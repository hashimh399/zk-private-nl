import { Link } from "react-router-dom";
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
} from "lucide-react";
import Navbar from "@/components/Navbar";

const PROTOCOL_THESIS =
  "This is a privacy-preserving lending flow where ZK proves eligibility, and Chainlink CRE runs a decentralized risk engine (with consensus) that attests an approval/rejection onchain—bringing institutional-grade risk controls to private DeFi.";

const zkFlow = [
  "1) User prepares private witness: identity secret + membership path + per-borrow nonce.",
  "2) Circuits generate Groth16 proof (a,b,c) and public signals (root, amount, nullifier, nonce).",
  "3) BorrowGate.requestBorrow(...) forwards proof to Groth16Verifier.verifyProof(...).",
  "4) If valid, BorrowRequested(requestId, borrower, nullifier, amount) is emitted.",
  "5) Nullifier replay is blocked, so each borrow attempt requires a fresh nonce/proof.",
];

const borrowLifecycle = [
  "A) User deposits ETH collateral into LendingPool.",
  "B) User submits borrow request with Groth16 proof via BorrowGate.",
  "C) Chainlink CRE workflow reads pool/borrow context and computes risk decision.",
  "D) Receiver writes decision onchain into BorrowApprovalRegistry.decisions[nullifier].",
  "E) User (or UI) polls decision; BorrowGate.executeBorrow(requestId) only proceeds if approved.",
  "F) LendingPool mints/transfers NL and updates debt; position is managed via repay/withdraw.",
];

const systemOverview = [
  {
    title: "Onchain Core (Sepolia)",
    details:
      "BorrowGate, Groth16Verifier, BorrowApprovalRegistry, LendingPool, NL token, Vault, and receiver contracts enforce verification, credit gating, mint/debt accounting, and settlement logic.",
  },
  {
    title: "Offchain Risk Fabric (Chainlink CRE)",
    details:
      "A decentralized workflow reacts to BorrowRequested events, evaluates policy/risk inputs, reaches consensus, then posts signed/forwarded reports onchain.",
  },
  {
    title: "Client + Prover",
    details:
      "Wallet user interacts via UI, generates proof artifacts (or uploads them), submits requests, and tracks decision-to-execution state transitions end-to-end.",
  },
];

const invariants = [
  "No valid proof, no borrow request acceptance.",
  "Nullifier uniqueness prevents proof replay across borrow attempts.",
  "Borrow execution is blocked unless registry decision is approved.",
  "Debt and collateral accounting remain synchronized in LendingPool state.",
  "Decision attestations are auditable onchain (requestId/nullifier traceability).",
];

const useCases = [
  {
    title: "Private Credit Underwriting",
    desc: "Prove policy eligibility without revealing sensitive borrower identity attributes onchain.",
    icon: Landmark,
  },
  {
    title: "Institutional Treasury Lending",
    desc: "Risk committee style controls (CRE consensus + policy checks) before debt minting is allowed.",
    icon: Building2,
  },
  {
    title: "Compliant DeFi Credit Rails",
    desc: "Support jurisdictional or mandate-based constraints while preserving user privacy via ZK.",
    icon: Scale,
  },
];

