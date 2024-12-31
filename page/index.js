import {
  MAP_URL, LAYER_NAME, SAI, CHU, DAI,
  FILL_COLOR_MATCHER_CHU, FILL_COLOR_MATCHER_SAI, FILL_COLOR_MATCHER_DAI,
  DAI_SPECIAL_TRANSFORM,
  PROPERTY_KEY,
  MIN_SOURCE_ZOOM_LEVEL_CHU,
  MIN_SOURCE_ZOOM_LEVEL_SAI,
  SAI_RAW_CODE_NAMES,
  SAI_LABEL_BASE_FILTER,
  SAI_LABELS,
  LAYER_KUBUNS,
} from './consts.js';
import { SettingsButtonControl } from './control.js';
import { getMapStyleSetting, SETTINGS_LAYER_OPACITY_CHANGE_EVENT, SETTINGS_MAP_STYLE_CHANGE_EVENT } from './localStorage.js';
import { formatCode, getAdvancedLayerFilters, getCodeColor, getFillOpacity, getKubunForZoom, getLegends, getShokuseiLayerFilters, scaleCode, updateCodeColor, updateFillMatcher } from './mapFunction.js';
import { getLngLatFromURL, getZoomFromURL, updateURL } from './url.js';
import { currentChuFillOpacity, currentChuFilter, currentDaiFillOpacity, currentDaiFilter, currentSaiFillOpacity, currentSaiFilter, setCurrentRawCode, setCurrentFillOpacity, setCurrentHanreiKubun, currentCodeKubun, currentHanreiKubun, currentRawCode, CURRENT_ADVANCED_FILTER_CHANGE_EVENT, CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, setCurrentDaiFilter, setCurrentChuFilter, setCurrentSaiFilter, setCurrentShokuseiFilter, currentSaiLabelsFillOpacity } from './variables.js';


// Build map as fast as possible
mapboxgl.accessToken = "__TEMPLATE_MAPBOX_ACCESS_TOKEN__";

const map = new mapboxgl.Map({
  container: 'map',
  center: getLngLatFromURL(),
  style: MAP_URL[getMapStyleSetting()],
  zoom: getZoomFromURL(),
  minZoom: 6,
  language: 'ja',
  customAttribution: [`Source: <a href="http://www.biodic.go.jp/kiso/vg/vg_kiso.html">1/2.5万植生図GISデータ(環境省生物多様性センター)</a> を加工して作成`],
});

map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
  }),
  "bottom-right",
);

// settings
const setttingsButtonControl = new SettingsButtonControl();

map.addControl(
  setttingsButtonControl,
  "bottom-right",
);

setttingsButtonControl.addSettingsControl(map);

window.addEventListener(CURRENT_ADVANCED_FILTER_CHANGE_EVENT, (e) => {
  const newFilter = e.detail.value;
  if (newFilter.trim().length > 0) {
    setCurrentShokuseiFilter('disabled');
  } else {
    setCurrentShokuseiFilter('all');
  }
});

/* constants */
// Some user agents (Fx, Safari) do not have userAgentData still;
// (Evil?) Almost all non Chromium based browsers should be mobile
const mobile = navigator.userAgentData?.mobile ?? true;

const paintPropertyOptions = {
  validate: false,
}

const LAYER_NAMES = Object.values(LAYER_NAME);

const HANREI_BASE_URL = "__TEMPLATE_HANREI_BASE_URL__";

const DOUBLE_TAP_MS = 250;

/* global variables */
let tapTimer = null;
let doubleTapping = false

let popup = null;

/* Close details by default on mobile devices */
let legendOpen = !mobile;
let legendParentOpen = false;

const setOpacityToMap = (layerKubun, opacity) => {
  if (layerKubun === SAI_LABELS) {
    map.setPaintProperty(LAYER_NAME[layerKubun], 'text-opacity', opacity, paintPropertyOptions);
  } else {
    map.setPaintProperty(LAYER_NAME[layerKubun], 'fill-opacity', opacity, paintPropertyOptions);
  }
}

