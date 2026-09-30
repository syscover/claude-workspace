# claude-monitor

A terminal dashboard of the Claude Code sessions running on this Mac. It shows which session works, which one waits for you, and where each one works. Press `Enter` on a session to jump to its Ghostty tab.

```
┌──────────────────────────────────────────────────────────────────────┐
│     STATUS   SESSION          WAITING FOR         LOCATION           │
│──────────────────────────────────────────────────────────────────────│
│› ○  idle     T-127                                aurora-catalyst    │
│  ●  waiting  T-221            permission prompt   ⎇ task+T-221       │
│  ✢  busy     T-132                                ⎇ T-132/backend    │
└──────────────────────────────────────────────────────────────────────┘
1–3 of 7 · ↑/↓ select · enter focus · q quit
```

The repository also ships `claude-workspace`, which opens the monitor and the Backlog.md board in two stacked Ghostty windows.

## Requirements

- macOS.
- Node.js 22 or later, and pnpm.
- Claude Code with the `claude agents --json` command.
- Ghostty, for the focus action and for `claude-workspace`. The rest of the monitor works in any terminal.
- `claude-workspace` only: Backlog.md (`backlog` on the `PATH`), and Accessibility permission for Ghostty in System Settings → Privacy & Security → Accessibility.

## Installation

```bash
pnpm install
pnpm build
ln -sf "$PWD/dist/cli.js" ~/.local/bin/claude-monitor
ln -sf "$PWD/bin/claude-workspace" ~/.local/bin/claude-workspace
```

`~/.local/bin` must be on the `PATH`. After a code change, run `pnpm build` again: the link points to `dist/`.

## claude-monitor

```bash
claude-monitor
```

The app opens in the alternate screen, like `vim` or `less`, and fills the whole terminal. When you quit, the terminal shows its previous content again.

### Keys

| Key | Action |
| --- | --- |
| `↑` / `↓` or `k` / `j` | Select a session |
| `Enter` | Focus the Ghostty tab of the selected session |
| `q` | Quit |

### Columns

| Column | Content |
| --- | --- |
| STATUS | `idle` (finished, waits for your next message), `waiting` (stopped until you answer, for example a permission prompt) or `busy` (working, animated spinner) |
| SESSION | The session name. Use `claude -n <name>` or `/rename` to give it a useful one |
| WAITING FOR | Why a `waiting` session stopped |
| LOCATION | The folder where the session works now. `⎇ name` is a worktree under `.claude/worktrees/`; otherwise the folder name |

The list shows `idle` first, then `waiting`, then `busy`: the sessions that need you are at the top. The selection follows the session, not the row, so a reorder does not move it to another session.

When the sessions do not fit, the table scrolls with the selection and the help line shows the visible range, for example `1–6 of 9`. The table needs 5 fixed rows (borders, titles, separator and help line); the rest are sessions.

### Notifications

When a session changes to `waiting` or to `idle`, macOS shows a notification with a sound. The sessions found at startup do not notify.

## claude-workspace

```bash
claude-workspace [board-folder]
```

It opens two Ghostty windows on the screen of the frontmost Ghostty window:

- the monitor at the top, with a fixed height;
- `backlog board` below it, in the rest of the usable height.

| Option | Default | Meaning |
| --- | --- | --- |
| `board-folder` | `/Users/carlos/Projects/aurora/aurora-catalyst` | Project whose Backlog.md board opens |
| `MONITOR_HEIGHT` | `228` | Height of the monitor window in points |

The default height fits 6 sessions with the current Ghostty font. If you change the font size, measure again:

```bash
MONITOR_HEIGHT=250 claude-workspace
```

## How it works

- **Sessions.** `claude agents --json` gives the status, the name and the process of each interactive session, in about 0.15 s. The monitor reads it every 1.5 s.
- **Real folder.** `claude agents` reports the folder where the session started, not the current one. A `cd` into a worktree only shows in the session transcript, so the monitor reads the last `cwd` from `~/.claude/projects/<encoded start folder>/<sessionId>.jsonl`. The folder updates when the session writes to its transcript.
- **Focus.** `ps` gives the `tty` of the session process; Ghostty's AppleScript finds the terminal with that `tty` and focuses it. `src/ghostty.ts` is the only terminal-specific file: another terminal needs only a new version of it.
- **Workspace.** Ghostty opens the windows; System Events moves them, because Ghostty's AppleScript does not expose window position. macOS can push a window below a menu bar that `visibleFrame` does not report, so the script reads where the monitor really landed and puts the board right below it.

A Ghostty split would keep both panes in one window, but Ghostty resizes splits proportionally: the monitor would stop showing exactly 6 sessions when the window changes size. That is why the workspace uses two windows.

## Development

```bash
pnpm dev     # run from source with tsx
pnpm test    # vitest: layout, ordering, transitions, real-folder parsing
pnpm build   # compile to dist/
```

| File | Role |
| --- | --- |
| `src/sessions.ts` | Reads sessions, real folders and terminals; ordering and state transitions |
| `src/layout.ts` | Column widths for the terminal width, and the scroll window |
| `src/ghostty.ts` | Focuses a Ghostty terminal by `tty` |
| `src/notify.ts` | macOS notifications |
| `src/app.tsx`, `src/cli.tsx` | The Ink interface |
| `bin/claude-workspace` | Window launcher |
