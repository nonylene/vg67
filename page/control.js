import { getMapStyleSetting, setMapStyleSetting } from "./localStorage.js";
import { CHU, DAI, MAP_URL, SAI } from "./consts.js";
import { CURRENT_ADVANCED_FILTER_CHANGE_EVENT, CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, currentAdvancedFilter, currentShokuseiFilter, setCurrentAdvancedFilter, setCurrentShokuseiFilter } from './variables.js';
import { getLegends, parseCodeKubunsForAdvancedFilter } from "./mapFunction.js";

// https://docs.mapbox.com/mapbox-gl-js/ja/api/markers/#icontrol
export class SettingsButtonControl {

  constructor(settingsControl) {
    this.settingsControl = settingsControl;
  }

  onAdd(map) {
    this.container = document.querySelector("#settingsButtonControlTemplate").content.cloneNode(true).firstElementChild;
    const button = this.container.querySelector("#settingsButton");
    button.onclick = () => {
      if (map.hasControl(this.settingsControl)) {
        map.removeControl(this.settingsControl);
      } else {
        map.addControl(this.settingsControl, "bottom-right");
      }
    }
    return this.container;
  }

  onRemove() {
    this.container.parentNode.removeChild(this.container);
  }
}

export class SettingsControl {

  onAdd(map) {
    this.container = document.querySelector("#settingsControlTemplate").content.cloneNode(true).firstElementChild;

    const mapSelect = this.container.querySelector("#settingsControlMapSelect");
    mapSelect.value = getMapStyleSetting();
    mapSelect.onchange = (e) => {
      const v = e.target.value;
      setMapStyleSetting(v);
      map.setStyle(MAP_URL[v])
    }

    const shokuseiSelect = this.container.querySelector("#settingsControlShokuseiSelect");
    shokuseiSelect.value = currentShokuseiFilter
    shokuseiSelect.onchange = (e) => setCurrentShokuseiFilter(e.target.value);
    this.onCurrentShokuseiFilterChange = (e) => {
      const newFilter = e.detail.value;
      const disabled = newFilter === 'disabled';
      shokuseiSelect.disabled = disabled;
      shokuseiSelect.value = newFilter;
    }
    window.addEventListener(CURRENT_SHOKUSEI_FILTER_CHANGE_EVENT, this.onCurrentShokuseiFilterChange);

    const updateDescription = (codeKubuns) => {
      const wrapper = document.querySelector("#settingsControlFilterWrapperTemplate").content.cloneNode(true).firstElementChild;
      codeKubuns.map(([code, kubun]) => {
        const legends = getLegends(code, kubun);
        if (legends.length === 0) {
          return null
        }

        const firstLegendName = legends[0]['name'];
        switch (kubun) {
          case DAI:
            return [code, `大区分/${firstLegendName}`]
          case CHU:
            return [code, `中区分/${firstLegendName}`]
          case SAI:
            return [code, `細区分/${firstLegendName}`]
        }
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

    const filterInput = this.container.querySelector("#settingsControlFilterInput");
    filterInput.value = currentAdvancedFilter;
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
    this.onCurrentAdvancedFilterchange = (e) => {
      const newFilter = e.detail.value;
      filterInput.value = newFilter;
      if (newFilter.trim().length > 0) {
        setCurrentShokuseiFilter('disabled');
        // as validate
        const codeKubuns = parseCodeKubunsForAdvancedFilter(newFilter);
        updateDescription(codeKubuns);
      } else {
        setCurrentShokuseiFilter('all');
        clearDescription();
      }
    }
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