const updateFillOpacity = (rawCode, kubun) => {
  LAYER_KUBUNS.forEach(targetKubun => {
    const fillOpacity = getFillOpacity(rawCode, kubun, targetKubun);
    setCurrentFillOpacity(fillOpacity, targetKubun);
    setOpacityToMap(targetKubun, fillOpacity);
  })
}

const resetFillOpacity = () => {
  LAYER_KUBUNS.forEach(kubun => {
    const fillOpacity = getFillOpacity(null, kubun, kubun);
    setCurrentFillOpacity(fillOpacity, kubun);
    setOpacityToMap(kubun, fillOpacity);
  })
}

// click event will not fire on double click / tap
const handleSingleClick = (func) => {
  // PC users does not perform double click on the map normally
  if (!mobile) {
    func()
    return
  }

  if (!doubleTapping) {
    // first tap!
    setTimeout(() => {
      if (!doubleTapping) {
        func();
      }
      // else: A second tap fired after the first tap
    }, DOUBLE_TAP_MS);
  }
  // else: The second tap (may happen when there is a gap between DOUBLE_TAP_MS and native double tap)
}

// touch events only fires on mobile
const handleTouchStart = () => {
  setttingsButtonControl.removeSettingsControlIfExists(map);

  if (tapTimer != null) {
    doubleTapping = true;
    // Disable setting doubleTapping = false after the first tap
    clearTimeout(tapTimer);
  }
  // else: This event should be the first tap

  tapTimer = setTimeout(() => {
    doubleTapping = false;
    tapTimer = null;
  }, DOUBLE_TAP_MS - 5);
}

const handleMouseDown = () => {
  setttingsButtonControl.removeSettingsControlIfExists(map);
}

const handleEscapeKeyDown = () => {
  if (!setttingsButtonControl.removeSettingsControlIfExists(map)) {
    deselect();
  }
}

const handleZoomEnd = () => {
  updateURL(map)

  if (currentHanreiKubun == null) {
    return
  }

  const mapKubun = getKubunForZoom(map.getZoom());
  let desiredHanreiKubun;
  switch (currentCodeKubun) {
    case SAI:
      desiredHanreiKubun = mapKubun;
      break
    case CHU:
      desiredHanreiKubun = mapKubun === DAI ? DAI : CHU
      break
    case DAI:
      desiredHanreiKubun = DAI;
      break
  }

  if (desiredHanreiKubun !== currentHanreiKubun) {
    const newRawCode = scaleCode(currentRawCode, currentCodeKubun, desiredHanreiKubun);
    const legends = getLegends(newRawCode, desiredHanreiKubun);
    showHanrei(newRawCode, legends, desiredHanreiKubun);
  }
}

const handleMoveEnd = () => {
  updateURL(map)
}

const getSaiLabelFilter = (sai) => {
  if (sai == null) {
    return SAI_LABEL_BASE_FILTER
  } else {
    return ["all", sai, SAI_LABEL_BASE_FILTER]
  }
}

const setMapFilters = ([dai, chu, sai]) => {
  setCurrentDaiFilter(dai);
  setCurrentChuFilter(chu);
  setCurrentSaiFilter(sai);
  map.setFilter(LAYER_NAME[DAI], dai)
  map.setFilter(LAYER_NAME[CHU], chu)
  map.setFilter(LAYER_NAME[SAI], sai)
  map.setFilter(LAYER_NAME[SAI_LABELS], getSaiLabelFilter(sai))
}

const handleCurrentAdvancedFilterChanged = (e) => {
  const filter = e.detail.value;
  setMapFilters(getAdvancedLayerFilters(filter));
}

const handleCurrentShokuseiFilterChanged = (e) => {
  const filter = e.detail.value;
  if (filter === 'disabled') {
    return
  }
  setMapFilters(getShokuseiLayerFilters(filter));
}

const handleSettingsMapStyleChanged = (e) => {
  map.setStyle(MAP_URL[e.detail.value]);
}

const handleSettingsLayerOpacityChanged = (e) => {
  updateFillOpacity(currentRawCode, currentCodeKubun)
}

