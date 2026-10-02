const subscribers = new Set();

let globeUiState = {
  activeMode: "navigation",
  selectedTarget: null,
};

export function getGlobeUiState() {
  return globeUiState;
}

export function setGlobeUiState(nextState) {
  globeUiState = {
    ...globeUiState,
    ...nextState,
  };

  subscribers.forEach((subscriber) => subscriber(globeUiState));
}

export function subscribeGlobeUiState(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
