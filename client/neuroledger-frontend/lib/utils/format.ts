import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatEther(value: bigint, decimals = 4): string {
  const eth = Number(value) / 1e18
  return eth.toFixed(decimals)
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatHealthFactor(hf: bigint): string {
  const factor = Number(hf) / 1e18
  if (factor < 1) {
    return `${factor.toFixed(3)} (LIQUIDATABLE)`
  }
  return factor.toFixed(3)
}

export function isHealthFactorSafe(hf: bigint): boolean {
  return Number(hf) / 1e18 >= 1
}

export function parseEther(value: string): bigint {
  try {
    return BigInt(Math.floor(parseFloat(value) * 1e18))
  } catch {
    return 0n
  }
}

export function getExplorerUrl(hash: string, type: 'tx' | 'address' = 'tx'): string {
  const base = 'https://sepolia.etherscan.io'
  return `${base}/${type}/${hash}`
}

export function truncateHash(hash: string): string {
  if (!hash) return ''
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
