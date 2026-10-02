const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

let activeController = null;

export class ApiRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function cancelActiveRequest() {
  activeController?.abort();
  activeController = null;
}

async function postJson(path, payload) {
  cancelActiveRequest();
  activeController = new AbortController();
  const signal = activeController.signal;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((item) => item.msg).join("; ")
            : "Mission request failed";

      if (import.meta.env.DEV) {
        console.error(`[API] ${path} failed`, response.status, data);
      }

      throw new ApiRequestError(detail, response.status);
    }

    return data;
  } finally {
    if (activeController?.signal === signal) {
      activeController = null;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DETECT_PROGRESS_STAGES = [
  { index: 1, name: "Receiving coordinates" },
  { index: 2, name: "Querying Sentinel imagery" },
  { index: 3, name: "Applying cloud filtering" },
  { index: 4, name: "Selecting scenes" },
  { index: 5, name: "Downloading bands" },
  { index: 6, name: "Preprocessing tensors" },
  { index: 7, name: "Running inference" },
  { index: 8, name: "Generating heatmap" },
  { index: 9, name: "Rendering visualization" },
];

const FORECAST_PROGRESS_STAGES = [
  { index: 1, name: "Receiving coordinates" },
  { index: 2, name: "Querying Sentinel imagery" },
  { index: 3, name: "Applying cloud filtering" },
  { index: 4, name: "Selecting scenes" },
  { index: 5, name: "Downloading bands" },
  { index: 6, name: "Preprocessing tensors" },
  { index: 7, name: "Running inference" },
  { index: 8, name: "Generating visualization" },
  { index: 9, name: "Rendering visualization" },
];

export function runDetectInference(payload) {
  return postJson("/detect", payload);
}

export function runDetectInferenceAsync(payload) {
  return postJson("/detect/async", payload);
}

export function runForecastInference(payload) {
  return postJson("/predict", payload);
}

export function runForecastInferenceAsync(payload) {
  return postJson("/predict/async", payload);
}

export async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Job polling failed";
    throw new ApiRequestError(detail, response.status);
  }
  return data;
}

export function cancelJob(jobId) {
  return postJson(`/jobs/${jobId}/cancel`, {});
}

async function pollJobUntilComplete(jobId, onProgress, { shouldCancel } = {}) {
  for (;;) {
    if (shouldCancel?.()) {
      throw new Error("Mission cancelled");
    }

    const status = await getJobStatus(jobId);
    onProgress?.(status.stage || null);

    if (status.status === "completed") {
      return status.result;
    }

    if (status.status === "error" || status.status === "cancelled") {
      throw new Error(status.error || "Job failed");
    }

    await sleep(900);
  }
}

async function runSyncWithSimulatedProgress(
  runSync,
  stages,
  payload,
  onProgress,
  { shouldCancel } = {},
) {
  let stageIndex = 0;
  onProgress?.(stages[0]);

  const timer = setInterval(() => {
    if (shouldCancel?.()) {
      return;
    }
    stageIndex = Math.min(stageIndex + 1, stages.length - 2);
    onProgress?.(stages[stageIndex]);
  }, 1100);

  try {
    const response = await runSync(payload);
    onProgress?.({
      ...stages[stages.length - 1],
      percent: 100,
    });
    return response;
  } finally {
    clearInterval(timer);
  }
}

export async function runDetectWithProgress(payload, { onProgress, shouldCancel, onJobStarted } = {}) {
  try {
    const { job_id: jobId } = await runDetectInferenceAsync(payload);
    onJobStarted?.(jobId);
    return pollJobUntilComplete(jobId, onProgress, { shouldCancel });
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      if (import.meta.env.DEV) {
        console.warn("[API] /detect/async unavailable — falling back to POST /detect");
      }
      return runSyncWithSimulatedProgress(
        runDetectInference,
        DETECT_PROGRESS_STAGES,
        payload,
        onProgress,
        { shouldCancel },
      );
    }
    throw err;
  }
}

export async function runForecastWithProgress(payload, { onProgress, shouldCancel, onJobStarted } = {}) {
  try {
    const { job_id: jobId } = await runForecastInferenceAsync(payload);
    onJobStarted?.(jobId);
    return pollJobUntilComplete(jobId, onProgress, { shouldCancel });
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      if (import.meta.env.DEV) {
        console.warn("[API] /predict/async unavailable — falling back to POST /predict");
      }
      return runSyncWithSimulatedProgress(
        runForecastInference,
        FORECAST_PROGRESS_STAGES,
        payload,
        onProgress,
        { shouldCancel },
      );
    }
    throw err;
  }
}

export { API_BASE_URL };
