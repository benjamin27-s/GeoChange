import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut } from "lucide-react";

export default function ImageTabs({ tabs, compareMode = false }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [zoom, setZoom] = useState(1);
  const [compare, setCompare] = useState(50);
  const [comparing, setComparing] = useState(false);

  const current = tabs.find((t) => t.id === active) || tabs[0];
  const compareTab = tabs.find((t) => t.id === "binary") || tabs.find((t) => t.id === "heatmap");

  const canCompare = useMemo(
    () =>
      compareMode &&
      Boolean(tabs.find((t) => t.id === "heatmap")?.image) &&
      Boolean(tabs.find((t) => t.id === "binary")?.image),
    [compareMode, tabs],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === active)) {
      setActive(tabs[0]?.id);
      setZoom(1);
    }
  }, [active, tabs]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.group("[Results] Image tab payloads");
    tabs.forEach((tab) => {
      console.log(tab.id, {
        hasImage: Boolean(tab.image),
        prefix: typeof tab.image === "string" ? tab.image.slice(0, 32) : null,
        length: typeof tab.image === "string" ? tab.image.length : 0,
      });
    });
    console.groupEnd();
  }, [tabs]);

  const handleImageError = (tab) => {
    if (import.meta.env.DEV) {
      console.error("[Results] Image failed to render", {
        id: tab?.id,
        label: tab?.label,
        image: tab?.image,
      });
    }
  };

  return (
    <div className="image-tabs">
      <div className="image-tabs__nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? "active" : ""}
            onClick={() => {
              setActive(tab.id);
              setZoom(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="image-tabs__toolbar">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
          <ZoomIn size={16} />
        </button>
        {canCompare && (
          <label className="compare-toggle">
            <input
              type="checkbox"
              checked={comparing}
              onChange={(e) => setComparing(e.target.checked)}
            />
            Compare H/M
          </label>
        )}
      </div>

      <div className="image-tabs__viewport">
        {current?.image ? (
          <motion.div
            className="image-tabs__frame"
            style={{ scale: zoom }}
            layout
          >
            {comparing && canCompare ? (
              <div className="image-compare">
                <img
                  src={tabs.find((t) => t.id === "heatmap")?.image}
                  alt="Heatmap"
                  onError={() => handleImageError(tabs.find((t) => t.id === "heatmap"))}
                />
                <div
                  className="image-compare__overlay"
                  style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}
                >
                  <img
                    src={tabs.find((t) => t.id === "binary")?.image}
                    alt="Binary mask"
                    onError={() => handleImageError(compareTab)}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compare}
                  onChange={(e) => setCompare(Number(e.target.value))}
                  className="image-compare__slider"
                />
              </div>
            ) : (
              <img
                src={current.image}
                alt={current.label}
                className="image-tabs__img"
                onError={() => handleImageError(current)}
              />
            )}
          </motion.div>
        ) : null}
        {current?.image ? null : (
          <div className="image-placeholder">
            <p>{current?.label}</p>
            <span>{current?.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}
