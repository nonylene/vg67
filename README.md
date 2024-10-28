# vg67

## Schema

- `H`: Represents `HANREI_C` (See [凡例コード](http://gis.biodic.go.jp/webgis/sc-015.html) for details)

## Craete mapbox styles

See [colormap](./colormap/README.md).

## Create mapbox tilemaps

### 1. Get vg67 shapefiles from Biodivercity Center of Japan

http://gis.biodic.go.jp/webgis/sc-023.html

### 2. Unzip all the archives

Path should be like `vg67/vg67_01/shp644441/p644441.shp` or `vg67/vg67_22/shp523852/shp523852/p523852.shp`.

### 3. Convert shapefile to geojson

See [geojsoner](./geojsoner/README.md).

### 4. Merge all the geojson files into a single jsonlines file

This step improves performance by 2x on the step 5.

```
$ rm data/geojson-lines/vg67_detail.geojsonlines
$ for f in $(find ./data/geojson/ -name '*.geojson'); do cat $f | jq -c . >> data/geojson-lines/vg67_detail.geojsonlines; done
```

### 5. Create xyz style mvt tile files

Install [felt/tippecanoe](https://github.com/felt/tippecanoe) and run:

```
$ tippecanoe -Z10 -z12 -d13 -l vg67_detail --no-simplification-of-shared-nodes --no-tile-compression --no-tile-size-limit --no-feature-limit --no-tiny-polygon-reduction --simplify-only-low-zooms -e data/mvt/out/ --force --read-parallel data/geojson-lines/vg67_detail.geojsonlines
```

- `-l`: Merge all the geojson files into the one layer
- `--no-tile-compression`: Required for mapbox / QGIS
- `--no-simplification-of-shared-nodes`: Cleanful polygon simpify (No overlaps, No empty spaces)
- `--simplify-only-low-zooms`: Show precise polygons on the max zoom
- `--no-tiny-polygon-reduction`: Disable small polygon show up as a square polygon

### 6. Upload maptile files to some block storage

For example...

```
$ docker run --rm -it -v ./rclone.conf:/config/rclone/rclone.conf:ro -v ./data/mvt/out:/data/mvt:ro rclone/rclone copy /data/mvt/ r2://{r2 bucket}/vg67/vg67_detail/ --no-check-dest --s3-no-check-bucket --progress
```

### 7. Build the viewer page

See [page](./page/README.md) directory

## Debugging

On data dir, run:

```
$ python3 -m http.server
```
