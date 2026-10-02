import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { useMission } from "../../context/MissionContext.jsx";

function defaultDates() {
   const today = new Date();
   // End date: 7 days before today (to avoid incomplete data)
   const end = new Date(today);
   end.setUTCDate(end.getUTCDate() - 7);
   // Start date: 30 days before end, but not earlier than earliest available imagery (2026-03-01)
   const earliest = new Date('2026-03-01');
   const startCandidate = new Date(end);
   startCandidate.setUTCDate(startCandidate.getUTCDate() - 30);
   const start = startCandidate < earliest ? earliest : startCandidate;
   return {
     start: start.toISOString().slice(0, 10),
     end: end.toISOString().slice(0, 10),
   };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function DetectModal() {
  const { setModal, runDetect } = useMission();
  const defaults = defaultDates();
  const maxHistoricalDate = todayIsoDate();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [cloudThreshold, setCloudThreshold] = useState(20);
  const [sensitivity, setSensitivity] = useState(50);
  const validationMessage = useMemo(() => {
    if (!startDate || !endDate) return "Select both historical dates.";
    if (startDate > endDate) return "Start date must be on or before end date.";
    if (startDate > maxHistoricalDate || endDate > maxHistoricalDate) {
      return "Detect mode only supports historical imagery dates.";
    }
    return "";
  }, [startDate, endDate, maxHistoricalDate]);

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
            <p className="modal__kicker">Change Detection</p>
            <h2>Configure Detection Mission</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setModal(null)}>
            <X size={18} />
          </button>
        </header>

        <div className="modal__body">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              max={maxHistoricalDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={endDate}
              max={maxHistoricalDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          {validationMessage && (
            <p className="modal__validation">{validationMessage}</p>
          )}
          <label>
            <span>Cloud threshold (UI)</span>
            <input
              type="range"
              min={0}
              max={40}
              value={cloudThreshold}
              onChange={(e) => setCloudThreshold(Number(e.target.value))}
            />
            <em>{cloudThreshold}% max cloud</em>
          </label>
          <label>
            <span>Sensitivity (UI)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
            />
            <em>{sensitivity}% detection sensitivity</em>
          </label>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn-ghost" onClick={() => setModal(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={Boolean(validationMessage)}
            onClick={() => runDetect({ startDate, endDate, cloudThreshold, sensitivity })}
          >
            Run Detection
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