const onPickColorChange = (value, rawCode, kubun) => {
  updateCodeColor(rawCode, kubun, value);
  const fillMatcher = updateFillMatcher(rawCode, kubun, value);
  map.setPaintProperty(LAYER_NAME[kubun], 'fill-color', fillMatcher, paintPropertyOptions);
  if (kubun == SAI) {
    map.setPaintProperty(LAYER_NAME[SAI_LABELS], 'text-halo-color', fillMatcher, paintPropertyOptions);
  }
}

const fetchDescription = async (fullCode) => {
  const resp = await fetch(new URL(`descriptions/${fullCode}.json`, HANREI_BASE_URL));
  return resp.json();
}

const toImageURL = (filename) => {
  return filename != null ? new URL(`images/${filename}`, HANREI_BASE_URL) : null
}

const hideHanrei = () => {
  document.querySelector("div#legendWrapper").style.display = "none";
  document.querySelector("div#titleWrapper").style.display = "block";
}

const showHanrei = (rawCode, legends, kubun) => {
  const code = DAI_SPECIAL_TRANSFORM[rawCode] ?? rawCode
  const legend = legends[0];
  const parentsText = legends.slice(1).reverse().map(t => t.name).join(" > ") + " >";

  const template = document.querySelector("#legendTemplate")
  const clone = template.content.cloneNode(true);
  clone.querySelector(".legendParents").textContent = parentsText;
  clone.querySelector(".legendCodeNumber").textContent = formatCode(code);
  clone.querySelector(".legendCloseButton").onclick = deselect;
  clone.querySelector(".legendWrapDetails").open = legendOpen;
  clone.querySelector(".legendWrapDetails").addEventListener('toggle', (event) => {
    legendOpen = event.newState === 'open'
  });
  clone.querySelector(".legendWrapDetails>summary").textContent = legend.name;
  clone.querySelector(".legendColorBox").value = getCodeColor(rawCode, kubun);
  clone.querySelector("input.legendColorBox").addEventListener('change', (event) => onPickColorChange(event.target.value, rawCode, kubun));
  // UX: Show old content temporary for legendExpList to prevent flickering due to API call latency
  const oldLegendExpList = document.querySelector("#legendExpList")
  if (oldLegendExpList != null) {
    clone.querySelector("#legendExpList").replaceWith(oldLegendExpList.cloneNode(true));
    clone.querySelector("#legendExpList").style.filter = "opacity(0.25)"
  }

  document.querySelector("div#titleWrapper").style.display = "none";
  document.querySelector("div#legend").replaceWith(clone)
  document.querySelector("div#legendWrapper").style.display = "flex";
  document.querySelector("div#legendTile").scrollTo(0, 0);

  setCurrentHanreiKubun(kubun);

  // remove the last element for descriptions
  const promises = legends.slice(0, -1).map(async ({ code, linkCode, name }) => {
    const { image, text } = await fetchDescription(linkCode);
    return { codeRepr: formatCode(code), imageURL: toImageURL(image), text, name }
  })

  const legendListTemplate = document.querySelector("#legendExpListTemplate")
  const listClone = legendListTemplate.content.cloneNode(true);
  const expDetails = listClone.querySelector(".legendExpDetails");
  expDetails.open = legendParentOpen;
  expDetails.addEventListener("toggle", (event) => {
    legendParentOpen = event.newState === 'open'
  })

  const legendExpTemplate = document.querySelector("#legendExpTemplate")
  let exps = []
  Promise.all(promises).then(rs => exps = rs).catch(console.error).finally(() => {
    exps.map(({ codeRepr, imageURL, text, name }, idx) => {
      const clone = legendExpTemplate.content.cloneNode(true);
      if (idx == 0) {
        // First element does not need to show title
        clone.querySelector(".legendExpTitle").style.display = "none";
      } else {
        clone.querySelector(".legendExpCodeNumber").textContent = codeRepr;
        clone.querySelector(".legendExpName").textContent = name;
        clone.querySelector(".legendExpTitle").style.display = "block";
      }
      clone.querySelector(".legendExpImg").src = imageURL ?? "";
      clone.querySelector(".legendExpImg").style.display = imageURL != null ? "inline" : "none"
      clone.querySelector(".legendExpText").textContent = text;
      return clone
    }).forEach((element, idx) => {
      if (idx == 0) {
        listClone.querySelector(".currentLegendExp").appendChild(element);
      } else {
        expDetails.appendChild(element);
      }
    })

    if (exps.length <= 1) {
      expDetails.style.display = "none";
    }

    document.querySelector("div#legendExpList").replaceWith(listClone);
  })
}

