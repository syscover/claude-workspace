# claude-workspace

A terminal workspace for Claude Code on macOS, with two commands:

- `claude-monitor`: a live dashboard of the Claude Code sessions running on this Mac.
- `claude-workspace`: opens the monitor above the Backlog.md board in Ghostty.

## claude-monitor at a glance

The monitor shows which session works, which one waits for you, and where each one works. Press `Enter` on a session to jump to its Ghostty tab.

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

## Requirements

- macOS.
- Node.js 22 or later, and pnpm.
- Claude Code with the `claude agents --json` command.
- Ghostty, for the focus action and for `claude-workspace`. The rest of the monitor works in any terminal.
- `claude-workspace` only: Backlog.md (`backlog` on the `PATH`), and Accessibility permission for Ghostty in System Settings → Privacy & Security → Accessibility.

## Installation

Clone the repository, build it and link both commands into a folder on your `PATH`:

```bash
git clone https://github.com/syscover/claude-workspace.git
cd claude-workspace
pnpm install
pnpm build
mkdir -p ~/.local/bin
ln -sf "$PWD/dist/cli.js" ~/.local/bin/claude-monitor
ln -sf "$PWD/bin/claude-workspace" ~/.local/bin/claude-workspace
```

`~/.local/bin` must be on the `PATH`. If it is not, add this line to `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

To install a specific version, clone its tag, for example `git clone --branch v0.3.0 …`. The versions are listed on the [tags page](https://github.com/syscover/claude-workspace/tags).

### Update

```bash
cd claude-workspace
git pull
pnpm install
pnpm build
```

The links point into the clone, so the commands use the new version right after the build. The same applies after a local code change: run `pnpm build` again.

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
claude-workspace [-w|--window] [board-folder]
```

It opens the monitor at the top, with a fixed height, and `backlog board` below it, in the rest of the usable height. Both go on the screen of the frontmost Ghostty window.

| Option | Default | Meaning |
| --- | --- | --- |
| (none) | | Splits the terminal where you run it: the monitor runs in it, the board opens below. The window fills the usable screen. Quitting the monitor closes its pane |
| `-w`, `--window` | | Two new separate windows, stacked. Works outside a terminal too, for example from a launcher |
| `board-folder` | `/Users/carlos/Projects/aurora/aurora-catalyst` | Project whose Backlog.md board opens |
| `MONITOR_HEIGHT` | `228` | Height of the monitor in points, as a window with its title bar |

The split pane has no title bar, so it gets `MONITOR_HEIGHT` minus an estimated 28 pt title bar. In both modes the default height fits 6 sessions with the current Ghostty font. If you change the font size, measure again:

```bash
MONITOR_HEIGHT=250 claude-workspace
```

## How it works

- **Sessions.** `claude agents --json` gives the status, the name and the process of each interactive session, in about 0.15 s. The monitor reads it every 1.5 s.
- **Real folder.** `claude agents` reports the folder where the session started, not the current one. A `cd` into a worktree only shows in the session transcript, so the monitor reads the last `cwd` from `~/.claude/projects/<encoded start folder>/<sessionId>.jsonl`. The folder updates when the session writes to its transcript.
- **Focus.** `ps` gives the `tty` of the session process; Ghostty's AppleScript finds the terminal with that `tty` and focuses it. `src/ghostty.ts` is the only terminal-specific file: another terminal needs only a new version of it.
- **Workspace.** In split mode the script finds its own Ghostty terminal by its `tty`, splits it and then replaces itself with the monitor (`exec claude-monitor`). Ghostty opens the windows and creates the split; System Events moves the windows, because Ghostty's AppleScript does not expose window position. In `--window` mode, macOS can push the monitor below a menu bar that `visibleFrame` does not report, so the script reads where the monitor really landed and puts the board right below it.
- **Split versus windows.** Ghostty resizes splits proportionally. If you change the height of the split window, the monitor gains or loses rows and stops showing exactly 6 sessions. Separate windows keep the monitor height fixed.

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
