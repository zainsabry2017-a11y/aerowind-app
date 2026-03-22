import { Link, useLocation } from "react-router-dom";
import { Wind, Ruler, Plane, Building2, Droplets, FileText, LayoutDashboard, CircleDot } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Hangar" },
  { path: "/wind-rose", icon: Wind, label: "Wind Rose" },
  { path: "/runway-usability", icon: CircleDot, label: "Usability" },
  { path: "/runway-length", icon: Ruler, label: "Length" },
  { path: "/aircraft", icon: Plane, label: "Aircraft" },
  { path: "/heliport", icon: Building2, label: "Heliport" },
  { path: "/water-runway", icon: Droplets, label: "Water" },
  { path: "/report", icon: FileText, label: "Report" },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-1 shrink-0 h-screen sticky top-0">
      <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center mb-4">
        <Wind className="w-4 h-4 text-primary" />
      </div>
      {navItems.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} className="relative group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={`w-10 h-10 rounded-sm flex items-center justify-center transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="w-4 h-4" />
            </motion.div>
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface border border-border rounded-sm text-xs text-foreground opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {item.label}
            </div>
          </Link>
        );
      })}
    </aside>
  );
};

export default AppSidebar;
