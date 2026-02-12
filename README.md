# NeuroLedger — ZK Private Pass–Gated Lending + Chainlink CRE Risk Orchestration (Gemini)

**Chainlink Convergence Hackathon Submission**  
A Next-Gen Lending (NL) protocol on **Ethereum Sepolia** where borrowing is gated by:
1) a **ZK Private Pass** (privacy-preserving allowlist via Merkle membership + nullifier), and  
2) a **Chainlink CRE Workflow** that orchestrates **onchain context + external risk data + Gemini LLM reasoning** before approving the borrow.

---

## Live Demo

- dApp: `https://neuroledger.com` *(Sepolia wallet required)*
- Chainlink Sepolia Faucet (ETH/LINK): `https://faucets.chain.link/sepolia`
- Demo video (3–5 minutes): `<YOUTUBE_OR_PUBLIC_LINK_HERE>`

---

## Hackathon Requirements Checklist

✅ **CRE Workflow** used as orchestration layer  
✅ Integrates **at least one blockchain**: Ethereum Sepolia  
✅ Integrates **external system / API / LLM**: Google Gemini + external risk signal API  
✅ Demonstrates **successful simulation via CRE CLI** (and optionally deployment)  
✅ **Public GitHub repo**  
✅ README includes **links to all Chainlink-related files**  
✅ 3–5 minute **public demo video** showing workflow execution (app + CLI simulate)

---
Chainlink-Related Files (Required Links)

CRE project config: project.yaml

Workflow definition: workflows/zkpass-risk-orchestrator/workflow.yaml

Workflow code (TypeScript): workflows/zkpass-risk-orchestrator/main.ts

Workflow config(s):

workflows/zkpass-risk-orchestrator/config.staging.json

workflows/zkpass-risk-orchestrator/config.production.json

Secrets manifest for simulation/deploy: secrets.yaml

Chainlink consumer contract (IReceiver): contracts/CREBorrowDecisionReceiver.sol
## High-Level Architecture

### Onchain (Sepolia)
- `lp.sol` — lending pool core logic (HF-based solvency checks)
- `vault.sol` — ETH collateral vault/accounting
- `mockoracle.sol` — price source for HF computation
- `nl.sol` — ERC20 token borrowed against ETH collateral

Added for this project:
- `BorrowGate.sol` — 2-step borrow flow: `requestBorrow()` → CRE decision → `executeBorrow()`
- `BorrowApprovalRegistry.sol` — stores CRE approve/reject decisions keyed by nullifier
- `CREBorrowDecisionReceiver.sol` — Chainlink consumer contract (`IReceiver.onReport`) called by KeystoneForwarder
- `ZKPassVerifier.sol` — Groth16 verifier generated from Circom/snarkjs

### Offchain (Chainlink CRE Workflow)
- Trigger: EVM Log `BorrowRequested`
- Reads onchain context (borrow amount, collateral value, health factor snapshot)
- Calls:
  - External risk signal API (market stress / volatility / etc.)
  - Google Gemini (LLM) for structured reasoning memo
- Deterministic policy decides approve/reject
- Writes result onchain via CRE secure write flow:
  - signed report → KeystoneForwarder → `CREBorrowDecisionReceiver.onReport()` → registry update

### Frontend (Next.js)
- Wallet connect (Sepolia)
- ZK proof generation (Groth16) from locally stored pass package
- Submit `requestBorrow()`, poll approval status, call `executeBorrow()`

---

## Borrow Flow (Low-Level)

### 0) Pass issuance (offchain admin/operator)
1. User receives secret `s`
2. Leaf computed (address-bound pass): `leaf = Poseidon(s, borrowerAddress)`
3. Leaf added to Merkle tree → new root `R`
4. Admin updates onchain root: `BorrowGate.setRoot(R)`
5. User stores pass package locally:
   - `s`, `root`, `pathElements[]`, `pathIndices[]`, `nonce`

### 1) Borrow request (user)
User calls `BorrowGate.requestBorrow(...)` with:
- public inputs: `root`, `nullifier`, `borrower`, `nonce`
- Groth16 proof for:
  - membership: `Poseidon(s, borrower) ∈ Merkle(root)`
  - nullifier: `nullifier = Poseidon(s, scope, borrower, nonce)`

Contract verifies proof, stores request as `PENDING`, emits:
`BorrowRequested(requestId, borrower, nullifier, asset, amount)`

### 2) CRE orchestration
CRE workflow listens for `BorrowRequested`, reads request context, calls external risk + Gemini, decides, and writes onchain approval/rejection.

### 3) Borrow execution (user)
User calls `BorrowGate.executeBorrow(requestId)`:
- requires registry approval for the request/nullifier
- consumes nullifier
- calls into `lp.sol` borrow path (HF re-check still enforced)
- mints/credits `NL` token to borrower if safe

---

## Repository Structure

```text
contracts/
  lp.sol
  vault.sol
  mockoracle.sol
  nl.sol
  BorrowGate.sol
  BorrowApprovalRegistry.sol
  CREBorrowDecisionReceiver.sol
  ZKPassVerifier.sol

circuits/
  zkpass.circom
  build/ (wasm, zkey, verification key)

workflows/
  zkpass-risk-orchestrator/
    workflow.yaml
    main.ts
    config.staging.json
    config.production.json

frontend/
  nextjs-app/ (neuroledger.com client)

scripts/
  issue-pass.ts
  publish-root.ts
  prove.ts

project.yaml
secrets.yaml
.env.example
