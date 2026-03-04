export function computeOptimalRepay(params: {
  collateralWei: bigint;
  debtWei: bigint;
  price18: bigint;
}): bigint {
  const { collateralWei, debtWei, price18 } = params;

  const collValue = (collateralWei * price18) / 10n ** 18n;

  // your current constants
  const numerator = (10200n * debtWei) - (8500n * collValue);

  let repay = 0n;
  if (numerator > 0n) repay = numerator / 1275n;

  if (repay > debtWei) repay = debtWei;
  return repay;
}