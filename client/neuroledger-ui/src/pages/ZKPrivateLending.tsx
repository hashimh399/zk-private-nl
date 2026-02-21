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
// import { ExternalLink, Upload, Loader2, CheckCircle2, XCircle, Clock, Square } from "lucide-react";

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

// function isBytes32(x?: string | null): x is Hex32 {
//   return !!x && x.startsWith("0x") && x.length === 66;
// }

// function shortHex(x: string, n = 10) {
//   if (!x) return "";
//   return `${x.slice(0, n)}…${x.slice(-6)}`;
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

//   const isReady = isConnected && chainId === SEPOLIA_CHAIN_ID;

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

//   // request state read (optional but useful for UI)
//   const { data: requestState, refetch: refetchRequestState } = useReadContract({
//     address: CONTRACTS.borrowGate,
//     abi: borrowGateAbi,
//     functionName: "requests",
//     args: requestId !== null ? [requestId] : undefined,
//     query: { enabled: isReady && requestId !== null, refetchInterval: requestId ? 4000 : false },
//   });

//   const refetchAll = () => {
//     refetchCollateral();
//     refetchDebt();
//     refetchHF();
//     refetchNL();
//     if (requestId !== null) refetchRequestState();
//   };

//   // --- Writes
//   const { writeContract, data: lastTxHash, isPending } = useWriteContract();
//   const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: lastTxHash });

//   const addActivity = (label: string, hash?: string) => {
//     setActivity((prev) => [
//       { id: crypto.randomUUID(), label, txHash: hash, timestamp: new Date() },
//       ...prev,
//     ].slice(0, 20));
//   };

//   // --- HF formatting
//   const hfFormatted = useMemo(() => {
//     if (!healthFactor) return "0.0000";
//     return Number(formatUnits(healthFactor as bigint, 18)).toFixed(4);
//   }, [healthFactor]);

//   const hfNum = Number(hfFormatted);
//   const hfStatus: "safe" | "risk" | "liquidatable" =
//     hfNum === 0 ? "safe" : hfNum >= 1.5 ? "safe" : hfNum >= 1.0 ? "risk" : "liquidatable";

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
 
//   // --- Step C: Request borrow (robust event parsing)
//   const handleRequestBorrow = () => {
//     if (!isReady) return toast.error("Connect wallet to Sepolia.");
//     if (!proof) return toast.error("Upload a valid proof first.");
//     if (!publicClient) return toast.error("Public client unavailable.");

//     // quick bytes32 guard
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

//             // parse BorrowRequested from receipt logs
//             const parsed = parseEventLogs({
//               abi: borrowGateAbi,
//               logs: receipt.logs,
//               eventName: "BorrowRequested",
//             });

//             // pick the one from BorrowGate address
//             const ev = parsed.find(
//               (x) => (x.address as string).toLowerCase() === CONTRACTS.borrowGate.toLowerCase()
//             ) ?? parsed[0];

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

//   // --- Step D: Poll decision (single call using decisions(nullifier))
//   const pollOnce = async () => {
//     if (!publicClient || !nullifier) return;

//     try {
//       const d = await (publicClient as any).readContract({
//         address: CONTRACTS.borrowApprovalRegistry,
//         abi: borrowApprovalRegistryAbi,
//         functionName: "decisions",
//         args: [nullifier],
//       });

//       // d is tuple: [decided, approved, rejected, reasonCode, decidedAt, riskScore, ltvBps]
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
//       // keep silent; RPC hiccups are normal
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
//     if (requestId === null) return toast.error("Missing requestId (BorrowRequested not decoded).");
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

//   // --- Step F: Approve + repay
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
//           addActivity("Approved NL spend", hash);
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
//     if (step === 1) return "Upload proof";
//     if (step === 2) return "Request borrow";
//     if (step === 3) return "Await CRE decision";
//     if (step === 4) return "Execute borrow";
//     return "Position management (repay / withdraw)";
//   }, [isReady, step]);

