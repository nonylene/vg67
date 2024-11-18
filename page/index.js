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

const defaultFillDai = 0.5;
const defaultFillChu = 0.5;
const defaultFillSai = 0.55;

const legendDai = "__TEMPLATE_LEGEND_DAI__";
const legendChu = "__TEMPLATE_LEGEND_CHU__";
const legendSai = "__TEMPLATE_LEGEND_SAI__";
const legendShokusei = "__TEMPLATE_LEGEND_SHOKUSEI__";

const fillColorMatcher = "__TEMPLATE_FILL_COLOR_SAI_MATCHER__";
const fillColorMatcherChu = "__TEMPLATE_FILL_COLOR_CHU_MATCHER__";
const fillColorMatcherDai = "__TEMPLATE_FILL_COLOR_DAI_MATCHER__";

const daiSpecialTransform = {
  91: 58, // Water area
  99: 57, // Paddy field
}

const updateFillOpacityDai = (map, daiCode) => {
  if (mobile) {
    // do nothing
    return
  }
  // daiCode should be raw; before transformed
  if (daiCode == null) {
    map.setPaintProperty('vg67-dai', 'fill-opacity', defaultFillDai);
  } else {
    map.setPaintProperty('vg67-dai', 'fill-opacity', ["case", ["==", ["get", "D"], daiCode], 0.95, 0.3])
  }
}

const updateFillOpacityChu = (map, chuCode) => {
  if (mobile) {
    // do nothing
    return
  }
  // daiCode should be raw; before transformed
  if (chuCode == null) {
    map.setPaintProperty('vg67-chu', 'fill-opacity', defaultFillChu);
  } else {
    map.setPaintProperty('vg67-chu', 'fill-opacity', ["case", ["==", ["get", "C"], chuCode], 0.9, 0.3])
  }
}

const updateFillOpacitySai = (map, saiCode) => {
  if (mobile) {
    // do nothing
    return
  }
  if (saiCode == null) {
    map.setPaintProperty('vg67-sai', 'fill-opacity', defaultFillSai);
  } else {
    map.setPaintProperty('vg67-sai', 'fill-opacity', ["case", ["==", ["get", "H"], saiCode], 0.9, 0.3])
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

const formatCode = (code) => {
  if (code < 99) {
    // dai
    return String(code).padStart(2, '0') + '****'
  }
  if (code < 9999) {
    // chu (9999 -> no information)
    return String(code).padStart(4, '0') + '**'
  }
  // sai
  return String(code).padStart(6, '0')
}

const renderHTML = (code, legends, rgb) => {
  const legend = legends[0];
  const parentsText = legends.slice(1).reverse().map(t => t.name).join(" > ") + " >";

  return `
  <div class="popup">
    <p class="legendParent">${parentsText}</p> 
    <p class="legendCode"><span class="legendColorBox" style="background-color: ${rgb};"></span> ${formatCode(code)}</p>
    <p class="legendName">${legend.name}</p>
  </div>
  `
}

const eventFillColorToRGB = (e) => {
  const rgba = e.features[0].layer.paint["fill-color"];
  return `rgb(${Math.floor(rgba.r * 255)} ${Math.floor(rgba.g * 255)} ${Math.floor(rgba.b * 255)})`
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
    'id': 'vg67-dai',
    'type': 'fill',
    'source': 'vg67-dai',
    'source-layer': 'vg67_dai',
    'minzoom': 6,
    'maxzoom': 8,
    "paint": {
      "fill-color": fillColorMatcherDai,
      "fill-opacity": defaultFillDai,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });
  map.addLayer({
    'id': 'vg67-chu',
    'type': 'fill',
    'source': 'vg67-chu',
    'source-layer': 'vg67_chu',
    'minzoom': 8,
    'maxzoom': 10,
    "paint": {
      "fill-color": fillColorMatcherChu,
      "fill-opacity": defaultFillChu,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });
  map.addLayer({
    'id': 'vg67-sai',
    'type': 'fill',
    'source': 'vg67-sai',
    'source-layer': 'vg67_detail',
    'minzoom': 10,
    "paint": {
      "fill-color": fillColorMatcher,
      "fill-opacity": defaultFillSai,
      "fill-outline-color": [
        "step", ["zoom"],
        "rgba(0,0,0,0)",
        12, fillColorMatcher,
      ],
    },
  });

  map.on('click', 'vg67-sai', (e) => {
    const code = e.features[0].properties["H"]
    updateFillOpacitySai(map, code);
    const rgb = eventFillColorToRGB(e);
    const legends = getLegendsSai(code);
    const popup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends, rgb))
      .addTo(map);

    popup.on('close', () => {
      updateFillOpacitySai(map, null);
    })
  });

  map.on('click', 'vg67-chu', (e) => {
    const code = e.features[0].properties["C"]
    updateFillOpacityChu(map, code);
    const rgb = eventFillColorToRGB(e);
    const legends = getLegendsChu(code);
    const popup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends, rgb))
      .addTo(map);

    popup.on('close', () => {
      updateFillOpacityChu(map, null);
    })
  });

  map.on('click', 'vg67-dai', (e) => {
    let code = e.features[0].properties["D"];
    updateFillOpacityDai(map, code);
    const rgb = eventFillColorToRGB(e);
    if (code in daiSpecialTransform) {
      code = daiSpecialTransform[code];
    }
    const legends = getLegendsDai(code);
    const popup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends, rgb))
      .addTo(map);

    popup.on('close', () => {
      updateFillOpacityDai(map, null);
    })
  });

});
