'use client'

import { useState } from 'react'

export function BorrowFlow({ address }: { address: `0x${string}` }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [passFile, setPassFile] = useState<File | null>(null)
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-primary text-white' : 'bg-primary/20 text-secondary'}`}>
              {s}
            </div>
            {s < 5 && <div className={`w-16 h-1 ${step > s ? 'bg-primary' : 'bg-primary/20'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary">Step 1: Provide ZK Pass</h3>
          <p className="text-secondary">Upload your ZK pass JSON file to begin the borrow process.</p>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".json"
              onChange={(e) => e.target.files && setPassFile(e.target.files[0])}
              className="hidden"
              id="passFile"
            />
            <label htmlFor="passFile" className="cursor-pointer">
              <div className="text-secondary mb-2">
                {passFile ? passFile.name : 'Click to upload pass JSON'}
              </div>
              <p className="text-xs text-secondary">Mode A: Upload pass.<address>.json</p>
            </label>
          </div>

          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <p className="text-sm text-error">
              ⚠️ <strong>Security Warning:</strong> Your pass JSON contains your secret. Never share this file publicly.
            </p>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!passFile}
            className="btn-primary w-full"
          >
            Continue to Proof Generation
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary">Step 2: Generate ZK Proof</h3>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center space-y-4">
            <div className="spinner mx-auto"></div>
            <p className="text-secondary">Generating proof in Web Worker...</p>
            <p className="text-xs text-secondary">This may take 30-60 seconds</p>
          </div>
          <button onClick={() => setStep(3)} className="btn-primary w-full">
            Proof Generated ✓ Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary">Step 3: Request Borrow</h3>
          <input
            type="number"
            placeholder="Borrow amount (NL)"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none"
          />
          <button onClick={() => setStep(4)} className="btn-primary w-full">
            Submit Borrow Request
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-primary">Step 4: Awaiting CRE Approval</h3>
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-6 text-center space-y-4">
            <div className="spinner mx-auto"></div>
            <p className="text-foreground font-semibold">Chainlink CRE Processing...</p>
            <p className="text-sm text-secondary">Your borrow request is being evaluated off-chain</p>
            <p className="text-xs text-secondary">Request ID: 0x1234...</p>
            <p className="text-xs text-secondary">Nullifier: 0xabcd...</p>
          </div>
          <button onClick={() => setStep(5)} className="btn-primary w-full">
            Simulate Approval (Demo)
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-success">Step 5: Approved! Execute Borrow</h3>
          <div className="bg-success/10 border border-success/20 rounded-lg p-6 text-center">
            <p className="text-success text-lg font-semibold mb-2">✓ Loan Approved</p>
            <p className="text-sm text-secondary">Click below to mint your NL tokens</p>
          </div>
          <button className="btn-primary w-full">
            Execute Borrow
          </button>
        </div>
      )}
    </div>
  )
}
