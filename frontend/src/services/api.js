const API_BASE_URL = "http://localhost:8000";

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}

export function detectChange(payload) {
  return postJson("/detect", payload);
}

export function predictNext(payload) {
  return postJson("/predict", payload);
}

export { API_BASE_URL };
