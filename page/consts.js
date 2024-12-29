export const LEGEND_DAI = "__TEMPLATE_LEGEND_DAI__";
export const LEGEND_CHU = "__TEMPLATE_LEGEND_CHU__";
export const LEGEND_SAI = "__TEMPLATE_LEGEND_SAI__";
export const LEGEND_SHOKUSEI = "__TEMPLATE_LEGEND_SHOKUSEI__";

export const DAI_RAW_CODE_NAMES = Object.fromEntries(Object.entries(LEGEND_DAI).map(([k, v]) => [k, v.n]));
export const CHU_RAW_CODE_NAMES = Object.fromEntries([
  ...Object.entries(DAI_RAW_CODE_NAMES).map(([k, v]) => [parseInt(k) * 100, v]),
  ...Object.entries(LEGEND_CHU),
])
export const SAI_RAW_CODE_NAMES = Object.fromEntries([
  ...Object.entries(CHU_RAW_CODE_NAMES).map(([k, v]) => [parseInt(k) * 100, v]),
  ...Object.entries(LEGEND_SAI),
])

export const DAI_RAW_CODES = Object.keys(DAI_RAW_CODE_NAMES).map(v => parseInt(v))
export const CHU_RAW_CODES = Object.keys(CHU_RAW_CODE_NAMES).map(v => parseInt(v))
export const SAI_RAW_CODES = Object.keys(SAI_RAW_CODE_NAMES).map(v => parseInt(v))

// Kubun enums
// Contribution guide: Put your favorite month/day for a new kubun const
export const SAI_LABELS = 1220;
export const SAI = 11;
export const CHU = 13;
export const DAI = 1113;

export const KUBUNS = [DAI, CHU, SAI];
export const LAYER_KUBUNS = [DAI, CHU, SAI, SAI_LABELS];

export const LAYER_NAME = {
  [DAI]: 'vg67-dai',
  [CHU]: 'vg67-chu',
  [SAI]: 'vg67-sai',
  [SAI_LABELS]: 'vg67-sai-labels',
}

export const PROPERTY_KEY = {
  [DAI]: 'D',
  [CHU]: 'C',
  [SAI]: 'H',
  [SAI_LABELS]: 'H',
}

// Fill color matcher contents may change by color settings
export const CODE_COLORS_SAI = "__TEMPLATE_CODE_COLORS_SAI_MATCHER__";
export const CODE_COLORS_CHU = "__TEMPLATE_CODE_COLORS_CHU_MATCHER__";
export const CODE_COLORS_DAI = "__TEMPLATE_CODE_COLORS_DAI_MATCHER__";

export const FALLBACK_COLOR = "#000000"

const buildMapboxMatcher = (colors, key) => {
  return [
    "match", ["get", key],
    ...Object.entries(Object.groupBy(Object.entries(colors), ([_, color]) => color)).flatMap(
      ([color, vs]) => [vs.map(([code,]) => parseInt(code)), color]
    ),
    FALLBACK_COLOR,
  ];
}

// Zoom level 12.5 -> zoom = 12
export const SAI_LABEL_BASE_FILTER = ["step", ["zoom"], false, 12, ["has", "12.5"], 13, ["has", "13"], 14, ["has", "14"], 15, true];

export const FILL_COLOR_MATCHER_SAI = buildMapboxMatcher(CODE_COLORS_SAI, PROPERTY_KEY[SAI]);
export const FILL_COLOR_MATCHER_CHU = buildMapboxMatcher(CODE_COLORS_CHU, PROPERTY_KEY[CHU]);
export const FILL_COLOR_MATCHER_DAI = buildMapboxMatcher(CODE_COLORS_DAI, PROPERTY_KEY[DAI]);

export const MIN_SOURCE_ZOOM_LEVEL_SAI = 10
export const MIN_SOURCE_ZOOM_LEVEL_CHU = 8

export const MAP_URL = {
  "standard": "__TEMPLATE_MAPBOX_STYLE_URL_STANDARD__",
  "light": "__TEMPLATE_MAPBOX_STYLE_URL_LIGHT__",
  "night": "__TEMPLATE_MAPBOX_STYLE_URL_NIGHT__",
  // https://docs.mapbox.com/api/maps/styles/
  "satellite": "mapbox://styles/mapbox/satellite-v9?optimize=true",
}

// Special codes
export const DAI_SPECIAL_TRANSFORM = {
  91: 58, // Water area
  99: 57, // Paddy field
}

export const DAI_SPECIAL_TRANSFORM_REVERSE = Object.fromEntries(
  Object.entries(DAI_SPECIAL_TRANSFORM).map(([k, v]) => [v, parseInt(k)])
)

export const DEFAULT_FILL_OPACITY = {
  [DAI]: 0.5,
  [CHU]: 0.5,
  [SAI]: 0.55,
  [SAI_LABELS]: 1,
}
