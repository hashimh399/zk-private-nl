import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  ArrowRight,
  Shield,
  Eye,
  Scale,
  Building2,
  Landmark,
  Network,
  CheckCircle2,
  Milestone,
  Sparkles,
  AlertTriangle,
  Play,
  Copy,
  Check,
} from "lucide-react";

// ---------------------------------------------
// Background
// ---------------------------------------------
const BlockchainNetworkBg = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;

      constructor(width: number, height: number) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;
        this.radius = Math.random() * 2 + 1;
        this.color = Math.random() > 0.5 ? "#a855f7" : "#f97316";
      }

      update(width: number, height: number) {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }

      draw(context: CanvasRenderingContext2D) {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = this.color;
        context.fill();
      }
    }

    const initParticles = () => {
      particles = Array.from({ length: 80 }, () => new Particle(canvas.width, canvas.height));
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.update(canvas.width, canvas.height);
        p.draw(ctx);
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(168, 85, 247, ${1 - distance / 150})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animate();

    const handleResize = () => {
      resize();
      initParticles();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 bg-[#06070b]" />;
};

// ---------------------------------------------
// Small UI helpers
// ---------------------------------------------
const Badge = ({
  icon,
  children,
  tone = "purple",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "purple" | "orange" | "slate";
}) => {
  const toneMap: Record<string, string> = {
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-200",
    slate: "border-white/10 bg-white/5 text-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${toneMap[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
};

const SectionHeader = ({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) => {
  const alignment = align === "left" ? "text-left" : "text-center";
  const maxWidth = align === "left" ? "max-w-3xl" : "max-w-4xl mx-auto";

  return (
    <div className={`${alignment} ${maxWidth} space-y-3`}>
      {eyebrow ? (
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{eyebrow}</div>
      ) : null}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
        {title}
      </h2>
      {description ? (
        <p className="text-slate-400 text-base md:text-lg leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
};

const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
    >
      {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const MermaidSpec = ({
  title,
  code,
}: {
  title: string;
  code: string;
}) => {
  return (
    <details className="group rounded-2xl border border-white/10 bg-black/30 open:bg-black/40 transition-colors">
      <summary className="list-none cursor-pointer px-6 py-5 flex items-center justify-between gap-4">
        <div className="text-left">
          <div className="font-semibold text-white">{title}</div>
          <div className="text-sm text-slate-400 mt-1">
            Expand to view Mermaid source
          </div>
        </div>
        <div className="text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">
          +
        </div>
      </summary>

      <div className="px-6 pb-6">
        <div className="flex justify-end mb-4">
          <CopyButton code={code} />
        </div>
        <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/50 p-5 text-xs md:text-sm leading-relaxed">
          <code className="text-slate-200">{code}</code>
        </pre>
      </div>
    </details>
  );
};

const FlowCard = ({
  tone,
  title,
  subtitle,
  steps,
  summary,
}: {
  tone: "purple" | "orange";
  title: string;
  subtitle: string;
  steps: string[];
  summary: string;
}) => {
  const accents =
    tone === "purple"
      ? {
          border: "border-purple-500/20",
          glow: "from-purple-500/15 to-purple-500/0",
          chip: "bg-purple-500/15 text-purple-200 border-purple-500/20",
          step: "bg-purple-500/15 text-purple-200 border-purple-500/20",
        }
      : {
          border: "orange-500/20",
          glow: "from-orange-500/15 to-orange-500/0",
          chip: "bg-orange-500/15 text-orange-200 border-orange-500/20",
          step: "bg-orange-500/15 text-orange-200 border-orange-500/20",
        };

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border ${accents.border} bg-black/30 p-8 md:p-10`}
    >
      <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accents.glow} pointer-events-none`} />

      <div className="relative">
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${accents.chip}`}>
          Core protocol flow
        </div>

        <h3 className="mt-4 text-2xl md:text-3xl font-bold text-white">{title}</h3>
        <p className="mt-2 text-slate-400 leading-relaxed">{subtitle}</p>

        <div className="mt-8 space-y-4">
          {steps.map((step, idx) => (
            <div key={step} className="flex items-start gap-4">
              <div
                className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${accents.step}`}
              >
                {idx + 1}
              </div>
              <div className="text-slate-200 leading-relaxed">{step}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">Why it matters</div>
          <div className="text-slate-200 leading-relaxed">{summary}</div>
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------
// Content
// ---------------------------------------------
const YOUTUBE_VIDEO_ID = "5mZSca-KnXM";

const problemPoints = [
  "Open access creates spam and Sybil risk for private credit systems.",
  "Static risk models cannot adapt per borrower or market condition.",
  "Liquidation infrastructure often depends on centralized keeper logic.",
  "Most protocols blur policy, execution, and trust boundaries.",
];

const solutionPoints = [
  "Borrower eligibility is proven privately with zero knowledge proofs.",
  "Borrow requests trigger a CRE workflow that evaluates market and AI signals off-chain.",
  "The decision is written on-chain and execution is gated by registry state.",
  "Liquidation is automated through CRE keepers with oracle-backed Health Factor logic.",
];

const enablesPoints = [
  "Private credit rails without publicly exposing borrower secrets.",
  "Permissioned and policy-aware lending for more institutional use cases.",
  "Adaptive risk layers that can evolve without rewriting the core protocol.",
  "Autonomous solvency protection with full and partial liquidation paths.",
];

const borrowSteps = [
  "The user generates or uploads a ZK proof that binds amount, root, nullifier, and nonce.",
  "BorrowGate.requestBorrow(...) verifies the proof and emits BorrowRequested if valid.",
  "Chainlink CRE risk orchestration evaluates Fear & Greed, Gemini score, and deterministic checks.",
  "CREBorrowDecisionReceiver writes the signed report on-chain into BorrowApprovalRegistry.",
  "The user calls executeBorrow(); BorrowGate checks the registry decision before proceeding.",
  "LendingPool.borrowFor(...) transfers NL to the borrower and updates debt state.",
];

const liquidationSteps = [
  "A CRE cron workflow scans borrower positions and checks Health Factor continuously.",
  "LendingPool uses oracle prices for collateral valuation and Health Factor computation.",
  "For HF < 1, CRE computes the minimum repay amount required to restore solvency off-chain.",
  "CRELiquidationReceiver forwards the signed liquidation report to the protocol.",
  "LendingPool.creLiquidate(...) performs full liquidation if repay >= debt, otherwise partial liquidation.",
  "Collateral is seized proportionally and the position is brought back to a healthy state.",
];

const guardrailCards = [
  {
    title: "Private eligibility is enforced",
    text: "No valid Groth16 proof means no borrow request can enter the protocol.",
  },
  {
    title: "Registry decision gates execution",
    text: "Borrow execution is blocked unless the approval decision exists and is approved on-chain.",
  },
  {
    title: "Solvency math stays deterministic",
    text: "Oracle-backed Health Factor, debt accounting, and liquidation paths are enforced by contracts.",
  },
  {
    title: "CRE is bounded by contract logic",
    text: "CRE computes policy and reports state, but it does not bypass on-chain enforcement.",
  },
];

const useCases = [
  {
    title: "Private Credit Underwriting",
    desc: "Prove policy eligibility without exposing sensitive borrower attributes on-chain.",
    icon: Landmark,
  },
  {
    title: "Institutional Treasury Lending",
    desc: "Use policy-aware risk decisions before allowing debt minting and execution.",
    icon: Building2,
  },
  {
    title: "Compliant Credit Rails",
    desc: "Support mandate-driven lending constraints while preserving borrower privacy.",
    icon: Scale,
  },
];

const roadmap = [
  "Oracle redundancy, liveness monitoring, and production-grade data feeds.",
  "Policy versioning, governance controls, and risk parameter change management.",
  "Multiple risk adapters with stronger CRE consensus hardening.",
  "Expanded collateral support and cross-chain settlement rails.",
  "Security hardening through audits, invariant testing, and formal verification.",
  "Institutional reporting surfaces and operational readiness controls.",
];

// ---------------------------------------------
// Main Page
// ---------------------------------------------
const Index = () => {
  const mermaid = useMemo(() => {
    const borrowFlow = `sequenceDiagram
  autonumber
  participant U as User + Wallet
  participant FE as dApp (Next.js)
  participant BG as BorrowGate.sol
  participant V as ZK Verifier (Groth16)
  participant CRE as Chainlink CRE Borrow Risk Workflow
  participant FG as Fear & Greed API
  participant GM as Gemini API
  participant RCV as CREBorrowDecisionReceiver
  participant REG as BorrowApprovalRegistry
  participant LP as LendingPool.sol
  participant NL as NL Token

  U->>FE: Generate or upload ZK proof
  FE->>BG: requestBorrow(a,b,c, publicSignals)
  BG->>V: verifyProof(a,b,c, publicSignals)
  V-->>BG: valid / invalid

  alt valid proof
    BG-->>CRE: BorrowRequested(requestId, borrower, nullifier, amount)
    CRE->>FG: Fetch market signal
    CRE->>GM: Fetch riskScoreBp
    Note over CRE: Approve if riskScoreBp < 8000\\nand deterministic checks pass
    CRE-->>RCV: Signed CRE report
    RCV-->>REG: Write approval decision on-chain
    U->>BG: executeBorrow(requestId)
    BG->>REG: Read decision by nullifier
    alt approved
      BG->>LP: borrowFor(borrower, amount)
      LP-->>NL: transfer NL
      NL-->>U: Borrowed NL received
    else rejected
      BG-->>U: execution blocked
    end
  else invalid proof
    BG-->>U: request rejected
  end`;

    const liquidationFlow = `sequenceDiagram
  autonumber
  participant CREL as CRE Liquidation Workflow
  participant LP as LendingPool
  participant ORA as Price Oracle
  participant RCVL as CRELiquidationReceiver
  participant U as Borrower

  CREL->>LP: Scan borrowers
  loop each borrower
    CREL->>LP: Read collateral, debt, HF
    LP->>ORA: Read price
    ORA-->>LP: latest ETH price
    LP-->>CREL: Position state
    alt HF < 1
      Note over CREL: Compute repay amount\\nneeded to restore HF > 1
      CREL-->>RCVL: Signed report (borrower, repayAmount)
      RCVL->>LP: creLiquidate(borrower, repayAmount)
      alt repayAmount >= debt
        LP-->>U: Full liquidation
      else repayAmount < debt
        LP-->>U: Partial liquidation
      end
    else HF >= 1
      CREL-->>CREL: skip
    end
  end`;

    const zkAccess = `flowchart TB
  subgraph Client
    W[Witness / pass file]
    P[Groth16 Prover]
    W --> P
  end

  subgraph Outputs
    PR[Proof a,b,c]
    R[root]
    N[nullifier]
    NO[nonce]
    A[amount]
  end

  P --> PR
  P --> R
  P --> N
  P --> NO
  P --> A

  subgraph OnChain
    BG[BorrowGate.requestBorrow]
    V[Groth16 Verifier]
    REG[Decision Registry]
  end

  PR --> BG
  R --> BG
  N --> BG
  NO --> BG
  A --> BG
  BG --> V
  V --> BG
  BG --> REG`;

    const trustBoundary = `flowchart LR
  subgraph Client
    U[User + Wallet]
    FE[dApp]
  end

  subgraph OffChain
    CRE[Chainlink CRE]
    FG[Fear & Greed API]
    GM[Gemini API]
  end

  subgraph OnChain
    BG[BorrowGate]
    V[Groth16 Verifier]
    REG[BorrowApprovalRegistry]
    LP[LendingPool]
    ORA[Price Oracle]
  end

  U --> FE
  FE --> BG
  BG --> V
  CRE --> FG
  CRE --> GM
  CRE --> REG
  BG --> REG
  BG --> LP
  LP --> ORA`;

    const guardrails = `flowchart TB
  A[BorrowRequested] --> B[CRE risk workflow]
  B --> C{Fear & Greed OK?}
  C -- no --> R5[Reject reasonCode=5]
  C -- yes --> D{Gemini riskScoreBp < 8000?}
  D -- no --> R7[Reject reasonCode=7]
  D -- yes --> E{Deterministic checks}
  E -- HF fail --> R2[Reject reasonCode=2]
  E -- LTV fail --> R3[Reject reasonCode=3]
  E -- Borrow limit fail --> R4[Reject reasonCode=4]
  E -- pass --> OK[Approve reasonCode=0]

  OK --> REG[Write decision on-chain]
  REG --> EX[executeBorrow allowed]`;

    return { borrowFlow, liquidationFlow, zkAccess, trustBoundary, guardrails };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#06070b] text-slate-200 font-sans">
      <BlockchainNetworkBg />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.10),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.08),transparent_25%)] pointer-events-none z-10" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />

      <div className="relative z-20">
        <Navbar />

        <main className="pt-24 md:pt-28 pb-24">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
            {/* HERO */}
            <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/40">
              <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
              <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-10 p-8 md:p-12 lg:p-16">
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge icon={<Sparkles className="w-4 h-4" />} tone="purple">
                      NeuroLedger Protocol
                    </Badge>
                    <Badge icon={<Network className="w-4 h-4" />} tone="orange">
                      Live on Sepolia
                    </Badge>
                  </div>

                  <div className="space-y-5">
                    <h1 className="max-w-5xl text-5xl md:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
                      ZK-Gated Lending With CRE-Orchestrated Risk & Liquidations
                    </h1>

                    <p className="max-w-3xl text-lg md:text-xl leading-relaxed text-slate-300">
                      NeuroLedger combines private borrower eligibility, off-chain risk
                      orchestration through Chainlink CRE, and deterministic on-chain
                      enforcement to create a policy-aware lending protocol.
                      NeuroLedger separates policy from execution:
CRE computes risk policy off-chain while smart contracts enforce solvency and execution on-chain.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Link
                      to="/zk-private-lending"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 px-6 py-3 text-white font-semibold shadow-lg shadow-purple-500/20 transition hover:scale-[1.02]"
                    >
                      Launch Protocol <ArrowRight className="w-5 h-5" />
                    </Link>

                    <button
  onClick={(e) => {
    e.preventDefault();
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  }}
  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-slate-100 font-semibold transition hover:bg-white/10"
>
  Watch Demo <Play className="w-5 h-5" />
</button>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">
                        Eligibility
                      </div>
                      <div className="text-white font-semibold">Groth16 proof verification</div>
                      <div className="text-sm text-slate-400 mt-1">
                        root, nullifier, nonce, amount
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">
                        Policy Layer
                      </div>
                      <div className="text-white font-semibold">CRE risk orchestration</div>
                      <div className="text-sm text-slate-400 mt-1">
                        event-driven decisions + cron liquidations
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">
                        Enforcement
                      </div>
                      <div className="text-white font-semibold">On-chain execution gates</div>
                      <div className="text-sm text-slate-400 mt-1">
                        registry, oracle pricing, Health Factor
                      </div>
                    </div>
                  </div>
                </div>

                {/* Protocol snapshot */}
                <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Protocol at a glance
                      </div>
                      <div className="mt-2 text-2xl font-bold text-white">
                        Three-layer architecture
                      </div>
                    </div>
                  - 
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="text-sm font-semibold text-white">1. Private eligibility</div>
                      <div className="mt-2 text-sm text-slate-400 leading-relaxed">
                        Borrowers prove they are eligible without exposing their secret.
                        Nullifiers prevent replay across borrow attempts.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="text-sm font-semibold text-white">2. Off-chain policy</div>
                      <div className="mt-2 text-sm text-slate-400 leading-relaxed">
                        Chainlink CRE consumes protocol events, evaluates risk with market
                        and AI signals, and produces a signed decision report.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="text-sm font-semibold text-white">3. On-chain execution</div>
                      <div className="mt-2 text-sm text-slate-400 leading-relaxed">
                        Contracts enforce proof validity, decision gating, oracle-backed
                        Health Factor, and full or partial liquidation paths.
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                    <div className="text-sm font-semibold text-white">Core principle</div>
                    <div className="mt-2 text-sm text-slate-300 leading-relaxed">
                      NeuroLedger separates <span className="text-white font-medium">policy</span>{" "}
                      from <span className="text-white font-medium">execution</span>. CRE
                      computes the policy layer; smart contracts enforce the result.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* VALUE STRIP */}
            <section className="grid lg:grid-cols-3 gap-6">
              <article className="rounded-3xl border border-white/10 bg-black/30 p-8">
                <Shield className="w-10 h-10 text-purple-300" />
                <h3 className="mt-5 text-2xl font-bold text-white">Private access control</h3>
                <p className="mt-3 text-slate-400 leading-relaxed">
                  Borrower eligibility is proven through ZK, so access can be policy-aware
                  without exposing identity secrets on-chain.
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-black/30 p-8">
                <Network className="w-10 h-10 text-orange-300" />
                <h3 className="mt-5 text-2xl font-bold text-white">
                  Off-chain policy, on-chain enforcement
                </h3>
                <p className="mt-3 text-slate-400 leading-relaxed">
                  Chainlink CRE orchestrates risk decisions; contracts enforce approval gates,
                  execution paths, and solvency rules deterministically.
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-black/30 p-8">
                <AlertTriangle className="w-10 h-10 text-red-300" />
                <h3 className="mt-5 text-2xl font-bold text-white">Autonomous solvency</h3>
                <p className="mt-3 text-slate-400 leading-relaxed">
                A CRE cron workflow sweeps positions, checks oracle-backed HF, and triggers partial/full liquidations to restore solvency.
                </p>
              </article>
            </section>

            {/* WHY THIS MATTERS */}
            <section className="space-y-10">
              <SectionHeader
                eyebrow="Protocol thesis"
                title="Why NeuroLedger matters"
                description="This protocol is built for private, policy-aware lending—where borrower eligibility stays private, risk decisions stay modular, and execution remains deterministic."
              />

              <div className="grid xl:grid-cols-3 gap-6">
                <article className="rounded-3xl border border-white/10 bg-black/30 p-8">
                  <div className="text-sm font-semibold text-red-200">The problem</div>
                  <h3 className="mt-3 text-2xl font-bold text-white">
                    Today’s DeFi lending is open, static, and reactive
                  </h3>
                  <ul className="mt-6 space-y-4">
                    {problemPoints.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-3xl border border-purple-500/20 bg-black/30 p-8">
                  <div className="text-sm font-semibold text-purple-200">The NeuroLedger model</div>
                  <h3 className="mt-3 text-2xl font-bold text-white">
                    Private eligibility, CRE policy, deterministic execution
                  </h3>
                  <ul className="mt-6 space-y-4">
                    {solutionPoints.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-3xl border border-orange-500/20 bg-black/30 p-8">
                  <div className="text-sm font-semibold text-orange-200">What this enables</div>
                  <h3 className="mt-3 text-2xl font-bold text-white">
                    A more institutional-grade DeFi credit stack
                  </h3>
                  <ul className="mt-6 space-y-4">
                    {enablesPoints.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </section>

            {/* ARCHITECTURE */}
            <section className="space-y-10">
              <SectionHeader
                eyebrow="System architecture"
                title="One system, three layers: private eligibility, off-chain policy, on-chain execution"
                description="The architecture below is the protocol’s control surface: ZK controls who may request a borrow, CRE computes risk policy, and the contracts enforce execution and liquidation."
              />

              <div className="grid xl:grid-cols-[minmax(0,1.55fr)_380px] gap-6 items-start">
                <div className="rounded-[28px] border border-white/10 bg-black/30 p-4 md:p-6">
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                    <img
                      src="/neuroledger.svg"
                      alt="NeuroLedger architecture diagram"
                      className="w-full h-auto object-contain"
                      loading="eager"
                    />
                  </div>
                </div>

                <aside className="space-y-4">
                

                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                    <div className="text-sm font-semibold text-slate-300">Reading the diagram</div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-yellow-400" />
                        Borrow request transaction
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-green-400" />
                        Borrow execution transaction
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-red-400" />
                        Liquidation actions
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-purple-400" />
                        Off-chain compute / CRE logic
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
                    <div className="text-sm font-semibold text-slate-300">What is enforced on-chain?</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-300" />
                        zk verification and proof validity
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-300" />
                        Registry-based decision gating before execution
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-300" />
                        Oracle-backed collateral valuation and Health Factor
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-300" />
                        Full or partial liquidation paths in LendingPool
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            {/* CORE FLOWS */}
            <section className="space-y-10">
              <SectionHeader
                eyebrow="Core protocol flows"
                title="Borrowing and liquidation are explicit, auditable flows"
                description="Each critical path is decomposed into discrete steps so the policy layer, enforcement layer, and solvency logic stay understandable and inspectable."
              />

              <div className="grid xl:grid-cols-2 gap-6">
                <FlowCard
                  tone="purple"
                  title="Borrow flow"
                  subtitle="Eligibility is private, decisioning is off-chain, and execution is gated on-chain."
                  steps={borrowSteps}
                  summary="Borrowing is never a single opaque action. It is a policy-aware pipeline: prove eligibility, request credit, receive a risk decision, then execute only if the protocol allows it."
                />

                <FlowCard
                  tone="orange"
                  title="Liquidation flow"
                  subtitle="The protocol continuously monitors solvency and restores unhealthy positions automatically."
                  steps={liquidationSteps}
                  summary="Liquidation is not a manual bot race. CRE computes the minimum corrective action, then the protocol executes the appropriate full or partial path deterministically."
                />
              </div>
            </section>

            {/* GUARDRAILS */}
            <section className="space-y-10">
              <SectionHeader
                eyebrow="Trust boundaries"
                title="Guardrails designed"
                description="NeuroLedger does not ask you to trust an AI. AI is confined to a bounded policy layer while smart contracts remain the source of truth for execution and solvency."
              />

              <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {guardrailCards.map((card, idx) => {
                  const tones = [
                    "border-purple-500/20",
                    "border-orange-500/20",
                    "border-white/10",
                    "border-red-500/20",
                  ];
                  return (
                    <article
                      key={card.title}
                      className={`rounded-3xl border ${tones[idx]} bg-black/30 p-6`}
                    >
                      <div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                        {idx === 0 ? (
                          <Shield className="w-5 h-5 text-purple-300" />
                        ) : idx === 1 ? (
                          <CheckCircle2 className="w-5 h-5 text-orange-300" />
                        ) : idx === 2 ? (
                          <Eye className="w-5 h-5 text-slate-200" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-300" />
                        )}
                      </div>
                      <h3 className="mt-5 text-xl font-bold text-white">{card.title}</h3>
                      <p className="mt-3 text-sm text-slate-400 leading-relaxed">{card.text}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* DEMO */}
            <section id="demo" className="space-y-10">
              <SectionHeader
                eyebrow="Live demo"
                title="Watch the protocol run end-to-end"
                description="The demo will show a full borrow request, CRE decisioning, on-chain execution, and a liquidation flow that restores Health Factor automatically."
              />

              <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6 items-stretch">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-8">
                  <div className="text-sm font-semibold text-slate-300">Demo storyline</div>
                  <h3 className="mt-3 text-3xl font-bold text-white">
                   Deposit → Borrow → decide → execute → liquidate
                  </h3>

                  <div className="mt-8 space-y-5">
                    {[
                      "User submits a borrow request with a valid ZK proof.",
                      "CRE risk workflow consumes the BorrowRequested event.",
                      "Decision is written on-chain through the receiver and registry.",
                      "executeBorrow() succeeds only after the decision is approved.",
                      "A liquidation workflow later detects HF < 1 and restores solvency.",
                    ].map((item, idx) => (
                      <div key={item} className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white">
                          {idx + 1}
                        </div>
                        <div className="text-slate-300 leading-relaxed">{item}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4 md:p-6">
                  <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black/50 relative">
                    {YOUTUBE_VIDEO_ID ? (
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
                        title="NeuroLedger Demo"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mb-4">
                          <Play className="w-8 h-8 text-white/80" />
                        </div>
                        <div className="text-xl font-bold text-white">Demo video placeholder</div>
                        <div className="mt-2 max-w-xl text-sm text-slate-400 leading-relaxed">
                          Upload your live demo to YouTube and set{" "}
                          <span className="font-mono text-slate-200">YOUTUBE_VIDEO_ID</span> to
                          embed it here.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* USE CASES + ROADMAP */}
            <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-6">
              <section className="space-y-6">
                <SectionHeader
                  eyebrow="Use cases"
                  title="Who this architecture is for"
                  description="NeuroLedger is designed for credit systems that need privacy, policy awareness, and stronger execution boundaries."
                  align="left"
                />

                <div className="space-y-4">
                  {useCases.map((u) => (
                    <article
                      key={u.title}
                      className="rounded-3xl border border-white/10 bg-black/30 p-6 flex gap-4 items-start"
                    >
                      <u.icon className="w-6 h-6 text-orange-300 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-lg font-bold text-white">{u.title}</h3>
                        <p className="mt-2 text-sm text-slate-400 leading-relaxed">{u.desc}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-black/30 p-8 md:p-10">
                <div className="flex items-center gap-3">
                  <Milestone className="w-7 h-7 text-purple-300" />
                  <h2 className="text-3xl font-bold text-white">Path to production</h2>
                </div>

                <ul className="mt-8 space-y-5">
                  {roadmap.map((step, idx) => (
                    <li key={idx} className="flex gap-4 items-start">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-purple-400 flex-shrink-0" />
                      <span className="text-slate-300 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* TECHNICAL APPENDIX */}
            <section className="space-y-8">
              <SectionHeader
                eyebrow="Technical appendix"
                title="Mermaid specs for documentation and deck diagrams"
                description=""
              />

              <div className="grid lg:grid-cols-2 gap-4">
                <MermaidSpec title="Borrow flow sequence diagram" code={mermaid.borrowFlow} />
                <MermaidSpec title="Liquidation flow sequence diagram" code={mermaid.liquidationFlow} />
                <MermaidSpec title="ZK access control diagram" code={mermaid.zkAccess} />
                
                <MermaidSpec title="Failure modes / guardrails diagram" code={mermaid.guardrails} />
              </div>
            </section>

            {/* FINAL CTA */}
            <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-purple-900/20 via-black/40 to-orange-900/10 p-10 md:p-14 text-center">
              <div className="max-w-4xl mx-auto">
                <div className="text-sm uppercase tracking-[0.22em] text-slate-400 mb-4">
                  Protocol summary
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                  NeuroLedger = ZK + CRE + AI → Autonomous Lending Protocol
                </h2>
                <p className="mt-5 text-slate-300 text-lg leading-relaxed">
                  Borrowers prove eligibility privately, CRE computes policy and risk,
                  and contracts enforce execution and solvency on-chain.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/zk-private-lending"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 px-6 py-3 text-white font-semibold shadow-lg shadow-purple-500/20 transition hover:scale-[1.02]"
                  >
                    Launch Protocol <ArrowRight className="w-5 h-5" />
                  </Link>

                 <button
  onClick={(e) => {
    e.preventDefault();
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  }}
  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-slate-100 font-semibold transition hover:bg-white/10"
>
  Watch Demo <Play className="w-5 h-5" />
</button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;