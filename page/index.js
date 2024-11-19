mapboxgl.accessToken = "__TEMPLATE_MAPBOX_ACCESS_TOKEN__";

const map = new mapboxgl.Map({
  container: 'map',
  center: [139.7669975, 35.6812505], // Tokyo
  style: "mapbox://styles/windfiber/cm3hcr9yl007301sq96vwf55b",
  zoom: 11,
  minZoom: 6,
  language: 'ja',
  customAttribution: [`Source: <a href="https://www.biodic.go.jp/kiso/vg/vg_kiso.html">1/2.5万植生図GISデータ(環境省生物多様性センター)</a> を加工して作成`],
});

map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
  })
);

const mobile = navigator.userAgentData.mobile;

const legendDai = "__TEMPLATE_LEGEND_DAI__";
const legendChu = "__TEMPLATE_LEGEND_CHU__";
const legendSai = "__TEMPLATE_LEGEND_SAI__";
const legendShokusei = "__TEMPLATE_LEGEND_SHOKUSEI__";

const fillColorMatcherSai = "__TEMPLATE_FILL_COLOR_SAI_MATCHER__";
const fillColorMatcherChu = "__TEMPLATE_FILL_COLOR_CHU_MATCHER__";
const fillColorMatcherDai = "__TEMPLATE_FILL_COLOR_DAI_MATCHER__";

const daiSpecialTransform = {
  91: 58, // Water area
  99: 57, // Paddy field
}

const paintPropertyOptions = {
  validate: false,
}

// Kubun enums
const SAI = 11;
const CHU = 13;
const DAI = 1113;

const DEFAULT_FILL_OPACITY = {
  [SAI]: 0.55,
  [CHU]: 0.5,
  [DAI]: 0.5,
}

const SELECTED_FILL_OPACITY = {
  [SAI]: 0.95,
  [CHU]: 0.9,
  [DAI]: 0.9,
}

const LAYER_NAME = {
  [SAI]: 'vg67-sai',
  [CHU]: 'vg67-chu',
  [DAI]: 'vg67-dai',
}

const PROPERTY_KEY = {
  [SAI]: 'H',
  [CHU]: 'C',
  [DAI]: 'D',
}

const updateFillOpacity = (code, kubun) => {
  if (mobile) {
    // do nothing
    return
  }
  // code should be raw; before transformed
  if (code == null) {
    map.setPaintProperty(LAYER_NAME[kubun], 'fill-opacity', DEFAULT_FILL_OPACITY[kubun], paintPropertyOptions);
  } else {
    map.setPaintProperty(LAYER_NAME[kubun],
      'fill-opacity',
      ["case", ["==", ["get", PROPERTY_KEY[kubun]], code], SELECTED_FILL_OPACITY[kubun], 0.3],
      paintPropertyOptions
    )
  }
}

