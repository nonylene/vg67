# trimmer

Trim (merge) small polygons and summarize with each SHOKUSEI code for lower zoom layers.

- Merge small polygons
 - Smaller than 750m^2
 - Thinness ratio https://gis.stackexchange.com/questions/151939/explanation-of-the-thinness-ratio-formula is smaller than some values (varied by area)
- Label each polygon with SHOKUSEI code http://gis.biodic.go.jp/webgis/sc-016.html instead of HANREI_C
- Merge polygons which have the same SHOKUSEI code and touch (> 13% of the total border length) together

```
$ poetry install
$ poetry run poetry run python3 main.py -g '../data/geojson/p{}*.geojson'
# Multiprocess
$ seq 36 68 | xargs -I{} -P 10 poetry run python3 main.py -g '../data/geojson/p{}*.geojson'
```
