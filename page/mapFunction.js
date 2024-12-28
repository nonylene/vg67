import {
  SAI, CHU, DAI, DAI_SPECIAL_TRANSFORM,
  LEGEND_DAI, LEGEND_CHU, LEGEND_SAI, LEGEND_SHOKUSEI, PROPERTY_KEY,
  DAI_SPECIAL_TRANSFORM_REVERSE, DEFAULT_FILL_OPACITY,
  DAI_RAW_CODES, CHU_RAW_CODES, SAI_RAW_CODES, FALLBACK_COLOR,
  CODE_COLORS_SAI, CODE_COLORS_CHU, CODE_COLORS_DAI,
  MIN_SOURCE_ZOOM_LEVEL_CHU,
  MIN_SOURCE_ZOOM_LEVEL_SAI,
  FILL_COLOR_MATCHER_SAI,
  FILL_COLOR_MATCHER_DAI,
  FILL_COLOR_MATCHER_CHU,
  DAI_RAW_CODE_NAMES,
  CHU_RAW_CODE_NAMES,
  SAI_RAW_CODE_NAMES
} from './consts.js';

// Utilities
export const formatCode = (code) => {
  if (code < 99) {
    // dai
    return String(code).padStart(2, '0') + '****';
  }
  if (code < 9999) {
    // chu (9999 -> no information)
    return String(code).padStart(4, '0') + '**';
  }
  // sai
  return String(code).padStart(6, '0');
}


// Get layer filter

// Prebuild shokusei filters
// http://gis.biodic.go.jp/webgis/sc-016.html
const SHOKUSEI_CODES_NATURAL = [1, 2, 4, 6, 8]
const SHOKUSEI_CODES_SECONDARY = [3, 5, 7, 9]

const ADDITIONAL_CHU_CODES_NATURAL = [5807] // Natural bare ground

const daiNaturalCodes = DAI_RAW_CODES.filter(v => SHOKUSEI_CODES_NATURAL.includes(LEGEND_DAI[v]["cc"]));
const daiSecondaryCodes = DAI_RAW_CODES.filter(v => SHOKUSEI_CODES_SECONDARY.includes(LEGEND_DAI[v]["cc"]));

const chuNaturalCodes = [
  ...CHU_RAW_CODES.filter(v => daiNaturalCodes.includes(Math.floor(v / 100))),
  ...ADDITIONAL_CHU_CODES_NATURAL,
];
const chuSecondaryCodes = CHU_RAW_CODES.filter(v => daiSecondaryCodes.includes(Math.floor(v / 100)));

const saiNaturalCodes = SAI_RAW_CODES.filter(v => chuNaturalCodes.includes(Math.floor(v / 100)));
const saiSecondaryCodes = SAI_RAW_CODES.filter(v => chuSecondaryCodes.includes(Math.floor(v / 100)));

const toMapboxFilter = (rawCodes, kubun) => {
  return ["in", ["get", PROPERTY_KEY[kubun]], ["literal", rawCodes]]
}

const LAYER_FILTER_DAI_NATURAL = toMapboxFilter(daiNaturalCodes, DAI)
const LAYER_FILTER_DAI_SECONDARY = toMapboxFilter(daiSecondaryCodes, DAI)

const LAYER_FILTER_CHU_NATURAL = toMapboxFilter(chuNaturalCodes, CHU)
const LAYER_FILTER_CHU_SECONDARY = toMapboxFilter(chuSecondaryCodes, CHU)

const LAYER_FILTER_SAI_NATURAL = toMapboxFilter(saiNaturalCodes, SAI)
const LAYER_FILTER_SAI_SECONDARY = toMapboxFilter(saiSecondaryCodes, SAI)

export const getShokuseiLayerFilters = (shokusei) => {
  switch (shokusei) {
    case "natural":
      return [LAYER_FILTER_DAI_NATURAL, LAYER_FILTER_CHU_NATURAL, LAYER_FILTER_SAI_NATURAL]
    case "secondary":
      return [LAYER_FILTER_DAI_SECONDARY, LAYER_FILTER_CHU_SECONDARY, LAYER_FILTER_SAI_SECONDARY]
    default:
      // no filter
      return [null, null, null]
  }
}

