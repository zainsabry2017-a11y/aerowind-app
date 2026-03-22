import { ReactNode } from "react";

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const ChartContainer = ({ title, children, className = "" }: ChartContainerProps) => (
  <div className={`bg-surface border border-border rounded-sm ${className}`}>
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</h3>
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
    </div>
    <div className="p-4 min-h-[300px] flex items-center justify-center">
      {children}
    </div>
  </div>
);

export default ChartContainer;
