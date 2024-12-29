/* Global variables among modules */

import { CHU, DAI, DEFAULT_FILL_OPACITY, SAI, SAI_LABELS } from "./consts.js";

export let currentDaiFilter = null;
export let currentChuFilter = null;
export let currentSaiFilter = null;

export function setCurrentDaiFilter(v) {
  currentDaiFilter = v;
}

export function setCurrentChuFilter(v) {
  currentChuFilter = v;
}

export function setCurrentSaiFilter(v) {
  currentSaiFilter = v;
}

export let currentDaiFillOpacity = DEFAULT_FILL_OPACITY[DAI];
export let currentChuFillOpacity = DEFAULT_FILL_OPACITY[CHU];
export let currentSaiFillOpacity = DEFAULT_FILL_OPACITY[SAI];
export let currentSaiLabelsFillOpacity = DEFAULT_FILL_OPACITY[SAI_LABELS];

export function setCurrentFillOpacity(v, kubun) {
  switch (kubun) {
    case DAI:
      currentDaiFillOpacity = v;
      break;
    case CHU:
      currentChuFillOpacity = v;
      break;
    case SAI:
      currentSaiFillOpacity = v;
      break;
    case SAI_LABELS:
      currentSaiLabelsFillOpacity = v;
      break;
  }
}

export let currentRawCode = null;
export let currentCodeKubun = null;
export let currentHanreiKubun = null;

export function setCurrentRawCode(rawCode, kubun) {
  currentRawCode = rawCode;
  currentCodeKubun = kubun;
}

export function setCurrentHanreiKubun(kubun) {
  currentHanreiKubun = kubun;
}

/* configurations */
export const CURRENT_ADVANCED_FILTER_CHANGE_EVENT = 'currentAdvancedFilterChange'
export let currentAdvancedFilter = "";

export const CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT = 'currentShokuseiFilterChange'
export let currentShokuseiFilter = "all";

// Will fire an event
export function setCurrentAdvancedFilter(filter) {
  currentAdvancedFilter = filter;
  window.dispatchEvent(new CustomEvent(CURRENT_ADVANCED_FILTER_CHANGE_EVENT, { "detail": { "value": filter } }));
}

export function setCurrentShokuseiFilter(filter) {
  currentShokuseiFilter = filter;
  window.dispatchEvent(new CustomEvent(CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, { "detail": { "value": filter } }));
}
