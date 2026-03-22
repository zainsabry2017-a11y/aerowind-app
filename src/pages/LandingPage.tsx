import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, CircleDot, Ruler, Plane, HeartHandshake, Droplets, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

// ── Airport tools (existing, unchanged) ──────────────────────────────────────
const airportTools = [
  {
    title: "Wind Rose Studio",
    desc: "Analyze wind data and generate ICAO-compliant wind roses for runway orientation.",
    icon: Wind,
    path: "/wind-rose",
    stat: "16-Point Analysis",
  },
  {
    title: "Runway Usability",
    desc: "Calculate wind coverage and crosswind components for candidate runway headings.",
    icon: CircleDot,
    path: "/runway-usability",
    stat: "AC 150/5300-13B",
  },
  {
    title: "Runway Length",
    desc: "Determine required runway length based on aircraft type and site conditions.",
    icon: Ruler,
    path: "/runway-length",
    stat: "Chapter 3 Method",
  },
  {
    title: "Aircraft Library",
    desc: "Browse ICAO aircraft characteristics database with AAC/ADG classification.",
    icon: Plane,
    path: "/aircraft",
    stat: "500+ Aircraft",
  },
];

// ── Home category cards ───────────────────────────────────────────────────────
const categories = [
  {
    id: "heliport",
    title: "Heliport",
    desc: "GACAR Part 138 helipad design, OLS, lighting, and RFFS requirements.",
    icon: HeartHandshake,
    stat: "GACAR Part 138",
    path: "/heliport",
  },
  {
    id: "airport",
    title: "Airport",
    desc: "Wind rose analysis, runway usability, length calculations, and aircraft library.",
    icon: Plane,
    stat: "ICAO Annex 14",
    path: "/airport", // new 8-tab Airport workflow
  },
  {
    id: "water-runway",
    title: "Water Runway",
    desc: "Seaplane base planning and water runway analysis tools.",
    icon: Droplets,
    stat: "Seaplane Base",
    path: "/water-runway",
  },
];

// ── Animation variants ────────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

// ── Component ─────────────────────────────────────────────────────────────────
const LandingPage = () => {
  const [view, setView] = useState<"home" | "airport">("home");
  const navigate = useNavigate();

  const handleCategoryClick = (cat: typeof categories[0]) => {
    if (cat.path) {
      navigate(cat.path);
    } else {
      setView("airport");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top progress bar */}
      <div className="h-[2px] bg-primary/20 w-full">
        <div className="h-full bg-primary animate-progress-load" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-border rounded-sm text-xs text-muted-foreground mb-6">
            <Wind className="w-3 h-3 text-primary" />
            <span className="font-mono-data">ICAO Annex 14 / GACAR Aligned</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display text-foreground mb-4">
            AeroWind<br />Runway Planner
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Precision analysis for critical infrastructure.<br />
            Calculate runway usability and wind coverage with engineering accuracy.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── HOME: 3 category cards ── */}
          {view === "home" && (
            <motion.div
              key="home"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
              className="grid grid-cols-1 md:grid-cols-3 gap-0 max-w-4xl w-full border border-border"
            >
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <motion.div key={cat.id} variants={item}>
                    <button
                      onClick={() => handleCategoryClick(cat)}
                      className="w-full text-left block p-8 border border-border bg-surface hover:bg-secondary/30 transition-all duration-300 group cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center group-hover:glow-cyan transition-shadow">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data">
                          {cat.stat}
                        </span>
                      </div>
                      <h3 className="text-lg font-display text-foreground mb-2 group-hover:text-primary transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {cat.desc}
                      </p>
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ── AIRPORT: existing 4 tool cards ── */}
          {view === "airport" && (
            <motion.div
              key="airport"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
              className="max-w-4xl w-full"
            >
              {/* Back button */}
              <button
                onClick={() => setView("home")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </button>

              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-border"
              >
                {airportTools.map((tool) => (
                  <motion.div key={tool.path} variants={item}>
                    <Link
                      to={tool.path}
                      className="block p-8 border border-border bg-surface hover:bg-secondary/30 transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center group-hover:glow-cyan transition-shadow">
                          <tool.icon className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono-data">
                          {tool.stat}
                        </span>
                      </div>
                      <h3 className="text-lg font-display text-foreground mb-2 group-hover:text-primary transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tool.desc}
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer tag */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-xs text-muted-foreground/50 font-mono-data"
        >
          v2.0 — Airport Planning Engineering Suite
        </motion.p>
      </div>
    </div>
  );
};

export default LandingPage;
