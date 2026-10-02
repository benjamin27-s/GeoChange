import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Map as MapIcon, Plus } from "lucide-react";
import toast from "react-hot-toast";

import {
  buildStatCards,
  changeDistribution,
  generateIntelligenceSummary,
  histogramFromDataUrl,
  timelineFromResponse,
} from "../../lib/intelligence.js";
import { useMission } from "../../context/MissionContext.jsx";
import AcquisitionTimeline from "./AcquisitionTimeline.jsx";
import AnalyticsSection from "./AnalyticsSection.jsx";
import GeospatialInsights from "./GeospatialInsights.jsx";
import ImageTabs from "./ImageTabs.jsx";
import StatCards from "./StatCards.jsx";
import { formatDatePairs } from "../../lib/acquisition.js";

function imageDataUrl(overlay) {
  if (!overlay) return null;
  return overlay.data_url || overlay.dataUrl || overlay.url || overlay.image || null;
}

export default function ResultDashboard() {
  const { result, goToMap, resetMission, goToLanding } = useMission();

  // Prevent the dashboard from crashing when the mission result
  // has been cleared during navigation back to the map/new analysis.
  if (!result) return null;

  const [histogram, setHistogram] = useState([]);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  const { workflow, response, locationLabel, roi, params } = result;

  const datePairs = useMemo(
    () => formatDatePairs(response, workflow, params),
    [response, workflow, params],
  );

  const stats = response.inference?.statistics || {};
  const overlays = stats.overlays || {};
  const isDetect = workflow === "detect";

  const t1Image = imageDataUrl(overlays.t1);
  const t2Image = imageDataUrl(overlays.t2);
  const heatmapImage = imageDataUrl(overlays.heatmap);
  const binaryMaskImage = imageDataUrl(overlays.binary_mask);

  const tabs = useMemo(() => {
    if (isDetect) {
      const [t1Pair, t2Pair] = datePairs;
      const [c1, c2] = response.cloud_percentages || [];

      return [
        {
          id: "t1",
          label: "Start (T1)",
          image: t1Image,
          description: `Requested ${t1Pair?.requested || "-"} | Scene ${
            t1Pair?.actual || "-"
          } | Cloud ${c1 != null ? `${c1.toFixed(1)}%` : "-"}.`,
        },
        {
          id: "t2",
          label: "End (T2)",
          image: t2Image,
          description: `Requested ${t2Pair?.requested || "-"} | Scene ${
            t2Pair?.actual || "-"
          } | Cloud ${c2 != null ? `${c2.toFixed(1)}%` : "-"}.`,
        },
        {
          id: "heatmap",
          label: "Heatmap",
          image: heatmapImage,
        },
        {
          id: "binary",
          label: "Binary Mask",
          image: binaryMaskImage,
        },
      ];
    }

    const frames = response.selected_timestamps || [];

    const frameTabs = frames.map((ts, i) => ({
      id: `frame-${i}`,
      label: `T${i + 1}`,
      image: null,
      description: `Sequence frame ${ts} | Cloud ${
        response.cloud_percentages?.[i]?.toFixed?.(1) ?? "-"
      }%`,
    }));

    return [
      ...frameTabs,
      {
        id: "predicted",
        label: "Predicted T4 RGB",
        image: imageDataUrl(stats.rgb_preview),
      },
    ];
  }, [
    isDetect,
    response,
    stats,
    datePairs,
    t1Image,
    t2Image,
    heatmapImage,
    binaryMaskImage,
  ]);

  const summary = useMemo(
    () => generateIntelligenceSummary(workflow, response),
    [workflow, response],
  );

  const statCards = useMemo(
    () => buildStatCards(workflow, response, roi),
    [workflow, response, roi],
  );

  const distribution = useMemo(
    () => (isDetect ? changeDistribution(stats) : []),
    [isDetect, stats],
  );

  const timeline = useMemo(
    () => timelineFromResponse(response),
    [response],
  );

  useEffect(() => {
    let cancelled = false;
    const previewImage = imageDataUrl(stats.rgb_preview);

    async function load() {
      if (isDetect && heatmapImage) {
        const data = await histogramFromDataUrl(heatmapImage);

        if (!cancelled) {
          setHistogram(data);
        }
      } else if (!isDetect && previewImage) {
        const data = await histogramFromDataUrl(previewImage, 12);

        if (!cancelled) {
          setHistogram(data);
        }
      }

      if (!cancelled) {
        setAnalyticsReady(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isDetect, heatmapImage, stats]);

  const exportReport = () => {
    const blob = new Blob([JSON.stringify(response, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `mission-${workflow}-${Date.now()}.json`;
    anchor.click();

    URL.revokeObjectURL(url);

    toast.success("Report exported");
  };

  const missionTitle = isDetect
    ? "Change Detection Mission"
    : "Forecast Mission";

  return (
    <motion.section
      className="result-dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="result-header">
        <div>
          <p className="result-kicker">
            {isDetect ? "Detection" : "Forecast"}
          </p>

          <h1>{missionTitle}</h1>

          <p className="result-location">
            {locationLabel ||
              `${roi.center.latitude.toFixed(4)}, ${roi.center.longitude.toFixed(
                4,
              )}`}
          </p>

          <AcquisitionTimeline
            workflow={workflow}
            response={response}
            params={params}
          />
        </div>
      </header>

      <div className="result-body">
        <div className="result-left">
          <ImageTabs
            tabs={tabs}
            compareMode={isDetect && Boolean(heatmapImage)}
          />
        </div>

        <aside className="result-right">
          <div className="intelligence-panel glass-panel">
            <h3>Intelligence Summary</h3>

            <p>{summary}</p>

            {response.warnings?.length > 0 && (
              <ul className="result-warnings">
                {response.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>

          <StatCards cards={statCards} />

          <GeospatialInsights
            workflow={workflow}
            response={response}
            roi={roi}
            params={params}
            histogram={histogram}
            datePairs={datePairs}
            mode="metadata"
          />
        </aside>
      </div>

      <div className="result-analytics">
        <GeospatialInsights
          workflow={workflow}
          response={response}
          roi={roi}
          params={params}
          histogram={histogram}
          datePairs={datePairs}
        />

        {analyticsReady && (
          <AnalyticsSection
            histogram={histogram}
            distribution={distribution}
            timeline={timeline}
            showDistribution={isDetect}
          />
        )}
      </div>

      <footer className="result-footer">
        <button
          type="button"
          className="btn-ghost"
          onClick={exportReport}
        >
          <Download size={16} /> Export Report
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            resetMission();
            goToMap();
          }}
        >
          <MapIcon size={16} /> Back To Map
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            resetMission();
            goToMap();
          }}
        >
          <Plus size={16} /> New Analysis
        </button>

        <button
          type="button"
          className="btn-ghost subtle"
          onClick={goToLanding}
        >
          <ArrowLeft size={16} /> Exit
        </button>
      </footer>
    </motion.section>
  );
}