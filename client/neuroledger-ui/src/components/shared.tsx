import { Copy, Check } from "lucide-react";
import { useState } from "react";

export const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors p-1">
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export const Address = ({ addr, truncate = true }: { addr: string; truncate?: boolean }) => {
  const display = truncate ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm">
      <span>{display}</span>
      <CopyButton text={addr} />
    </span>
  );
};

export const MetricCard = ({ label, value, sub, status }: {
  label: string;
  value: string;
  sub?: string;
  status?: "safe" | "risk" | "liquidatable";
}) => {
  const statusColor = status === "safe" ? "text-success" : status === "risk" ? "text-warning" : status === "liquidatable" ? "text-destructive" : "";
  const statusBg = status === "safe" ? "bg-success/10 border-success/30" : status === "risk" ? "bg-warning/10 border-warning/30" : status === "liquidatable" ? "bg-destructive/10 border-destructive/30" : "";

  return (
    <div className="card-elevated p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <p className={`metric-value ${statusColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {status && (
        <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded border ${statusBg} ${statusColor} uppercase`}>
          {status}
        </span>
      )}
    </div>
  );
};
