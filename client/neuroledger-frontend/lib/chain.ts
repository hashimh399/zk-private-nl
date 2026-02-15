import { sepolia } from 'wagmi/chains'

export const chains = [sepolia] as const

export const SEPOLIA_CHAIN_ID = 11155111

export const BLOCK_EXPLORER = 'https://sepolia.etherscan.io'

export const FAUCETS = {
  sepolia: 'https://sepoliafaucet.com',
  chainlink: 'https://faucets.chain.link/sepolia',
}
