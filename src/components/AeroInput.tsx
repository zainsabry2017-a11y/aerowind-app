import { ReactNode } from "react";

interface AeroInputProps {
  label: string;
  placeholder?: string;
  unit?: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
}

const AeroInput = ({ label, placeholder, unit, type = "text", value, onChange }: AeroInputProps) => (
  <div className="space-y-1">
    <label className="aero-label">{label}</label>
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="aero-input w-full rounded-sm"
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono-data">
          {unit}
        </span>
      )}
    </div>
  </div>
);

interface AeroSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (v: string) => void;
}

const AeroSelect = ({ label, options, value, onChange }: AeroSelectProps) => (
  <div className="space-y-1">
    <label className="aero-label">{label}</label>
    <select
      value={value}
      onChange={e => onChange?.(e.target.value)}
      className="aero-input w-full rounded-sm appearance-none cursor-pointer"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export { AeroInput, AeroSelect };
