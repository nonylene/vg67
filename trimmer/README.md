# trimmer

Trim (merge) small polygons and summarize with each SHOKUSEI code for lower zoom layers.

- Merge small polygons
 - Smaller than 500m^2
 - Either total width or height is shorter than 300m
- Label each polygon with SHOKUSEI code http://gis.biodic.go.jp/webgis/sc-016.html instead of HANREI_C
- Merge polygons touching together which have the same SHOKUSEI code

```
$ poetry install
$ poetry run poetry run python3 main.py -g '../data/geojson/p{}*.geojson'
# Multiprocess
$ seq 36 68 | xargs -I{} -P 10 poetry run python3 main.py -g '../data/geojson/p{}*.geojson'
```
