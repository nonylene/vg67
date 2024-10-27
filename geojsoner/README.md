# geojsoner

Generate geojson files from vg67 shape files with some optimiazation:

- Strip unused properties
- Reduce precision (round 5, ~1m)

## Run

```
$ poetry install
$ poetry run python3 main.py -s '/foo/vg67/**/*.shp'
# Multiprocess
$ seq -w 47 | xargs -P 8 -I{} poetry run python3 main.py -s '/foo/vg67/vg67_{}/*/*.shp'
```
