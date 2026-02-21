import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { formatEther } from "viem";
import Navbar from "@/components/Navbar";
import WalletConnect from "@/components/WalletConnect";
import { Address, CopyButton } from "@/components/shared";
import { CONTRACTS, CONTRACT_LABELS, SEPOLIA_CHAIN_ID, etherscanAddress } from "@/config/contracts";
import { borrowApprovalRegistryAbi, borrowGateAbi } from "@/config/abis";
import { ShieldAlert, Copy, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";

const ADMIN_ROLE = "0xeE7B99c587C1667b396EbC87a176136Be1B4f031" as `0x${string}`;

const Admin = () => {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const isReady = isConnected && chainId === SEPOLIA_CHAIN_ID;

  const { data: isAdmin, isLoading: checkingAdmin } = useReadContract({
    address: CONTRACTS.borrowApprovalRegistry,
    abi: borrowApprovalRegistryAbi,
    functionName: "hasRole",
    args: address ? [ADMIN_ROLE, address] : undefined,
    query: { enabled: !!address && isReady },
  });

  const [events, setEvents] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<Map<string, any>>(new Map());
  const [filter, setFilter] = useState<"all" | "approved" | "rejected" | "pending">("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin || !publicClient) return;
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACTS.borrowGate,
          event: {
            type: "event", name: "BorrowRequested",
            inputs: [
              { name: "requestId", type: "uint256", indexed: true },
              { name: "borrower", type: "address", indexed: true },
              { name: "nullifier", type: "bytes32", indexed: false },
              { name: "amount", type: "uint256", indexed: false },
            ],
          },
          fromBlock: BigInt(0),
          toBlock: "latest",
        } as any);
        setEvents(logs as any[]);

        const decs = new Map<string, any>();
        for (const log of logs as any[]) {
          const nullifier = log.args?.nullifier;
          if (!nullifier) continue;
          try {
            const decided = await (publicClient as any).readContract({
              address: CONTRACTS.borrowApprovalRegistry, abi: borrowApprovalRegistryAbi,
              functionName: "isDecided", args: [nullifier],
            });
            if (decided) {
              const approved = await (publicClient as any).readContract({
                address: CONTRACTS.borrowApprovalRegistry, abi: borrowApprovalRegistryAbi,
                functionName: "isApproved", args: [nullifier],
              });
              const data = await (publicClient as any).readContract({
                address: CONTRACTS.borrowApprovalRegistry, abi: borrowApprovalRegistryAbi,
                functionName: "decisions", args: [nullifier],
              });
              decs.set(nullifier, { decided: true, approved, data });
            } else {
              decs.set(nullifier, { decided: false });
            }
          } catch {}
        }
        setDecisions(decs);
      } catch (e) {
        console.error("Failed to fetch events", e);
      }
      setLoading(false);
    };
    fetchEvents();
  }, [isAdmin, publicClient]);

  const filteredEvents = events.filter((ev) => {
    const nullifier = (ev.args as any)?.nullifier;
    const dec = decisions.get(nullifier);
    if (filter === "all") return true;
    if (filter === "pending") return !dec?.decided;
    if (filter === "approved") return dec?.approved === true;
    if (filter === "rejected") return dec?.decided && !dec?.approved;
    return true;
  });

  const copyAll = () => {
    const text = Object.entries(CONTRACTS)
      .filter(([k]) => k !== "currentMerkleRoot")
      .map(([k, v]) => `${CONTRACT_LABELS[k] || k}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Protocol Administration · Sepolia</p>
            </div>
            <WalletConnect />
          </div>

          {!isReady ? (
            <div className="card-elevated p-12 text-center">
              <p className="text-xl font-semibold mb-2">Connect your wallet to Sepolia</p>
            </div>
          ) : checkingAdmin ? (
            <div className="card-elevated p-12 text-center">
              <p className="text-muted-foreground">Checking admin role…</p>
            </div>
          ) : !isAdmin ? (
            <div className="card-elevated p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">Access Restricted</p>
              <p className="text-muted-foreground">Connected wallet does not have admin role on the BorrowApprovalRegistry.</p>
              <p className="text-sm text-muted-foreground mt-2 font-mono">{CONTRACTS.deployer}</p>
            </div>
          ) : (
            <>
              <div className="card-elevated p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Deployed Contracts</h2>
                  <button onClick={copyAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3.5 h-3.5" /> Copy All
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {Object.entries(CONTRACTS)
                    .filter(([k]) => k !== "currentMerkleRoot")
                    .map(([key, addr]) => (
                      <div key={key} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <span className="text-xs text-muted-foreground">{CONTRACT_LABELS[key] || key}</span>
                        <div className="flex items-center gap-1">
                          <Address addr={addr} />
                          <a href={etherscanAddress(addr)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="font-semibold text-lg">Borrow Decisions</h2>
                  <div className="flex gap-1">
                    {(["all", "approved", "rejected", "pending"] as const).map((f) => (
                      <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <p className="text-muted-foreground text-sm py-6 text-center">Loading events…</p>
                ) : filteredEvents.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 text-center">No events found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="pb-2 pr-4">Borrower</th>
                          <th className="pb-2 pr-4">Request ID</th>
                          <th className="pb-2 pr-4">Amount</th>
                          <th className="pb-2 pr-4">Nullifier</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {filteredEvents.map((ev, i) => {
                          const args = ev.args as any;
                          const dec = decisions.get(args?.nullifier);
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="py-3 pr-4"><Address addr={args?.borrower || ""} /></td>
                              <td className="py-3 pr-4">{args?.requestId?.toString()}</td>
                              <td className="py-3 pr-4">{args?.amount ? formatEther(args.amount) : "?"} NL</td>
                              <td className="py-3 pr-4">{args?.nullifier?.slice(0, 10)}…</td>
                              <td className="py-3">
                                {!dec?.decided ? (
                                  <span className="inline-flex items-center gap-1 text-warning"><Clock className="w-3 h-3" /> Pending</span>
                                ) : dec.approved ? (
                                  <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> Approved</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" /> Rejected</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
