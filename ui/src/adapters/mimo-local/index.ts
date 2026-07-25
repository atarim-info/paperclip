import type { UIAdapterModule } from "../types";
import { parseMimoStdoutLine, buildMimoLocalConfig } from "@paperclipai/adapter-mimo-local/ui";
import { MimoLocalConfigFields } from "./config-fields";

export const mimoLocalUIAdapter: UIAdapterModule = {
  type: "mimo_local",
  label: "MiMo (local)",
  parseStdoutLine: parseMimoStdoutLine,
  ConfigFields: MimoLocalConfigFields,
  buildAdapterConfig: buildMimoLocalConfig,
};
