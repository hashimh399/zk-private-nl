'use client'

import { useAccount } from 'wagmi'
import { getAllAddresses } from '@/lib/addresses'
import { formatAddress, copyToClipboard } from '@/lib/utils/format'
import { useState } from 'react'

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState('')
  const addresses = getAllAddresses()
  
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase()
  const isAdmin = address?.toLowerCase() === adminAddress

  const handleCopy = async (addr: string, name: string) => {
    const success = await copyToClipboard(addr)
    if (success) {
      setCopied(name)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-[#10002B] to-background">
        <div className="glass-card p-8 text-center">
          <h2 className="text-2xl font-bold text-primary mb-4">Admin Page</h2>
          <p className="text-secondary mb-4">Connect your wallet to access admin controls</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[#10002B] to-background py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Admin Dashboard</h1>
          {isAdmin ? (
            <p className="text-success">✓ Admin access granted</p>
          ) : (
            <p className="text-warning">⚠️ Read-only mode - Not admin address</p>
          )}
        </div>

        {/* Deployment Info */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-primary">Deployed Contracts</h2>
          <div className="space-y-3">
            {Object.entries(addresses).map(([name, addr]) => (
              <div key={name} className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div>
                  <p className="font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-secondary font-mono">{addr}</p>
                </div>
                <button
                  onClick={() => handleCopy(addr, name)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm"
                >
                  {copied === name ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <>
            {/* Set Merkle Root */}
            <div className="glass-card p-8 space-y-6">
              <h2 className="text-2xl font-bold text-primary">Set Merkle Root</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-secondary mb-2">New Merkle Root (bytes32)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <button className="btn-primary">
                  Update Root in BorrowGate
                </button>
              </div>
            </div>

            {/* Oracle Controls */}
            <div className="glass-card p-8 space-y-6">
              <h2 className="text-2xl font-bold text-primary">Oracle Controls</h2>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-secondary mb-2">New Price (USD, 18 decimals)</label>
                    <input
                      type="text"
                      placeholder="2500000000000000000000"
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-secondary mb-2">Updated At (timestamp)</label>
                    <input
                      type="number"
                      placeholder={Math.floor(Date.now() / 1000).toString()}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <button className="btn-primary">
                  Set Oracle Price
                </button>
              </div>
            </div>

            {/* Simulate CRE Decision */}
            <div className="glass-card p-8 space-y-6">
              <h2 className="text-2xl font-bold text-primary">DEV ONLY: Simulate CRE Decision</h2>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                <p className="text-warning text-sm">⚠️ This bypasses the actual Chainlink CRE workflow. Use only for testing.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-secondary mb-2">Nullifier (bytes32)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none font-mono"
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="decision" value="approve" className="text-primary" />
                    <span className="text-foreground">Approve</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="decision" value="reject" className="text-primary" />
                    <span className="text-foreground">Reject</span>
                  </label>
                </div>
                <button className="btn-primary">
                  Simulate Decision
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
