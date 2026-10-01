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

interface Process {
    ppid: number;
    tty: string | undefined;
    command: string;
}

export function parseProcesses(psOutput: string): Map<number, Process> {
    const table = new Map<number, Process>();
    for (const line of psOutput.split('\n')) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
        if (!match) continue;
        const [, pid, ppid, tty, command] = match;
        table.set(Number(pid), { ppid: Number(ppid), tty: tty === '??' ? undefined : `/dev/${tty}`, command });
    }
    return table;
}

// A background session runs in a pty of the Claude daemon; the user's tab is the
// process that started the daemon, which the daemon names in `--spawned-by`.
const SPAWNED_BY = /--spawned-by \{.*?"pid":(\d+)/;

/** Terminal to focus for a session: its own tty, or the tab that started its daemon. */
export function focusTty(entry: Pick<AgentEntry, 'kind' | 'pid'>, table: ReadonlyMap<number, Process>): string | undefined {
    if (!entry.pid) return undefined;
    if (entry.kind !== 'background') return table.get(entry.pid)?.tty;
    for (let pid = entry.pid, proc = table.get(pid); proc; pid = proc.ppid, proc = table.get(pid)) {
        const spawner = proc.command.match(SPAWNED_BY)?.[1];
        if (spawner) return table.get(Number(spawner))?.tty;
    }
    return undefined;
}

async function readProcesses(): Promise<Map<number, Process>> {
    const { stdout } = await run('ps', ['-A', '-ww', '-o', 'pid=,ppid=,tty=,command=']).catch(() => ({ stdout: '' }));
    return parseProcesses(stdout);
}

export async function readSessions(): Promise<Session[]> {
    const { stdout } = await run('claude', ['agents', '--json']);
    // Only live sessions report a status; finished background jobs do not.
    const entries = (JSON.parse(stdout) as AgentEntry[]).filter((e) => e.status);
    const processes = await readProcesses();

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
                tty: focusTty(e, processes),
            };
        }),
    );
    return sortSessions(sessions);
}
