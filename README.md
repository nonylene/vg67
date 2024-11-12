# vg67

## Schema

- `H`: Represents `HANREI_C` (See [凡例コード](http://gis.biodic.go.jp/webgis/sc-015.html) for details)
- `C`: Represents `{DAI_C}{CHU_C}`
- `S`: Represents `{SHOKU_C}` with original additional codes

## Craete mapbox styles

See [colormap](./colormap/README.md).

## Create mapbox tilemaps

### 1. Get vg67 shapefiles from Biodivercity Center of Japan

http://gis.biodic.go.jp/webgis/sc-023.html

### 2. Unzip all the archives

Path should be like `vg67/vg67_01/shp644441/p644441.shp` or `vg67/vg67_22/shp523852/shp523852/p523852.shp`.

### 3. Convert shapefile to geojson

See [geojsoner](./geojsoner/).

and Run:

```
# Insert a newline after each file
$ awk '{print $0}' ./data/geojson/*.geojson > data/geojson-lines/vg67_sai.geojsonlines
```

This merge improves tippecanoe performance by 2x.

### 5. Trim geojsons for lower zooms

See [trimmer](./trimmer/)

and Run:

```
# Insert a newline after each file
$ awk '{print $0}' ./data/geojson-trimmed/chu/*.geojson > data/geojson-lines/vg67_chu.geojsonlines
$ awk '{print $0}' ./data/geojson-trimmed/dai/*.geojson > data/geojson-lines/vg67_dai.geojsonlines
```

### 6. Create xyz style mvt tile files

Install [felt/tippecanoe](https://github.com/felt/tippecanoe) and run:

```
$ tippecanoe -Z10 -z12 -d14 -l vg67_detail --no-simplification-of-shared-nodes --no-tile-compression --no-tile-size-limit --no-feature-limit --no-tiny-polygon-reduction --name="vg67_detail" --description="1/2.5万植生図GISデータ(環境省生物多様性センター) https://www.biodic.go.jp/kiso/vg/vg_kiso.html を加工して作成" -e data/mvt/detail/out/ --force --read-parallel data/geojson-lines/vg67_detail.geojsonlines
$ tippecanoe -Z8 -z9 -l vg67_chu --no-simplification-of-shared-nodes --no-tile-compression --no-tile-size-limit --no-feature-limit --no-tiny-polygon-reduction --name="vg67_chu" --description="1/2.5万植生図GISデータ(環境省生物多様性センター) https://www.biodic.go.jp/kiso/vg/vg_kiso.html を加工して作成" -e data/mvt/chu/out/ --force --read-parallel data/geojson-lines/vg67_chu.geojsonlines
$ tippecanoe -Z6 -z9 -l vg67_dai --no-simplification-of-shared-nodes --no-tile-compression --no-tile-size-limit --no-feature-limit --no-tiny-polygon-reduction --name="vg67_dai" --description="1/2.5万植生図GISデータ(環境省生物多様性センター) https://www.biodic.go.jp/kiso/vg/vg_kiso.html を加工して作成" -e data/mvt/dai/out/ --force --read-parallel data/geojson-lines/vg67_dai.geojsonlines
```

- `-d14`: Keep high resolution on the max zoom
- `-l`: Merge all the geojson files into one layer
- `--no-tile-compression`: Required for mapbox / QGIS
- `--no-simplification-of-shared-nodes`: Cleanful polygon simpify (No overlaps, No empty spaces)
- `--no-tiny-polygon-reduction`: Disable small polygon show up as a square polygon

### 7. Upload maptile files to some block storage

For example...

```
$ cp rclone.conf.example rclone.conf
$ edit rclone.conf
$ docker run --rm -it -v ./rclone.conf:/config/rclone/rclone.conf:ro -v ./data/mvt/out:/data/mvt:ro rclone/rclone copy /data/mvt/ r2://{r2 bucket}/vg67/vg67_detail/ --no-check-dest --s3-no-check-bucket --progress
$ docker run --rm -it -v ./rclone.conf:/config/rclone/rclone.conf:ro -v ./data/mvt/trimmed/out:/data/mvt:ro rclone/rclone copy /data/mvt/ r2://{r2 bucket}/vg67/vg67_trimmed/ --no-check-dest --s3-no-check-bucket --progress
```

## Build the viewer page

See [page](./page/README.md) directory

## Debugging

On data dir, run:

```
$ python3 -m http.server
```

- Open <http://localhost:8000/page/> on your browser to view the map
- Set `http://localhost:8000/mvt/out/{z}/{x}/{y}.pbf` with max zoom level 12 to view the vector tiles on QGIS
