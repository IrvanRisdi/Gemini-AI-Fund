export const PAPER_FEE_PER_SIDE = 0.003;

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function orderedLimitBand(entry: number, atrValue: number, floor: number, ceiling: number) {
  const high = Math.min(ceiling, entry);
  const low = Math.min(high, Math.max(floor, high - atrValue * 0.3));
  return { low, high };
}

/**
 * Keep the stop far enough from 15-minute noise while bounding the maximum
 * loss per unit. The structural/ATR stop is retained when it already lies
 * inside the configured 3-5% risk band.
 */
export function stopForRiskBand(
  entry: number,
  structuralStop: number,
  atrValue: number,
  minimumRiskPct = 0.03,
  maximumRiskPct = 0.05,
) {
  const structuralRisk = Math.max(0, (entry - structuralStop) / entry);
  const atrRisk = Math.max(0, atrValue / entry);
  const riskPct = clamp(Math.max(structuralRisk, atrRisk), minimumRiskPct, maximumRiskPct);
  return entry * (1 - riskPct);
}

/**
 * Solve the target from NET reward/risk after both entry and exit fees:
 * net reward >= multiple * net loss.
 */
export function targetForNetReward(
  entry: number,
  stop: number,
  multiple = 1.5,
  feePerSide = PAPER_FEE_PER_SIDE,
) {
  const netLossPerUnit = (entry - stop) + feePerSide * (entry + stop);
  return (entry * (1 + feePerSide) + multiple * netLossPerUnit) / (1 - feePerSide);
}

export function netRewardRisk(
  entry: number,
  stop: number,
  target: number,
  feePerSide = PAPER_FEE_PER_SIDE,
) {
  const netReward = (target - entry) - feePerSide * (entry + target);
  const netRisk = (entry - stop) + feePerSide * (entry + stop);
  return { netReward, netRisk, multiple: netRisk > 0 ? netReward / netRisk : 0 };
}

export function validNetPlan(entry: number, stop: number, target: number, minimumMultiple = 1.5) {
  if (!(stop > 0 && entry > stop && target > entry)) return false;
  const plan = netRewardRisk(entry, stop, target);
  return plan.netReward > 0 && plan.multiple >= minimumMultiple - 1e-9;
}
