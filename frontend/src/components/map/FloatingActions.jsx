import { motion } from "framer-motion";
import { LineChart, RotateCcw, ScanSearch } from "lucide-react";

export default function FloatingActions({
  hasRoi,
  onDetect,
  onForecast,
  onReset,
}) {
  const actions = [
    {
      id: "detect",
      label: "Detect Change",
      icon: ScanSearch,
      onClick: onDetect,
      disabled: !hasRoi,
      primary: true,
    },
    {
      id: "forecast",
      label: "Forecast",
      icon: LineChart,
      onClick: onForecast,
      disabled: !hasRoi,
    },
    {
      id: "reset",
      label: "Reset ROI",
      icon: RotateCcw,
      onClick: onReset,
      disabled: !hasRoi,
    },
  ];

  return (
    <motion.div
      className="floating-actions"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {actions.map((action) => (
        <motion.button
          key={action.id}
          type="button"
          className={`fab ${action.primary ? "fab--primary" : ""}`}
          disabled={action.disabled}
          onClick={action.onClick}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          title={action.label}
        >
          <action.icon size={18} />
          <span>{action.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
