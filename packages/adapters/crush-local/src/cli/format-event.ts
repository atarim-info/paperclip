import pc from "picocolors";

export function printCrushStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trimEnd();
  if (!line.trim()) return;
  console.log(pc.green(line));
}
