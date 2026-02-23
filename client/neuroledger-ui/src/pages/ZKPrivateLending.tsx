"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, formatUnits, parseEventLogs } from "viem";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import WalletConnect from "@/components/WalletConnect";
import { MetricCard, CopyButton } from "@/components/shared";
import { CONTRACTS, etherscanTx, SEPOLIA_CHAIN_ID } from "@/config/contracts";
import {
  lendingPoolAbi,
  nlTokenAbi,
  borrowGateAbi,
  borrowApprovalRegistryAbi,
} from "@/config/abis";
import {
  ExternalLink,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

type Hex32 = `0x${string}`;

interface ProofData {
  amount: string;   // uint256 string
  root: Hex32;      // bytes32
  nullifier: Hex32; // bytes32
  nonce: string;    // uint256 string
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

interface ActivityItem {
  id: string;
  label: string;
  txHash?: string;
  timestamp: Date;
}

interface PersistedActivityItem {
  id: string;
  label: string;
  txHash?: string;
  timestamp: string;
}

function isBytes32(x?: string | null): x is Hex32 {
  return !!x && x.startsWith("0x") && x.length === 66;
}

function shortHex(x: string, n = 10) {
  if (!x) return "";
  return `${x.slice(0, n)}…${x.slice(-6)}`;
}

function safeSnippet(s: string, max = 140) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : one.slice(0, max) + "…";
}

export default function ZKPrivateLending() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  // flow states
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [proof, setProof] = useState<ProofData | null>(null);

  const [requestTx, setRequestTx] = useState<`0x${string}` | null>(null);
  const [requestId, setRequestId] = useState<bigint | null>(null);
  const [nullifier, setNullifier] = useState<Hex32 | null>(null);

  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [decision, setDecision] = useState<{
    decided: boolean;
    approved: boolean;
    rejected: boolean;
    reasonCode: number;
    decidedAt: number;
    riskScore: number;
    ltvBps: number;
  } | null>(null);

  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // new: server proof generation
  const [generatingProof, setGeneratingProof] = useState(false);

  const isReady = isConnected && chainId === SEPOLIA_CHAIN_ID;
  const activityStorageKey = address
    ? `zk-private-lending:activity:${chainId}:${address.toLowerCase()}`
    : "";

  // --- Reads
  const { data: ethCollateral, refetch: refetchCollateral } = useReadContract({
    address: CONTRACTS.lendingPool,
    abi: lendingPoolAbi,
    functionName: "ethCollateral",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isReady },
  });

  const { data: tokenDebt, refetch: refetchDebt } = useReadContract({
    address: CONTRACTS.lendingPool,
    abi: lendingPoolAbi,
    functionName: "tokenDebt",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isReady },
  });

  const { data: healthFactor, refetch: refetchHF } = useReadContract({
    address: CONTRACTS.lendingPool,
    abi: lendingPoolAbi,
    functionName: "HealthFactor",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isReady },
  });
  const { data: collateralValue, refetch: refetchCollValue } = useReadContract({
  address: CONTRACTS.lendingPool,
  abi: lendingPoolAbi,
  functionName: "collateralValueOf",
  args: address ? [address] : undefined,
  query: { enabled: !!address && isReady },
});

  const { data: nlBalance, refetch: refetchNL } = useReadContract({
    address: CONTRACTS.nlToken,
    abi: nlTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isReady },
  });

  // request state read
  const { data: requestState, refetch: refetchRequestState } = useReadContract({
    address: CONTRACTS.borrowGate,
    abi: borrowGateAbi,
    functionName: "requests",
    args: requestId !== null ? [requestId] : undefined,
    query: {
      enabled: isReady && requestId !== null,
      refetchInterval: requestId ? 4000 : false,
    },
  });

  // Admin detection (Registry DEFAULT_ADMIN_ROLE is 0x00)
  const { data: isAdmin } = useReadContract({
    address: CONTRACTS.borrowApprovalRegistry,
    abi: borrowApprovalRegistryAbi,
    functionName: "hasRole",
    args: address
      ? [
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          address,
        ]
      : undefined,
    query: { enabled: !!address && isReady },
  });

  const refetchAll = () => {
    refetchCollateral();
    refetchDebt();
    refetchHF();
    refetchNL();
    refetchCollValue();
    if (requestId !== null) refetchRequestState();
    fetchOnchainActivity();
  };

  // --- Writes
  const { writeContract, data: lastTxHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: lastTxHash });

  const mergeActivity = (items: ActivityItem[]) => {
    const byKey = new Map<string, ActivityItem>();
    for (const item of items) {
      const key = item.txHash ? `${item.label}:${item.txHash.toLowerCase()}` : `${item.label}:${item.id}`;
      const existing = byKey.get(key);
      if (!existing || existing.timestamp < item.timestamp) {
        byKey.set(key, item);
      }
    }
    return Array.from(byKey.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 40);
  };

  const addActivity = (label: string, hash?: string) => {
    setActivity((prev) =>
      mergeActivity([
        { id: crypto.randomUUID(), label, txHash: hash, timestamp: new Date() },
        ...prev,
      ])
    );
  };

  const fetchOnchainActivity = async () => {
    if (!publicClient || !address || !isReady) return;

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const window = 120_000n;
      const fromBlock = latestBlock > window ? latestBlock - window : 0n;

      const requestedLogs = await publicClient.getLogs({
        address: CONTRACTS.borrowGate,
        event: {
          type: "event",
          name: "BorrowRequested",
          inputs: [
            { name: "requestId", type: "uint256", indexed: true },
            { name: "borrower", type: "address", indexed: true },
            { name: "nullifier", type: "bytes32", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
          ],
        },
        args: { borrower: address },
        fromBlock,
        toBlock: "latest",
      } as const);

      const requestIdToNullifier = new Map<string, string>();
      const items: ActivityItem[] = [];

      for (const log of requestedLogs) {
        const args = log.args as any;
        const txHash = log.transactionHash;
        const requestId = args?.requestId ? args.requestId.toString() : "?";
        const amount = args?.amount ? Number(formatEther(args.amount)).toFixed(4) : "?";
        const nullifierVal = args?.nullifier as string | undefined;
        if (nullifierVal) {
          requestIdToNullifier.set(requestId, nullifierVal.toLowerCase());
        }
        items.push({
          id: txHash ? `${txHash}:request` : crypto.randomUUID(),
          label: `Borrow requested (#${requestId}, ${amount} NL)`,
          txHash: txHash as `0x${string}` | undefined,
          timestamp: new Date(),
        });
      }

      const executedLogs = await publicClient.getLogs({
        address: CONTRACTS.borrowGate,
        event: {
          type: "event",
          name: "BorrowExecuted",
          inputs: [
            { name: "requestId", type: "uint256", indexed: true },
            { name: "nullifier", type: "bytes32", indexed: true },
          ],
        },
        fromBlock,
        toBlock: "latest",
      } as const);

      for (const log of executedLogs) {
        const args = log.args as any;
        const requestId = args?.requestId ? args.requestId.toString() : "?";
        const eventNullifier = (args?.nullifier as string | undefined)?.toLowerCase();
        const knownNullifier = requestIdToNullifier.get(requestId);
        if (!eventNullifier || !knownNullifier || eventNullifier !== knownNullifier) continue;

        items.push({
          id: log.transactionHash ? `${log.transactionHash}:execute` : crypto.randomUUID(),
          label: `Borrow executed (#${requestId})`,
          txHash: log.transactionHash as `0x${string}` | undefined,
          timestamp: new Date(),
        });
      }

      setActivity((prev) => mergeActivity([...items, ...prev]));
    } catch (e) {
      console.error("Failed to fetch on-chain activity", e);
    }
  };

  useEffect(() => {
    if (!activityStorageKey) return;
    try {
      const raw = localStorage.getItem(activityStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedActivityItem[];
      const hydrated = parsed
        .map((x) => ({ ...x, timestamp: new Date(x.timestamp) }))
        .filter((x) => !Number.isNaN(x.timestamp.getTime()));
      if (hydrated.length > 0) {
        setActivity((prev) => mergeActivity([...hydrated, ...prev]));
      }
    } catch {
      // ignore invalid local cache
    }
  }, [activityStorageKey]);

  useEffect(() => {
    if (!activityStorageKey) return;
    const payload: PersistedActivityItem[] = activity.map((item) => ({
      id: item.id,
      label: item.label,
      txHash: item.txHash,
      timestamp: item.timestamp.toISOString(),
    }));
    localStorage.setItem(activityStorageKey, JSON.stringify(payload));
  }, [activity, activityStorageKey]);

  useEffect(() => {
    if (!isReady || !address || !publicClient) return;
    fetchOnchainActivity();
  }, [isReady, address, publicClient]);

  // --- HF formatting
  const hfFormatted = useMemo(() => {
    if (!healthFactor) return "0.0000";
    return Number(formatUnits(healthFactor as bigint, 18)).toFixed(4);
  }, [healthFactor]);

  const hfNum = Number(hfFormatted);
  const hfStatus: "safe" | "risk" | "liquidatable" =
    hfNum === 0 ? "safe" : hfNum >= 1.5 ? "safe" : hfNum >= 1.0 ? "risk" : "liquidatable";

  
  const hfBadge =
    hfStatus === "safe" ? "SAFE" : hfStatus === "risk" ? "AT RISK" : "LIQUIDATABLE";

  const safeCollateralFloor = useMemo(() => {
  if (!ethCollateral || !tokenDebt || !collateralValue) return 0n;
  const debt = tokenDebt as bigint;
  if (debt === 0n) return 0n;

  const liqThr = 85n; // liquidationThreshold

  // minCollValue = debt * 100 / liqThr
  const minCollValue = (debt * 100n) / liqThr;

  // Convert required coll value back to ETH collateral proportionally:
  // minCollateral = ethCollateral * minCollValue / collValue
  const collEth = ethCollateral as bigint;
  const collVal = collateralValue as bigint;

  if (collVal === 0n) return collEth; // extremely defensive

  return (collEth * minCollValue) / collVal;
}, [ethCollateral, tokenDebt, collateralValue]);

const maxWithdrawable = useMemo(() => {
  if (!ethCollateral) return 0n;
  const collEth = ethCollateral as bigint;

  if (!tokenDebt || (tokenDebt as bigint) === 0n) return collEth;

  if (collEth <= safeCollateralFloor) return 0n;
  return collEth - safeCollateralFloor;
}, [ethCollateral, tokenDebt, safeCollateralFloor]);


  const maxBorrowable = useMemo(() => {
  if (!collateralValue || !tokenDebt) return 0n;

  // matches LendingPool.liquidationThreshold = 85
  const liquidationThreshold = 85n;

  // maxDebt = collValue * liqThr / 100
  const maxDebt = (collateralValue as bigint * liquidationThreshold) / 100n;
  const debt = tokenDebt as bigint;

  if (maxDebt <= debt) return 0n;
  return maxDebt - debt;
}, [collateralValue, tokenDebt]);
  
  // CRE simulate command
  const creCommand = useMemo(() => {
    if (!requestTx) return "";
    return `cre workflow simulate ./zkpass-risk-orchestrator --project-root . --target staging-settings --broadcast --non-interactive --trigger-index 0 --evm-tx-hash ${requestTx} --evm-event-index 0`;
  }, [requestTx]);

  // --- Step A: Deposit
  const handleDeposit = () => {
    if (!depositAmount) return toast.error("Enter a deposit amount.");
    if (!isReady) return toast.error("Connect wallet to Sepolia.");

    writeContract(
      {
        address: CONTRACTS.lendingPool,
        abi: lendingPoolAbi,
        functionName: "deposit",
        value: parseEther(depositAmount),
      } as any,
      {
        onSuccess: (hash: `0x${string}`) => {
          addActivity("Deposit submitted", hash);
          toast.success("Deposit tx submitted");
          setTimeout(refetchAll, 3000);
          setStep(1);
        },
        onError: (err: Error) => toast.error(err.message.slice(0, 160)),
      }
    );
  };

  // --- Step B: Upload proof
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ProofData;

        if (!data.amount || !data.root || !data.nullifier || !data.nonce || !data.a || !data.b || !data.c) {
          toast.error("Invalid proof JSON shape");
          return;
        }
        if (!isBytes32(data.root) || !isBytes32(data.nullifier)) {
          toast.error("root/nullifier must be bytes32 (0x + 64 hex).");
          return;
        }

        setProof(data);
        setNullifier(data.nullifier);
        setDecision(null);
        setRequestId(null);
        setRequestTx(null);

        addActivity("Proof loaded");
        toast.success("Proof loaded");
        setStep(2);
      } catch {
        toast.error("Failed to parse JSON");
      }
    };

    reader.readAsText(file);
  };

  // --- Server proof generation (optional path)
  const handleGenerateProofFromServer = async () => {
    if (!isReady || !address) return toast.error("Connect wallet to Sepolia.");

    try {
      setGeneratingProof(true);
      const res = await fetch("/api/proof/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Keep payload minimal; server can decide nonce/pass lookup
        body: JSON.stringify({
          borrower: address,
          // You can allow UI amount later; default to 10 NL if not provided server-side
          amountNL: "10",
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt ? safeSnippet(txt, 160) : "Server proof generation failed");
      }

      const data = (await res.json()) as ProofData;

      if (!data?.amount || !data?.root || !data?.nullifier || !data?.nonce || !data?.a || !data?.b || !data?.c) {
        throw new Error("Invalid proof response from server");
      }
      if (!isBytes32(data.root) || !isBytes32(data.nullifier)) {
        throw new Error("Server returned invalid bytes32 root/nullifier");
      }

      setProof(data);
      setNullifier(data.nullifier);
      setDecision(null);
      setRequestId(null);
      setRequestTx(null);

      addActivity("Proof generated (server)");
      toast.success("Proof generated from server");
      setStep(2);
    } catch (e: any) {
      toast.error(String(e?.message ?? e).slice(0, 200));
    } finally {
      setGeneratingProof(false);
    }
  };

  // --- Step C: Request borrow (robust event parsing)
  const handleRequestBorrow = () => {
    if (!isReady) return toast.error("Connect wallet to Sepolia.");
    if (!proof) return toast.error("Upload a valid proof first.");
    if (!publicClient) return toast.error("Public client unavailable.");

    if (!isBytes32(proof.root) || !isBytes32(proof.nullifier)) {
      return toast.error("Invalid root/nullifier format.");
    }

    writeContract(
      {
        address: CONTRACTS.borrowGate,
        abi: borrowGateAbi,
        functionName: "requestBorrow",
        args: [
          BigInt(proof.amount),
          proof.root,
          proof.nullifier,
          BigInt(proof.nonce),
          proof.a.map(BigInt) as any,
          proof.b.map((row) => row.map(BigInt)) as any,
          proof.c.map(BigInt) as any,
        ],
      } as any,
      {
        onSuccess: async (hash: `0x${string}`) => {
          setRequestTx(hash);
          addActivity("Borrow request submitted", hash);
          toast.success("Borrow request submitted");

          try {
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            const parsed = parseEventLogs({
              abi: borrowGateAbi,
              logs: receipt.logs,
              eventName: "BorrowRequested",
            });

            const ev =
              parsed.find(
                (x) => (x.address as string).toLowerCase() === CONTRACTS.borrowGate.toLowerCase()
              ) ?? parsed[0];

            if (!ev) {
              toast.error("BorrowRequested event not found in tx logs.");
              setStep(3);
              return;
            }

            const rid = (ev.args as any).requestId as bigint;
            const nf = (ev.args as any).nullifier as Hex32;

            setRequestId(rid);
            setNullifier(nf); // chain is source of truth
            addActivity(`BorrowRequested decoded (requestId=${rid.toString()})`);

            setStep(3);
          } catch (e: any) {
            toast.error(`Failed to decode requestId: ${String(e?.message ?? e).slice(0, 140)}`);
            setStep(3);
          }
        },
        onError: (err: Error) => toast.error(err.message.slice(0, 160)),
      }
    );
  };

  // --- Step D: Poll decision (decisions(nullifier))
  const pollOnce = async () => {
    if (!publicClient || !nullifier) return;

    try {
      const d = await (publicClient as any).readContract({
        address: CONTRACTS.borrowApprovalRegistry,
        abi: borrowApprovalRegistryAbi,
        functionName: "decisions",
        args: [nullifier],
      });

      const decided = Boolean(d[0]);
      if (!decided) return;

      const approved = Boolean(d[1]);
      const rejected = Boolean(d[2]);

      const reasonCode = Number(d[3]);
      const decidedAt = Number(d[4]);
      const riskScore = Number(d[5]);
      const ltvBps = Number(d[6]);

      setDecision({ decided, approved, rejected, reasonCode, decidedAt, riskScore, ltvBps });
      setPolling(false);
      if (pollRef.current) clearInterval(pollRef.current);

      addActivity(approved ? "CRE Decision: APPROVED" : "CRE Decision: REJECTED");
      setStep(4);
    } catch {
      // silent
    }
  };

  const startPolling = () => {
    if (!nullifier) return toast.error("Missing nullifier.");
    if (!publicClient) return toast.error("Public client unavailable.");

    setPolling(true);
    pollOnce();
    pollRef.current = setInterval(pollOnce, 4000);
  };

  const stopPolling = () => {
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // --- Step E: Execute borrow
  const executedOnchain = requestState ? Boolean((requestState as any)[3]) : false;

  const handleExecuteBorrow = () => {
    if (!isReady) return toast.error("Connect wallet to Sepolia.");
    if (!decision?.approved) return toast.error("Not approved yet.");
    if (requestId === null) return toast.error("Missing requestId.");
    if (executedOnchain) return toast.error("Already executed.");

    writeContract(
      {
        address: CONTRACTS.borrowGate,
        abi: borrowGateAbi,
        functionName: "executeBorrow",
        args: [requestId],
      } as any,
      {
        onSuccess: (hash: `0x${string}`) => {
          addActivity("Execute borrow submitted", hash);
          toast.success("Execute borrow tx submitted");
          setTimeout(refetchAll, 3000);
          setStep(5);
        },
        onError: (err: Error) => toast.error(err.message.slice(0, 180)),
      }
    );
  };

  // --- Step F: Approve + repay (spender MUST be LendingPool)
  const handleApproveAndRepay = async () => {
    if (!isReady) return toast.error("Connect wallet to Sepolia.");
    if (!publicClient) return toast.error("Public client unavailable.");

    const suggested = tokenDebt ? formatEther(tokenDebt as bigint) : "0";
    const amt = repayAmount || suggested;
    const amtBn = parseEther(amt);

    writeContract(
      {
        address: CONTRACTS.nlToken,
        abi: nlTokenAbi,
        functionName: "approve",
        args: [CONTRACTS.lendingPool, amtBn],
      } as any,
      {
        onSuccess: async (hash: `0x${string}`) => {
          addActivity("Approved NL spend (spender=LendingPool)", hash);
          toast.success("Approval submitted");

          await publicClient.waitForTransactionReceipt({ hash });

          writeContract(
            {
              address: CONTRACTS.lendingPool,
              abi: lendingPoolAbi,
              functionName: "repay",
              args: [amtBn],
            } as any,
            {
              onSuccess: (h: `0x${string}`) => {
                addActivity("Repay submitted", h);
                toast.success("Repay tx submitted");
                setTimeout(refetchAll, 3000);
              },
              onError: (err: Error) => toast.error(err.message.slice(0, 160)),
            }
          );
        },
        onError: (err: Error) => toast.error(err.message.slice(0, 160)),
      }
    );
  };

  // --- Step G: Withdraw
  const handleWithdraw = () => {
    if (!isReady) return toast.error("Connect wallet to Sepolia.");

    const suggested = ethCollateral ? formatEther(ethCollateral as bigint) : "0";
    const amt = withdrawAmount || suggested;
    if (parseEther(amt) > maxWithdrawable) {
  return toast.error("Amount exceeds max safe withdraw (HF would break).");
}
    writeContract(
      {
        address: CONTRACTS.lendingPool,
        abi: lendingPoolAbi,
        functionName: "withDrawCollateral",
        args: [parseEther(amt)],
      } as any,
      {
        onSuccess: (hash: `0x${string}`) => {
          addActivity("Withdraw submitted", hash);
          toast.success("Withdraw tx submitted");
          setTimeout(refetchAll, 3000);
        },
        onError: (err: Error) => toast.error(err.message.slice(0, 160)),
      }
    );
  };

  const flowLabel = useMemo(() => {
    if (!isReady) return "Connect wallet to Sepolia";
    if (step === 0) return "Deposit collateral";
    if (step === 1) return "Provide proof (upload or server)";
    if (step === 2) return "Request borrow";
    if (step === 3) return "Await CRE decision";
    if (step === 4) return "Execute borrow";
    return "Position management (repay / withdraw)";
  }, [isReady, step]);

  // decision LTV display (0..100%)
  const ltvPct = useMemo(() => {
    if (!decision) return 0;
    return Math.min(decision.ltvBps / 100, 100);
  }, [decision]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 px-4 sm:px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold">ZK Private Lending</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>NeuroLedger Protocol · Sepolia</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified contracts
                </span>
              </div>
            </div>
            <WalletConnect />
          </div>

          {Boolean(isAdmin) && (
            <div className="mb-6 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="font-semibold">Admin mode enabled</span>
              <span className="text-muted-foreground">— registry admin role detected for this wallet</span>
            </div>
          )}

          {/* Flow status banner */}
          <div className="card-elevated p-4 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Step</p>
              <p className="font-semibold">{flowLabel}</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {isPending || isConfirming ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transaction in progress…
                </span>
              ) : (
                <span>Ready</span>
              )}
            </div>
          </div>

          {!isReady ? (
            <div className="card-elevated p-12 text-center">
              <p className="text-xl font-semibold mb-2">Connect your wallet to Sepolia</p>
              <p className="text-muted-foreground">This demo interacts with verified contracts on Sepolia.</p>
            </div>
          ) : (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <MetricCard
                  label="ETH Collateral"
                  value={ethCollateral ? Number(formatEther(ethCollateral as bigint)).toFixed(6) : "0"}
                  sub="ETH"
                />
                <MetricCard
                  label="Token Debt"
                  value={tokenDebt ? Number(formatEther(tokenDebt as bigint)).toFixed(4) : "0"}
                  sub="NL"
                />
                <MetricCard
                  label="Max Borrowable"
                  value={Number(formatEther(maxBorrowable)).toFixed(4)}
                   sub="NL"
                />
                <MetricCard
                  label="Health Factor"
                  value={hfFormatted}
                  sub={hfBadge}
                  status={hfStatus}
                />
                <MetricCard
                  label="NL Balance"
                  value={nlBalance ? Number(formatEther(nlBalance as bigint)).toFixed(4) : "0"}
                  sub="NL"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
                {/* Left: steps */}
                <div className="xl:col-span-2 space-y-4">
                  <StepCard step={0} current={step} label="A" title="Deposit ETH Collateral">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="ETH amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDepositAmount("0.01")}
                          className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs hover:text-foreground"
                        >
                          0.01
                        </button>
                        <button
                          type="button"
                          onClick={() => setDepositAmount("0.05")}
                          className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs hover:text-foreground"
                        >
                          0.05
                        </button>
                        <button
                          type="button"
                          onClick={() => setDepositAmount("0.1")}
                          className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs hover:text-foreground"
                        >
                          0.1
                        </button>
                        <button
                          onClick={handleDeposit}
                          disabled={isPending || isConfirming}
                          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isPending || isConfirming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Deposit"
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Deposit ETH as collateral into LendingPool.
                    </p>
                  </StepCard>

                  <StepCard step={1} current={step} label="B" title="Provide ZK Proof" alwaysEnabled>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 cursor-pointer border border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Upload proof JSON</p>
                          <p className="text-xs text-muted-foreground">
                            Drag/drop or choose a file
                          </p>
                        </div>
                        <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                      </label>

                      <button
                        onClick={handleGenerateProofFromServer}
                        disabled={generatingProof}
                        className="flex items-center justify-center gap-2 border border-border rounded-lg p-4 hover:border-primary/50 transition-colors bg-muted"
                      >
                        {generatingProof ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <TerminalSquare className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-semibold">Generate proof (Server)</p>
                          <p className="text-xs text-muted-foreground">
                            Optional, for smoother UX
                          </p>
                        </div>
                      </button>
                    </div>

                    {proof && (
                      <div className="mt-3 bg-muted rounded-lg p-3 text-xs font-mono space-y-1">
                        <p>Amount: {proof.amount}</p>
                        <p className="flex items-center gap-1">
                          Nullifier: {shortHex(proof.nullifier)} <CopyButton text={proof.nullifier} />
                        </p>
                        <p>Root: {shortHex(proof.root)}</p>
                        <p>Nonce: {proof.nonce}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Manual upload is the recommended hackathon demo path. Server proving is optional.
                    </p>
                  </StepCard>

                  <StepCard step={2} current={step} label="C" title="Request Borrow" alwaysEnabled>
                    <button
                      onClick={handleRequestBorrow}
                      disabled={isPending || isConfirming || !proof}
                      className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {isPending || isConfirming ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        "Submit Borrow Request"
                      )}
                    </button>

                    {(requestTx || requestId !== null || nullifier) && (
                      <div className="mt-3 bg-muted rounded-lg p-3 text-xs font-mono space-y-1">
                        {requestTx && (
                          <p className="flex items-center gap-2">
                            Tx:
                            <a
                              className="text-primary underline"
                              href={etherscanTx(requestTx)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortHex(requestTx)}
                            </a>
                            <ExternalLink className="w-3 h-3" />
                          </p>
                        )}
                        {requestId !== null && (
                          <p className="flex items-center gap-1">
                            RequestId: {requestId.toString()} <CopyButton text={requestId.toString()} />
                          </p>
                        )}
                        {nullifier && (
                          <p className="flex items-center gap-1">
                            Nullifier: {shortHex(nullifier)} <CopyButton text={nullifier} />
                          </p>
                        )}
                      </div>
                    )}
                  </StepCard>

                  <StepCard step={3} current={step} label="D" title="Await CRE Decision" alwaysEnabled>
                    {!decision ? (
                      <>
                    
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="inline-flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mb-3">
  <img src="https://cryptologos.cc/logos/chainlink-link-logo.svg?v=029" alt="Chainlink" className="w-3 h-3" />
  Powered by Chainlink CRE
</div>
                          <button
                            onClick={startPolling}
                            disabled={polling || !nullifier}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {polling ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                Polling…
                              </>
                            ) : (
                              "Start Polling"
                            )}
                          </button>

                          {polling && (
                            <button
                              onClick={stopPolling}
                              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm"
                            >
                              <Square className="w-3 h-3 inline mr-1" /> Stop
                            </button>
                          )}
                        </div>

                        {requestTx && creCommand && (
                          <div className="mt-4 bg-muted rounded-lg p-3 text-xs font-mono">
                            <p className="mb-2 text-muted-foreground">
                              Run CRE workflow (copy/paste):
                            </p>
                            <div className="flex items-start gap-2">
                              <code className="flex-1 break-all">{creCommand}</code>
                              <CopyButton text={creCommand} />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          {decision.approved ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                          <span className="font-bold">{decision.approved ? "APPROVED" : "REJECTED"}</span>
                          <span className="text-xs text-muted-foreground">
                            (reasonCode={decision.reasonCode})
                          </span>
                        </div>

                        <table className="w-full text-xs font-mono">
                          <tbody>
                            <Row k="decided" v={String(decision.decided)} />
                            <Row k="approved" v={String(decision.approved)} />
                            <Row k="rejected" v={String(decision.rejected)} />
                            <Row k="reasonCode" v={String(decision.reasonCode)} />
                            <Row k="decidedAt" v={String(decision.decidedAt)} />
                            <Row k="riskScore" v={String(decision.riskScore)} />
                            <Row k="ltvBps" v={String(decision.ltvBps)} />
                          </tbody>
                        </table>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>LTV</span>
                            <span>{(decision.ltvBps / 100).toFixed(2)}%</span>
                          </div>
                          <div className="h-2 bg-background/40 rounded">
                            <div
                              className="h-2 bg-primary rounded"
                              style={{ width: `${ltvPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </StepCard>

                  <StepCard step={4} current={step} label="E" title="Execute Borrow">
                    <button
                      onClick={handleExecuteBorrow}
                      disabled={
                        isPending ||
                        isConfirming ||
                        !decision?.approved ||
                        requestId === null ||
                        executedOnchain
                      }
                      className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {executedOnchain ? "Already Executed" : "Execute Borrow"}
                    </button>

                    <div className="mt-3 text-xs text-muted-foreground">
                      {requestId === null ? "Waiting for requestId…" : `requestId: ${requestId.toString()}`}
                      {requestState && (
                        <span className="ml-2">
                          · executed: <span className="font-mono">{String(executedOnchain)}</span>
                        </span>
                      )}
                    </div>
                  </StepCard>

                  <StepCard step={5} current={step} label="F" title="Repay Debt" alwaysEnabled>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder={tokenDebt ? formatEther(tokenDebt as bigint) : "Amount"}
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={handleApproveAndRepay}
                        disabled={isPending || isConfirming}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        Approve & Repay
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Approves NL to <span className="font-mono">LendingPool</span>, then repays.
                    </p>
                  </StepCard>

                  <StepCard step={5} current={step} label="G" title="Withdraw Collateral" alwaysEnabled>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="number"
                        step="0.001"
                        placeholder={ethCollateral ? formatEther(ethCollateral as bigint) : "ETH amount"}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={handleWithdraw}
                        disabled={isPending || isConfirming}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        Withdraw
                      </button>
                    </div>
                   <p className="text-xs text-muted-foreground mt-2">
  Max: {ethCollateral ? formatEther(ethCollateral as bigint) : "0"} ETH ·
  Max safe withdraw: {formatEther(maxWithdrawable)} ETH
</p>
                  </StepCard>
                </div>

                {/* Right: activity */}
                <div>
                  <div className="card-elevated p-5 xl:sticky xl:top-24">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Recent Activity</h3>
                      <button
                        onClick={refetchAll}
                        className="text-xs text-primary hover:underline"
                      >
                        Refresh
                      </button>
                    </div>

                    {activity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet</p>
                    ) : (
                      <div className="space-y-3">
                        {activity.map((a) => (
                          <div key={a.id} className="flex items-start gap-2 text-sm">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-foreground">{a.label}</p>
                              {a.txHash && (
                                <a
                                  href={etherscanTx(a.txHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  {shortHex(a.txHash)} <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <p className="text-xs text-muted-foreground">{a.timestamp.toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-1 text-muted-foreground pr-4">{k}</td>
      <td className="py-1 font-mono">{v}</td>
    </tr>
  );
}

function StepCard({
  step,
  current,
  label,
  title,
  alwaysEnabled = false,
  children,
}: {
  step: number;
  current: number;
  label: string;
  title: string;
  alwaysEnabled?: boolean;
  children: React.ReactNode;
}) {
  const isActive = alwaysEnabled ? true : current >= step;

  return (
    <div className={`card-elevated p-5 transition-opacity ${isActive ? "opacity-100" : "opacity-40"}`}>
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {label}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {isActive ? children : null}
    </div>
  );
}

// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import {
//   useAccount,
//   usePublicClient,
//   useReadContract,
//   useWriteContract,
//   useWaitForTransactionReceipt,
// } from "wagmi";
// import { parseEther, formatEther, formatUnits, parseEventLogs } from "viem";
// import { toast } from "sonner";
// import Navbar from "@/components/Navbar";
// import WalletConnect from "@/components/WalletConnect";
// import { MetricCard, CopyButton } from "@/components/shared";
// import { CONTRACTS, etherscanTx, SEPOLIA_CHAIN_ID } from "@/config/contracts";
// import {
//   lendingPoolAbi,
//   nlTokenAbi,
//   borrowGateAbi,
//   borrowApprovalRegistryAbi,
// } from "@/config/abis";
// import {
//   ExternalLink,
//   Upload,
//   Loader2,
//   CheckCircle2,
//   XCircle,
//   Clock,
//   Square,
//   ShieldCheck,
//   TerminalSquare,
//   Activity
// } from "lucide-react";

// type Hex32 = `0x${string}`;

// interface ProofData {
//   amount: string;   // uint256 string
//   root: Hex32;      // bytes32
//   nullifier: Hex32; // bytes32
//   nonce: string;    // uint256 string
//   a: [string, string];
//   b: [[string, string], [string, string]];
//   c: [string, string];
// }

// interface ActivityItem {
//   id: string;
//   label: string;
//   txHash?: string;
//   timestamp: Date;
// }

// interface PersistedActivityItem {
//   id: string;
//   label: string;
//   txHash?: string;
//   timestamp: string;
// }

// function isBytes32(x?: string | null): x is Hex32 {
//   return !!x && x.startsWith("0x") && x.length === 66;
// }

// function shortHex(x: string, n = 10) {
//   if (!x) return "";
//   return `${x.slice(0, n)}…${x.slice(-6)}`;
// }

// function safeSnippet(s: string, max = 140) {
//   const one = s.replace(/\s+/g, " ").trim();
//   return one.length <= max ? one : one.slice(0, max) + "…";
// }

// export default function ZKPrivateLending() {
//   const { address, isConnected, chainId } = useAccount();
//   const publicClient = usePublicClient();

//   // flow states
//   const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
//   const [depositAmount, setDepositAmount] = useState("");
//   const [proof, setProof] = useState<ProofData | null>(null);

//   const [requestTx, setRequestTx] = useState<`0x${string}` | null>(null);
//   const [requestId, setRequestId] = useState<bigint | null>(null);
//   const [nullifier, setNullifier] = useState<Hex32 | null>(null);

//   const [polling, setPolling] = useState(false);
//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   const [decision, setDecision] = useState<{
//     decided: boolean;
//     approved: boolean;
//     rejected: boolean;
//     reasonCode: number;
//     decidedAt: number;
//     riskScore: number;
//     ltvBps: number;
//   } | null>(null);

//   const [repayAmount, setRepayAmount] = useState("");
//   const [withdrawAmount, setWithdrawAmount] = useState("");

//   const [activity, setActivity] = useState<ActivityItem[]>([]);

//   // new: server proof generation
//   const [generatingProof, setGeneratingProof] = useState(false);

//   const isReady = isConnected && chainId === SEPOLIA_CHAIN_ID;
//   const activityStorageKey = address
//     ? `zk-private-lending:activity:${chainId}:${address.toLowerCase()}`
//     : "";

//   // --- Reads
//   const { data: ethCollateral, refetch: refetchCollateral } = useReadContract({
//     address: CONTRACTS.lendingPool,
//     abi: lendingPoolAbi,
//     functionName: "ethCollateral",
//     args: address ? [address] : undefined,
//     query: { enabled: !!address && isReady },
//   });

//   const { data: tokenDebt, refetch: refetchDebt } = useReadContract({
//     address: CONTRACTS.lendingPool,
//     abi: lendingPoolAbi,
//     functionName: "tokenDebt",
//     args: address ? [address] : undefined,
//     query: { enabled: !!address && isReady },
//   });

//   const { data: healthFactor, refetch: refetchHF } = useReadContract({
//     address: CONTRACTS.lendingPool,
//     abi: lendingPoolAbi,
//     functionName: "HealthFactor",
//     args: address ? [address] : undefined,
//     query: { enabled: !!address && isReady },
//   });

//   const { data: nlBalance, refetch: refetchNL } = useReadContract({
//     address: CONTRACTS.nlToken,
//     abi: nlTokenAbi,
//     functionName: "balanceOf",
//     args: address ? [address] : undefined,
//     query: { enabled: !!address && isReady },
//   });

//   // request state read
//   const { data: requestState, refetch: refetchRequestState } = useReadContract({
//     address: CONTRACTS.borrowGate,
//     abi: borrowGateAbi,
//     functionName: "requests",
//     args: requestId !== null ? [requestId] : undefined,
//     query: {
//       enabled: isReady && requestId !== null,
//       refetchInterval: requestId ? 4000 : false,
//     },
//   });

//   // Admin detection (Registry DEFAULT_ADMIN_ROLE is 0x00)
//   const { data: isAdmin } = useReadContract({
//     address: CONTRACTS.borrowApprovalRegistry,
//     abi: borrowApprovalRegistryAbi,
//     functionName: "hasRole",
//     args: address
//       ? [
//           "0x0000000000000000000000000000000000000000000000000000000000000000",
//           address,
//         ]
//       : undefined,
//     query: { enabled: !!address && isReady },
//   });

//   const refetchAll = () => {
//     refetchCollateral();
//     refetchDebt();
//     refetchHF();
//     refetchNL();
//     if (requestId !== null) refetchRequestState();
//     fetchOnchainActivity();
//   };

//   // --- Writes
//   const { writeContract, data: lastTxHash, isPending } = useWriteContract();
//   const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: lastTxHash });

//   const mergeActivity = (items: ActivityItem[]) => {
//     const byKey = new Map<string, ActivityItem>();
//     for (const item of items) {
//       const key = item.txHash ? `${item.label}:${item.txHash.toLowerCase()}` : `${item.label}:${item.id}`;
//       const existing = byKey.get(key);
//       if (!existing || existing.timestamp < item.timestamp) {
//         byKey.set(key, item);
//       }
//     }
//     return Array.from(byKey.values())
//       .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
//       .slice(0, 40);
//   };

//   const addActivity = (label: string, hash?: string) => {
//     setActivity((prev) =>
//       mergeActivity([
//         { id: crypto.randomUUID(), label, txHash: hash, timestamp: new Date() },
//         ...prev,
//       ])
//     );
//   };

//   const fetchOnchainActivity = async () => {
//     if (!publicClient || !address || !isReady) return;

//     try {
//       const latestBlock = await publicClient.getBlockNumber();
//       const window = 120_000n;
//       const fromBlock = latestBlock > window ? latestBlock - window : 0n;

//       const requestedLogs = await publicClient.getLogs({
//         address: CONTRACTS.borrowGate,
//         event: {
//           type: "event",
//           name: "BorrowRequested",
//           inputs: [
//             { name: "requestId", type: "uint256", indexed: true },
//             { name: "borrower", type: "address", indexed: true },
//             { name: "nullifier", type: "bytes32", indexed: true },
//             { name: "amount", type: "uint256", indexed: false },
//           ],
//         },
//         args: { borrower: address },
//         fromBlock,
//         toBlock: "latest",
//       } as const);

//       const requestIdToNullifier = new Map<string, string>();
//       const items: ActivityItem[] = [];

//       for (const log of requestedLogs) {
//         const args = log.args as any;
//         const txHash = log.transactionHash;
//         const requestId = args?.requestId ? args.requestId.toString() : "?";
//         const amount = args?.amount ? Number(formatEther(args.amount)).toFixed(4) : "?";
//         const nullifierVal = args?.nullifier as string | undefined;
//         if (nullifierVal) {
//           requestIdToNullifier.set(requestId, nullifierVal.toLowerCase());
//         }
//         items.push({
//           id: txHash ? `${txHash}:request` : crypto.randomUUID(),
//           label: `Borrow requested (#${requestId}, ${amount} NL)`,
//           txHash: txHash as `0x${string}` | undefined,
//           timestamp: new Date(),
//         });
//       }

//       const executedLogs = await publicClient.getLogs({
//         address: CONTRACTS.borrowGate,
//         event: {
//           type: "event",
//           name: "BorrowExecuted",
//           inputs: [
//             { name: "requestId", type: "uint256", indexed: true },
//             { name: "nullifier", type: "bytes32", indexed: true },
//           ],
//         },
//         fromBlock,
//         toBlock: "latest",
//       } as const);

//       for (const log of executedLogs) {
//         const args = log.args as any;
//         const requestId = args?.requestId ? args.requestId.toString() : "?";
//         const eventNullifier = (args?.nullifier as string | undefined)?.toLowerCase();
//         const knownNullifier = requestIdToNullifier.get(requestId);
//         if (!eventNullifier || !knownNullifier || eventNullifier !== knownNullifier) continue;

//         items.push({
//           id: log.transactionHash ? `${log.transactionHash}:execute` : crypto.randomUUID(),
//           label: `Borrow executed (#${requestId})`,
//           txHash: log.transactionHash as `0x${string}` | undefined,
//           timestamp: new Date(),
//         });
//       }

//       setActivity((prev) => mergeActivity([...items, ...prev]));
//     } catch (e) {
//       console.error("Failed to fetch on-chain activity", e);
//     }
//   };

//   useEffect(() => {
//     if (!activityStorageKey) return;
//     try {
//       const raw = localStorage.getItem(activityStorageKey);
//       if (!raw) return;
//       const parsed = JSON.parse(raw) as PersistedActivityItem[];
//       const hydrated = parsed
//         .map((x) => ({ ...x, timestamp: new Date(x.timestamp) }))
//         .filter((x) => !Number.isNaN(x.timestamp.getTime()));
//       if (hydrated.length > 0) {
//         setActivity((prev) => mergeActivity([...hydrated, ...prev]));
//       }
//     } catch {
//       // ignore invalid local cache
//     }
//   }, [activityStorageKey]);

//   useEffect(() => {
//     if (!activityStorageKey) return;
//     const payload: PersistedActivityItem[] = activity.map((item) => ({
//       id: item.id,
//       label: item.label,
//       txHash: item.txHash,
//       timestamp: item.timestamp.toISOString(),
//     }));
//     localStorage.setItem(activityStorageKey, JSON.stringify(payload));
//   }, [activity, activityStorageKey]);

//   useEffect(() => {
//     if (!isReady || !address || !publicClient) return;
//     fetchOnchainActivity();
//   }, [isReady, address, publicClient]);

//   // --- HF formatting
//   const hfFormatted = useMemo(() => {
//     if (!healthFactor) return "0.0000";
//     return Number(formatUnits(healthFactor as bigint, 18)).toFixed(4);
//   }, [healthFactor]);

//   const hfNum = Number(hfFormatted);
//   const hfStatus: "safe" | "risk" | "liquidatable" =
//     hfNum === 0 ? "safe" : hfNum >= 1.5 ? "safe" : hfNum >= 1.0 ? "risk" : "liquidatable";

//   const hfBadge =
//     hfStatus === "safe" ? "SAFE" : hfStatus === "risk" ? "AT RISK" : "LIQUIDATABLE";

//   // CRE simulate command
//   const creCommand = useMemo(() => {
//     if (!requestTx) return "";
//     return `cre workflow simulate ./zkpass-risk-orchestrator --project-root . --target staging-settings --broadcast --non-interactive --trigger-index 0 --evm-tx-hash ${requestTx} --evm-event-index 0`;
//   }, [requestTx]);

//   // --- Step A: Deposit
//   const handleDeposit = () => {
//     if (!depositAmount) return toast.error("Enter a deposit amount.");
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");

//     writeContract(
//       {
//         address: CONTRACTS.lendingPool,
//         abi: lendingPoolAbi,
//         functionName: "deposit",
//         value: parseEther(depositAmount),
//       } as any,
//       {
//         onSuccess: (hash: `0x${string}`) => {
//           addActivity("Deposit submitted", hash);
//           toast.success("Deposit tx submitted");
//           setTimeout(refetchAll, 3000);
//           setStep(1);
//         },
//         onError: (err: Error) => toast.error(err.message.slice(0, 160)),
//       }
//     );
//   };

//   // --- Step B: Upload proof
//   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();

//     reader.onload = (ev) => {
//       try {
//         const data = JSON.parse(ev.target?.result as string) as ProofData;

//         if (!data.amount || !data.root || !data.nullifier || !data.nonce || !data.a || !data.b || !data.c) {
//           toast.error("Invalid proof JSON shape");
//           return;
//         }
//         if (!isBytes32(data.root) || !isBytes32(data.nullifier)) {
//           toast.error("root/nullifier must be bytes32 (0x + 64 hex).");
//           return;
//         }

//         setProof(data);
//         setNullifier(data.nullifier);
//         setDecision(null);
//         setRequestId(null);
//         setRequestTx(null);

//         addActivity("Proof loaded");
//         toast.success("Proof loaded");
//         setStep(2);
//       } catch {
//         toast.error("Failed to parse JSON");
//       }
//     };

//     reader.readAsText(file);
//   };

//   // --- Server proof generation (optional path)
//   const handleGenerateProofFromServer = async () => {
//     if (!isReady || !address) return toast.error("Connect wallet to Sepolia.");

//     try {
//       setGeneratingProof(true);
//       const res = await fetch("/api/proof/borrow", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         // Keep payload minimal; server can decide nonce/pass lookup
//         body: JSON.stringify({
//           borrower: address,
//           // You can allow UI amount later; default to 10 NL if not provided server-side
//           amountNL: "10",
//         }),
//       });

//       if (!res.ok) {
//         const txt = await res.text().catch(() => "");
//         throw new Error(txt ? safeSnippet(txt, 160) : "Server proof generation failed");
//       }

//       const data = (await res.json()) as ProofData;

//       if (!data?.amount || !data?.root || !data?.nullifier || !data?.nonce || !data?.a || !data?.b || !data?.c) {
//         throw new Error("Invalid proof response from server");
//       }
//       if (!isBytes32(data.root) || !isBytes32(data.nullifier)) {
//         throw new Error("Server returned invalid bytes32 root/nullifier");
//       }

//       setProof(data);
//       setNullifier(data.nullifier);
//       setDecision(null);
//       setRequestId(null);
//       setRequestTx(null);

//       addActivity("Proof generated (server)");
//       toast.success("Proof generated from server");
//       setStep(2);
//     } catch (e: any) {
//       toast.error(String(e?.message ?? e).slice(0, 200));
//     } finally {
//       setGeneratingProof(false);
//     }
//   };

//   // --- Step C: Request borrow (robust event parsing)
//   const handleRequestBorrow = () => {
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");
//     if (!proof) return toast.error("Upload a valid proof first.");
//     if (!publicClient) return toast.error("Public client unavailable.");

//     if (!isBytes32(proof.root) || !isBytes32(proof.nullifier)) {
//       return toast.error("Invalid root/nullifier format.");
//     }

//     writeContract(
//       {
//         address: CONTRACTS.borrowGate,
//         abi: borrowGateAbi,
//         functionName: "requestBorrow",
//         args: [
//           BigInt(proof.amount),
//           proof.root,
//           proof.nullifier,
//           BigInt(proof.nonce),
//           proof.a.map(BigInt) as any,
//           proof.b.map((row) => row.map(BigInt)) as any,
//           proof.c.map(BigInt) as any,
//         ],
//       } as any,
//       {
//         onSuccess: async (hash: `0x${string}`) => {
//           setRequestTx(hash);
//           addActivity("Borrow request submitted", hash);
//           toast.success("Borrow request submitted");

//           try {
//             const receipt = await publicClient.waitForTransactionReceipt({ hash });

//             const parsed = parseEventLogs({
//               abi: borrowGateAbi,
//               logs: receipt.logs,
//               eventName: "BorrowRequested",
//             });

//             const ev =
//               parsed.find(
//                 (x) => (x.address as string).toLowerCase() === CONTRACTS.borrowGate.toLowerCase()
//               ) ?? parsed[0];

//             if (!ev) {
//               toast.error("BorrowRequested event not found in tx logs.");
//               setStep(3);
//               return;
//             }

//             const rid = (ev.args as any).requestId as bigint;
//             const nf = (ev.args as any).nullifier as Hex32;

//             setRequestId(rid);
//             setNullifier(nf); // chain is source of truth
//             addActivity(`BorrowRequested decoded (requestId=${rid.toString()})`);

//             setStep(3);
//           } catch (e: any) {
//             toast.error(`Failed to decode requestId: ${String(e?.message ?? e).slice(0, 140)}`);
//             setStep(3);
//           }
//         },
//         onError: (err: Error) => toast.error(err.message.slice(0, 160)),
//       }
//     );
//   };

//   // --- Step D: Poll decision (decisions(nullifier))
//   const pollOnce = async () => {
//     if (!publicClient || !nullifier) return;

//     try {
//       const d = await (publicClient as any).readContract({
//         address: CONTRACTS.borrowApprovalRegistry,
//         abi: borrowApprovalRegistryAbi,
//         functionName: "decisions",
//         args: [nullifier],
//       });

//       const decided = Boolean(d[0]);
//       if (!decided) return;

//       const approved = Boolean(d[1]);
//       const rejected = Boolean(d[2]);

//       const reasonCode = Number(d[3]);
//       const decidedAt = Number(d[4]);
//       const riskScore = Number(d[5]);
//       const ltvBps = Number(d[6]);

//       setDecision({ decided, approved, rejected, reasonCode, decidedAt, riskScore, ltvBps });
//       setPolling(false);
//       if (pollRef.current) clearInterval(pollRef.current);

//       addActivity(approved ? "CRE Decision: APPROVED" : "CRE Decision: REJECTED");
//       setStep(4);
//     } catch {
//       // silent
//     }
//   };

//   const startPolling = () => {
//     if (!nullifier) return toast.error("Missing nullifier.");
//     if (!publicClient) return toast.error("Public client unavailable.");

//     setPolling(true);
//     pollOnce();
//     pollRef.current = setInterval(pollOnce, 4000);
//   };

//   const stopPolling = () => {
//     setPolling(false);
//     if (pollRef.current) clearInterval(pollRef.current);
//   };

//   useEffect(() => {
//     return () => {
//       if (pollRef.current) clearInterval(pollRef.current);
//     };
//   }, []);

//   // --- Step E: Execute borrow
//   const executedOnchain = requestState ? Boolean((requestState as any)[3]) : false;

//   const handleExecuteBorrow = () => {
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");
//     if (!decision?.approved) return toast.error("Not approved yet.");
//     if (requestId === null) return toast.error("Missing requestId.");
//     if (executedOnchain) return toast.error("Already executed.");

//     writeContract(
//       {
//         address: CONTRACTS.borrowGate,
//         abi: borrowGateAbi,
//         functionName: "executeBorrow",
//         args: [requestId],
//       } as any,
//       {
//         onSuccess: (hash: `0x${string}`) => {
//           addActivity("Execute borrow submitted", hash);
//           toast.success("Execute borrow tx submitted");
//           setTimeout(refetchAll, 3000);
//           setStep(5);
//         },
//         onError: (err: Error) => toast.error(err.message.slice(0, 180)),
//       }
//     );
//   };

//   // --- Step F: Approve + repay (spender MUST be LendingPool)
//   const handleApproveAndRepay = async () => {
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");
//     if (!publicClient) return toast.error("Public client unavailable.");

//     const suggested = tokenDebt ? formatEther(tokenDebt as bigint) : "0";
//     const amt = repayAmount || suggested;
//     const amtBn = parseEther(amt);

//     writeContract(
//       {
//         address: CONTRACTS.nlToken,
//         abi: nlTokenAbi,
//         functionName: "approve",
//         args: [CONTRACTS.lendingPool, amtBn],
//       } as any,
//       {
//         onSuccess: async (hash: `0x${string}`) => {
//           addActivity("Approved NL spend (spender=LendingPool)", hash);
//           toast.success("Approval submitted");

//           await publicClient.waitForTransactionReceipt({ hash });

//           writeContract(
//             {
//               address: CONTRACTS.lendingPool,
//               abi: lendingPoolAbi,
//               functionName: "repay",
//               args: [amtBn],
//             } as any,
//             {
//               onSuccess: (h: `0x${string}`) => {
//                 addActivity("Repay submitted", h);
//                 toast.success("Repay tx submitted");
//                 setTimeout(refetchAll, 3000);
//               },
//               onError: (err: Error) => toast.error(err.message.slice(0, 160)),
//             }
//           );
//         },
//         onError: (err: Error) => toast.error(err.message.slice(0, 160)),
//       }
//     );
//   };

//   // --- Step G: Withdraw
//   const handleWithdraw = () => {
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");

//     const suggested = ethCollateral ? formatEther(ethCollateral as bigint) : "0";
//     const amt = withdrawAmount || suggested;

//     writeContract(
//       {
//         address: CONTRACTS.lendingPool,
//         abi: lendingPoolAbi,
//         functionName: "withDrawCollateral",
//         args: [parseEther(amt)],
//       } as any,
//       {
//         onSuccess: (hash: `0x${string}`) => {
//           addActivity("Withdraw submitted", hash);
//           toast.success("Withdraw tx submitted");
//           setTimeout(refetchAll, 3000);
//         },
//         onError: (err: Error) => toast.error(err.message.slice(0, 160)),
//       }
//     );
//   };

//   const flowLabel = useMemo(() => {
//     if (!isReady) return "Connect wallet to Sepolia";
//     if (step === 0) return "Deposit collateral";
//     if (step === 1) return "Provide proof (upload or server)";
//     if (step === 2) return "Request borrow";
//     if (step === 3) return "Await CRE decision";
//     if (step === 4) return "Execute borrow";
//     return "Position management (repay / withdraw)";
//   }, [isReady, step]);

//   // decision LTV display (0..100%)
//   const ltvPct = useMemo(() => {
//     if (!decision) return 0;
//     return Math.min(decision.ltvBps / 100, 100);
//   }, [decision]);

//   return (
//     <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans relative overflow-hidden">
      
//       {/* Background Ambience */}
//       <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0a0a0a] to-[#0a0a0a] pointer-events-none" />

//       <div className="relative z-10">
//         <Navbar />

//         <div className="pt-28 px-4 sm:px-6 pb-20">
//           <div className="max-w-6xl mx-auto">
            
//             {/* Header Area */}
//             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
//               <div className="space-y-2">
//                 <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
//                   ZK Private Lending
//                 </h1>
//                 <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
//                   <span className="font-semibold text-white">NeuroLedger Protocol</span>
//                   <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-mono text-orange-400 shadow-[0_0_10px_-2px_rgba(249,115,22,0.2)]">
//                     <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
//                     Sepolia Testnet
//                   </span>
//                   <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-mono text-purple-300">
//                     <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
//                     Verified Contracts
//                   </span>
//                 </div>
//               </div>
//               <div className="scale-105 origin-left md:origin-right">
//                 <WalletConnect />
//               </div>
//             </div>

//             {Boolean(isAdmin) && (
//               <div className="mb-8 rounded-xl border border-purple-500/40 bg-purple-500/10 p-4 text-sm flex items-center gap-3 shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)] backdrop-blur-md">
//                 <ShieldCheck className="w-5 h-5 text-purple-400" />
//                 <span className="font-bold text-purple-100">Admin Mode Enabled</span>
//                 <span className="text-purple-300/70 hidden sm:inline">— Registry admin role detected for this wallet.</span>
//               </div>
//             )}

//             {/* Flow Status Banner */}
//             <div className="backdrop-blur-md bg-black/40 border border-purple-500/20 shadow-[0_0_30px_-10px_rgba(168,85,247,0.2)] rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//               <div>
//                 <p className="text-xs uppercase tracking-wider font-bold text-purple-400 mb-1">Current Protocol Step</p>
//                 <p className="text-xl font-bold text-white">{flowLabel}</p>
//               </div>
//               <div className="text-sm font-medium">
//                 {isPending || isConfirming ? (
//                   <span className="inline-flex items-center gap-2 text-orange-400 bg-orange-500/10 px-4 py-2 rounded-lg border border-orange-500/20">
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                     Transaction Processing...
//                   </span>
//                 ) : (
//                   <span className="inline-flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20">
//                     <CheckCircle2 className="w-4 h-4" />
//                     System Ready
//                   </span>
//                 )}
//               </div>
//             </div>

//             {!isReady ? (
//               <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-3xl p-16 text-center shadow-2xl shadow-black">
//                 <ShieldCheck className="w-16 h-16 text-purple-500/50 mx-auto mb-6" />
//                 <p className="text-2xl font-bold text-white mb-3">Connect Your Wallet</p>
//                 <p className="text-slate-400 max-w-md mx-auto">Please connect your Web3 wallet and switch to the Sepolia testnet to interact with the NeuroLedger protocol.</p>
//               </div>
//             ) : (
//               <>
//                 {/* Metrics */}
//                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
//                   {/* MetricCards assume standard classes, but wrap nicely here */}
//                   <MetricCard
//                     label="ETH Collateral"
//                     value={ethCollateral ? Number(formatEther(ethCollateral as bigint)).toFixed(6) : "0"}
//                     sub="ETH"
//                   />
//                   <MetricCard
//                     label="Token Debt"
//                     value={tokenDebt ? Number(formatEther(tokenDebt as bigint)).toFixed(4) : "0"}
//                     sub="NL"
//                   />
//                   <MetricCard
//                     label="Health Factor"
//                     value={hfFormatted}
//                     sub={hfBadge}
//                     status={hfStatus}
//                   />
//                   <MetricCard
//                     label="NL Balance"
//                     value={nlBalance ? Number(formatEther(nlBalance as bigint)).toFixed(4) : "0"}
//                     sub="NL"
//                   />
//                 </div>

//                 <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
//                   {/* Left: Interactive Steps */}
//                   <div className="xl:col-span-2 space-y-6">
                    
//                     <StepCard step={0} current={step} label="A" title="Deposit ETH Collateral">
//                       <div className="flex flex-col sm:flex-row gap-3">
//                         <input
//                           type="number"
//                           step="0.001"
//                           placeholder="ETH amount"
//                           value={depositAmount}
//                           onChange={(e) => setDepositAmount(e.target.value)}
//                           className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
//                         />
//                         <div className="flex gap-2">
//                           {["0.01", "0.05", "0.1"].map((amt) => (
//                             <button
//                               key={amt}
//                               type="button"
//                               onClick={() => setDepositAmount(amt)}
//                               className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 font-mono text-sm hover:bg-white/10 hover:text-white transition-colors"
//                             >
//                               {amt}
//                             </button>
//                           ))}
//                           <button
//                             onClick={handleDeposit}
//                             disabled={isPending || isConfirming}
//                             className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-500/20 hover:scale-[1.02] hover:bg-purple-500 disabled:opacity-50 disabled:hover:scale-100 transition-all"
//                           >
//                             {isPending || isConfirming ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deposit"}
//                           </button>
//                         </div>
//                       </div>
//                       <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
//                         <ShieldCheck className="w-3.5 h-3.5" /> Deposit ETH as over-collateralization into LendingPool.
//                       </p>
//                     </StepCard>

//                     <StepCard step={1} current={step} label="B" title="Provide Zero-Knowledge Proof" alwaysEnabled>
//                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                         <label className="flex items-center gap-4 cursor-pointer border-2 border-dashed border-white/20 bg-black/20 rounded-xl p-5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group">
//                           <div className="p-3 bg-white/5 rounded-lg group-hover:bg-purple-500/20 transition-colors">
//                             <Upload className="w-6 h-6 text-purple-400" />
//                           </div>
//                           <div className="min-w-0">
//                             <p className="text-sm font-bold text-white mb-0.5">Upload Proof JSON</p>
//                             <p className="text-xs text-slate-400">Drag/drop or select file</p>
//                           </div>
//                           <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
//                         </label>

//                         <button
//                           onClick={handleGenerateProofFromServer}
//                           disabled={generatingProof}
//                           className="flex items-center gap-4 text-left border border-white/10 bg-black/20 rounded-xl p-5 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group disabled:opacity-50"
//                         >
//                           <div className="p-3 bg-white/5 rounded-lg group-hover:bg-orange-500/20 transition-colors">
//                             {generatingProof ? (
//                               <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
//                             ) : (
//                               <TerminalSquare className="w-6 h-6 text-orange-400" />
//                             )}
//                           </div>
//                           <div className="min-w-0">
//                             <p className="text-sm font-bold text-white mb-0.5">Generate (Server)</p>
//                             <p className="text-xs text-slate-400">Simulate proof generation</p>
//                           </div>
//                         </button>
//                       </div>

//                       {proof && (
//                         <div className="mt-4 bg-black/60 border border-white/5 rounded-xl p-4 text-xs font-mono text-slate-300 space-y-2 shadow-inner">
//                           <p><span className="text-purple-400">Amount:</span> {proof.amount}</p>
//                           <div className="flex items-center gap-2">
//                             <span className="text-orange-400">Nullifier:</span> {shortHex(proof.nullifier)} <CopyButton text={proof.nullifier} />
//                           </div>
//                           <p><span className="text-purple-400">Root:</span> {shortHex(proof.root)}</p>
//                           <p><span className="text-orange-400">Nonce:</span> {proof.nonce}</p>
//                         </div>
//                       )}

//                       <p className="text-xs text-slate-500 mt-4 italic">
//                         * Manual upload is the recommended path for hackathon demos.
//                       </p>
//                     </StepCard>

//                     <StepCard step={2} current={step} label="C" title="Submit Borrow Request" alwaysEnabled>
//                       <button
//                         onClick={handleRequestBorrow}
//                         disabled={isPending || isConfirming || !proof}
//                         className="w-full px-4 py-4 rounded-xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.01] hover:bg-purple-500 disabled:opacity-50 disabled:hover:scale-100 transition-all"
//                       >
//                         {isPending || isConfirming ? (
//                           <Loader2 className="w-5 h-5 animate-spin mx-auto" />
//                         ) : (
//                           "Submit Verified Borrow Request Onchain"
//                         )}
//                       </button>

//                       {(requestTx || requestId !== null || nullifier) && (
//                         <div className="mt-4 bg-black/60 border border-white/5 rounded-xl p-4 text-xs font-mono text-slate-300 space-y-2">
//                           {requestTx && (
//                             <p className="flex items-center gap-2">
//                               <span className="text-purple-400">Tx Hash:</span>
//                               <a
//                                 className="text-white hover:text-orange-400 underline decoration-white/30 hover:decoration-orange-400/50 underline-offset-2 transition-colors"
//                                 href={etherscanTx(requestTx)}
//                                 target="_blank"
//                                 rel="noreferrer"
//                               >
//                                 {shortHex(requestTx)}
//                               </a>
//                               <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
//                             </p>
//                           )}
//                           {requestId !== null && (
//                             <div className="flex items-center gap-2">
//                               <span className="text-orange-400">RequestId:</span> <span className="text-white font-bold">{requestId.toString()}</span> <CopyButton text={requestId.toString()} />
//                             </div>
//                           )}
//                           {nullifier && (
//                             <div className="flex items-center gap-2">
//                               <span className="text-purple-400">Nullifier:</span> {shortHex(nullifier)} <CopyButton text={nullifier} />
//                             </div>
//                           )}
//                         </div>
//                       )}
//                     </StepCard>

//                     <StepCard step={3} current={step} label="D" title="Await Chainlink CRE Decision">
//                       {!decision ? (
//                         <>
//                           <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
//                             <button
//                               onClick={startPolling}
//                               disabled={polling || !nullifier}
//                               className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50 transition-all"
//                             >
//                               {polling ? (
//                                 <>
//                                   <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-orange-400" />
//                                   Polling Registry...
//                                 </>
//                               ) : (
//                                 "Start Polling"
//                               )}
//                             </button>

//                             {polling && (
//                               <button
//                                 onClick={stopPolling}
//                                 className="px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all flex items-center gap-2"
//                               >
//                                 <Square className="w-4 h-4" /> Stop
//                               </button>
//                             )}
//                           </div>

//                           {requestTx && creCommand && (
//                             <div className="mt-5 bg-black border border-white/10 rounded-xl p-4 text-xs font-mono">
//                               <p className="mb-3 text-slate-500 uppercase tracking-wider font-bold">
//                                 // Run CRE Risk Orchestrator Workflow
//                               </p>
//                               <div className="flex items-start gap-3">
//                                 <code className="flex-1 break-all text-green-400 leading-relaxed">{creCommand}</code>
//                                 <div className="mt-1"><CopyButton text={creCommand} /></div>
//                               </div>
//                             </div>
//                           )}
//                         </>
//                       ) : (
//                         <div className="bg-black/40 border border-white/10 rounded-xl p-5">
//                           <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
//                             {decision.approved ? (
//                               <CheckCircle2 className="w-7 h-7 text-green-500" />
//                             ) : (
//                               <XCircle className="w-7 h-7 text-red-500" />
//                             )}
//                             <div>
//                               <span className={`text-xl font-extrabold tracking-tight ${decision.approved ? "text-green-500" : "text-red-500"}`}>
//                                 {decision.approved ? "CRE APPROVED" : "CRE REJECTED"}
//                               </span>
//                               <span className="ml-3 text-xs text-slate-400 font-mono bg-white/5 px-2 py-1 rounded-md">
//                                 Code: {decision.reasonCode}
//                               </span>
//                             </div>
//                           </div>

//                           <table className="w-full text-sm font-mono text-slate-300">
//                             <tbody>
//                               <Row k="decided" v={String(decision.decided)} />
//                               <Row k="approved" v={String(decision.approved)} />
//                               <Row k="rejected" v={String(decision.rejected)} />
//                               <Row k="reasonCode" v={String(decision.reasonCode)} />
//                               <Row k="decidedAt" v={String(decision.decidedAt)} />
//                               <Row k="riskScore" v={String(decision.riskScore)} />
//                               <Row k="ltvBps" v={String(decision.ltvBps)} />
//                             </tbody>
//                           </table>

//                           <div className="mt-6 pt-5 border-t border-white/10">
//                             <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-bold uppercase tracking-wider">
//                               <span>Max LTV Limit</span>
//                               <span className="text-white">{(decision.ltvBps / 100).toFixed(2)}%</span>
//                             </div>
//                             <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10">
//                               <div
//                                 className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
//                                 style={{ width: `${ltvPct}%` }}
//                               />
//                             </div>
//                           </div>
//                         </div>
//                       )}
//                     </StepCard>

//                     <StepCard step={4} current={step} label="E" title="Execute Approved Borrow">
//                       <button
//                         onClick={handleExecuteBorrow}
//                         disabled={
//                           isPending ||
//                           isConfirming ||
//                           !decision?.approved ||
//                           requestId === null ||
//                           executedOnchain
//                         }
//                         className="w-full px-4 py-4 rounded-xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-500/20 hover:scale-[1.01] hover:bg-purple-500 disabled:opacity-50 disabled:hover:scale-100 transition-all"
//                       >
//                         {executedOnchain ? "Borrow Transferred Successfully" : "Execute Smart Contract Borrow"}
//                       </button>

//                       <div className="mt-4 text-xs font-mono text-slate-400 bg-black/40 p-3 rounded-lg border border-white/5">
//                         {requestId === null ? "Awaiting requestId generation…" : `Target RequestId: ${requestId.toString()}`}
//                         {requestState && (
//                           <span className="ml-3 text-purple-400">
//                             // Executed state: <span className="text-white font-bold">{String(executedOnchain)}</span>
//                           </span>
//                         )}
//                       </div>
//                     </StepCard>

//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
//                       <StepCard step={5} current={step} label="F" title="Repay Position">
//                         <div className="flex flex-col gap-3">
//                           <input
//                             type="number"
//                             step="0.01"
//                             placeholder={tokenDebt ? formatEther(tokenDebt as bigint) : "NL Amount"}
//                             value={repayAmount}
//                             onChange={(e) => setRepayAmount(e.target.value)}
//                             className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
//                           />
//                           <button
//                             onClick={handleApproveAndRepay}
//                             disabled={isPending || isConfirming}
//                             className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50 transition-all"
//                           >
//                             Approve & Repay
//                           </button>
//                         </div>
//                       </StepCard>

//                       <StepCard step={5} current={step} label="G" title="Withdraw Collateral" alwaysEnabled>
//                         <div className="flex flex-col gap-3">
//                           <input
//                             type="number"
//                             step="0.001"
//                             placeholder={ethCollateral ? formatEther(ethCollateral as bigint) : "ETH Amount"}
//                             value={withdrawAmount}
//                             onChange={(e) => setWithdrawAmount(e.target.value)}
//                             className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
//                           />
//                           <button
//                             onClick={handleWithdraw}
//                             disabled={isPending || isConfirming}
//                             className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/20 disabled:opacity-50 transition-all"
//                           >
//                             Withdraw ETH
//                           </button>
//                         </div>
//                       </StepCard>
//                     </div>

//                   </div>

//                   {/* Right: Onchain Activity Feed */}
//                   <div>
//                     <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-6 xl:sticky xl:top-28 shadow-xl">
//                       <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
//                         <h3 className="font-bold text-lg text-white flex items-center gap-2">
//                           <Activity className="w-5 h-5 text-orange-400" />
//                           Live Activity
//                         </h3>
//                         <button
//                           onClick={refetchAll}
//                           className="text-xs font-bold text-purple-400 hover:text-white transition-colors uppercase tracking-wider bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20"
//                         >
//                           Refresh
//                         </button>
//                       </div>

//                       {activity.length === 0 ? (
//                         <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-black/20">
//                           <p className="text-sm text-slate-500 font-mono">No onchain activity detected.</p>
//                         </div>
//                       ) : (
//                         <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
//                           {activity.map((a) => (
//                             <div key={a.id} className="flex items-start gap-3 text-sm group">
//                               <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 group-hover:bg-orange-400 group-hover:shadow-[0_0_8px_rgba(249,115,22,0.8)] transition-all" />
//                               <div className="min-w-0">
//                                 <p className="text-white font-medium mb-0.5">{a.label}</p>
//                                 <div className="flex items-center gap-3">
//                                   {a.txHash && (
//                                     <a
//                                       href={etherscanTx(a.txHash)}
//                                       target="_blank"
//                                       rel="noopener noreferrer"
//                                       className="text-xs font-mono text-purple-400 hover:text-orange-400 inline-flex items-center gap-1 transition-colors"
//                                     >
//                                       {shortHex(a.txHash)} <ExternalLink className="w-3 h-3" />
//                                     </a>
//                                   )}
//                                   <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
//                                     <Clock className="w-3 h-3" /> {a.timestamp.toLocaleTimeString()}
//                                   </p>
//                                 </div>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // Subcomponents specifically styled for the dark theme

// function Row({ k, v }: { k: string; v: string }) {
//   return (
//     <tr className="border-b border-white/5 last:border-0">
//       <td className="py-2.5 text-slate-500 pr-4">{k}</td>
//       <td className="py-2.5 font-mono text-white break-all">{v}</td>
//     </tr>
//   );
// }

// function StepCard({
//   step,
//   current,
//   label,
//   title,
//   alwaysEnabled = false,
//   children,
// }: {
//   step: number;
//   current: number;
//   label: string;
//   title: string;
//   alwaysEnabled?: boolean;
//   children: React.ReactNode;
// }) {
//   const isActive = alwaysEnabled ? true : current >= step;

//   return (
//     <div 
//       className={`backdrop-blur-md bg-white/5 border rounded-2xl p-6 md:p-8 transition-all duration-500 ${
//         isActive 
//           ? "border-white/10 opacity-100 shadow-[0_8px_30px_rgb(0,0,0,0.5)] ring-1 ring-white/5" 
//           : "border-transparent opacity-40 grayscale-[30%] hover:opacity-60 pointer-events-none"
//       }`}
//     >
//       <div className="flex items-center gap-4 mb-6">
//         <span
//           className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold shadow-lg ${
//             isActive 
//               ? "bg-purple-600 text-white shadow-purple-500/30" 
//               : "bg-white/10 text-slate-500"
//           }`}
//         >
//           {label}
//         </span>
//         <h3 className="font-extrabold text-xl text-white tracking-tight">{title}</h3>
//       </div>
//       {isActive ? <div className="space-y-2">{children}</div> : null}
//     </div>
//   );
// }
