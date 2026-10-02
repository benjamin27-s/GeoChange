import { useSyncExternalStore } from "react";

const listeners = new Set();

const initialState = {
  selectedLocation: null,
  selectedEntityId: null,
  activeRoi: null,
  popupVisible: false,
  interactionMode: "navigation",
  pendingWorkflow: null,
};

let state = initialState;

function emit() {
  listeners.forEach((listener) => listener());
}

export function getInteractionState() {
  return state;
}

export function subscribeInteractionState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setActiveRoi({ roi, entityId }) {
  state = {
    ...state,
    selectedLocation: roi.center,
    selectedEntityId: entityId,
    activeRoi: roi,
    popupVisible: true,
    interactionMode: "roi-selected",
    pendingWorkflow: null,
  };

  emit();
}

export function closeRoiPopup() {
  state = {
    ...state,
    popupVisible: false,
    pendingWorkflow: null,
  };

  emit();
}

export function requestWorkflow(workflow) {
  state = {
    ...state,
    pendingWorkflow: workflow,
  };

  emit();
}

export function resetInteractionState() {
  state = initialState;
  emit();
}

export function useInteractionState() {
  return useSyncExternalStore(
    subscribeInteractionState,
    getInteractionState,
    getInteractionState,
  );
}
