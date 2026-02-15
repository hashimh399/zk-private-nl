'use client'

import { FAUCETS } from '@/lib/chain'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold text-primary mb-2">NeuroLedger</h3>
            <p className="text-sm text-secondary">
              Next-gen lending with ZK privacy and Chainlink CRE
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Resources</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <a href="/docs" className="hover:text-primary transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="/hackathon" className="hover:text-primary transition-colors">
                  Hackathon Info
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Faucets */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Get Testnet Tokens</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <a href={FAUCETS.sepolia} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  Sepolia ETH Faucet →
                </a>
              </li>
              <li>
                <a href={FAUCETS.chainlink} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  Chainlink Faucet →
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-secondary text-center">
            ⚠️ Testnet Only - Not Audited - Do Not Use With Real Funds
          </p>
          <p className="text-xs text-secondary text-center mt-2">
            © 2026 NeuroLedger. Built for Sepolia testnet.
          </p>
        </div>
      </div>
    </footer>
  )
}
