export function buildGeminiPrompt(params: {
  fearGreed: number;
  hfNowE18: bigint;
  hfAfterE18: bigint;
  ltvBpsAfter: number;
  borrowAmountWei: bigint;
}): string {
  return [
    "You are a deterministic risk scoring function.",
     "Return STRICT JSON only.",
  "No markdown, no code fences, no prose, no keys outside schema.",
  "Output must be a single JSON object and nothing else.",
  "",
  "Schema:",
  '{ "riskScoreBp": number }',
    "",
    "Inputs:",
    `fearGreed=${params.fearGreed}`,
    `hfNowE18=${params.hfNowE18.toString()}`,
    `hfAfterE18=${params.hfAfterE18.toString()}`,
    `ltvBpsAfter=${params.ltvBpsAfter}`,
    `borrowAmountWei=${params.borrowAmountWei.toString()}`,
    "",
    "Rules:",
    "- riskScoreBp must be an integer in [0,10000].",
    "- Higher score = higher risk.",
  ].join("\n");
}