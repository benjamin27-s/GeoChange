import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useRef,
} from "react";

import {
  buildDetectPayload,
  buildForecastPayload,
} from "../lib/intelligence.js";
import {
  cancelActiveRequest,
  runDetectWithProgress,
  runForecastWithProgress,
  cancelJob,
} from "../api/inferenceApi.js";
import { toFriendlyMissionError } from "../lib/errors.js";

const MissionContext = createContext(null);

export function MissionProvider({ children }) {
  const [screen, setScreen] = useState("landing");
  const [roi, setRoi] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [workflow, setWorkflow] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);

  const jobIdRef = useRef(null);
  const cancelRequestedRef = useRef(false);

  const resetMission = useCallback(() => {
    cancelActiveRequest();
    cancelRequestedRef.current = false;
    setLoading(false);
    setWorkflow(null);
    setResult(null);
    setError(null);
    setModal(null);
    setJobId(null);
    setProgress(null);
    jobIdRef.current = null;
  }, []);

  const goToMap = useCallback(() => {
    resetMission();
    setScreen("map");
  }, [resetMission]);

  const goToLanding = useCallback(() => {
    resetMission();
    setRoi(null);
    setLocationLabel("");
    setScreen("landing");
  }, [resetMission]);

  const cancelMission = useCallback(() => {
    cancelActiveRequest();
    cancelRequestedRef.current = true;

    const currentJobId = jobIdRef.current;
    if (currentJobId) {
      cancelJob(currentJobId).catch(() => undefined);
    }

    setLoading(false);
    setWorkflow(null);
    setError(null);
    setJobId(null);
    setProgress(null);
    jobIdRef.current = null;
    setScreen("map");
  }, []);

  const runDetect = useCallback(
    async (params) => {
      if (!roi?.bbox || !roi?.center) {
        setError("Click the map to place an analysis region before running detection.");
        return;
      }
      setModal(null);
      setLoading(true);
      setWorkflow("detect");
      setError(null);
      setProgress(null);
      cancelRequestedRef.current = false;
      setScreen("map");

      try {
        const payload = buildDetectPayload(roi, params);
        const response = await runDetectWithProgress(payload, {
          onProgress: setProgress,
          shouldCancel: () => cancelRequestedRef.current,
          onJobStarted: (id) => {
            setJobId(id);
            jobIdRef.current = id;
          },
        });

        if (cancelRequestedRef.current) return;

        setResult({
          workflow: "detect",
          response,
          params,
          locationLabel,
          roi,
        });
        setScreen("results");
      } catch (err) {
        if (cancelRequestedRef.current) return;
        const friendly = toFriendlyMissionError(err);
        if (friendly) setError(friendly);
        setScreen("map");
      } finally {
        setLoading(false);
        jobIdRef.current = null;
        cancelRequestedRef.current = false;
      }
    },
    [roi, locationLabel],
  );

  const runForecast = useCallback(
    async (params) => {
      if (!roi?.bbox || !roi?.center) {
        setError("Click the map to place an analysis region before running forecast.");
        return;
      }
      setModal(null);
      setLoading(true);
      setWorkflow("forecast");
      setError(null);
      setProgress(null);
      cancelRequestedRef.current = false;
      setScreen("map");

      try {
        const payload = buildForecastPayload(roi, params);
        const response = await runForecastWithProgress(payload, {
          onProgress: setProgress,
          shouldCancel: () => cancelRequestedRef.current,
          onJobStarted: (id) => {
            setJobId(id);
            jobIdRef.current = id;
          },
        });

        if (cancelRequestedRef.current) return;

        setResult({
          workflow: "forecast",
          response,
          params,
          locationLabel,
          roi,
        });
        setScreen("results");
      } catch (err) {
        if (cancelRequestedRef.current) return;
        const friendly = toFriendlyMissionError(err);
        if (friendly) setError(friendly);
        setScreen("map");
      } finally {
        setLoading(false);
        jobIdRef.current = null;
        cancelRequestedRef.current = false;
      }
    },
    [roi, locationLabel],
  );

  const value = useMemo(
    () => ({
      screen,
      setScreen,
      roi,
      setRoi,
      locationLabel,
      setLocationLabel,
      loading,
      workflow,
      result,
      error,
      setError,
      modal,
      setModal,
      goToMap,
      goToLanding,
      cancelMission,
      resetMission,
      runDetect,
      runForecast,
      jobId,
      progress,
    }),
    [
      screen,
      roi,
      locationLabel,
      loading,
      workflow,
      result,
      error,
      modal,
      goToMap,
      goToLanding,
      cancelMission,
      resetMission,
      runDetect,
      runForecast,
      jobId,
      progress,
    ],
  );

  return (
    <MissionContext.Provider value={value}>{children}</MissionContext.Provider>
  );
}

export function useMission() {
  const ctx = useContext(MissionContext);
  if (!ctx) {
    throw new Error("useMission must be used within MissionProvider");
  }
  return ctx;
}
