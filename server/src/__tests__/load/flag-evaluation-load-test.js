import { sleep, check, group } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const flagEvalDur = new Trend("flag_eval_duration");
const flagEvalErrors = new Rate("flag_eval_errors");

const BASE_URL = __ENV.K6_BASE_URL || "http://127.0.0.1:3100";

export const options = {
  stages: [
    { duration: "10s", target: 5 },
    { duration: "20s", target: 25 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    flag_eval_duration: ["p(99)<10"],
    flag_eval_errors: ["rate<0.01"],
  },
};

export default function () {
  group("flag evaluation: get experimental settings", () => {
    const res = http.get(`${BASE_URL}/api/instance/settings/experimental`, {
      headers: { "Content-Type": "application/json" },
    });
    check(res, {
      "status is 200": (r) => r.status === 200,
    });
    flagEvalDur.add(res.timings.duration);
    flagEvalErrors.add(res.status !== 200);
    sleep(0.1);
  });
}
