import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { focusTerminal } from './ghostty.js';
import { fitColumns, scrollOffset, type ColumnSize } from './layout.js';
import { notify } from './notify.js';
import { crackWhip } from './whip.js';
import { locationLabel, readSessions, transitions, type Session, type Status } from './sessions.js';

const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const SPINNER_MS = 150;
const REFRESH_MS = 1500;

const MARKER_WIDTH = 5;
const BORDER_WIDTH = 2;
// Top and bottom border, titles, separator and the help line.
const CHROME_ROWS = 5;
const COLUMNS: (ColumnSize & { title: string; value: (s: Session) => string })[] = [
    { title: 'STATUS', width: 9, value: (s) => s.status },
    { title: 'SESSION', grow: 1, value: (s) => s.name },
    { title: 'WAITING FOR', width: 20, value: (s) => s.waitingFor ?? '' },
    { title: 'LOCATION', grow: 1, value: (s) => locationLabel(s.launchDir, s.dir) },
];

function Icon({ status, frame }: { status: Status; frame: number }) {
    if (status === 'busy') return <Text color="yellow">{SPINNER[frame % SPINNER.length]}</Text>;
    if (status === 'waiting') return <Text color="red">●</Text>;
    return <Text color="green">○</Text>;
}

export function App() {
    const { exit } = useApp();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedId, setSelectedId] = useState<string>();
    const [frame, setFrame] = useState(0);
    const [message, setMessage] = useState<string>();
    const lastStatus = useRef(new Map<string, Status>());
    const offset = useRef(0);
    const { columns, rows } = useWindowSize();
    const rowWidth = Math.max(0, columns - BORDER_WIDTH);
    const widths = fitColumns(COLUMNS, rowWidth - MARKER_WIDTH);

    useEffect(() => {
        const timer = setInterval(() => setFrame((f) => f + 1), SPINNER_MS);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let active = true;
        const refresh = async () => {
            try {
                const current = await readSessions();
                if (!active) return;
                for (const s of transitions(lastStatus.current, current)) {
                    notify(`Claude Code · ${s.name}`, s.status === 'waiting' ? `Waiting: ${s.waitingFor ?? 'input'}` : 'Finished');
                }
                lastStatus.current = new Map(current.map((s) => [s.sessionId, s.status]));
                setSessions(current);
            } catch (error) {
                if (active) setMessage(`Cannot read sessions: ${(error as Error).message}`);
            }
        };
        refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);

    // The list reorders on every refresh, so the selection follows the session, not the row.
    const index = Math.max(0, sessions.findIndex((s) => s.sessionId === selectedId));
    const selected = sessions[index];

    const visible = Math.max(1, rows - CHROME_ROWS - (message ? 1 : 0));
    offset.current = scrollOffset({ previous: offset.current, selected: index, visible, total: sessions.length });
    const shown = sessions.slice(offset.current, offset.current + visible);
    const range = sessions.length > visible ? `${offset.current + 1}–${offset.current + shown.length} of ${sessions.length} · ` : '';

    useInput((input, key) => {
        if (input === 'q') exit();
        if (input === 'p') crackWhip();
        if (sessions.length === 0) return;
        if (key.upArrow || input === 'k') setSelectedId(sessions[Math.max(0, index - 1)].sessionId);
        if (key.downArrow || input === 'j') setSelectedId(sessions[Math.min(sessions.length - 1, index + 1)].sessionId);
        if (key.return && selected) {
            if (!selected.tty) return setMessage(`${selected.name} has no terminal`);
            focusTerminal(selected.tty).then(
                () => setMessage(undefined),
                (error: Error) => setMessage(`Cannot focus ${selected.name}: ${error.message}`),
            );
        }
    });

    return (
        // Filling the whole window makes Ink redraw from the top-left corner instead of the cursor row.
        <Box flexDirection="column" width={columns} height={rows}>
            {/* Colors follow Backlog.md: focused list border yellow, secondary lines gray, selection inverse + bold. */}
            <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="yellow">
                <Box>
                    <Box width={MARKER_WIDTH} flexShrink={0} />
                    {COLUMNS.map((c, i) => (
                        <Box key={c.title} width={widths[i]} flexShrink={0}>
                            <Text bold wrap="truncate">
                                {c.title}
                            </Text>
                        </Box>
                    ))}
                </Box>
                <Text color="gray">{'─'.repeat(rowWidth)}</Text>
                {shown.map((s) => {
                    const isSelected = s === selected;
                    return (
                        <Box key={s.sessionId}>
                            <Box width={MARKER_WIDTH} flexShrink={0}>
                                <Text color="cyan">{isSelected ? '› ' : '  '}</Text>
                                <Icon status={s.status} frame={frame} />
                            </Box>
                            {COLUMNS.map((c, i) => (
                                <Box key={c.title} width={widths[i]} flexShrink={0}>
                                    <Text inverse={isSelected} bold={isSelected} wrap="truncate">
                                        {c.value(s).padEnd(widths[i])}
                                    </Text>
                                </Box>
                            ))}
                        </Box>
                    );
                })}
            </Box>
            {message && <Text color="red">{message}</Text>}
            <Text dimColor wrap="truncate">{range}↑/↓ select · enter focus · p punish · q quit</Text>
        </Box>
    );
}
