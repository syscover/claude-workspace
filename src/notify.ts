import { execFile } from 'node:child_process';

const NOTIFY_SCRIPT = [
    'on run argv',
    'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"',
    'end run',
];

export function notify(title: string, message: string): void {
    execFile('osascript', [...NOTIFY_SCRIPT.flatMap((line) => ['-e', line]), title, message], () => {});
}