//   return (
//     <div className="min-h-screen bg-background">
//       <Navbar />

//       <div className="pt-20 px-6 pb-12">
//         <div className="max-w-6xl mx-auto">
//           <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
//             <div>
//               <h1 className="text-3xl font-bold">ZK Private Lending</h1>
//               <p className="text-muted-foreground">NeuroLedger Protocol · Sepolia</p>
//             </div>
//             <WalletConnect />
//           </div>

//           {/* Flow status banner */}
//           <div className="card-elevated p-4 mb-6 flex items-center justify-between gap-4">
//             <div>
//               <p className="text-xs text-muted-foreground">Current Step</p>
//               <p className="font-semibold">{flowLabel}</p>
//             </div>
//             <div className="text-xs text-muted-foreground">
//               {isPending || isConfirming ? (
//                 <span className="inline-flex items-center gap-2">
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                   Transaction in progress…
//                 </span>
//               ) : (
//                 <span>Ready</span>
//               )}
//             </div>
//           </div>

//           {!isReady ? (
//             <div className="card-elevated p-12 text-center">
//               <p className="text-xl font-semibold mb-2">Connect your wallet to Sepolia</p>
//               <p className="text-muted-foreground">This demo interacts with verified contracts on Sepolia.</p>
//             </div>
//           ) : (
//             <>
//               {/* Metrics */}
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
//                 <MetricCard
//                   label="ETH Collateral"
//                   value={ethCollateral ? Number(formatEther(ethCollateral as bigint)).toFixed(6) : "0"}
//                   sub="ETH"
//                 />
//                 <MetricCard
//                   label="Token Debt"
//                   value={tokenDebt ? Number(formatEther(tokenDebt as bigint)).toFixed(4) : "0"}
//                   sub="NL"
//                 />
//                 <MetricCard label="Health Factor" value={hfFormatted} sub="≥ 1.0 safe" status={hfStatus} />
//                 <MetricCard
//                   label="NL Balance"
//                   value={nlBalance ? Number(formatEther(nlBalance as bigint)).toFixed(4) : "0"}
//                   sub="NL"
//                 />
//               </div>

//               <div className="grid lg:grid-cols-3 gap-6 mb-8">
//                 {/* Left: steps */}
//                 <div className="lg:col-span-2 space-y-4">
//                   <StepCard step={0} current={step} label="A" title="Deposit ETH Collateral">
//                     <div className="flex gap-2">
//                       <input
//                         type="number"
//                         step="0.001"
//                         placeholder="ETH amount"
//                         value={depositAmount}
//                         onChange={(e) => setDepositAmount(e.target.value)}
//                         className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
//                       />
//                       <button
//                         onClick={handleDeposit}
//                         disabled={isPending || isConfirming}
//                         className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                       >
//                         {isPending || isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deposit"}
//                       </button>
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">Deposit ETH as collateral into LendingPool.</p>
//                   </StepCard>

//                   <StepCard step={1} current={step} label="B" title="Upload ZK Proof">
//                     <label className="flex items-center gap-3 cursor-pointer border border-dashed border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
//                       <Upload className="w-5 h-5 text-muted-foreground" />
//                       <span className="text-sm text-muted-foreground">Upload proof JSON</span>
//                       <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
//                     </label>

//                     {proof && (
//                       <div className="mt-3 bg-muted rounded-lg p-3 text-xs font-mono space-y-1">
//                         <p>Amount: {proof.amount}</p>
//                         <p className="flex items-center gap-1">
//                           Nullifier: {shortHex(proof.nullifier)} <CopyButton text={proof.nullifier} />
//                         </p>
//                         <p>Root: {shortHex(proof.root)}</p>
//                         <p>Nonce: {proof.nonce}</p>
//                       </div>
//                     )}
//                   </StepCard>

