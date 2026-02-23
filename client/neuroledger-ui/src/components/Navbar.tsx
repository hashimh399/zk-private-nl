import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const Navbar = () => {
  const location = useLocation();

  const links = [
    { to: "/", label: "Protocol Info" },
    { to: "/zk-private-lending", label: "Live Demo" },
    { to: "/admin", label: "Admin" },
  ];

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl shadow-lg shadow-purple-900/20"
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
        
        {/* Logo Section */}
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.05 }} 
            transition={{ type: "spring", stiffness: 300 }}
          >
            {/* Ensure nl.webp is in your public/ folder */}
            <img 
              src="/nl.webp" 
              alt="NeuroLedger Logo" 
              className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.4)] transition-all duration-300 group-hover:drop-shadow-[0_0_16px_rgba(168,85,247,0.6)]" 
            />
          </motion.div>
          <span className="font-extrabold text-xl md:text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-500 group-hover:from-orange-300 group-hover:to-purple-400 transition-all duration-300">
            NeuroLedger
          </span>
        </Link>

        {/* Desktop Links & Network Badge */}
        <div className="flex items-center gap-3 md:gap-6 overflow-x-auto no-scrollbar">
          <div className="hidden sm:flex items-center gap-2">
            {links.map((l) => {
              const isActive = location.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-2 md:px-4 md:py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {/* Sepolia Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-orange-500/30 bg-orange-500/10 shadow-[0_0_15px_-3px_rgba(249,115,22,0.2)] flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs md:text-sm font-mono text-orange-400 font-bold uppercase tracking-wider">
              Sepolia
            </span>
          </div>
        </div>
        
      </div>

      {/* Mobile Links Fallback (Visible only on very small screens below 'sm') */}
      <div className="sm:hidden flex items-center justify-center gap-2 pb-3 px-4 overflow-x-auto no-scrollbar border-t border-white/5 pt-2">
         {links.map((l) => {
            const isActive = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                  isActive
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "text-slate-400 hover:text-white bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
      </div>
    </motion.nav>
  );
};

export default Navbar;