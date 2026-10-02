import { useEffect, useState } from "react";

function animatedValue(value, progress) {
  const match = String(value).match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return value;
  const target = Number(match[1]);
  const suffix = match[2] || "";
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return `${(target * progress).toFixed(decimals)}${suffix}`;
}

export default function StatCards({ cards }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = null;
    const started = performance.now();
    const tick = () => {
      const next = Math.min(1, (performance.now() - started) / 520);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cards]);

  return (
    <div className="stat-cards">
      {cards.map((card) => (
        <article key={card.label} className="stat-card">
          <span>{card.label}</span>
          <strong>{animatedValue(card.value, progress)}</strong>
        </article>
      ))}
    </div>
  );
}
