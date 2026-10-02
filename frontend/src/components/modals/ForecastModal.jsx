import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { useMission } from "../../context/MissionContext.jsx";

export default function ForecastModal() {
  const { setModal, runForecast } = useMission();
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const { horizonDays, lookbackDays } = useMemo(() => {
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.max(1, Math.ceil((target - today) / (1000 * 60 * 60 * 24)));
    return {
      horizonDays: diff,
      lookbackDays: Math.min(365, Math.max(30, 90)),
    };
  }, [targetDate]);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal glass-panel"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
      >
        <header className="modal__header">
          <div>
            <p className="modal__kicker">Temporal Forecast</p>
            <h2>Configure Forecast Mission</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setModal(null)}>
            <X size={18} />
          </button>
        </header>

        <div className="modal__body">
          <label>
            <span>Future target date</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <div className="modal__computed">
            <span>Forecast horizon</span>
            <strong>{horizonDays} days ahead</strong>
            <p>
              Acquisition lookback: {lookbackDays} days · 3-scene sequence · any
              future date allowed.
            </p>
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn-ghost" onClick={() => setModal(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => runForecast({ targetDate, lookbackDays })}
          >
            Generate Forecast
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
