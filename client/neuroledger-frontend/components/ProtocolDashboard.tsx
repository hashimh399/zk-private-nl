'use client'

import { useReadContract } from 'wagmi'
import { getContractAddress } from '@/lib/addresses'
import { formatEther, formatHealthFactor, isHealthFactorSafe } from '@/lib/utils/format'
import LendingPoolABI from '@/lib/abis/LendingPool.json'
import MockOracleABI from '@/lib/abis/MockOracle.json'
import VaultABI from '@/lib/abis/Vault.json'
import { useEffect } from 'react'

interface ProtocolDashboardProps {
  address: `0x${string}`
}

export function ProtocolDashboard({ address }: ProtocolDashboardProps) {
  // Read user's collateral
  const { data: ethCollateral } = useReadContract({
    address: getContractAddress('LendingPool'),
    abi: LendingPoolABI,
    functionName: 'ethCollateral',
    args: [address],
  })

  // Read user's debt
  const { data: tokenDebt } = useReadContract({
    address: getContractAddress('LendingPool'),
    abi: LendingPoolABI,
    functionName: 'tokenDebt',
    args: [address],
  })

  // Read user's health factor
  const { data: healthFactor } = useReadContract({
    address: getContractAddress('LendingPool'),
    abi: LendingPoolABI,
    functionName: 'HealthFactor',
    args: [address],
  })

  // Read collateral value in USD
  const { data: collateralValue } = useReadContract({
    address: getContractAddress('LendingPool'),
    abi: LendingPoolABI,
    functionName: 'collateralValueOf',
    args: [address],
  })

  // Read oracle price
  const { data: priceData } = useReadContract({
    address: getContractAddress('MockOracle'),
    abi: MockOracleABI,
    functionName: 'getLatestPrice',
  })

  // Read vault total escrowed
  const { data: totalEscrowed } = useReadContract({
    address: getContractAddress('Vault'),
    abi: VaultABI,
    functionName: 'totalEthEscrowed',
  })

  const price = priceData ? (priceData as [bigint, bigint])[0] : 0n
  const updatedAt = priceData ? (priceData as [bigint, bigint])[1] : 0n
  const now = Math.floor(Date.now() / 1000)
  const priceAge = now - Number(updatedAt)
  const isPriceStale = priceAge > 3600 // 1 hour

  const hfValue = healthFactor as bigint | undefined
  const isSafe = hfValue ? isHealthFactorSafe(hfValue) : true

  return (
    <div className="glass-card p-6">
      <h2 className="text-2xl font-bold text-primary mb-6">Protocol Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Your ETH Collateral */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-secondary mb-1">Your ETH Collateral</p>
          <p className="text-2xl font-bold text-foreground">
            {ethCollateral ? formatEther(ethCollateral as bigint) : '0.0000'} ETH
          </p>
        </div>

        {/* Your NL Debt */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-secondary mb-1">Your NL Debt</p>
          <p className="text-2xl font-bold text-foreground">
            {tokenDebt ? formatEther(tokenDebt as bigint) : '0.0000'} NL
          </p>
        </div>

        {/* Your Health Factor */}
        <div className={`p-4 rounded-lg border ${isSafe ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`}>
          <p className="text-sm text-secondary mb-1">Your Health Factor</p>
          <p className={`text-2xl font-bold ${isSafe ? 'text-success' : 'text-error'}`}>
            {hfValue ? formatHealthFactor(hfValue) : '∞'}
          </p>
          {!isSafe && (
            <p className="text-xs text-error mt-1">⚠️ Liquidatable!</p>
          )}
        </div>

        {/* Collateral Value USD */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-secondary mb-1">Collateral Value (USD)</p>
          <p className="text-2xl font-bold text-foreground">
            ${collateralValue ? formatEther(collateralValue as bigint, 2) : '0.00'}
          </p>
        </div>

        {/* ETH/USD Price */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-secondary mb-1">ETH/USD Price</p>
          <p className="text-2xl font-bold text-foreground">
            ${price ? formatEther(price, 2) : '0.00'}
          </p>
          {isPriceStale && (
            <p className="text-xs text-warning mt-1">⚠️ Price stale ({Math.floor(priceAge / 60)}m)</p>
          )}
        </div>

        {/* Vault Solvency */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm text-secondary mb-1">Vault Solvency</p>
          <p className="text-lg font-bold text-success">
            {totalEscrowed ? '✓ Solvent' : 'Loading...'}
          </p>
          <p className="text-xs text-secondary mt-1">
            {totalEscrowed ? `${formatEther(totalEscrowed as bigint)} ETH escrowed` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
