import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[#10002B] to-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold">
              <span className="bg-gradient-to-r from-primary via-primary-hover to-accent bg-clip-text text-transparent">
                NeuroLedger
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-secondary max-w-3xl mx-auto">
              Next-Generation Decentralized Lending with Zero-Knowledge Privacy and Chainlink CRE Orchestration
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/app" className="btn-primary text-lg px-8 py-4">
                Launch App
              </Link>
              <Link href="/docs" className="px-8 py-4 border border-primary text-primary hover:bg-primary/10 rounded-lg transition-all">
                Read Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What is NeuroLedger */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            What is NeuroLedger?
          </h2>
          <p className="text-lg text-secondary leading-relaxed mb-4">
            NeuroLedger is a trustless, over-collateralized lending platform built on Ethereum. 
            Users deposit ETH as collateral and borrow NL tokens based on their health factor.
          </p>
          <p className="text-lg text-secondary leading-relaxed">
            The platform combines cutting-edge zero-knowledge proofs for privacy-preserving borrower 
            verification with Chainlink Computing Runtime Environment (CRE) for intelligent, automated 
            loan approval orchestration.
          </p>
        </div>
      </section>

      {/* Why ZK Private Pass */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Why ZK Private Pass?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Privacy-Preserving</h3>
                  <p className="text-secondary text-sm">
                    Prove membership in approved borrower set without revealing identity
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Replay Protection</h3>
                  <p className="text-secondary text-sm">
                    Nullifiers prevent double-spending of approvals
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Cryptographic Security</h3>
                  <p className="text-secondary text-sm">
                    Poseidon hash-based Merkle proofs provide mathematical guarantees
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Client-Side Proofs</h3>
                  <p className="text-secondary text-sm">
                    Secrets never leave your device - all proof generation happens locally
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Chainlink CRE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Why Chainlink CRE?
          </h2>
          <div className="space-y-6">
            <p className="text-lg text-secondary leading-relaxed">
              Chainlink Computing Runtime Environment (CRE) enables sophisticated off-chain computation 
              workflows triggered by on-chain events, bringing enterprise-grade automation to DeFi.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-primary mb-2">Off-Chain Processing</h3>
                <p className="text-sm text-secondary">
                  Complex risk assessment runs off-chain, keeping gas costs low
                </p>
              </div>
              <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-primary mb-2">External APIs</h3>
                <p className="text-sm text-secondary">
                  Integrate real-world data and AI models like Gemini for intelligent decisioning
                </p>
              </div>
              <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-primary mb-2">Automated Workflows</h3>
                <p className="text-sm text-secondary">
                  Event-driven orchestration ensures timely, reliable loan approvals
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-8 text-center">
            How It Works
          </h2>
          <div className="space-y-6">
            {[
              { step: '1', title: 'Deposit Collateral', desc: 'Lock ETH in the LendingPool smart contract' },
              { step: '2', title: 'Generate ZK Proof', desc: 'Prove membership in approved borrower set without revealing identity' },
              { step: '3', title: 'Request Borrow', desc: 'Submit borrow request with ZK proof to BorrowGate' },
              { step: '4', title: 'CRE Workflow', desc: 'Chainlink CRE processes request with external APIs and Gemini AI' },
              { step: '5', title: 'Get Approval', desc: 'CRE writes decision to on-chain registry' },
              { step: '6', title: 'Execute Borrow', desc: 'Mint NL tokens if approved, maintain health factor > 1.0' },
            ].map((item) => (
              <div key={item.step} className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">{item.step}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-secondary">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass-card p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-secondary mb-8 max-w-2xl mx-auto">
            Connect your wallet and start borrowing with privacy-preserving ZK proofs on Sepolia testnet.
          </p>
          <Link href="/app" className="btn-primary text-lg px-12 py-4 inline-block">
            Launch App Now
          </Link>
        </div>
      </section>
    </div>
  )
}
