import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

const SectionHeader = ({ title, subtitle, action }: SectionHeaderProps) => (
  <div className="flex items-end justify-between mb-6">
    <div>
      <h2 className="text-2xl font-display text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

export default SectionHeader;