//                   <StepCard step={2} current={step} label="C" title="Request Borrow" alwaysEnabled>
//                     <button
//                       onClick={handleRequestBorrow}
//                       disabled={isPending || isConfirming || !proof}
//                       className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                     >
//                       {isPending || isConfirming ? (
//                         <Loader2 className="w-4 h-4 animate-spin mx-auto" />
//                       ) : (
//                         "Submit Borrow Request"
//                       )}
//                     </button>

//                     {(requestTx || requestId !== null || nullifier) && (
//                       <div className="mt-3 bg-muted rounded-lg p-3 text-xs font-mono space-y-1">
//                         {requestTx && (
//                           <p className="flex items-center gap-2">
//                             Tx: <a className="text-primary underline" href={etherscanTx(requestTx)} target="_blank"> {shortHex(requestTx)} </a>
//                             <ExternalLink className="w-3 h-3" />
//                           </p>
//                         )}
//                         {requestId !== null && (
//                           <p className="flex items-center gap-1">
//                             RequestId: {requestId.toString()} <CopyButton text={requestId.toString()} />
//                           </p>
//                         )}
//                         {nullifier && (
//                           <p className="flex items-center gap-1">
//                             Nullifier: {shortHex(nullifier)} <CopyButton text={nullifier} />
//                           </p>
//                         )}
//                       </div>
//                     )}
//                   </StepCard>

//                   <StepCard step={3} current={step} label="D" title="Await CRE Decision">
//                     {!decision ? (
//                       <div className="flex items-center gap-3">
//                         <button
//                           onClick={startPolling}
//                           disabled={polling || !nullifier}
//                           className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                         >
//                           {polling ? (
//                             <>
//                               <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
//                               Polling…
//                             </>
//                           ) : (
//                             "Start Polling"
//                           )}
//                         </button>
//                         {polling && (
//                           <button
//                             onClick={stopPolling}
//                             className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm"
//                           >
//                             <Square className="w-3 h-3 inline mr-1" /> Stop
//                           </button>
//                         )}
//                       </div>
//                     ) : (
//                       <div className="bg-muted rounded-lg p-3">
//                         <div className="flex items-center gap-2 mb-3">
//                           {decision.approved ? (
//                             <CheckCircle2 className="w-5 h-5 text-success" />
//                           ) : (
//                             <XCircle className="w-5 h-5 text-destructive" />
//                           )}
//                           <span className="font-bold">{decision.approved ? "APPROVED" : "REJECTED"}</span>
//                         </div>

//                         <table className="w-full text-xs font-mono">
//                           <tbody>
//                             <Row k="decided" v={String(decision.decided)} />
//                             <Row k="approved" v={String(decision.approved)} />
//                             <Row k="rejected" v={String(decision.rejected)} />
//                             <Row k="reasonCode" v={String(decision.reasonCode)} />
//                             <Row k="decidedAt" v={String(decision.decidedAt)} />
//                             <Row k="riskScore" v={String(decision.riskScore)} />
//                             <Row k="ltvBps" v={String(decision.ltvBps)} />
//                           </tbody>
//                         </table>
//                       </div>
//                     )}
//                   </StepCard>

//                   <StepCard step={4} current={step} label="E" title="Execute Borrow">
//                     <button
//                       onClick={handleExecuteBorrow}
//                       disabled={
//                         isPending ||
//                         isConfirming ||
//                         !decision?.approved ||
//                         requestId === null ||
//                         executedOnchain
//                       }
//                       className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                     >
//                       {executedOnchain ? "Already Executed" : "Execute Borrow"}
//                     </button>

//                     <div className="mt-3 text-xs text-muted-foreground">
//                       {requestId === null ? "Waiting for requestId…" : `requestId: ${requestId.toString()}`}
//                       {requestState && (
//                         <span className="ml-2">
//                           · executed: <span className="font-mono">{String(executedOnchain)}</span>
//                         </span>
//                       )}
//                     </div>
//                   </StepCard>

