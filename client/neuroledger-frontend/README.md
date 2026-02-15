# NeuroLedger Frontend

Next-generation decentralized lending platform with zero-knowledge privacy and Chainlink CRE orchestration.

## 🚀 Features

- **Zero-Knowledge Privacy**: Prove borrower eligibility without revealing identity using ZK proofs
- **Chainlink CRE Integration**: Automated off-chain risk assessment with on-chain decisioning
- **Over-Collateralized Lending**: Trustless borrowing with health factor monitoring
- **Modern UI**: Dark purple + silver theme with glassmorphism effects
- **Full TypeScript**: Type-safe development with strict mode enabled

## 📋 Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Sepolia testnet ETH ([get from faucet](https://sepoliafaucet.com))
- Deployed smart contracts on Sepolia

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/your-org/neuroledger-frontend.git
cd neuroledger-frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
# - Set NEXT_PUBLIC_ADMIN_ADDRESS to your admin wallet
# - Optionally set NEXT_PUBLIC_RPC_URL
# - Contract addresses will be loaded from deployments/sepolia.json
```

## ⚙️ Configuration

### Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_ADMIN_ADDRESS=0xYourAdminAddress
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY  # Optional
```

### Contract Addresses

Update `/deployments/sepolia.json` with your deployed contract addresses:

```json
{
  "NL": "0xYourNLTokenAddress",
  "MockOracle": "0xYourOracleAddress",
  "LendingPool": "0xYourLendingPoolAddress",
  "BorrowGate": "0xYourBorrowGateAddress",
  ...
}
```

## 🚦 Running Locally

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## 🏗️ Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📦 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_ADMIN_ADDRESS`
- `NEXT_PUBLIC_RPC_URL` (optional)

Configure custom domain in Vercel settings.

## 📖 Project Structure

```
/
├── app/                    # Next.js 14 App Router pages
│   ├── page.tsx           # Landing page
│   ├── app/page.tsx       # Main dApp interface
│   ├── admin/page.tsx     # Admin controls
│   ├── docs/page.tsx      # Documentation
│   ├── hackathon/page.tsx # Hackathon info
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Navbar.tsx         # Navigation
│   ├── Footer.tsx         # Footer with faucet links
│   ├── ProtocolDashboard.tsx
│   ├── DepositWithdraw.tsx
│   ├── BorrowFlow.tsx     # ZK proof borrow flow
│   ├── Repay.tsx
│   └── Providers.tsx      # Web3 providers
├── lib/                   # Core libraries
│   ├── chain.ts           # Chain configuration
│   ├── addresses.ts       # Contract address management
│   ├── abis/              # Contract ABIs (JSON)
│   └── utils/
│       └── format.ts      # Formatting utilities
├── hooks/                 # Custom React hooks
├── workers/               # Web Workers (ZK proof generation)
├── public/                # Static assets
│   ├── brand/             # Logo and branding
│   └── circuits/          # ZK circuit files
└── deployments/           # Contract deployment info
    └── sepolia.json
```

## 🎯 User Flows

### Complete Borrow Flow

1. **Connect Wallet**: Connect MetaMask to Sepolia testnet
2. **Deposit Collateral**: Lock ETH in LendingPool
3. **Upload ZK Pass**: Provide pass JSON file with secret
4. **Generate Proof**: Client-side ZK proof generation (30-60s)
5. **Request Borrow**: Submit borrow request with proof
6. **CRE Processing**: Chainlink CRE evaluates request off-chain
7. **Approval**: CRE writes decision to BorrowApprovalRegistry
8. **Execute Borrow**: Mint NL tokens if approved
9. **Repay**: Approve NL tokens and repay debt
10. **Withdraw**: Retrieve collateral once HF permits

### Health Factor Management

- **HF > 1.0**: Safe position
- **HF < 1.0**: Liquidatable
- Monitor dashboard for real-time HF updates

## 🔐 Security Considerations

- ⚠️ **Testnet Only**: Not audited, do not use with real funds
- 🔒 **ZK Secrets**: Pass files contain secrets - never share publicly
- 📊 **Oracle Risk**: MockOracle is for testing only
- 💸 **Liquidation**: Positions with HF < 1.0 can be liquidated

## 🛠️ Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## 📚 Key Technologies

- **Next.js 14**: App Router, Server Components
- **TypeScript**: Strict mode, no `any` types
- **wagmi v2**: React hooks for Ethereum
- **viem**: Low-level Ethereum library
- **RainbowKit**: Wallet connection UI
- **TailwindCSS**: Utility-first styling
- **TanStack Query**: Data fetching & caching
- **snarkjs**: ZK proof generation

## 🔗 Links

- [Sepolia Faucet](https://sepoliafaucet.com)
- [Chainlink Faucet](https://faucets.chain.link/sepolia)
- [Sepolia Etherscan](https://sepolia.etherscan.io)
- [Documentation](/docs)
- [Hackathon Info](/hackathon)

## 🎨 Theme

Dark purple (#7B2CBF) + Silver (#C0C0C0) with glassmorphism effects

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## ⚠️ Disclaimer

This is experimental software deployed on Sepolia testnet. Not audited. Do not use with real funds.

---

Built for hackathon evaluation with ❤️
