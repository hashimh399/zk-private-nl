import deployments from '../deployments/sepolia.json'

export type ContractName = 
  | 'NL'
  | 'MockOracle'
  | 'Vault'
  | 'LendingPool'
  | 'BorrowGate'
  | 'BorrowApprovalRegistry'
  | 'CREBorrowDecisionReceiver'
  | 'ZKPassVerifier'

export const getContractAddress = (name: ContractName): `0x${string}` => {
  const envKey = `NEXT_PUBLIC_${name.toUpperCase()}_ADDRESS`
  const envAddress = process.env[envKey]
  
  if (envAddress) {
    return envAddress as `0x${string}`
  }
  
  const deployedAddress = deployments[name as keyof typeof deployments]
  
  if (typeof deployedAddress === 'string') {
    return deployedAddress as `0x${string}`
  }
  
  return '0x0000000000000000000000000000000000000000'
}

export const getAllAddresses = () => {
  return {
    NL: getContractAddress('NL'),
    MockOracle: getContractAddress('MockOracle'),
    Vault: getContractAddress('Vault'),
    LendingPool: getContractAddress('LendingPool'),
    BorrowGate: getContractAddress('BorrowGate'),
    BorrowApprovalRegistry: getContractAddress('BorrowApprovalRegistry'),
    CREBorrowDecisionReceiver: getContractAddress('CREBorrowDecisionReceiver'),
    ZKPassVerifier: getContractAddress('ZKPassVerifier'),
  }
}
