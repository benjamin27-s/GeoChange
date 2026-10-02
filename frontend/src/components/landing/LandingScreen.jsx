import { motion } from "framer-motion";
import { Radar } from "lucide-react";

import { useMission } from "../../context/MissionContext.jsx";

export default function LandingScreen() {
  const { goToMap } = useMission();

  return (
    <motion.section
      className="landing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="landing-glow landing-glow--a" />
      <div className="landing-glow landing-glow--b" />

      <motion.div
        className="landing-content"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7 }}
      >
        <div className="landing-icon">
          <Radar size={28} strokeWidth={1.5} />
        </div>
        <p className="landing-kicker">Planetary Intelligence Division</p>
        <h1>AI Geospatial Intelligence Platform</h1>
        <p className="landing-subtitle">
          Satellite Change Detection &amp; Forecasting
        </p>
        <motion.button
          type="button"
          className="btn-primary landing-cta"
          onClick={goToMap}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Begin Mission
        </motion.button>
      </motion.div>
    </motion.section>
  );
}
