import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolves from both src/ (tsx) and dist/ (build), since both sit next to assets/.
const WHIP = fileURLToPath(new URL('../assets/whip.mp3', import.meta.url));

export function crackWhip(): void {
    execFile('afplay', [WHIP], () => {});
}
