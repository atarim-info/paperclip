import pc from "picocolors";
import { parseFreebuffEvent } from "../events.js";

/** Renders one adapter event for `paperclipai run --watch`. */
export function printFreebuffStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trimEnd();
  if (!line.trim()) return;
  const event = parseFreebuffEvent(line);
  if (!event) {
    if (debug) console.log(pc.dim(line));
    return;
  }
  switch (event.t) {
    case "status":
      console.log(pc.dim(`· ${event.message}`));
      return;
    case "text":
      console.log(event.thinking ? pc.dim(event.text) : pc.green(event.text));
      return;
    case "tool":
      console.log(pc.cyan(`⚒ ${event.tool}`));
      return;
    case "agent":
      console.log(pc.magenta(`◆ ${event.agent}${event.status ? ` (${event.status})` : ""}`));
      return;
    case "ask":
      console.log(pc.yellow(`? ${event.text ?? "Freebuff asked the user a question."}`));
      return;
    case "mode":
      console.log(pc.dim(`— ${event.mode}`));
      return;
  }
}
