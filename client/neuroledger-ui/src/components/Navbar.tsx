import { Link, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

const Navbar = () => {
  const location = useLocation();

  const links = [
    { to: "/", label: "Portfolio" },
    { to: "/zk-private-lending", label: "Demo" },
    { to: "/admin", label: "Admin" },
  ];

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <motion.div whileHover={{ rotate: 12 }} transition={{ type: "spring", stiffness: 300 }}>
            <Shield className="w-5 h-5 text-primary" />
          </motion.div>
          <span className="font-bold text-lg group-hover:text-gradient transition-all duration-300">NeuroLedger</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                location.pathname === l.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-xs font-mono text-primary">Sepolia</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
