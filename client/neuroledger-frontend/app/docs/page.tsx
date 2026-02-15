export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[#10002B] to-background py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Documentation</h1>
          <p className="text-secondary">Learn about NeuroLedger protocol mechanics and security</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Health Factor & Invariants</h2>
          <div className="space-y-4 text-secondary">
            <p><strong className="text-foreground">Health Factor (HF)</strong> = (Collateral Value × Liquidation Threshold) / Debt Value</p>
            <p>If HF &lt; 1.0, your position becomes liquidatable.</p>
            <p className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <strong className="text-primary">Invariant:</strong> The protocol maintains solvency by ensuring all positions have HF ≥ 1.0 or are liquidated to restore system health.
            </p>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">ZK Private Pass</h2>
          <div className="space-y-4 text-secondary">
            <p>A zero-knowledge proof system that allows borrowers to prove membership in an approved set without revealing their identity.</p>
            <p><strong className="text-foreground">Components:</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Secret (s): Known only to the borrower</li>
              <li>Leaf: Poseidon(s, borrowerAddress)</li>
              <li>Merkle Root (R): Root of tree containing all approved borrowers</li>
            </ul>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Nullifier</h2>
          <div className="space-y-4 text-secondary">
            <p><strong className="text-foreground">Formula:</strong> Nullifier = Poseidon(s, scope=1, borrowerAddress, nonce)</p>
            <p><strong className="text-foreground">Purpose:</strong> Prevents replay attacks by ensuring each proof can only be used once.</p>
            <p>The registry tracks used nullifiers to prevent double-spending of approvals.</p>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Chainlink CRE</h2>
          <div className="space-y-4 text-secondary">
            <p>Chainlink Computing Runtime Environment orchestrates off-chain computation workflows triggered by on-chain events.</p>
            <p><strong className="text-foreground">In NeuroLedger:</strong></p>
            <p>BorrowRequested event → CRE workflow → risk assessment (external API + Gemini AI) → on-chain decision via CREBorrowDecisionReceiver</p>
            <p className="bg-success/10 p-4 rounded-lg border border-success/20">
              <strong className="text-success">Benefit:</strong> Separates complex risk logic from expensive on-chain computation while maintaining trustlessness.
            </p>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-error">Security Disclaimers</h2>
          <ul className="space-y-2 text-secondary list-disc list-inside">
            <li>⚠️ Testnet only - not audited, do not use with real funds</li>
            <li>🔐 ZK pass secrets must remain confidential</li>
            <li>📊 Oracle price manipulation risk exists in production scenarios</li>
            <li>💸 Liquidation may result in collateral loss</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