const roadmap = [
  "Production-grade oracle stack + market data redundancy and liveness SLAs.",
  "Policy versioning, governance controls, and formalized risk parameter change management.",
  "Independent risk adapters (multiple providers) with CRE consensus hardening.",
  "Expanded collateral sets and cross-chain settlement rails.",
  "Security hardening: audits, invariant/property testing, and formal verification for critical modules.",
  "Institutional controls: reporting APIs, attestations, and SOC/operational readiness.",
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <section className="card-elevated p-8 md:p-10 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono text-primary">
              <Network className="w-3.5 h-3.5" />
              Protocol Page · Sepolia
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              NeuroLedger Protocol
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-4xl">
              {PROTOCOL_THESIS}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/zk-private-lending"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Open Live Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Open Admin Dashboard
              </Link>
            </div>
          </section>

          <section className="grid lg:grid-cols-3 gap-6">
            {systemOverview.map((item) => (
              <article key={item.title} className="card-elevated p-6">
                <h2 className="text-xl font-bold mb-3">{item.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.details}</p>
              </article>
            ))}
          </section>

          <section className="card-elevated p-8 space-y-6">
            <h2 className="section-heading">Architecture Diagram 1 · ZK Proof Flow (Groth16)</h2>
            <p className="text-sm text-muted-foreground">
              Generation to onchain verification pipeline, including witness/public signal boundaries and replay protection.
            </p>
            <div className="grid md:grid-cols-2 gap-3 font-mono text-xs">
              {zkFlow.map((line) => (
                <div key={line} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                  {line}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Explainer:</span> private borrower inputs never need to be revealed onchain; only
              cryptographic validity and constrained public signals are verified before request registration.
            </p>
          </section>

          <section className="card-elevated p-8 space-y-6">
            <h2 className="section-heading">Architecture Diagram 2 · Borrow Lifecycle with CRE Decisioning</h2>
            <p className="text-sm text-muted-foreground">
              End-to-end sequence from collateralization to borrow execution after decentralized risk attestation.
            </p>
            <div className="grid md:grid-cols-2 gap-3 font-mono text-xs">
              {borrowLifecycle.map((line) => (
                <div key={line} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                  {line}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Explainer:</span> ZK handles privacy-preserving eligibility at request time;
              Chainlink CRE handles institutional-style risk scoring and consensus attestation before any mint/debt transition is allowed.
            </p>
          </section>

          <section className="card-elevated p-8 space-y-6">
            <h2 className="section-heading">Architecture Diagram 3 · System Overview</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-semibold mb-2">User + Client</p>
                <p className="text-muted-foreground">Wallet connect, proof submission, decision polling, execution, and lifecycle actions.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-semibold mb-2">Sepolia Contracts</p>
                <p className="text-muted-foreground">Borrow gatekeeping, proof verification, decision registry, debt/collateral accounting, token minting.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-semibold mb-2">Chainlink CRE</p>
                <p className="text-muted-foreground">Event-triggered consensus workflow, external risk signals, report forwarding and onchain attestation.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Explainer:</span> this split cleanly separates privacy proofs, policy/risk orchestration,
              and deterministic settlement logic into independently auditable layers.
            </p>
          </section>

          <section className="grid lg:grid-cols-2 gap-6">
            <article className="card-elevated p-7 space-y-4">
              <h2 className="section-heading inline-flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> How ZK Proofs Are Used
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Borrow eligibility is proven without exposing private identity/witness data.</li>
                <li>• Proof includes bound public values (root, amount, nullifier, nonce) checked by verifier contract.</li>
                <li>• BorrowGate only records a request after successful verifier return.</li>
                <li>• Nullifier pattern prevents proof reuse and replay across attempts.</li>
              </ul>
            </article>

            <article className="card-elevated p-7 space-y-4">
              <h2 className="section-heading inline-flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> How Chainlink CRE Is Used
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• CRE listens for borrow request events and evaluates risk with decentralized execution.</li>
                <li>• Consensus-driven decision output is forwarded onchain through receiver + registry.</li>
                <li>• Borrow execution path references registry approval status per nullifier/request.</li>
                <li>• This creates a clear audit trail from event trigger to final risk attestation.</li>
              </ul>
            </article>
          </section>

          <section className="card-elevated p-8 space-y-4">
            <h2 className="section-heading">Protocol Invariants Enforced</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {invariants.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="section-heading">Real-World Use Cases</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {useCases.map((u) => (
                <article key={u.title} className="card-elevated p-6">
                  <u.icon className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-semibold mb-2">{u.title}</h3>
                  <p className="text-sm text-muted-foreground">{u.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card-elevated p-8 space-y-4">
            <h2 className="section-heading inline-flex items-center gap-2">
              <Milestone className="w-5 h-5 text-primary" /> Roadmap to Institutional-Grade Adoption
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {roadmap.map((step) => (
                <li key={step}>• {step}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
