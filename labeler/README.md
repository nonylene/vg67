# labeler

Create label data geojson files from polygon data.

```
$ poetry install
$ poetry run python3 main.py -g [geojson path pattern]
# e.g.
$ seq 36 68 | xargs -I{} -P 10 poetry run python3 main.py -g '../data/geojson/p{}*.geojson'
```
