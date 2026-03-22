import { AlertTriangle, Info, AlertCircle, XCircle } from "lucide-react";
import type { SafetyWarning } from "@/lib/engineeringSafety";

interface SafetyWarningsProps {
  warnings: SafetyWarning[];
}

const iconMap = {
  info: Info,
  caution: AlertCircle,
  warning: AlertTriangle,
  critical: XCircle,
};

const colorMap = {
  info: "border-primary/30 bg-primary/5 text-primary",
  caution: "border-warning/30 bg-warning/5 text-warning",
  warning: "border-warning/50 bg-warning/10 text-warning",
  critical: "border-destructive/50 bg-destructive/10 text-destructive",
};

const SafetyWarnings = ({ warnings }: SafetyWarningsProps) => {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const Icon = iconMap[w.level];
        return (
          <div key={i} className={`flex items-start gap-3 px-4 py-3 border rounded-sm ${colorMap[w.level]}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{w.message}</p>
              <p className="text-xs opacity-80 mt-0.5">{w.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SafetyWarnings;
