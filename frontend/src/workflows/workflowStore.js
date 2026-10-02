import { useSyncExternalStore } from "react";

const subscribers = new Set();

const initialState = {
  status: "idle",
  workflow: null,
  message: "Awaiting command",
  error: "",
  result: null,
};

let state = initialState;

function emit() {
  subscribers.forEach((subscriber) => subscriber());
}

export function getWorkflowState() {
  return state;
}

export function subscribeWorkflowState(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function setWorkflowLoading(workflow) {
  state = {
    status: "loading",
    workflow,
    message: `${workflow} acquisition and inference running`,
    error: "",
    result: null,
  };
  emit();
}

export function setWorkflowResult(workflow, result) {
  state = {
    status: "success",
    workflow,
    message: `${workflow} result rendered`,
    error: "",
    result,
  };
  emit();
}

export function setWorkflowError(workflow, error) {
  state = {
    status: "error",
    workflow,
    message: `${workflow} failed`,
    error: error.message || String(error),
    result: null,
  };
  emit();
}

export function resetWorkflowState() {
  state = initialState;
  emit();
}

export function useWorkflowState() {
  return useSyncExternalStore(
    subscribeWorkflowState,
    getWorkflowState,
    getWorkflowState,
  );
}