const getLegendsSai = (saiCode) => {
  const parents = getLegendsChu(Math.floor(saiCode / 100))

  if (saiCode % 100 === 0) {
    return parents
  } else {
    const name = legendSai[String(saiCode)];
    const saiLegend = {
      "name": name,
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
    const name = legendChu[String(chuCode)];
    const chuLegend = {
      "name": name,
      "linkCode": chuCode * 100,
    }
    return [chuLegend, ...parents]
  }

}

const getLegendsDai = (daiCode) => {
  const dai = legendDai[String(daiCode)];
  const shokuseiName = legendShokusei[String(dai["cc"])];
  const daiName = dai["n"];
  return [
    {
      "name": daiName,
      "linkCode": daiCode * 10000,
    },
    {
      "name": shokuseiName,
    },
  ]
}

const getLegends = (code, kubun) => {
  switch (kubun) {
    case SAI:
      return getLegendsSai(code)
    case CHU:
      return getLegendsChu(code)
    case DAI:
      return getLegendsDai(code)
  }

  return null // unexpected
}

const formatCode = (code) => {
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

const updateMatcherValue = (matcher, rawCode, value) => {
  // delete current match
  for (let i = 0; i < matcher.length; i++) {
    const v = matcher[i];
    if (Array.isArray(v)) {
      if (v.includes(rawCode)) {
        if (v.length === 1) {
          matcher.splice(i, 2);
        } else {
          matcher[i] = v.filter((k) => k !== rawCode);
        }
        break
      }
    }
  }

  matcher.splice(2, 0, [rawCode], value);
}

const onPickColorChange = (value, rawCode, kubun) => {
  switch (kubun) {
    case SAI:
      updateMatcherValue(fillColorMatcherSai, rawCode, value);
      map.setPaintProperty(LAYER_NAME[kubun], 'fill-color', fillColorMatcherSai, paintPropertyOptions);
      break
    case CHU:
      updateMatcherValue(fillColorMatcherChu, rawCode, value);
      map.setPaintProperty(LAYER_NAME[kubun], 'fill-color', fillColorMatcherChu, paintPropertyOptions);
      break
    case DAI:
      updateMatcherValue(fillColorMatcherDai, rawCode, value);
      map.setPaintProperty(LAYER_NAME[kubun], 'fill-color', fillColorMatcherDai, paintPropertyOptions);
      break
  }
}

const renderHTML = (code, rawCode, legends, rgb, kubun) => {
  const legend = legends[0];
  const parentsText = legends.slice(1).reverse().map(t => t.name).join(" > ") + " >";

  return `
  <div class="popup">
    <p class="legendParent">${parentsText}</p> 
    <p class="legendCode"><input type="color" title="Click to change the fill color" class="legendColorBox" value="${rgb}" onChange="onPickColorChange(this.value, ${rawCode}, ${kubun})" />&nbsp;${formatCode(code)}</span></p>
    <p class="legendName">${legend.name}</p>
  </div>
  `;
}

const eventFillColorToRGB = (e) => {
  const rgba = e.features[0].layer.paint["fill-color"];
  const rgbToHex = (v) => Math.floor(v * 255).toString(16).padStart(2, "0");
  return `#${rgbToHex(rgba.r)}${rgbToHex(rgba.g)}${rgbToHex(rgba.b)}`
}

const onMapClick = (e, kubun) => {
  const rawCode = e.features[0].properties[PROPERTY_KEY[kubun]];
  updateFillOpacity(rawCode, kubun);
  let code = rawCode;
  const rgb = eventFillColorToRGB(e);
  if (rawCode in daiSpecialTransform) {
    code = daiSpecialTransform[rawCode];
  }
  const legends = getLegends(code, kubun);
  const popup = new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(renderHTML(code, rawCode, legends, rgb, kubun))
    .addTo(map);

  popup.on('close', () => {
    updateFillOpacity(null, kubun);
  })
}

map.on('load', () => {
  map.addSource('vg67-dai', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_DAI_URL__",
    ],
    minzoom: 6,
    maxzoom: 8,
    bounds: [
      122, 24, 154, 46,
    ],
  });
  map.addSource('vg67-chu', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_CHU_URL__",
    ],
    minzoom: 8,
    maxzoom: 9,
    bounds: [
      122, 24, 154, 46,
    ],
  });
  map.addSource('vg67-sai', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_SAI_URL__",
    ],
    minzoom: 9,
    maxzoom: 12,
    bounds: [
      122, 24, 154, 46,
    ],
  });

  map.addLayer({
    'id': LAYER_NAME[DAI],
    'type': 'fill',
    'source': 'vg67-dai',
    'source-layer': 'vg67_dai',
    'minzoom': 6,
    'maxzoom': 8,
    "paint": {
      "fill-color": fillColorMatcherDai,
      "fill-opacity": DEFAULT_FILL_OPACITY[DAI],
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });
  map.addLayer({
    'id': LAYER_NAME[CHU],
    'type': 'fill',
    'source': 'vg67-chu',
    'source-layer': 'vg67_chu',
    'minzoom': 8,
    'maxzoom': 10,
    "paint": {
      "fill-color": fillColorMatcherChu,
      "fill-opacity": DEFAULT_FILL_OPACITY[CHU],
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });
  map.addLayer({
    'id': LAYER_NAME[SAI],
    'type': 'fill',
    'source': 'vg67-sai',
    'source-layer': 'vg67_detail',
    'minzoom': 10,
    "paint": {
      "fill-color": fillColorMatcherSai,
      "fill-opacity": DEFAULT_FILL_OPACITY[SAI],
      "fill-outline-color": [
        "step", ["zoom"],
        "rgba(0,0,0,0)",
        12, fillColorMatcherSai,
      ],
    },
  });

  map.on('click', 'vg67-sai', (e) => {
    onMapClick(e, SAI);
  });

  map.on('click', 'vg67-chu', (e) => {
    onMapClick(e, CHU);
  });

  map.on('click', 'vg67-dai', (e) => {
    onMapClick(e, DAI);
  });

});
