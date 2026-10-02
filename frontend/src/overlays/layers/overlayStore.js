import { useSyncExternalStore } from "react";

const subscribers = new Set();

let state = {
  layers: [],
  activeResult: null,
};

function emit() {
  subscribers.forEach((subscriber) => subscriber());
}

export function getOverlayState() {
  return state;
}

export function subscribeOverlayState(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function setOverlayLayers(layers, activeResult) {
  state = {
    layers,
    activeResult,
  };
  emit();
}

export function updateOverlayLayer(layerId, patch) {
  state = {
    ...state,
    layers: state.layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...patch } : layer,
    ),
  };
  emit();
}

export function clearOverlayState() {
  state = {
    layers: [],
    activeResult: null,
  };
  emit();
}

export function useOverlayState() {
  return useSyncExternalStore(
    subscribeOverlayState,
    getOverlayState,
    getOverlayState,
  );
}
