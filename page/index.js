mapboxgl.accessToken = "__TEMPLATE_MAPBOX_ACCESS_TOKEN__";

const map = new mapboxgl.Map({
  container: 'map',
  center: [139.7669975, 35.6812505], // Tokyo
  style: "mapbox://styles/mapbox/standard?optimize=true",
  zoom: 10,
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
  if (code < 100) {
    // dai
    return String(code).padStart(2, '0') + '****'
  }
  if (code < 10000) {
    // chu
    return String(code).padStart(4, '0') + '**'
  }
  // sai
  return String(code).padStart(6, '0')
}

const renderHTML = (code, legends) => {
  const legend = legends[0];
  const parentsText = legends.slice(1).reverse().map(t => t.name).join(" > ") + " >";

  return `
  <div class="popup">
    <p class="legendParent">${parentsText}</p> 
    <p class="legendCode">${formatCode(code)}</p>
    <p class="legendName">${legend.name}</p>
  </div>
  `
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
  map.addSource('vg67-detail', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_DETAIL_URL__",
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
      "fill-opacity": 0.5,
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
      "fill-opacity": 0.5,
      "fill-outline-color": "rgba(0,0,0,0)",
    },
  });
  map.addLayer({
    'id': 'vg67-detail',
    'type': 'fill',
    'source': 'vg67-detail',
    'source-layer': 'vg67_detail',
    'minzoom': 10,
    "paint": {
      "fill-color": fillColorMatcher,
      "fill-opacity": 0.55,
      "fill-outline-color": [
        "step", ["zoom"],
        "rgba(0,0,0,0)",
        12, fillColorMatcher,
      ],
    },
  });

  map.on('click', 'vg67-detail', (e) => {
    const code = e.features[0].properties["H"]
    const legends = getLegendsSai(code);
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends))
      .addTo(map);
  });

  map.on('click', 'vg67-chu', (e) => {
    const code = e.features[0].properties["C"]
    const legends = getLegendsChu(code);
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends))
      .addTo(map);
  });

  map.on('click', 'vg67-dai', (e) => {
    let code = e.features[0].properties["D"];
    map.setPaintProperty('vg67-dai', 'fill-opacity', ["match", ["get", "D"], [code], 1, 0.3])
    if (code in daiSpecialTransform) {
      code = daiSpecialTransform[code];
    }
    const legends = getLegendsDai(code);
    const popup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(renderHTML(code, legends))
      .addTo(map);

    popup.on('close', () => {
      map.setPaintProperty('vg67-dai', 'fill-opacity', 0.55)
    })
  });

});
