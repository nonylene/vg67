# page

Build a page to view vg67 map.

## Setup

```
$ cp variables.toml.example variables.toml
$ edit variables.toml
```

## Build

Create mapbox styles in advance.

```
$ python3 main.py
# inotify
$ inotifywait --recursive --monitor --event modify,move,create,delete . | while read; do python3 build.py; done
```
