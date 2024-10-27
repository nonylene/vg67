# vg67

## Schema

- `H`: Represents `HANREI_C` (See [凡例コード](http://gis.biodic.go.jp/webgis/sc-015.html) for details)

## tippiecanoe

```
$ tippecanoe -Z6 -z11 -l vg67_detail --no-simplification-of-shared-nodes --no-tile-compression --no-tile-size-limit --no-feature-limit --no-tiny-polygon-reduction --simplify-only-low-zooms -e data/mvt/out/ --force data/geojson/*.geojson 
```

- `-l`: Merge all the geojson files into the one layer
- `--no-tile-compression`: Required for mapbox / QGIS
- `--no-simplification-of-shared-nodes`: Cleanful polygon simpify (No overlaps, No empty spaces)
- `--simplify-only-low-zooms`: Show precise polygons on the max zoom
- `--no-tiny-polygon-reduction`: Disable small polygon show up as a square polygon
