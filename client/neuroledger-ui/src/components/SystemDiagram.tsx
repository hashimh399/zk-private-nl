import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { label: "User", sub: "Deposits ETH" },
  { label: "ZK Proof", sub: "Groth16 Eligibility" },
  { label: "BorrowGate", sub: "requestBorrow()" },
  { label: "CRE Workflow", sub: "Risk Assessment" },
  { label: "Receiver", sub: "On-chain Report" },
  { label: "Registry", sub: "Approve / Reject" },
  { label: "Execute", sub: "Mint & Borrow NL" },
];

const SystemDiagram = () => {
  return (
    <motion.div
      className="card-elevated p-6 overflow-x-auto"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center gap-2 min-w-[800px]">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <motion.div
              className="flex flex-col items-center text-center min-w-[100px]"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center mb-2 hover:border-primary/40 transition-colors duration-300"
                whileHover={{ scale: 1.1, boxShadow: "0 0 20px -4px hsl(270 70% 60% / 0.25)" }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <span className="text-xs font-mono font-bold text-primary">{i + 1}</span>
              </motion.div>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.sub}</p>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.3 }}
              >
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default SystemDiagram;
