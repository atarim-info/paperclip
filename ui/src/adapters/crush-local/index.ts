import type { UIAdapterModule } from "../types";
import { parseCrushStdoutLine, buildCrushLocalConfig } from "@paperclipai/adapter-crush-local/ui";
import { CrushLocalConfigFields } from "./config-fields";

export const crushLocalUIAdapter: UIAdapterModule = {
  type: "crush_local",
  label: "Crush (local)",
  parseStdoutLine: parseCrushStdoutLine,
  ConfigFields: CrushLocalConfigFields,
  buildAdapterConfig: buildCrushLocalConfig,
};
