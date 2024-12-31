const SETTINGS_MAP_STYLE_KEY = 'settingsMapStyleKey';
const SETTINGS_LAYER_OPACITY_KEY = 'settingsLayerOpacityKey';

export const SETTINGS_MAP_STYLE_CHANGE_EVENT = 'settingsMapStyleChange';
export const SETTINGS_LAYER_OPACITY_CHANGE_EVENT = 'settingsLayerOpacityChange';

export function getMapStyleSetting() {
  return localStorage.getItem(SETTINGS_MAP_STYLE_KEY) || 'standard';
}

export function setMapStyleSetting(value) {
  localStorage.setItem(SETTINGS_MAP_STYLE_KEY, value);
  window.dispatchEvent(new CustomEvent(SETTINGS_MAP_STYLE_CHANGE_EVENT, { "detail": { "value": value } }));
}

export function getLayerOpacitySetting() {
  const val = parseFloat(localStorage.getItem(SETTINGS_LAYER_OPACITY_KEY));
  return isNaN(val) ? 1 : val;
}

export function setLayerOpacitySetting(value) {
  localStorage.setItem(SETTINGS_LAYER_OPACITY_KEY, String(value));
  window.dispatchEvent(new CustomEvent(SETTINGS_LAYER_OPACITY_CHANGE_EVENT, { "detail": { "value": value } }));
}
