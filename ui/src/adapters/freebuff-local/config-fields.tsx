import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

/**
 * Freebuff takes no model or extra CLI arguments — it has only `--cwd` and
 * `--continue` — so the form covers the binary, the run ceiling, and the PTY
 * timing knobs that govern typing the prompt into its TUI.
 */
export function FreebuffLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field
        label="Freebuff command"
        hint="Path to the freebuff binary. Must be logged in already (`freebuff login`) — Freebuff's login is interactive and a run cannot complete it."
      >
        <DraftInput
          value={isCreate ? (values!.command ?? "") : eff("adapterConfig", "command", String(config.command ?? ""))}
          onCommit={(v) => (isCreate ? set!({ command: v }) : mark("adapterConfig", "command", v || undefined))}
          immediate
          className={inputClass}
          placeholder="freebuff"
        />
      </Field>
      <Field
        label="Run timeout (seconds)"
        hint="Hard ceiling for the whole run. Free-tier sessions last an hour, so a longer timeout will not save a run that outlives its session."
      >
        <DraftInput
          value={
            isCreate
              ? String((values as { timeoutSec?: unknown }).timeoutSec ?? "")
              : eff("adapterConfig", "timeoutSec", String(config.timeoutSec ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ timeoutSec: v } as never)
              : mark("adapterConfig", "timeoutSec", v ? Number(v) : undefined)
          }
          immediate
          className={inputClass}
          placeholder="1800"
        />
      </Field>
      <Field
        label="Prompt delay (ms)"
        hint="How long to let Freebuff's UI settle after it starts before typing the prompt into it. Raise this if runs fail with freebuff_prompt_not_accepted."
      >
        <DraftInput
          value={
            isCreate
              ? String((values as { promptDelayMs?: unknown }).promptDelayMs ?? "")
              : eff("adapterConfig", "promptDelayMs", String(config.promptDelayMs ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ promptDelayMs: v } as never)
              : mark("adapterConfig", "promptDelayMs", v ? Number(v) : undefined)
          }
          immediate
          className={inputClass}
          placeholder="6000"
        />
      </Field>
    </>
  );
}