//                   <StepCard step={5} current={step} label="F" title="Repay Debt">
//                     <div className="flex gap-2">
//                       <input
//                         type="number"
//                         step="0.01"
//                         placeholder={tokenDebt ? formatEther(tokenDebt as bigint) : "Amount"}
//                         value={repayAmount}
//                         onChange={(e) => setRepayAmount(e.target.value)}
//                         className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
//                       />
//                       <button
//                         onClick={handleApproveAndRepay}
//                         disabled={isPending || isConfirming}
//                         className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                       >
//                         Approve & Repay
//                       </button>
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Approves NL to LendingPool, then repays.
//                     </p>
//                   </StepCard>

//                   <StepCard step={5} current={step} label="G" title="Withdraw Collateral" alwaysEnabled>
//                     <div className="flex gap-2">
//                       <input
//                         type="number"
//                         step="0.001"
//                         placeholder={ethCollateral ? formatEther(ethCollateral as bigint) : "ETH amount"}
//                         value={withdrawAmount}
//                         onChange={(e) => setWithdrawAmount(e.target.value)}
//                         className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
//                       />
//                       <button
//                         onClick={handleWithdraw}
//                         disabled={isPending || isConfirming}
//                         className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
//                       >
//                         Withdraw
//                       </button>
//                     </div>
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Max: {ethCollateral ? formatEther(ethCollateral as bigint) : "0"} ETH
//                     </p>
//                   </StepCard>
//                 </div>

//                 {/* Right: activity */}
//                 <div>
//                   <div className="card-elevated p-5 sticky top-24">
//                     <div className="flex items-center justify-between mb-4">
//                       <h3 className="font-semibold">Recent Activity</h3>
//                       <button
//                         onClick={refetchAll}
//                         className="text-xs text-primary hover:underline"
//                       >
//                         Refresh
//                       </button>
//                     </div>

//                     {activity.length === 0 ? (
//                       <p className="text-sm text-muted-foreground">No activity yet</p>
//                     ) : (
//                       <div className="space-y-3">
//                         {activity.map((a) => (
//                           <div key={a.id} className="flex items-start gap-2 text-sm">
//                             <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
//                             <div className="min-w-0">
//                               <p className="text-foreground">{a.label}</p>
//                               {a.txHash && (
//                                 <a
//                                   href={etherscanTx(a.txHash)}
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   className="text-xs text-primary hover:underline inline-flex items-center gap-1"
//                                 >
//                                   {shortHex(a.txHash)} <ExternalLink className="w-3 h-3" />
//                                 </a>
//                               )}
//                               <p className="text-xs text-muted-foreground">{a.timestamp.toLocaleTimeString()}</p>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// function Row({ k, v }: { k: string; v: string }) {
//   return (
//     <tr className="border-b border-border last:border-0">
//       <td className="py-1 text-muted-foreground pr-4">{k}</td>
//       <td className="py-1 font-mono">{v}</td>
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
//     <div className={`card-elevated p-5 transition-opacity ${isActive ? "opacity-100" : "opacity-40"}`}>
//       <div className="flex items-center gap-3 mb-3">
//         <span
//           className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
//             isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
//           }`}
//         >
//           {label}
//         </span>
//         <h3 className="font-semibold">{title}</h3>
//       </div>
//       {isActive ? children : null}
//     </div>
//   );
// }


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
    if (requestId !== null) refetchRequestState();
  };

  // --- Writes
  const { writeContract, data: lastTxHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: lastTxHash });

  const addActivity = (label: string, hash?: string) => {
    setActivity((prev) => [
      { id: crypto.randomUUID(), label, txHash: hash, timestamp: new Date() },
      ...prev,
    ].slice(0, 20));
  };

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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

                  <StepCard step={3} current={step} label="D" title="Await CRE Decision">
                    {!decision ? (
                      <>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

                  <StepCard step={5} current={step} label="F" title="Repay Debt">
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
                      Max: {ethCollateral ? formatEther(ethCollateral as bigint) : "0"} ETH
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