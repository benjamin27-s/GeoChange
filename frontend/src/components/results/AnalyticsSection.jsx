import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnalyticsSection({
  histogram,
  distribution,
  timeline,
  showDistribution = true,
}) {
  return (
    <div className="analytics-section">
      <h3>Analytics</h3>
      <div className="analytics-grid">
        <article className="analytics-card">
          <h4>Confidence Histogram</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={histogram}>
              <CartesianGrid stroke="rgba(80,230,255,0.08)" vertical={false} />
              <XAxis dataKey="bin" tick={{ fill: "#8ba3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8ba3b8", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#0a1220",
                  border: "1px solid rgba(80,230,255,0.2)",
                }}
              />
              <Bar dataKey="count" fill="#50e6ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        {showDistribution && distribution.length > 0 && (
          <article className="analytics-card">
            <h4>Change Distribution</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribution} layout="vertical">
                <CartesianGrid stroke="rgba(80,230,255,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#8ba3b8", fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "#8ba3b8", fontSize: 10 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0a1220",
                    border: "1px solid rgba(80,230,255,0.2)",
                  }}
                />
                <Bar dataKey="value" fill="#50e6ff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        )}

        <article className="analytics-card analytics-card--wide">
          <h4>Acquisition Timeline</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeline}>
              <CartesianGrid stroke="rgba(80,230,255,0.08)" />
              <XAxis dataKey="index" tick={{ fill: "#8ba3b8", fontSize: 10 }} />
              <YAxis
                tick={{ fill: "#8ba3b8", fontSize: 10 }}
                domain={[0, 100]}
                label={{ value: "Cloud %", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a1220",
                  border: "1px solid rgba(80,230,255,0.2)",
                }}
              />
              <Line
                type="monotone"
                dataKey="cloud"
                stroke="#50e6ff"
                strokeWidth={2}
                dot={{ r: 4, fill: "#50e6ff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </div>
    </div>
  );
}
