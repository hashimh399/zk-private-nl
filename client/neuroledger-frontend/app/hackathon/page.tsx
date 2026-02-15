export default function HackathonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[#10002B] to-background py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Hackathon Information</h1>
          <p className="text-secondary">For judges and teammates evaluating NeuroLedger</p>
        </div>

        {/* Hackathon Checklist */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Hackathon Checklist</h2>
          <div className="space-y-3">
            {[
              '✅ Public repo with complete source code',
              '✅ README links to Chainlink files (/workflows, /contracts)',
              '✅ CRE workflow simulation instructions (CLI commands)',
              '✅ External API/LLM: Gemini integration documented',
              '✅ Blockchain: Sepolia testnet deployment',
              '✅ Demo steps summary below',
            ].map((item, i) => (
              <div key={i} className="flex items-center space-x-3">
                <span className="text-success text-xl">{item.split(' ')[0]}</span>
                <span className="text-secondary">{item.substring(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Architecture Flow</h2>
          <div className="bg-primary/5 p-6 rounded-lg border border-primary/20 font-mono text-sm overflow-x-auto">
            <div className="space-y-2 text-secondary">
              <div>User → <span className="text-primary">BorrowGate</span> (ZK proof)</div>
              <div className="ml-8">↓ emit BorrowRequested event</div>
              <div><span className="text-primary">Chainlink CRE</span> detects event</div>
              <div className="ml-8">↓ run off-chain workflow</div>
              <div><span className="text-primary">External API</span> + <span className="text-accent">Gemini AI</span></div>
              <div className="ml-8">↓ compute approval decision</div>
              <div><span className="text-primary">CREBorrowDecisionReceiver</span>.onReport()</div>
              <div className="ml-8">↓ write to registry</div>
              <div><span className="text-primary">BorrowApprovalRegistry</span> stores decision</div>
              <div className="ml-8">↓ user queries registry</div>
              <div><span className="text-primary">BorrowGate</span>.executeBorrow()</div>
              <div className="ml-8">↓ if approved</div>
              <div><span className="text-primary">LendingPool</span>.borrowFor() mints NL tokens</div>
            </div>
          </div>
        </div>

        {/* Where to Find Chainlink Files */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Chainlink Integration Files</h2>
          <div className="space-y-3 text-secondary">
            <div className="flex items-center space-x-3">
              <span className="text-primary">📁</span>
              <code className="bg-background px-3 py-1 rounded">workflows/workflow.yaml</code>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-primary">📁</span>
              <code className="bg-background px-3 py-1 rounded">workflows/src/*</code>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-primary">📄</span>
              <code className="bg-background px-3 py-1 rounded">contracts/CREBorrowDecisionReceiver.sol</code>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-primary">📄</span>
              <code className="bg-background px-3 py-1 rounded">contracts/BorrowApprovalRegistry.sol</code>
            </div>
          </div>
        </div>

        {/* Live Demo Script */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Live Demo Script</h2>
          <ol className="space-y-3 text-secondary list-decimal list-inside">
            <li>Connect MetaMask wallet to Sepolia</li>
            <li>Deposit 0.05 ETH as collateral</li>
            <li>Upload ZK pass JSON file</li>
            <li>Generate zero-knowledge proof (client-side)</li>
            <li>Submit borrow request with proof</li>
            <li>Show "Pending CRE Approval" status</li>
            <li>Demonstrate CRE workflow simulation (CLI or admin)</li>
            <li>Show approval decision written to registry</li>
            <li>Execute borrow to mint NL tokens</li>
            <li>Repay debt with NL tokens</li>
            <li>Withdraw collateral</li>
          </ol>
        </div>

        {/* CRE Simulation */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">CRE Workflow Simulation</h2>
          <p className="text-secondary">For local testing, simulate the CRE decision:</p>
          <div className="bg-background p-4 rounded-lg border border-border font-mono text-sm overflow-x-auto">
            <code className="text-accent">
              # Option 1: Via admin page<br/>
              # Navigate to /admin, find "Simulate CRE Decision"<br/>
              # Input nullifier and approval status<br/><br/>
              # Option 2: Via contract (if receiver allows)<br/>
              cast send $RECEIVER "onReport(bytes32,bool,string)" \<br/>
              &nbsp;&nbsp;$NULLIFIER true "Approved by demo"
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