const deselect = () => {
  resetFillOpacity();
  setCurrentRawCode(null, null);
  setCurrentHanreiKubun(null);
  if (popup != null) {
    popup.remove();
    popup = null;
  }
  hideHanrei();
}

const showPopup = (lngLat, name) => {
  if (mobile) {
    return
  }

  const html = `<div class="legendPopup">${name}</div>`

  popup = new mapboxgl.Popup()
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);

  // Set onclick maunally because on('close') event fires even if the popup is closed programatically
  // When we click the outside of popup, it will be closed programatically, and opacity reset process will result to waste of energy
  // since map's onclick event will be fired right after this event
  popup.getElement().querySelector("button.mapboxgl-popup-close-button").onclick = deselect;
}

const onMapClick = (e, kubun) => {
  const rawCode = e.features[0].properties[PROPERTY_KEY[kubun]];
  const lngLat = e.lngLat;
  const legends = getLegends(rawCode, kubun);

  handleSingleClick(() => {
    if (currentRawCode !== rawCode) {
      updateFillOpacity(rawCode, kubun);
      showHanrei(rawCode, legends, kubun)
      setCurrentRawCode(rawCode, kubun);
    }
    showPopup(lngLat, legends[0].name);
  })
}

map.on('load', () => {
  map.on('click', [LAYER_NAME[SAI], LAYER_NAME[SAI_LABELS]], (e) => {
    onMapClick(e, SAI);
  });

  map.on('click', LAYER_NAME[CHU], (e) => {
    onMapClick(e, CHU);
  });

  map.on('click', LAYER_NAME[DAI], (e) => {
    onMapClick(e, DAI);
  });

  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point);
    // Light theme includes the layer "water"
    if (features.filter(v => v.layer != null && LAYER_NAMES.includes(v.layer.id)).length === 0) {
      handleSingleClick(deselect);
    }
  });

  map.on('touchstart', handleTouchStart);
  map.on('mousedown', handleMouseDown);
  map.on('zoomend', handleZoomEnd);
  map.on('moveend', handleMoveEnd);

  window.addEventListener(CURRENT_ADVANCED_FILTER_CHANGE_EVENT, handleCurrentAdvancedFilterChanged)
  window.addEventListener(CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, handleCurrentShokuseiFilterChanged)
  window.addEventListener(SETTINGS_LAYER_OPACITY_CHANGE_EVENT, handleSettingsLayerOpacityChanged)
  window.addEventListener(SETTINGS_MAP_STYLE_CHANGE_EVENT, handleSettingsMapStyleChanged)

  window.addEventListener('keydown', (event) => {
    if (event.key == "Escape") handleEscapeKeyDown();
  })
})

