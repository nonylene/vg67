import { getLayerOpacitySetting, getMapStyleSetting, setLayerOpacitySetting, setMapStyleSetting } from "./localStorage.js";
import { CHU, CHU_RAW_CODE_NAMES, DAI, DAI_RAW_CODE_NAMES, DAI_SPECIAL_TRANSFORM, MAP_URL, SAI, SAI_RAW_CODE_NAMES } from "./consts.js";
import { CURRENT_ADVANCED_FILTER_CHANGE_EVENT, CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, currentAdvancedFilter, currentShokuseiFilter, setCurrentAdvancedFilter, setCurrentShokuseiFilter } from './variables.js';
import { getCodeKubunDescription, getCodeKubunDescriptionWithName, parseCodeKubunsForAdvancedFilter } from "./mapFunction.js";

// https://docs.mapbox.com/mapbox-gl-js/ja/api/markers/#icontrol
export class SettingsButtonControl {

  constructor() {
    this.hanreiFilterSettingsControl = new HanreiFilterSettingsControl();
    this.settingsControl = new SettingsControl();
  }

  onAdd(map) {
    this.container = document.querySelector("#settingsButtonControlTemplate").content.cloneNode(true).firstElementChild;
    const button = this.container.querySelector("#settingsButton");
    button.onclick = () => {
      const removed = this.removeSettingsControlIfExists(map);
      if (!removed) {
        this.addSettingsControl(map);
      }
    }

    this.settingsControl.onSearchButtonClick = () => {
      map.removeControl(this.settingsControl)
      map.addControl(this.hanreiFilterSettingsControl, "bottom-right")
    }

    this.hanreiFilterSettingsControl.onCloseButtonClick = () => {
      map.removeControl(this.hanreiFilterSettingsControl)
      map.addControl(this.settingsControl, "bottom-right")
    }

    return this.container;
  }

  addSettingsControl(map) {
    map.addControl(this.settingsControl, "bottom-right");
  }

  removeSettingsControlIfExists(map) {
    if (map.hasControl(this.settingsControl)) {
      map.removeControl(this.settingsControl);
      return true
    }
    if (map.hasControl(this.hanreiFilterSettingsControl)) {
      map.removeControl(this.hanreiFilterSettingsControl);
      return true
    }
    return false
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
  }
}

export class SettingsControl {

  constructor() {
    this.onSearchButtonClick = null;
  }

  onAdd(map) {
    this.container = document.querySelector("#settingsControlTemplate").content.cloneNode(true).firstElementChild;

    const opacityInput = this.container.querySelector("#settingsControlOpacity");
    opacityInput.value = getLayerOpacitySetting();
    opacityInput.onchange = (e) => {
      const v = e.target.value;
      setLayerOpacitySetting(v);
    }

    const mapSelect = this.container.querySelector("#settingsControlMapSelect");
    mapSelect.value = getMapStyleSetting();
    mapSelect.onchange = (e) => {
      const v = e.target.value;
      setMapStyleSetting(v);
    }

    const shokuseiSelect = this.container.querySelector("#settingsControlShokuseiSelect");
    shokuseiSelect.onchange = (e) => setCurrentShokuseiFilter(e.target.value);
    const setShokuseiFilter = (newValue) => {
      const disabled = newValue === 'disabled';
      shokuseiSelect.disabled = disabled;
      shokuseiSelect.value = newValue;
    }
    setShokuseiFilter(currentShokuseiFilter);
    this.onCurrentShokuseiFilterChange = (e) => setShokuseiFilter(e.detail.value)
    window.addEventListener(CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, this.onCurrentShokuseiFilterChange);

    const updateDescription = (codeKubuns) => {
      const wrapper = document.querySelector("#settingsControlFilterWrapperTemplate").content.cloneNode(true).firstElementChild;
      codeKubuns.map(([code, kubun]) => {
        const desc = getCodeKubunDescription(code, kubun)
        return desc != null ? [code, desc] : null
      }).filter(x => x != null).forEach(([code, desc]) => {
        const elem = document.createElement('div')
        elem.textContent = `${code}: ${desc}`
        wrapper.appendChild(elem);
      })
      this.container.querySelector('#settingsControlFilterWrapper').replaceWith(wrapper);
    }

    const showError = (errorText) => {
      const wrapper = document.querySelector("#settingsControlFilterWrapperTemplate").content.cloneNode(true).firstElementChild;
      const div = document.createElement('div')
      div.textContent = `Error: ${errorText}`
      wrapper.appendChild(div)
      this.container.querySelector('#settingsControlFilterWrapper').replaceWith(wrapper);
    }

    const clearDescription = () => {
      this.container.querySelector('#settingsControlFilterWrapper').textContent = "";
    }

    this.container.querySelector("#settingsControlFilterSearchButton").onclick = this.onSearchButtonClick;

    const filterInput = this.container.querySelector("#settingsControlFilterInput");
    const setAdvancedFilter = (newFilter, initialize) => {
      filterInput.value = newFilter;
      if (newFilter.trim().length > 0) {
        // as validate
        const codeKubuns = parseCodeKubunsForAdvancedFilter(newFilter);
        updateDescription(codeKubuns);
      } else {
        if (!initialize) {
          clearDescription();
        }
      }
    }
    setAdvancedFilter(currentAdvancedFilter, true);
    filterInput.onchange = (e) => {
      const value = e.target.value;
      try {
        // as validate
        if (value.trim().length !== 0) {
          parseCodeKubunsForAdvancedFilter(value);
        }
        // if error -> do not update global variable
        setCurrentAdvancedFilter(value);
      } catch (e) {
        console.error(e);
        showError(e.message);
      }
    };
    this.onCurrentAdvancedFilterchange = (e) => setAdvancedFilter(e.detail.value, false);
    window.addEventListener(CURRENT_ADVANCED_FILTER_CHANGE_EVENT, this.onCurrentAdvancedFilterchange);

    this.container.querySelector("#settingsControlFilterResetButton").onclick = (e) => {
      setCurrentAdvancedFilter("");
      e.target.blur();
    };

    return this.container;
  }

