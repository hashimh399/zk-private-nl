export function decideBorrow(params: {
  fearGreed: number;
  minFearGreed: number;
  hfAfter: bigint;
  minHfAfter: bigint;
  ltvBps: number;
  maxLtvBps: number;
  reqAmount: bigint;
  maxBorrowAmount: bigint;
}): { approved: boolean; reasonCode: number } {
  let approved = true;
  let reasonCode = 0;

  if (params.fearGreed < 0) {
    approved = false;
    reasonCode = 5; // risk API failed
  } else if (params.fearGreed < params.minFearGreed) {
    approved = false;
    reasonCode = 1;
  } else if (params.hfAfter < params.minHfAfter) {
    approved = false;
    reasonCode = 2;
  } else if (BigInt(params.ltvBps) > BigInt(params.maxLtvBps)) {
    approved = false;
    reasonCode = 3;
  } else if (params.reqAmount > params.maxBorrowAmount) {
    approved = false;
    reasonCode = 4;
  }

  return { approved, reasonCode };
}