# type: ignore

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Tuple

from slyr_community.parser import objects
from slyr_community.parser.object import Object
from slyr_community.parser.object_registry import REGISTRY
from slyr_community.parser.stream import Stream

LAYER_FILE = "/lyr/origin.lyr"

# initialize map http://gis.biodic.go.jp/webgis/sc-016.html
_DAI_SHOKUSEI_MAP_SEED = {
    0: range(0, 1),  # Unknown code: 9999
    1: range(1, 4),
    2: range(4, 8),
    3: range(8, 11),
    4: range(11, 22),
    5: range(22, 27),
    6: range(27, 40),
    7: range(40, 47),
    8: range(47, 54),
    9: range(54, 58),
    10: range(58, 59),
    # 11 -> water (original)
}
DAI_SHOKUSEI_MAP = {}

for shokusei, rng in _DAI_SHOKUSEI_MAP_SEED.items():
    for dai in rng:
        DAI_SHOKUSEI_MAP[dai] = shokusei


def shokusei_kubun(code: int):
    if code == 580600:
        return 11

    return DAI_SHOKUSEI_MAP[code // 10000]


@dataclass(frozen=True)
class RGBA:
    r: int
    g: int
    b: int
    a: int

    def terminal_repr(self) -> str:
        return f"\033[38;2;{int(self.r)};{int(self.g)};{int(self.b)}m{str(self)}\033[0m"

    def mapbox_style(self) -> str:
        if self.a == 1:

            def fmt_hex(value: float) -> str:
                # e.g. 0.23, 1, 0.1, ....
                return "%0.2x" % int(value)

            # e.g. #123456
            return f"#{fmt_hex(self.r)}{fmt_hex(self.g)}{fmt_hex(self.b)}"

        def fmt_alpha(value: float) -> str:
            # e.g. 0.23, 1, 0.1, ....
            return ("%.2f" % value).rstrip("0").rstrip(".")

        return (
            f"rgba({round(self.r)},{round(self.g)},{round(self.b)},{fmt_alpha(self.a)})"
        )


FALLBACK_COLOR = RGBA(0, 0, 0, 1)

ADDITIONAL_COLORS = {9999: RGBA(0, 0, 0, 0)}

SHOKUSEI_COLOR_ALIASES = {
    0: 9999,  # transparent
    1: 10000,  # light purple
    2: 60107,  # Yellow
    3: 80100,  # Light green
    4: 110100,  # Mid Lime green
    5: 220100,  # More Lime green
    6: 280501,  # Dark green
    7: 420100,  # Choke red
    8: 470100,  # Wine red
    9: 570400,  # Light Blue
    10: 580100,  # Gray
    11: 580600,  # Sky blue
}


def cmyk_to_rgba(c: int, m: int, y: int, k: int) -> RGBA:
    return RGBA(
        255 * (1 - c / 100) * (1 - k / 100),
        255 * (1 - m / 100) * (1 - k / 100),
        255 * (1 - y / 100) * (1 - k / 100),
        1,
    )


def convert_color(
    color: objects.CmykColor | objects.HsvColor | objects.RgbColor,
) -> RGBA:
    match type(color):
        case objects.CmykColor:
            return cmyk_to_rgba(
                color.cyan,
                color.magenta,
                color.yellow,
                color.black,
            )
        case objects.HsvColor | objects.RgbColor:
            # HsvColor internal values are identical to RGBColor
            return RGBA(color.red, color.green, color.blue, 1)
        case _:
            raise RuntimeError(f"Unknown fill color: {color}, label: {label}")


def get_colors_from_lyr(layer_file_path: str) -> dict[int, Tuple[RGBA, RGBA]]:
    colors = {}

    with open(layer_file_path, "rb") as f:
        stream = Stream(f)
        feature_layer = stream.read_object()  # type: FeatureLayer
        renderer = feature_layer.renderer  # type: UniqueValueRenderer
        legend_group = renderer.groups[0]  # type: LegendGroup
        for hanrei_c, clazz in zip(
            renderer.values, legend_group.classes
        ):  # hanrei_c -> str, clazz -> LegendClass
            label = clazz.label
            hanrei_n = label[len(hanrei_c) :]  # For debugging
            symbol = clazz.symbol  # type: SimpleFillSymbol | MultiLayerFillSymbol

            # Get background symbol's fill / outline color
            match type(symbol):
                case objects.SimpleFillSymbol:
                    background_symbol = symbol
                case objects.MultiLayerFillSymbol:
                    # The first layer should be the background layer
                    background_symbol = symbol.layers[0]
                    if type(background_symbol) != objects.SimpleFillSymbol:
                        raise RuntimeError(
                            f"Unknown background_symbol: {background_symbol}, label: {label}"
                        )
                case _:
                    raise RuntimeError(f"Unknown symbol: {symbol}, label: {label}")

            if background_symbol.fill_style != objects.SimpleFillSymbol.STYLE_SOLID:
                raise RuntimeError(
                    f"Unknown symbol style: {background_symbol.fill_style}, label: {label}"
                )

            fill_color_rgba = convert_color(background_symbol.color)

            outline = background_symbol.outline  # type: SimpleLineSymbol
            outline_color_rgba = convert_color(outline.color)

            colors[int(hanrei_c)] = (fill_color_rgba, outline_color_rgba)

    for hanrei, color in ADDITIONAL_COLORS.items():
        colors[hanrei] = (color, RGBA(0, 0, 0, 1))

    return colors


def generate_mapbox_style(
    colors: dict[int, Tuple[RGBA, RGBA]], key: str
) -> Tuple[list[str | list[int]], list[str | list[int]]]:
    fill_colors: dict[RGBA, list[int]] = defaultdict(list)
    outline_colors: dict[RGBA, list[int]] = defaultdict(list)

    for hanrei_c, (fill, outline) in colors.items():
        fill_colors[fill].append(hanrei_c)
        outline_colors[outline].append(hanrei_c)

    def _mapbox_style(c: dict[RGBA, list[str]]) -> list[str | list[str]]:
        mapbox_style = [
            "match",
            ["get", key],
        ]

        for color, values in c.items():
            mapbox_style.append(values)
            mapbox_style.append(color.mapbox_style())

        mapbox_style.append(FALLBACK_COLOR.mapbox_style())

        return mapbox_style

    return _mapbox_style(fill_colors), _mapbox_style(outline_colors)


def main(outline: bool, shokusei: bool):
    # Register all available objects in slyr_community
    for i in dir(objects):
        obj = getattr(objects, i)
        if type(obj) is type and issubclass(obj, Object):
            REGISTRY.register(obj)

    colors = get_colors_from_lyr(LAYER_FILE)
    shokusei_colors = {
        code: colors[alias] for code, alias in SHOKUSEI_COLOR_ALIASES.items()
    }

    # fill
    fill_style, outline_style = generate_mapbox_style(colors, "H")
    shokusei_fill_style, _ = generate_mapbox_style(shokusei_colors, "S")

    if shokusei:
        print(json.dumps(shokusei_fill_style, separators=(",", ":")))
    else:
        print(json.dumps(fill_style, separators=(",", ":")))
    if outline:
        print(json.dumps(outline_style, separators=(",", ":")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "colormap", "Export vg67 lyr colromap as mapbox style json"
    )
    parser.add_argument(
        "-s", "--shokusei", help="Output shokusei style", action="store_true"
    )
    parser.add_argument(
        "-o", "--outline", help="Output outline style", action="store_true"
    )
    args = parser.parse_args()
    main(args.outline, args.shokusei)
