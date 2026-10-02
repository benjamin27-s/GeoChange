import { formatDatePairs } from "../../lib/acquisition.js";

export default function AcquisitionTimeline({ workflow, response, params }) {
  const pairs = formatDatePairs(response, workflow, params);

  return (
    <div className="acquisition-timeline">
      {pairs.map((pair) => (
        <article key={pair.label} className="acquisition-row">
          <span className="acquisition-row__label">{pair.label}</span>
          <div className="acquisition-row__dates">
            <div>
              <em>Requested</em>
              <strong>{pair.requested || "—"}</strong>
            </div>
            <div>
              <em>Scene used</em>
              <strong className={pair.adaptive ? "adaptive" : ""}>
                {pair.actual || "—"}
              </strong>
            </div>
          </div>
          {pair.adaptive && pair.requested !== pair.actual && (
            <p className="acquisition-row__note">
              Nearest valid low-cloud Sentinel scene auto-selected.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
