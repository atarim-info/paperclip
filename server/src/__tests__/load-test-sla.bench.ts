import { bench, describe } from "vitest";
import { normalizeExperimentalSettings, normalizeGeneralSettings } from "../services/instance-settings.js";

// Synchronous benchmarks for the Zod-based flag evaluation normalization

describe("normalizeExperimentalSettings (sync)", () => {
  const fullPayload = {
    enableEnvironments: true,
    enableIsolatedWorkspaces: true,
    enableStreamlinedLeftNavigation: false,
    enableConferenceRoomChat: true,
    enableIssuePlanDecompositions: true,
    enableExperimentalFileViewer: true,
    enableCloudSync: false,
    autoRestartDevServerWhenIdle: false,
    enableIssueGraphLivenessAutoRecovery: true,
    issueGraphLivenessAutoRecoveryLookbackHours: 48,
  };

  bench("empty input (cold start defaults)", () => {
    normalizeExperimentalSettings(undefined);
  });

  bench("partial input (single flag)", () => {
    normalizeExperimentalSettings({ enableConferenceRoomChat: true });
  });

  bench("full payload (all flags)", () => {
    normalizeExperimentalSettings(fullPayload);
  });

  bench("legacy payload with unknown keys", () => {
    normalizeExperimentalSettings({
      ...fullPayload,
      retiredFlagA: true,
      retiredFlagB: "yes",
      retiredFlagC: 42,
    });
  });
});

describe("normalizeGeneralSettings (sync)", () => {
  bench("empty input", () => {
    normalizeGeneralSettings(undefined);
  });

  bench("partial input", () => {
    normalizeGeneralSettings({ keyboardShortcuts: true });
  });

  bench("full payload", () => {
    normalizeGeneralSettings({
      censorUsernameInLogs: true,
      keyboardShortcuts: true,
      feedbackDataSharingPreference: "allowed",
      backupRetention: 30,
    });
  });
});
