# colormap

Generate color map from vg67 layer definition file.

Due to compatibility with the library, this script can convert only vg67 lyr files up to version 2.5.

## Run

```
$ docker build . -t colormap
$ docker run --rm -v $(realpath lyr):/lyr -it colormap python3 colormap.py -k sai > ../data/style/vg67_style.json
$ docker run --rm -v $(realpath lyr):/lyr -it colormap python3 colormap.py -k chu > ../data/style/vg67_chu_style.json
$ docker run --rm -v $(realpath lyr):/lyr -it colormap python3 colormap.py -k shokusei > ../data/style/vg67_shokusei_style.json
```
