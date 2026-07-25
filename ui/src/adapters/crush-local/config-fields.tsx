import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.";

export function CrushLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  return (
    <>
      {!hideInstructionsFile && (
        <Field label="Agent instructions file" hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? values!.instructionsFilePath ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark("adapterConfig", "instructionsFilePath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}
      <Field label="Model" hint="Crush model id (model or provider/model). Leave blank to use Crush's configured default.">
        <DraftInput
          value={isCreate ? (values!.model ?? "") : eff("adapterConfig", "model", String(config.model ?? ""))}
          onCommit={(v) => (isCreate ? set!({ model: v }) : mark("adapterConfig", "model", v || undefined))}
          immediate
          className={inputClass}
          placeholder="anthropic/claude-sonnet-4-5-20250929"
        />
      </Field>
      <Field label="Small model" hint="Optional auxiliary model passed as --small-model.">
        <DraftInput
          value={isCreate ? ((values as { smallModel?: string }).smallModel ?? "") : eff("adapterConfig", "smallModel", String(config.smallModel ?? ""))}
          onCommit={(v) => (isCreate ? set!({ smallModel: v } as never) : mark("adapterConfig", "smallModel", v || undefined))}
          immediate
          className={inputClass}
          placeholder="anthropic/claude-haiku-4-5-20251001"
        />
      </Field>
    </>
  );
}
