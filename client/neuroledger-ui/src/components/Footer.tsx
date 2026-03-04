import React from "react";
import { Link } from "react-router-dom";
import { Github, Linkedin, Globe, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="mt-24 border-t border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-12">

        {/* Logo + Protocol */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <img
              src="/nl.webp"
              alt="NeuroLedger"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-xl font-bold text-white">
              NeuroLedger
            </span>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
            NeuroLedger is a privacy-preserving lending protocol combining
            Zero-Knowledge eligibility proofs, Chainlink CRE risk orchestration,
            and deterministic on-chain enforcement for autonomous credit markets.
          </p>

          <p className="text-xs text-slate-500">
            Built for the Chainlink Convergence Hackathon.
          </p>
        </div>

        {/* Protocol Links */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-lg">Protocol</h3>

          <div className="flex flex-col gap-3 text-sm text-slate-400">
            <Link
              to="/zk-private-lending"
              className="hover:text-white transition-colors"
            >
              Launch App
            </Link>

            <Link
              to="/admin"
              className="hover:text-white transition-colors"
            >
              Admin Dashboard
            </Link>

            <a
              href="#demo"
              className="hover:text-white transition-colors"
            >
              Demo
            </a>

            <a
              href="https://github.com/hashimh399/zk-private-nl"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Github Repository
            </a>
          </div>
        </div>

        {/* About the Developer */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-lg">
            About the Developer
          </h3>

          <p className="text-sm text-slate-400 leading-relaxed">
            NeuroLedger was built by an independent protocol engineer - Hashim Mir, focused
            on decentralized credit infrastructure, privacy-preserving finance,
            and autonomous risk systems combining AI, ZK proofs, and oracle-based
            solvency mechanisms.
          </p>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs border border-green-500/30 bg-green-500/10 text-green-300">
  Open to Protocol Engineering Roles
</span>

          <div className="flex gap-4 pt-2">

            <a
              href="https://github.com/hashimh399"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
            >
              <Github className="w-5 h-5 text-slate-300" />
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
            >
              <Linkedin className="w-5 h-5 text-slate-300" />
            </a>

            <a
              href="https://neuroledgers.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
            >
              <Globe className="w-5 h-5 text-slate-300" />
            </a>

            <a
              href="mailto:hashim.mir@neuroledgers.com"
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
            >
              <Mail className="w-5 h-5 text-slate-300" />
            </a>

          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} NeuroLedger Protocol · Built with
        Chainlink CRE · ZK-Powered Lending Infrastructure
      </div>
      
    </footer>
  );
};

export default Footer;