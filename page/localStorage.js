const SETTINGS_MAP_STYLE_KEY = 'settingsMapStyleKey';

export function getMapStyleSetting() {
  return localStorage.getItem(SETTINGS_MAP_STYLE_KEY) || 'standard';
}

export function setMapStyleSetting(value) {
  return localStorage.setItem(SETTINGS_MAP_STYLE_KEY, value);
}
