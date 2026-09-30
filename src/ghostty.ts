import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The only terminal-specific piece: another emulator needs only a new version of this function.
// The tty travels as an argument, never inside the script text.
const FOCUS_SCRIPT = [
    'on run argv',
    'tell application "Ghostty"',
    'focus (first terminal whose tty is (item 1 of argv))',
    'end tell',
    'end run',
];

export async function focusTerminal(tty: string): Promise<void> {
    await run('osascript', [...FOCUS_SCRIPT.flatMap((line) => ['-e', line]), tty]);
}
