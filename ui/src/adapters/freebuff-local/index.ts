import type { UIAdapterModule } from "../types";
import { parseFreebuffStdoutLine, buildFreebuffLocalConfig } from "@paperclipai/adapter-freebuff-local/ui";
import { FreebuffLocalConfigFields } from "./config-fields";

export const freebuffLocalUIAdapter: UIAdapterModule = {
  type: "freebuff_local",
  label: "Freebuff (local)",
  parseStdoutLine: parseFreebuffStdoutLine,
  ConfigFields: FreebuffLocalConfigFields,
  buildAdapterConfig: buildFreebuffLocalConfig,
};
