# geojsoner

Generate geojson files from vg67 shape files with some optimiazation:

- Strip unused properties
- Reduce precision (round 7, ~1cm)
  - Too rough precision (e.g.) may lead overlaps

## Run

```
$ poetry install
$ poetry run python3 main.py -s '/foo/vg67/**/*.shp'
# Multiprocess; ** is important. Some shapefile has one (or two?!) more parent directory...
$ seq -w 47 | xargs -P 8 -I{} poetry run python3 main.py -s '/foo/vg67/vg67_{}/**/*.shp'
```

Memo: Do multiprocess over a prefecture, not invidisual shapefiles, otherwise dedup process may not work.