  onRemove() {
    window.removeEventListener(CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, this.onCurrentShokuseiFilterChange)
    window.removeEventListener(CURRENT_ADVANCED_FILTER_CHANGE_EVENT, this.onCurrentAdvancedFilterchange)
    this.container.parentNode.removeChild(this.container);
  }
}

export class HanreiFilterSettingsControl {

  constructor() {
    const getDescriptionEntries = (kubun) => {
      let names;
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

      return Object.entries(names).filter(
        ([k]) => !(k in DAI_SPECIAL_TRANSFORM) && parseInt(k) !== 0 // remove no information
      ).map((([k, v]) => {
        const description = getCodeKubunDescriptionWithName(kubun, v)
        return [parseInt(k), `${k}: ${description}`]
      }))
    }

    this.allCodeDescriptions = [
      ...getDescriptionEntries(DAI),
      ...getDescriptionEntries(CHU),
      ...getDescriptionEntries(SAI),
    ]

    this.onCloseButtonClick = null;
  }

  onAdd(map) {
    this.container = document.querySelector("#hanreiFilterSettingsControlTemplate").content.cloneNode(true).firstElementChild;

    this.container.querySelector("#hanreiFilterSettingsCloseButton").onclick = this.onCloseButtonClick;

    // advanced filters should not change outside of this panel (while opening)
    this.currentAdvancedFilterCodes = parseCodeKubunsForAdvancedFilter(currentAdvancedFilter).map(([code,]) => code);

    const selectsTemplate = this.container.querySelector('#hanrelFilterSelectsTemplate')

    const setFilterSelects = (value) => {
      const selects = selectsTemplate.content.cloneNode(true).firstElementChild;
      const selectTemplate = selects.querySelector('#hanrelFilterSelectTemplate');

      const trimmed = value.trim().replace(/\**$/, "").replace(/^0*/, ""); // Remove 0 prefix and * suffix
      const selectedCodeDescriptions = this.allCodeDescriptions.filter(([k,]) => this.currentAdvancedFilterCodes.includes(k))
      const remainingCodeDescriptions = this.allCodeDescriptions.filter(
        ([k, v]) => !this.currentAdvancedFilterCodes.includes(k) && (String(k).includes(trimmed) || v.includes(trimmed))
      ).slice(0, 101);

      const appendElement = (([value, content], selected, disabled) => {
        const htmlId = `hanreiFilterSelectInput${value}`

        const select = selectTemplate.content.cloneNode(true).firstElementChild;
        const inputElement = select.querySelector('input')
        const labelElement = select.querySelector('label')

        inputElement.id = htmlId;
        inputElement.value = value;
        inputElement.checked = selected;
        inputElement.disabled = disabled;
        labelElement.htmlFor = htmlId;
        labelElement.textContent = content;

        inputElement.addEventListener('change', () => {
          const v = parseInt(inputElement.value);
          if (inputElement.checked) {
            this.currentAdvancedFilterCodes.push(v)
          } else {
            this.currentAdvancedFilterCodes = this.currentAdvancedFilterCodes.filter(x => x !== v)
          }
          setCurrentAdvancedFilter(this.currentAdvancedFilterCodes.join(','))
        })

        selects.appendChild(select);
      })

      selectedCodeDescriptions.forEach(v => appendElement(v, true, false));
      remainingCodeDescriptions.slice(0, 100).forEach(v => appendElement(v, false, false));

      if (remainingCodeDescriptions.length > 100) {
        appendElement(['Remaining', '⋯'], false, true)
      }

      this.container.querySelector('#hanreiFilterSelects').replaceWith(selects);
    }

    this.container.querySelector("#hanreiFilterInput").onchange = (e) => {
      setFilterSelects(e.target.value);
      if (mobile) {
        e.target.blur();
      }
    };
    setFilterSelects("");

    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
  }
}
