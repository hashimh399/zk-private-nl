import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { SEPOLIA_CHAIN_ID } from "@/config/contracts";
import { Wallet, LogOut } from "lucide-react";

const WalletConnect = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const wrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
      >
        <Wallet className="w-4 h-4" /> Connect Wallet
      </button>
    );
  }

  if (wrongChain) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-destructive font-medium">Wrong network</span>
        <button
          onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
          className="px-4 py-2 rounded-lg bg-warning text-warning-foreground font-semibold text-sm"
        >
          Switch to Sepolia
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-sm text-muted-foreground">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};

export default WalletConnect;
