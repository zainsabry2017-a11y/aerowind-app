import { Download, FileText } from "lucide-react";

interface ExportButtonProps {
  label?: string;
  variant?: "primary" | "outline";
  icon?: "download" | "file";
}

const ExportButton = ({ label = "Export", variant = "outline", icon = "download" }: ExportButtonProps) => {
  const Icon = icon === "file" ? FileText : Download;
  const base = "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm transition-all duration-200";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-primary text-primary hover:bg-primary hover:text-primary-foreground",
  };

  return (
    <button className={`${base} ${variants[variant]}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

export default ExportButton;
