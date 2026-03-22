import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import LandingPage from "./pages/LandingPage";
import WindRosePage from "./pages/WindRosePage";
import RunwayUsabilityPage from "./pages/RunwayUsabilityPage";
import RunwayLengthPage from "./pages/RunwayLengthPage";
import AircraftPage from "./pages/AircraftPage";
import AirportPage from "./pages/AirportPage";
import HeliportPage from "./pages/HeliportPage";
import WaterRunwayPage from "./pages/WaterRunwayPage";
import ReportPage from "./pages/ReportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AnalysisProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/airport" element={<AirportPage />} />
            <Route path="/wind-rose" element={<WindRosePage />} />
            <Route path="/runway-usability" element={<RunwayUsabilityPage />} />
            <Route path="/runway-length" element={<RunwayLengthPage />} />
            <Route path="/aircraft" element={<AircraftPage />} />
            <Route path="/heliport" element={<HeliportPage />} />
            <Route path="/water-runway" element={<WaterRunwayPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AnalysisProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
