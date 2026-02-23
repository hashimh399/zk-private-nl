import React, { useEffect, useRef } from "react";
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

// --- Custom Background Component ---
const BlockchainNetworkBg = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        // Mix of Purple and Orange
        this.color = Math.random() > 0.5 ? "#a855f7" : "#f97316"; 
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    for (let i = 0; i < 80; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(168, 85, 247, ${1 - distance / 150})`; // Fading purple lines
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 bg-[#0a0a0a]" />;
};

// --- Protocol Data ---
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
    title: "Offchain Risk Fabric",
    details:
      "A decentralized workflow reacts to BorrowRequested events, evaluates policy/risk inputs, reaches consensus, then posts signed/forwarded reports onchain via Chainlink CRE.",
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
  "Security hardening: audits, invariant/property testing, and formal verification.",
  "Institutional controls: reporting APIs, attestations, and SOC/operational readiness.",
];

// --- Main Page Component ---
const Index = () => {
  return (
    <div className="min-h-screen relative text-slate-200 overflow-hidden font-sans">
      <BlockchainNetworkBg />
      
      {/* Top Gradient Overlay for readability */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />

      <div className="relative z-20">
        <Navbar />

        <main className="pt-32 pb-24 px-6">
          <div className="max-w-6xl mx-auto space-y-16">
            
            {/* HERO SECTION */}
            <section className="backdrop-blur-md bg-black/40 border border-purple-500/20 rounded-3xl p-8 md:p-12 shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] space-y-6 text-center lg:text-left flex flex-col lg:flex-row items-center gap-10">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/50 bg-orange-500/10 px-4 py-1.5 text-sm font-mono text-orange-400">
                  <Network className="w-4 h-4" />
                  Live on Sepolia Testnet
                </div>
                
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-purple-500 to-purple-400">
                  NeuroLedger
                </h1>
                
                <p className="text-slate-300 text-lg md:text-xl leading-relaxed max-w-2xl">
                  {PROTOCOL_THESIS}
                </p>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                  <Link
                    to="/zk-private-lending"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-bold hover:scale-105 transition-transform shadow-lg shadow-purple-500/25"
                  >
                    Launch DApp <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-purple-500/30 bg-black/50 text-slate-300 hover:bg-purple-900/30 transition-colors"
                  >
                    Open Admin Dashboard
                  </Link>
                </div>
              </div>
              
              {/* Feature/Logo Integration */}
              <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4">
                   {/* Replace src with actual Chainlink logo path */}
                  <img src="https://cryptologos.cc/logos/chainlink-link-logo.svg?v=029" alt="Chainlink" className="w-10 h-10" loading="lazy" />
                  <div>
                    <p className="font-bold text-white">Powered by CRE</p>
                    <p className="text-xs text-slate-400">Decentralized Risk Engine</p>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4">
                  <Shield className="w-10 h-10 text-purple-400" />
                  <div>
                    <p className="font-bold text-white">Zero-Knowledge</p>
                    <p className="text-xs text-slate-400">Groth16 Proof Verification</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ARCHITECTURE PLACEHOLDERS */}
            <div className="space-y-10">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Protocol Architecture</h2>
                <p className="text-slate-400">End-to-end integration mapping for the Convergence Hackathon</p>
              </div>

              {/* Diagram 1: ZK Proof Flow */}
              <section className="backdrop-blur-sm bg-black/30 border border-white/10 rounded-2xl p-8 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-2 h-full bg-purple-500" />
                <h3 className="text-2xl font-bold mb-4 text-white">1. ZK Proof Flow (Groth16)</h3>
                
                {/* Lazy Loaded Image Placeholder - Replace src with your public repo raw URL */}
                <div className="w-full h-64 md:h-96 bg-black/50 rounded-xl mb-6 flex items-center justify-center border border-white/5 overflow-hidden">
                  <img 
                    src="https://placehold.co/1200x600/111111/a855f7?text=ZK+Proof+Architecture+Diagram\n(Replace+with+Github+Raw+URL)" 
                    alt="ZK Flow Diagram" 
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4 font-mono text-sm">
                  {zkFlow.map((line, idx) => (
                    <div key={idx} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </section>

              {/* Diagram 2: Borrow Lifecycle & CRE */}
              <section className="backdrop-blur-sm bg-black/30 border border-white/10 rounded-2xl p-8 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-2 h-full bg-orange-500" />
                <h3 className="text-2xl font-bold mb-4 text-white flex items-center gap-3">
                  2. Borrow Lifecycle & Chainlink CRE
                  <img src="https://cryptologos.cc/logos/chainlink-link-logo.svg?v=029" alt="Chainlink" className="w-6 h-6" loading="lazy" />
                </h3>
                
                {/* Lazy Loaded Image Placeholder - Replace src with your public repo raw URL */}
                <div className="w-full h-64 md:h-96 bg-black/50 rounded-xl mb-6 flex items-center justify-center border border-white/5 overflow-hidden">
                  <img 
                    src="https://placehold.co/1200x600/111111/f97316?text=CRE+Borrow+Lifecycle+Diagram\n(Replace+with+Github+Raw+URL)" 
                    alt="Borrow Lifecycle Diagram" 
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4 font-mono text-sm">
                  {borrowLifecycle.map((line, idx) => (
                    <div key={idx} className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 text-slate-300">
                      {line}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* SYSTEM OVERVIEW GRID */}
            <section className="grid lg:grid-cols-3 gap-6">
              {systemOverview.map((item, idx) => (
                <article key={item.title} className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                  <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${idx === 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {idx === 0 ? <Network /> : idx === 1 ? <Shield /> : <Eye />}
                  </div>
                  <h2 className="text-xl font-bold mb-3 text-white">{item.title}</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.details}</p>
                </article>
              ))}
            </section>

            {/* INVARIANTS */}
            <section className="backdrop-blur-sm bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/30 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Protocol Invariants Enforced</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {invariants.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl bg-black/40 p-4 border border-white/5">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* USE CASES & ROADMAP */}
            <div className="grid lg:grid-cols-2 gap-8">
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Landmark className="text-orange-400" /> Real-World Use Cases
                </h2>
                <div className="space-y-4">
                  {useCases.map((u) => (
                    <article key={u.title} className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-5 flex gap-4 items-start hover:border-orange-500/30 transition-colors">
                      <u.icon className="w-6 h-6 text-orange-400 flex-shrink-0" />
                      <div>
                        <h3 className="font-bold text-white mb-1">{u.title}</h3>
                        <p className="text-sm text-slate-400">{u.desc}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-8 h-full">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
                  <Milestone className="text-purple-400" /> Path to Production
                </h2>
                <ul className="space-y-4 text-sm text-slate-300">
                  {roadmap.map((step, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;