import { execFile } from 'node:child_process';
import { open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type Status = 'busy' | 'waiting' | 'idle';

export interface Session {
    sessionId: string;
    name: string;
    status: Status;
    waitingFor: string | undefined;
    /** Folder where the session started; `claude agents` reports only this one. */
    launchDir: string;
    /** Folder where the session works now, read from its transcript. */
    dir: string;
    tty: string | undefined;
}

interface AgentEntry {
    kind: string;
    pid?: number;
    cwd: string;
    sessionId: string;
    name: string;
    status?: Status;
    waitingFor?: string;
}

const RANK: Record<Status, number> = { idle: 0, waiting: 1, busy: 2 };

// Enough to reach the last entry with a cwd, even after large tool outputs.
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;

export function transcriptPath(home: string, launchDir: string, sessionId: string): string {
    return `${home}/.claude/projects/${launchDir.replace(/[/.]/g, '-')}/${sessionId}.jsonl`;
}

export function lastCwd(transcriptTail: string): string | undefined {
    const lines = transcriptTail.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('"cwd"')) continue;
        try {
            const cwd = JSON.parse(lines[i]).cwd;
            if (typeof cwd === 'string') return cwd;
        } catch {
            // The first line of a tail is usually cut in half.
        }
    }
    return undefined;
}

export function locationLabel(launchDir: string, dir: string): string {
    const worktree = dir.split('/.claude/worktrees/')[1];
    if (worktree) return `⎇ ${worktree}`;
    const launchName = launchDir.split('/').at(-1);
    if (dir === launchDir) return launchName!;
    if (dir.startsWith(`${launchDir}/`)) return `${launchName}${dir.slice(launchDir.length)}`;
    return dir.split('/').at(-1)!;
}

export function sortSessions(sessions: Session[]): Session[] {
    return [...sessions].sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));
}

/** Sessions that moved to a state that asks for the user; unseen sessions stay silent. */
export function transitions(previous: ReadonlyMap<string, Status>, current: Session[]): Session[] {
    return current.filter((s) => {
        const before = previous.get(s.sessionId);
        return before !== undefined && before !== s.status && s.status !== 'busy';
    });
}

async function readTail(path: string): Promise<string | undefined> {
    try {
        const file = await open(path, 'r');
        try {
            const { size } = await file.stat();
            const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
            const buffer = Buffer.alloc(length);
            await file.read(buffer, 0, length, size - length);
            return buffer.toString('utf8');
        } finally {
            await file.close();
        }
    } catch {
        return undefined;
    }
}

async function ttysByPid(pids: number[]): Promise<Map<number, string>> {
    if (pids.length === 0) return new Map();
    const { stdout } = await run('ps', ['-o', 'pid=,tty=', '-p', pids.join(',')]).catch(() => ({ stdout: '' }));
    const ttys = new Map<number, string>();
    for (const line of stdout.split('\n')) {
        const [pid, tty] = line.trim().split(/\s+/);
        if (pid && tty && tty !== '??') ttys.set(Number(pid), `/dev/${tty}`);
    }
    return ttys;
}

export async function readSessions(): Promise<Session[]> {
    const { stdout } = await run('claude', ['agents', '--json']);
    const entries = (JSON.parse(stdout) as AgentEntry[]).filter((e) => e.kind === 'interactive' && e.status);
    const ttys = await ttysByPid(entries.flatMap((e) => (e.pid ? [e.pid] : [])));

    const sessions = await Promise.all(
        entries.map(async (e): Promise<Session> => {
            const tail = await readTail(transcriptPath(homedir(), e.cwd, e.sessionId));
            return {
                sessionId: e.sessionId,
                name: e.name,
                status: e.status!,
                waitingFor: e.waitingFor,
                launchDir: e.cwd,
                dir: (tail && lastCwd(tail)) ?? e.cwd,
                tty: e.pid ? ttys.get(e.pid) : undefined,
            };
        }),
    );
    return sortSessions(sessions);
}