map.on('style.load', () => {
  // Make features shine when no light environment (night)
  const fillEmissiveStrength = getMapStyleSetting() == 'night' ? 1 : 0;

  const dark = ['night', 'satellite'].includes(getMapStyleSetting());
  const labelTextColor = [
    "let", "rgb", ["to-rgba", FILL_COLOR_MATCHER_SAI],
    [
      "step",
      // calcluate luma
      [
        "+",
        ["*", ["at", 0, ["var", "rgb"]], 0.299],
        ["*", ["at", 1, ["var", "rgb"]], 0.587],
        ["*", ["at", 2, ["var", "rgb"]], 0.114]
      ],
      dark ? "#E0E0E0" : "#FFFFFF",
      dark ? 180 : 150,
      dark ? "#000000" : "#636363"
    ]
  ]

  map.addSource('vg67-dai', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_DAI_URL__",
    ],
    minzoom: 6,
    maxzoom: MIN_SOURCE_ZOOM_LEVEL_CHU,
    bounds: [
      122, 24, 154, 46,
    ],
  });
  map.addSource('vg67-chu', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_CHU_URL__",
    ],
    minzoom: MIN_SOURCE_ZOOM_LEVEL_CHU,
    maxzoom: MIN_SOURCE_ZOOM_LEVEL_SAI - 1,
    bounds: [
      122, 24, 154, 46,
    ],
  });
  map.addSource('vg67-sai', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_SAI_URL__",
    ],
    minzoom: MIN_SOURCE_ZOOM_LEVEL_SAI,
    maxzoom: 12,
    bounds: [
      122, 24, 154, 46,
    ],
  });
  map.addSource('vg67-sai-labels', {
    type: 'vector',
    tiles: [
      "__TEMPLATE_MAPTILE_SAI_LABELS_URL__",
    ],
    minzoom: 12,
    maxzoom: 12,
    bounds: [
      122, 24, 154, 46,
    ],
  });

  map.addLayer(
    Object.assign(
      {
        'id': LAYER_NAME[DAI],
        'type': 'fill',
        'source': 'vg67-dai',
        'source-layer': 'vg67_dai',
        'minzoom': 6,
        'maxzoom': MIN_SOURCE_ZOOM_LEVEL_CHU,
        "paint": {
          "fill-color": FILL_COLOR_MATCHER_DAI,
          "fill-opacity": currentDaiFillOpacity,
          "fill-outline-color": "rgba(0,0,0,0)",
          "fill-emissive-strength": fillEmissiveStrength,
        },
      },
      currentDaiFilter != null ? { "filter": currentDaiFilter } : null
    )
  );
  map.addLayer(
    Object.assign(
      {
        'id': LAYER_NAME[CHU],
        'type': 'fill',
        'source': 'vg67-chu',
        'source-layer': 'vg67_chu',
        'minzoom': MIN_SOURCE_ZOOM_LEVEL_CHU,
        'maxzoom': MIN_SOURCE_ZOOM_LEVEL_SAI,
        "paint": {
          "fill-color": FILL_COLOR_MATCHER_CHU,
          "fill-opacity": currentChuFillOpacity,
          "fill-outline-color": "rgba(0,0,0,0)",
          "fill-emissive-strength": fillEmissiveStrength,
        },
      },
      currentChuFilter != null ? { "filter": currentChuFilter } : null
    )
  );
  map.addLayer(
    Object.assign(
      {
        'id': LAYER_NAME[SAI],
        'type': 'fill',
        'source': 'vg67-sai',
        'source-layer': 'vg67_sai',
        'minzoom': MIN_SOURCE_ZOOM_LEVEL_SAI,
        "paint": {
          "fill-color": FILL_COLOR_MATCHER_SAI,
          "fill-opacity": currentSaiFillOpacity,
          "fill-outline-color": [
            "step", ["zoom"],
            "rgba(0,0,0,0)",
            12, FILL_COLOR_MATCHER_SAI,
          ],
          "fill-emissive-strength": fillEmissiveStrength,
        },
      },
      currentSaiFilter != null ? { "filter": currentSaiFilter } : null
    )
  );
  map.addLayer(
    {
      'id': LAYER_NAME[SAI_LABELS],
      'type': 'symbol',
      'source': 'vg67-sai-labels',
      'source-layer': 'vg67_sai_labels',
      'minzoom': 12.5,
      'layout': {
        "text-field": ["get", ["to-string", ["get", "H"]], ["literal", SAI_RAW_CODE_NAMES]],
        "text-size": 13,
        "text-letter-spacing": 0.1,
        "text-line-height": 1.3,
      },
      "paint": {
        "text-color": labelTextColor,
        "text-halo-width": 1,
        "text-halo-blur": 2,
        "text-halo-color": FILL_COLOR_MATCHER_SAI,
        "text-opacity": currentSaiLabelsFillOpacity,
      },
      "filter": getSaiLabelFilter(currentSaiFilter),
    }
  );
});