export const parseCodeKubunsForAdvancedFilter = (filter) => {
  return filter.trim().split(',').filter(x => x !== '').map((number) => {
    const num = parseInt(number.trim().replace(/\**$/, "")); // Allow 01**** like strings
    if (isNaN(num)) {
      throw Error(`"${number}" is not an integer`)
    }

    if (num <= 0 || num > 999999) {
      throw Error(`${num} is outside of range(1, 1000000)`)
    }

    if (num < 100) {
      return [DAI_SPECIAL_TRANSFORM[num] ?? num, DAI]
    }

    if (num < 10000) {
      return [num, CHU]
    }

    return [num, SAI]
  });
}

export const getAdvancedLayerFilters = (filter) => {
  if (filter.trim().length == 0) {
    // no filter
    return [null, null, null]
  }

  const codeKubuns = parseCodeKubunsForAdvancedFilter(filter);

  const dai = toMapboxFilter(
    DAI_RAW_CODES.filter(rawCode => {
      return codeKubuns.some(([filterCode, kubun]) => {
        switch (kubun) {
          case DAI:
            return rawCode === filterCode || DAI_SPECIAL_TRANSFORM[rawCode] === filterCode;
          default:
            return false;
        }
      })
    }), DAI
  )

  const chu = toMapboxFilter(
    CHU_RAW_CODES.filter(rawCode => {
      return codeKubuns.some(([filterCode, kubun]) => {
        switch (kubun) {
          case DAI:
            return Math.floor(rawCode / 100) === filterCode;
          case CHU:
            return rawCode === filterCode;
          case SAI:
            return false;
        }
      })
    }), CHU
  )

  const sai = toMapboxFilter(
    SAI_RAW_CODES.filter(rawCode => {
      return codeKubuns.some(([filterCode, kubun]) => {
        switch (kubun) {
          case DAI:
            return Math.floor(rawCode / 10000) === filterCode;
          case CHU:
            return Math.floor(rawCode / 100) === filterCode;
          case SAI:
            return rawCode === filterCode;
        }
      })
    }), SAI
  )

  return [dai, chu, sai]
}

// Get legends
const getLegendsSai = (saiCode) => {
  const parents = getLegendsChu(Math.floor(saiCode / 100))

  if (saiCode % 100 === 0) {
    return parents
  } else {
    if (!(saiCode in LEGEND_SAI)) {
      return []
    }
    const name = LEGEND_SAI[saiCode];
    const saiLegend = {
      "name": name,
      "code": saiCode,
      "linkCode": saiCode,
    }
    return [saiLegend, ...parents]
  }
}

const getLegendsChu = (chuCode) => {
  const parents = getLegendsDai(Math.floor(chuCode / 100))

  if (chuCode % 100 === 0) {
    return parents
  } else {
    if (!(chuCode in LEGEND_CHU)) {
      return []
    }
    const name = LEGEND_CHU[chuCode];
    const chuLegend = {
      "name": name,
      "code": chuCode,
      "linkCode": chuCode * 100,
    }
    return [chuLegend, ...parents]
  }
}

const getLegendsDai = (daiRawCode) => {
  if (!(daiRawCode in LEGEND_DAI)) {
    return []
  }
  const daiCode = daiRawCode in DAI_SPECIAL_TRANSFORM ? DAI_SPECIAL_TRANSFORM[daiRawCode] : daiRawCode;
  const dai = LEGEND_DAI[daiRawCode];
  const shokuseiName = LEGEND_SHOKUSEI[String(dai["cc"])];
  const daiName = dai["n"];
  return [
    {
      "name": daiName,
      "code": daiCode,
      "linkCode": daiCode * 10000,
    },
    {
      "name": shokuseiName,
    },
  ]
}

export const getLegends = (rawCode, kubun) => {
  switch (kubun) {
    case SAI:
      return getLegendsSai(rawCode)
    case CHU:
      return getLegendsChu(rawCode)
    case DAI:
      return getLegendsDai(rawCode)
  }
}

export const getCodeKubunDescriptionWithName = (kubun, name) => {
  let prefix = null;
  switch (kubun) {
    case DAI:
      prefix = '大区分'
      break
    case CHU:
      prefix = '中区分'
      break
    case SAI:
      prefix = '細区分'
      break
  }

  return `${prefix}/${name}`
}

export const getCodeKubunDescription = (code, kubun) => {
  let names = null;
  switch (kubun) {
    case DAI:
      names = DAI_RAW_CODE_NAMES
      break
    case CHU:
      names = CHU_RAW_CODE_NAMES
      break
    case SAI:
      names = SAI_RAW_CODE_NAMES
      break
  }

  if (code in names) {
    return getCodeKubunDescriptionWithName(kubun, names[code])
  }

  return null
}

