// Shared mutable page state (one plan on screen at a time).
export const state = {
  plan: null,
  ai: null,
  doneKey: '',
  done: new Set(), // titles of actions the user ticked
  boxes: [], // checkbox elements of the plan currently on screen
  uid: 0,
};

export const tools = () => window.CleanAirTools;
