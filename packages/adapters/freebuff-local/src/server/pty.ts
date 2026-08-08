import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { DEFAULT_PTY_LAUNCHER } from "../config.js";

/**
 * Runs Freebuff inside a pseudo-terminal.
 *
 * Freebuff has no headless mode — it opens a full-screen TUI even when stdin is
 * a pipe — so the only way to drive it is to give it a real terminal and type
 * into it. We allocate that terminal with util-linux `script(1)`:
 *
 *   script -qec "freebuff --cwd <workdir>" /dev/null
 *
 * `script` is chosen over `node-pty` deliberately: it needs no native module in
 * the server or the sandbox images. The cost is coarse control (no window
 * resize, exit codes come from `script` rather than Freebuff), which is
 * acceptable because we never read the screen — the transcript comes from
 * Freebuff's on-disk chat store. This module only has to keep a terminal alive
 * and deliver keystrokes.
 *
 * The PTY's output is counted, not parsed. Byte volume is the one useful
 * signal it carries: a TUI that painted almost nothing never reached an input
 * box.
 */

export interface FreebuffPtyOptions {
  command: string;
  cwd: string;
  env: Record<string, string>;
  /** PTY allocator; defaults to util-linux `script(1)`. */
  ptyLauncher?: string;
  columns?: number;
  rows?: number;
}

export interface FreebuffPtyHandle {
  pid: number;
  /** Bytes the TUI has painted so far. */
  bytesPainted(): number;
  exited(): boolean;
  exitInfo(): { code: number | null; signal: string | null };
  /** Type text into the terminal, optionally wrapped in bracketed paste. */
  write(text: string): void;
  /** Submit the current input (carriage return, as a terminal sends it). */
  submit(): void;
  /** Ctrl-C, then SIGTERM/SIGKILL to the whole process group. */
  dispose(): Promise<void>;
}

/**
 * Bracketed paste framing. Freebuff's input box may treat a bare newline inside
 * a multi-line prompt as "submit"; wrapping the text tells the terminal the
 * whole block is pasted content, which well-behaved TUIs insert verbatim.
 */
export function bracketPaste(text: string): string {
  return `\x1b[200~${text}\x1b[201~`;
}

export function ptyLauncherOf(options: FreebuffPtyOptions): string {
  return options.ptyLauncher?.trim() || DEFAULT_PTY_LAUNCHER;
}

export function buildPtyArgv(options: FreebuffPtyOptions): string[] {
  return ["-qec", `${options.command} --cwd ${JSON.stringify(options.cwd)}`, "/dev/null"];
}

export function spawnFreebuffPty(options: FreebuffPtyOptions): FreebuffPtyHandle {
  const child: ChildProcessWithoutNullStreams = spawn(ptyLauncherOf(options), buildPtyArgv(options), {
    stdio: ["pipe", "pipe", "pipe"],
    detached: true, // own process group, so dispose() can reap the whole tree
    env: {
      ...options.env,
      TERM: options.env.TERM ?? "xterm-256color",
      COLUMNS: String(options.columns ?? 200),
      LINES: String(options.rows ?? 50),
    },
  }) as ChildProcessWithoutNullStreams;

  let painted = 0;
  let exited = false;
  let exitCode: number | null = null;
  let exitSignal: string | null = null;

  child.stdout.on("data", (chunk: Buffer) => {
    painted += chunk.length;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    painted += chunk.length;
  });
  child.on("exit", (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
  });
  child.on("error", () => {
    exited = true;
  });

  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-child.pid!, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // already gone
      }
    }
  };

  return {
    pid: child.pid ?? -1,
    bytesPainted: () => painted,
    exited: () => exited,
    exitInfo: () => ({ code: exitCode, signal: exitSignal }),
    write(text: string) {
      if (exited) return;
      try {
        child.stdin.write(text);
      } catch {
        // The TUI closed underneath us; the watcher notices via exited().
      }
    },
    submit() {
      if (exited) return;
      try {
        child.stdin.write("\r");
      } catch {
        // as above
      }
    },
    async dispose() {
      if (!exited) {
        try {
          child.stdin.write("\x03"); // Ctrl-C
        } catch {
          // ignore
        }
        await delay(500);
        killGroup("SIGTERM");
        await delay(1500);
        if (!exited) killGroup("SIGKILL");
      }
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
