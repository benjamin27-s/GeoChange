import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";

import { MissionProvider, useMission } from "./context/MissionContext.jsx";
import LandingScreen from "./components/landing/LandingScreen.jsx";
import MapScreen from "./components/map/MapScreen.jsx";
import ResultDashboard from "./components/results/ResultDashboard.jsx";

function AppRoutes() {
  const { screen } = useMission();

  return (
    <AnimatePresence mode="wait">
      {screen === "landing" && <LandingScreen key="landing" />}
      {screen === "map" && <MapScreen key="map" />}
      {screen === "results" && <ResultDashboard key="results" />}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MissionProvider>
      <AppRoutes />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#0a1220",
            color: "#dbeafe",
            border: "1px solid rgba(80, 230, 255, 0.25)",
          },
        }}
      />
    </MissionProvider>
  );
}
