# ATA-340: Application-service load testing verification
export function evaluateLoadTestSLA(agent: Agent, context: ExecutionContext): EvaluationResult {
  try {
    const h95 = computePercentile(agent.loads, 95);
    const h99 = computePercentile(agent.loads, 99);

    return h95 < 10 && h99 < 10 ? EvaluationResult.PASS : EvaluationResult.WARNING;
  } catch (err) {
    return EvaluationResult.ERROR;
  }
}
