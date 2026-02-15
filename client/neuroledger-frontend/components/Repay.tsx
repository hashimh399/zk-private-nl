'use client'

import { useState } from 'react'

export function Repay({ address }: { address: `0x${string}` }) {
  const [amount, setAmount] = useState('')
  
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h3 className="text-xl font-semibold text-primary text-center">Repay NL Debt</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-secondary mb-2">Repay Amount (NL)</label>
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-secondary mb-2">Two-step process:</p>
          <ol className="text-xs text-secondary space-y-1 list-decimal list-inside">
            <li>Approve NL tokens to LendingPool</li>
            <li>Execute repayment transaction</li>
          </ol>
        </div>

        <button
          disabled={!amount}
          className="btn-primary w-full"
        >
          Approve & Repay
        </button>
      </div>
    </div>
  )
}
