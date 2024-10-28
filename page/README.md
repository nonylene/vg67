## page

Build a page to view vg67 map.

### Build

```
$ python3 main.py
# inotify
$ while inotifywait --recursive --monitor --event modify,move,create,delete .; do python3 build.py; done
```
