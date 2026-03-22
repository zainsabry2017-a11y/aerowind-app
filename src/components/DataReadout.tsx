interface DataReadoutProps {
  value: string | number;
  unit: string;
  label: string;
  className?: string;
}

const DataReadout = ({ value, unit, label, className = "" }: DataReadoutProps) => (
  <div className={`p-6 border-l-2 border-l-primary bg-surface/50 rounded-sm ${className}`}>
    <div className="flex items-baseline gap-2 mb-1">
      <span className="text-4xl font-display text-foreground">{value}</span>
      <span className="text-sm font-mono-data text-muted-foreground">{unit}</span>
    </div>
    <span className="text-sm text-muted-foreground">{label}</span>
  </div>
);

export default DataReadout;
