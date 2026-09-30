import { describe, expect, it } from 'vitest';
import { lastCwd, locationLabel, sortSessions, transcriptPath, transitions, type Session } from './sessions.js';

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
