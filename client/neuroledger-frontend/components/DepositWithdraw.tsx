'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther } from 'viem'
import { getContractAddress } from '@/lib/addresses'
import { formatEther } from '@/lib/utils/format'
import { getExplorerUrl } from '@/lib/utils/format'
import LendingPoolABI from '@/lib/abis/LendingPool.json'

interface DepositWithdrawProps {
  address: `0x${string}`
}

export function DepositWithdraw({ address }: DepositWithdrawProps) {
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  
  const { data: ethBalance } = useBalance({ address })
  
  const { writeContract: writeDeposit, data: depositHash, isPending: isDepositPending } = useWriteContract()
  const { writeContract: writeWithdraw, data: withdrawHash, isPending: isWithdrawPending } = useWriteContract()
  
  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const handleDeposit = async () => {
    try {
      const value = parseEther(depositAmount)
      await writeDeposit({
        address: getContractAddress('LendingPool'),
        abi: LendingPoolABI,
        functionName: 'deposit',
        value,
      })
      setDepositAmount('')
    } catch (error) {
      console.error('Deposit error:', error)
    }
  }

  const handleWithdraw = async () => {
    try {
      const amount = parseEther(withdrawAmount)
      await writeWithdraw({
        address: getContractAddress('LendingPool'),
        abi: LendingPoolABI,
        functionName: 'withdrawCollateral',
        args: [amount],
      })
      setWithdrawAmount('')
    } catch (error) {
      console.error('Withdraw error:', error)
    }
  }

  return (
    <div className="glass-card p-6">
      <h2 className="text-2xl font-bold text-primary mb-6">Manage Collateral</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Deposit */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Deposit ETH</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Available Balance</span>
              <span className="text-foreground">
                {ethBalance ? formatEther(ethBalance.value) : '0.0000'} ETH
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={() => ethBalance && setDepositAmount(formatEther(ethBalance.value))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary-hover"
              >
                MAX
              </button>
            </div>
            <button
              onClick={handleDeposit}
              disabled={!depositAmount || isDepositPending || isDepositConfirming}
              className="btn-primary w-full"
            >
              {isDepositPending || isDepositConfirming ? 'Processing...' : 'Deposit'}
            </button>
            {depositHash && (
              <a
                href={getExplorerUrl(depositHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-primary hover:underline text-center"
              >
                View transaction →
              </a>
            )}
          </div>
        </div>

        {/* Withdraw */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Withdraw ETH</h3>
          <div className="space-y-2">
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                placeholder="0.0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-xs text-warning">
              ⚠️ Ensure your health factor remains above 1.0 after withdrawal
            </p>
            <button
              onClick={handleWithdraw}
              disabled={!withdrawAmount || isWithdrawPending || isWithdrawConfirming}
              className="btn-primary w-full"
            >
              {isWithdrawPending || isWithdrawConfirming ? 'Processing...' : 'Withdraw'}
            </button>
            {withdrawHash && (
              <a
                href={getExplorerUrl(withdrawHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-primary hover:underline text-center"
              >
                View transaction →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
