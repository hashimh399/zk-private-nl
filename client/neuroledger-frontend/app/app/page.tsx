'use client'

import { useAccount, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { SEPOLIA_CHAIN_ID } from '@/lib/chain'
import { ProtocolDashboard } from '@/components/ProtocolDashboard'
import { DepositWithdraw } from '@/components/DepositWithdraw'
import { BorrowFlow } from '@/components/BorrowFlow'
import { Repay } from '@/components/Repay'
import { useState } from 'react'

export default function AppPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [activeTab, setActiveTab] = useState<'borrow' | 'repay' | 'liquidate'>('borrow')

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-[#10002B] to-background">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-primary">Welcome to NeuroLedger</h1>
          <p className="text-secondary text-lg">Connect your wallet to get started</p>
          <ConnectButton />
        </div>
      </div>
    )
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-[#10002B] to-background">
        <div className="glass-card p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold text-error">Wrong Network</h2>
          <p className="text-secondary">
            Please switch to Sepolia testnet to use NeuroLedger
          </p>
          <p className="text-sm text-secondary">
            Chain ID: {SEPOLIA_CHAIN_ID}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[#10002B] to-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary">NeuroLedger dApp</h1>
          <p className="text-secondary">Privacy-preserving lending powered by ZK proofs and Chainlink CRE</p>
        </div>

        {/* Protocol Dashboard */}
        <ProtocolDashboard address={address!} />

        {/* Deposit/Withdraw Section */}
        <DepositWithdraw address={address!} />

        {/* Tabs */}
        <div className="glass-card p-6">
          <div className="flex space-x-4 border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('borrow')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'borrow'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Borrow
            </button>
            <button
              onClick={() => setActiveTab('repay')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'repay'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Repay
            </button>
            <button
              onClick={() => setActiveTab('liquidate')}
              className={`pb-4 px-4 font-semibold transition-colors ${
                activeTab === 'liquidate'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Liquidate
            </button>
          </div>

          {activeTab === 'borrow' && <BorrowFlow address={address!} />}
          {activeTab === 'repay' && <Repay address={address!} />}
          {activeTab === 'liquidate' && (
            <div className="text-center text-secondary py-8">
              <p>Liquidation interface - Check /app#liquidation or see admin page</p>
              <p className="text-sm mt-2">Coming soon in this interface</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
