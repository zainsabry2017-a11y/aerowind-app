import { AlertTriangle } from "lucide-react";

interface WarningBannerProps {
  message: string;
}

const WarningBanner = ({ message }: WarningBannerProps) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-sm">
    <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
    <p className="text-sm text-warning">{message}</p>
  </div>
);

export default WarningBanner;
