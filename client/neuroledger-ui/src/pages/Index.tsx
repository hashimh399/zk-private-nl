import { Link } from "react-router-dom";
import { ExternalLink, Github, Linkedin, Mail, ArrowRight, Shield, Eye, Cpu, Zap, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import SystemDiagram from "@/components/SystemDiagram";

const CHIPS = [
  "ZK", "EVM", "Chainlink CRE", "DeFi Risk", "Enterprise Systems",
  "Contact Center Architecture", "CRM Integrations", "AI Agent Assist",
];

const SKILLS = [
  { category: "Protocol Engineering", items: ["Solidity", "Foundry", "EVM Internals", "Gas Optimization", "Upgradeable Contracts"] },
  { category: "Zero-Knowledge", items: ["Groth16 / Circom", "ZK-Pass", "Merkle Proofs", "Proof Generation Pipelines"] },
  { category: "Oracles & Risk", items: ["Chainlink CRE", "Chainlink Functions", "Risk Scoring", "LTV / Health Factor Logic"] },
  { category: "Infrastructure", items: ["Docker / K8s", "CI/CD", "Monitoring", "AWS / GCP", "Terraform"] },
  { category: "Frontend / Fullstack", items: ["React / TypeScript", "wagmi / viem", "Node.js", "GraphQL", "REST APIs"] },
  { category: "Enterprise", items: ["Contact Center Platforms", "CRM Integrations", "AI Agent Assist", "Telephony / SIP"] },
];

const OPTIMIZES = [
  { icon: Shield, label: "Correctness", desc: "Formal verification mindset. Every state transition must be provably correct." },
  { icon: Eye, label: "Observability", desc: "Structured logging, event-driven monitoring, and on-chain auditability." },
  { icon: Cpu, label: "Security", desc: "Defense-in-depth: access control, reentrancy guards, ZK privacy layers." },
  { icon: Zap, label: "Reliability", desc: "Fault-tolerant systems with graceful degradation and recovery paths." },
];

const EXPERIENCE = [
  {
    role: "Protocol Engineer",
    focus: "ZK + EVM + Chainlink CRE",
    desc: "Built NeuroLedger: end-to-end ZK private lending protocol with Groth16 proof verification, Chainlink CRE risk orchestration, and on-chain borrow approval registry on Sepolia.",
  },
  {
    role: "Senior Software Engineer",
    focus: "Enterprise Architecture",
    desc: "Designed and deployed production contact center platforms, CRM integrations, AI-powered agent assist systems, and telephony infrastructure serving enterprise clients.",
  },
];

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.8 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[30%] right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-6">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse-glow" />
              <span className="font-mono text-sm text-muted-foreground">Sepolia Testnet · Live</span>
            </motion.div>

            {/* <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-black tracking-tight mb-4">
              Hashim <span className="text-gradient">(ma818)</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-xl md:text-2xl text-silver max-w-3xl mb-4">
              Protocol Engineer / Senior Software Engineer
            </motion.p> */}

            {/* <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-2xl mb-8">
              I build verifiable, production-grade systems at the intersection of zero-knowledge cryptography,
              on-chain risk orchestration, and enterprise software architecture.
            </motion.p> */}

            <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mb-10">
              {CHIPS.map((c, i) => (
                <motion.span
                  key={c}
                  className="chip shimmer"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  {c}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="glow-line" />

      {/* Featured Project */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            {...scaleIn}
            whileInView={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="card-elevated p-8 md:p-12 relative group"
          >
            {/* Hover glow effect */}
            <div className="absolute -inset-px rounded-lg bg-gradient-to-r from-primary/20 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10 blur-sm" />

            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <motion.span
                  className="chip mb-3 inline-block"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                >
                  Featured Project
                </motion.span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                  NeuroLedger
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl">
                  ZK Private Lending + Chainlink CRE Risk Orchestration — a fully on-chain lending protocol
                  with privacy-preserving eligibility proofs and automated risk decisions.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { label: "ZK Proofs", value: "Groth16 via Circom" },
                { label: "Risk Engine", value: "Chainlink CRE + Gemini" },
                { label: "Network", value: "Sepolia Testnet" },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  className="bg-muted/50 rounded-lg p-4 border border-border/50 hover:border-primary/30 transition-colors duration-300"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="font-semibold text-foreground">{m.value}</p>
                </motion.div>
              ))}
            </div>
            <motion.div
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                to="/zk-private-lending"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:shadow-[0_0_24px_-4px_hsl(270_70%_60%/0.5)] transition-all duration-300"
              >
                Launch Live Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* System Diagram */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="section-heading mb-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            System Architecture
          </motion.h2>
          <SystemDiagram />
        </div>
      </section>

      <div className="glow-line" />

      {/* Experience */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="section-heading mb-10"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Experience
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {EXPERIENCE.map((exp, i) => (
              <motion.div
                key={exp.role}
                className="card-elevated p-6 group hover:border-primary/30 transition-colors duration-300"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
              >
                <h3 className="text-xl font-bold mb-1 group-hover:text-gradient transition-all duration-300">{exp.role}</h3>
                <p className="text-sm text-primary font-mono mb-3">{exp.focus}</p>
                <p className="text-muted-foreground">{exp.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Skills Matrix */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="section-heading mb-10"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Skills Matrix
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SKILLS.map((s, i) => (
              <motion.div
                key={s.category}
                className="card-elevated p-6 hover:border-primary/30 transition-colors duration-300"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3 }}
              >
                <h3 className="font-semibold text-primary mb-3">{s.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {s.items.map((item) => (
                    <span key={item} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors duration-200 cursor-default">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="glow-line" />

      {/* What I Optimize For */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="section-heading mb-10"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            What I Optimize For
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OPTIMIZES.map((o, i) => (
              <motion.div
                key={o.label}
                className="card-elevated p-6 text-center group hover:border-primary/30 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, boxShadow: "0 0 30px -5px hsl(270 70% 60% / 0.15)" }}
              >
                <motion.div
                  className="inline-flex"
                  whileHover={{ rotate: 8, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <o.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                </motion.div>
                <h3 className="font-bold mb-2">{o.label}</h3>
                <p className="text-sm text-muted-foreground">{o.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        className="border-t border-border py-12 px-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-bold text-lg">neuroledgers.com</p>
            <p className="text-sm text-muted-foreground">Built by Hashim (ma818)</p>
          </div>
          <div className="flex items-center gap-4">
            {[
              { href: "https://github.com", icon: Github },
              { href: "https://linkedin.com", icon: Linkedin },
              { href: "mailto:hello@neuroledgers.com", icon: Mail },
            ].map(({ href, icon: Icon }) => (
              <motion.a
                key={href}
                href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                whileHover={{ y: -3, scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Icon className="w-5 h-5" />
              </motion.a>
            ))}
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
