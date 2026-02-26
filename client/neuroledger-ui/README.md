flowchart LR
  U[User Wallet] -->|Deposit ETH| LP[LendingPool.sol]
  LP -->|escrow ETH| V[Vault.sol]
  V -->|mint/burn| NL[NeuroLedger NL ERC20]

  U -->|ZK proof (Groth16)| BG[BorrowGate.sol]
  BG -->|emit BorrowRequested| EVT[(EVM Log Event)]

  EVT -->|trigger| CRE[Chainlink CRE Workflow]
  CRE -->|onchain reads| BG
  CRE -->|onchain reads| LP
  CRE -->|GET| FGI[Fear & Greed API]
  CRE -->|POST (advisory)| GEM[Gemini LLM]

  CRE -->|signed report| FWD[Forwarder]
  FWD -->|onReport(metadata, report)| RX[CREBorrowDecisionReceiver.sol]
  RX -->|writeDecision| REG[BorrowApprovalRegistry.sol]

  REG -->|approval state| BG
  BG -->|executeBorrow| LP