import type { UIAdapterModule } from "../types";
import { parseKiloStdoutLine, buildKiloLocalConfig } from "@paperclipai/adapter-kilocode-local/ui";
import { KiloLocalConfigFields } from "./config-fields";

export const kilocodeLocalUIAdapter: UIAdapterModule = {
  type: "kilocode_local",
  label: "Kilo Code (local)",
  parseStdoutLine: parseKiloStdoutLine,
  ConfigFields: KiloLocalConfigFields,
  buildAdapterConfig: buildKiloLocalConfig,
};
