import type { ServerAdapterModule, AdapterExecutionResult, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";

export const type = "mimo_local";
export const label = "Mimo (local)";

export const models: Array<{ id: string; label: string }> = [
  { id: "mimo/mimo-auto", label: "Mimo Auto" },
  { id: "xiaomi/mimo-v2-flash", label: "Mimo V2 Flash" },
  { id: "xiaomi/mimo-v2-pro", label: "Mimo V2 Pro" },
  { id: "xiaomi/mimo-v2.5-pro", label: "Mimo V2.5 Pro" },
];

export const agentConfigurationDoc = `# mimo_local agent configuration

Adapter: mimo_local

Use when:
- You want Paperclip to run Mimo locally as the agent runtime

Core fields:
- model (string, required): Mimo model id
- command (string, optional): defaults to "mimo"
`;

export function createServerAdapter(): ServerAdapterModule {
  return {
    type: "mimo_local",
    execute: async (ctx): Promise<AdapterExecutionResult> => {
      const { spawn } = await import("child_process");
      const command = String(ctx.config.command ?? "mimo");
      const model = String(ctx.config.model ?? "mimo/mimo-auto");
      const prompt = String(ctx.context.prompt ?? "");
      const args = ["run", "--model", model, prompt];

      return new Promise((resolve) => {
        const proc = spawn(command, args, {
          cwd: String(ctx.context.cwd ?? process.cwd()),
          env: { ...process.env, ...(ctx.config.env as Record<string, string> ?? {}) },
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on("close", (code: number | null) => {
          resolve({
            exitCode: code ?? 1,
            signal: null,
            timedOut: false,
          });
        });

        proc.on("error", (err: Error) => {
          resolve({
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage: err.message,
          });
        });
      });
    },
    testEnvironment: async (): Promise<AdapterEnvironmentTestResult> => {
      const { execSync } = await import("child_process");
      try {
        execSync("mimo --version", { encoding: "utf-8", timeout: 5000 });
        return {
          adapterType: "mimo_local",
          status: "pass",
          checks: [],
          testedAt: new Date().toISOString(),
        };
      } catch {
        return {
          adapterType: "mimo_local",
          status: "fail",
          checks: [],
          testedAt: new Date().toISOString(),
        };
      }
    },
  };
}
