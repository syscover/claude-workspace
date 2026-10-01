import { describe, expect, it } from 'vitest';
import {
    focusTty,
    lastCwd,
    locationLabel,
    parseProcesses,
    sortSessions,
    transcriptPath,
    transitions,
    type Session,
} from './sessions.js';

const repo = '/Users/me/Projects/app';

const session = (over: Partial<Session>): Session => ({
    sessionId: 'id',
    name: 'name',
    status: 'busy',
    waitingFor: undefined,
    launchDir: repo,
    dir: repo,
    tty: undefined,
    ...over,
});

describe('locationLabel', () => {
    it('marks a worktree with its name and subfolder', () => {
        expect(locationLabel(repo, `${repo}/.claude/worktrees/T-132/backend`)).toBe('⎇ T-132/backend');
    });

    it('shows the launch folder name and the subfolder inside it', () => {
        expect(locationLabel(repo, repo)).toBe('app');
        expect(locationLabel(repo, `${repo}/backend`)).toBe('app/backend');
    });

    it('does not treat a sibling folder with the same prefix as inside the launch folder', () => {
        expect(locationLabel(repo, '/Users/me/Projects/app-docs')).toBe('app-docs');
    });

    it('shows only the last segment of a folder outside the launch folder', () => {
        expect(locationLabel(repo, '/private/tmp/scratchpad/ctrl')).toBe('ctrl');
    });
});

describe('transcriptPath', () => {
    it('encodes slashes and dots of the launch folder as dashes', () => {
        expect(transcriptPath('/home/me', '/Users/me/.x/app', 'abc')).toBe(
            '/home/me/.claude/projects/-Users-me--x-app/abc.jsonl',
        );
    });
});

describe('lastCwd', () => {
    it('returns the cwd of the last entry that has one', () => {
        const text = ['{"cwd":"/a"}', '{"cwd":"/b"}', '{"type":"system"}', ''].join('\n');
        expect(lastCwd(text)).toBe('/b');
    });

    it('ignores a truncated first line and returns undefined without cwd', () => {
        expect(lastCwd('d":"/cut"}\n{"type":"x"}')).toBeUndefined();
    });
});

describe('sortSessions', () => {
    it('puts idle first, then waiting, then busy, each group by name', () => {
        const sorted = sortSessions([
            session({ name: 'b', status: 'busy' }),
            session({ name: 'w', status: 'waiting' }),
            session({ name: 'z', status: 'idle' }),
            session({ name: 'a', status: 'idle' }),
        ]);
        expect(sorted.map((s) => s.name)).toEqual(['a', 'z', 'w', 'b']);
    });
});

describe('transitions', () => {
    it('reports sessions that changed to waiting or idle', () => {
        const previous = new Map([
            ['1', 'busy'],
            ['2', 'busy'],
            ['3', 'idle'],
        ] as const);
        const current = [
            session({ sessionId: '1', status: 'waiting' }),
            session({ sessionId: '2', status: 'idle' }),
            session({ sessionId: '3', status: 'busy' }),
        ];
        expect(transitions(previous, current).map((s) => s.sessionId)).toEqual(['1', '2']);
    });

    it('stays silent for a session it has not seen before', () => {
        expect(transitions(new Map(), [session({ status: 'idle' })])).toEqual([]);
    });
});

describe('parseProcesses', () => {
    it('reads pid, parent, tty and command, and drops the tty of a process without one', () => {
        const table = parseProcesses(['  90645 15324 ttys010  claude', '24182 90645 ??       claude daemon run', ''].join('\n'));
        expect(table.get(90645)).toEqual({ ppid: 15324, tty: '/dev/ttys010', command: 'claude' });
        expect(table.get(24182)).toEqual({ ppid: 90645, tty: undefined, command: 'claude daemon run' });
    });
});

describe('focusTty', () => {
    const table = parseProcesses(
        [
            '90645 15324 ttys010  claude',
            '24182 90645 ??       claude daemon run --origin transient --spawned-by {"label":"claude","cwd":"/a b","pid":90645}',
            '24222 24182 ??       claude --bg-pty-host /tmp/pty.sock',
            '24513 24222 ttys009  claude --session-id x --fork-session --resume /t.jsonl',
            '50000 1     ttys002  claude',
        ].join('\n'),
    );

    it('uses the tty of an interactive session', () => {
        expect(focusTty({ kind: 'interactive', pid: 50000 }, table)).toBe('/dev/ttys002');
    });

    it('follows a background session up to the terminal that spawned its daemon', () => {
        expect(focusTty({ kind: 'background', pid: 24513 }, table)).toBe('/dev/ttys010');
    });

    it('has no tty when the spawner is gone or the session has no process', () => {
        const orphan = parseProcesses('24182 1 ?? claude daemon run --spawned-by {"pid":999}\n24513 24182 ttys009 claude');
        expect(focusTty({ kind: 'background', pid: 24513 }, orphan)).toBeUndefined();
        expect(focusTty({ kind: 'background' }, table)).toBeUndefined();
    });
});