// Get opacity
const SELECTED_FILL_OPACITY = {
  [SAI]: 0.8,
  [CHU]: 0.9,
  [DAI]: 0.9,
}

const getTargetCodes = (rawCode, codeKubun, targetKubun) => {
  const daiCodes = (daiRawCode) => {
    const codes = [daiRawCode]
    if (daiRawCode in DAI_SPECIAL_TRANSFORM_REVERSE) {
      codes.push(DAI_SPECIAL_TRANSFORM_REVERSE[daiRawCode])
    }
    return codes
  }

  switch (codeKubun) {
    case SAI:
      switch (targetKubun) {
        case SAI:
          return [rawCode]
        case CHU:
          return [Math.floor(rawCode / 100)]
        case DAI:
          return daiCodes(Math.floor(rawCode / 10000))
      }

    case CHU:
      switch (targetKubun) {
        case SAI:
          return SAI_RAW_CODES.filter(v => Math.floor(v / 100) === rawCode)
        case CHU:
          return [rawCode]
        case DAI:
          return daiCodes(Math.floor(rawCode / 100));
      }

    case DAI:
      const code = DAI_SPECIAL_TRANSFORM[rawCode] ?? rawCode;
      switch (targetKubun) {
        case SAI:
          return SAI_RAW_CODES.filter(v => Math.floor(v / 10000) === code)
        case CHU:
          return CHU_RAW_CODES.filter(v => Math.floor(v / 100) === code)
        case DAI:
          return [rawCode]
      }
  }
}

export const getFillOpacity = (rawCode, codeKubun, targetKubun) => {
  if (rawCode == null) {
    return DEFAULT_FILL_OPACITY[targetKubun]
  }

  const targetCodes = getTargetCodes(rawCode, codeKubun, targetKubun);
  return ["match", ["get", PROPERTY_KEY[targetKubun]], targetCodes, SELECTED_FILL_OPACITY[targetKubun], 0.2]
}

// Get color

export const getCodeColor = (rawCode, kubun) => {
  switch (kubun) {
    case SAI:
      return CODE_COLORS_SAI[rawCode] ?? FALLBACK_COLOR
    case CHU:
      return CODE_COLORS_CHU[rawCode] ?? FALLBACK_COLOR
    case DAI:
      return CODE_COLORS_DAI[rawCode] ?? FALLBACK_COLOR
  }
}

export const updateCodeColor = (rawCode, kubun, newColor) => {
  switch (kubun) {
    case SAI:
      CODE_COLORS_SAI[rawCode] = newColor
      break
    case CHU:
      CODE_COLORS_CHU[rawCode] = newColor
      break
    case DAI:
      CODE_COLORS_DAI[rawCode] = newColor
      break
  }
}

export const updateFillMatcher = (rawCode, kubun, newColor) => {
  let fillMatcher;
  switch (kubun) {
    case SAI:
      fillMatcher = FILL_COLOR_MATCHER_SAI;
      break
    case CHU:
      fillMatcher = FILL_COLOR_MATCHER_CHU;
      break
    case DAI:
      fillMatcher = FILL_COLOR_MATCHER_DAI;
      break
  }

  // delete current match
  for (let i = 0; i < fillMatcher.length; i++) {
    const v = fillMatcher[i];
    if (Array.isArray(v)) {
      if (v.includes(rawCode)) {
        if (v.length === 1) {
          fillMatcher.splice(i, 2);
        } else {
          fillMatcher[i] = v.filter((k) => k !== rawCode);
        }
        break
      }
    }
  }

  fillMatcher.splice(2, 0, [rawCode], newColor);
  return fillMatcher;
}


// Get kubun from zoom

export const getKubunForZoom = (zoom) => {
  if (zoom >= MIN_SOURCE_ZOOM_LEVEL_SAI) {
    return SAI
  }

  if (zoom >= MIN_SOURCE_ZOOM_LEVEL_CHU) {
    return CHU
  }

  return DAI
}

export const scaleCode = (code, currentKubun, newKubun) => {
  switch (currentKubun) {
    case SAI:
      switch (newKubun) {
        case SAI:
          return code
        case CHU:
          return Math.floor(code / 100)
        case DAI:
          return Math.floor(code / 10000)
      }
    case CHU:
      switch (newKubun) {
        case CHU:
          return code
        case DAI:
          return Math.floor(code / 100)
      }
    case DAI:
      switch (newKubun) {
        case DAI:
          return code
      }
  }

  throw Error(`scaleKubun does not support scale to smaller kubun`)
}
