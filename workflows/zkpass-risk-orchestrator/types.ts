// workflows/zkpass-borrow-risk/types.ts
import { z } from "zod";

/*********************************
 * Config schema
 *********************************/
const evmConfigSchema = z.object({
  chainSelectorName: z.string().min(1),
  borrowGateAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, "borrowGateAddress must be a 20-byte 0x hex"),
  receiverAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, "receiverAddress must be a 20-byte 0x hex"),
  gasLimit: z
    .string()
    .regex(/^\d+$/u, "gasLimit must be a numeric string")
    .refine((v) => Number(v) > 0, { message: "gasLimit must be > 0" }),
});

const decisionPolicySchema = z.object({
  fearGreedMin: z.number().int().min(0).max(100),
  minHfAfter1e18: z.string().regex(/^\d+$/u),
  maxLtvAfterBps: z.number().int().min(0).max(10_000),
  maxBorrowAmount: z.string().regex(/^\d+$/u),
});

export const configSchema = z.object({
  geminiModel: z.string().min(1),
  riskApiUrl: z.string().url(),
  decisionPolicy: decisionPolicySchema,
  evms: z.array(evmConfigSchema).min(1),
});

export type Config = z.infer<typeof configSchema>;

/*********************************
 * Onchain BorrowRequest tuple
 * (must match BorrowGate.getBorrowRequest ABI)
 *********************************/
export type BorrowRequestData = {
  borrower: `0x${string}`;
  asset: `0x${string}`;
  amount: bigint;
  nullifier: bigint;
  collateralValue: bigint;
  debtValue: bigint;
  hfAfter1e18: bigint;
  ltvAfterBps: number; // uint16
};

/*********************************
 * Risk policy outputs
 *********************************/
export enum ReasonCode {
  OK_APPROVED = 0,
  FEAR_GREED_TOO_LOW = 1,
  HF_TOO_LOW = 2,
  LTV_TOO_HIGH = 3,
  AMOUNT_TOO_HIGH = 4,
  OFFCHAIN_RISK_API_ERROR = 5,
  LLM_ERROR_OR_INVALID = 6,
  ONCHAIN_CONTEXT_MISMATCH = 7,
  INTERNAL_ERROR = 8,
}

export type GuardrailDecision = {
  approved: boolean;
  reason: ReasonCode;
};

/*********************************
 * Gemini structured output (advisory)
 *********************************/
export const GeminiAdvisorySchema = z.object({
  recommendation: z.enum(["APPROVE", "REJECT", "INCONCLUSIVE"]),
  riskScoreBp: z.number().int().min(0).max(10_000),
  primaryReasonCode: z.number().int().min(0).max(255),
});

export type GeminiAdvisory = z.infer<typeof GeminiAdvisorySchema>;

export type GeminiResponse = {
  statusCode: number;
  responseId: string;
  advisoryJson: string; // minified JSON string
};
