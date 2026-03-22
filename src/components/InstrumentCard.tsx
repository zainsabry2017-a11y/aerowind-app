import { ReactNode } from "react";
import { motion } from "framer-motion";

interface InstrumentCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  accentColor?: "primary" | "warning";
}

const InstrumentCard = ({ title, children, className = "", accentColor = "primary" }: InstrumentCardProps) => {
  const accentClass = accentColor === "warning" ? "border-l-warning" : "border-l-primary";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`bg-surface border border-border border-l-2 ${accentClass} rounded-sm ${className}`}
    >
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
};

export default InstrumentCard;
