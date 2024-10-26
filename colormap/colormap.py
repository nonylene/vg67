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


def get_colors_from_lyr(layer_file_path: str) -> dict[str, Tuple[RGBA, RGBA]]:
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

            colors[hanrei_c] = (fill_color_rgba, outline_color_rgba)

    return colors


def generate_mapbox_style(
    colors: dict[str, Tuple[RGBA, RGBA]]
) -> Tuple[list[str | list[str]], list[str | list[str]]]:
    fill_colors: dict[RGBA, list[str]] = defaultdict(list)
    outline_colors: dict[RGBA, list[str]] = defaultdict(list)

    for hanrei_c, (fill, outline) in colors.items():
        fill_colors[fill].append(hanrei_c)
        outline_colors[outline].append(hanrei_c)

    def _mapbox_style(c: dict[RGBA, list[str]]) -> list[str | list[str]]:
        mapbox_style = [
            "match",
            ["get", "HANREI_C"],
        ]

        for color, values in c.items():
            mapbox_style.append(values)
            mapbox_style.append(color.mapbox_style())

        mapbox_style.append(FALLBACK_COLOR.mapbox_style())

        return mapbox_style

    return _mapbox_style(fill_colors), _mapbox_style(outline_colors)


def main(outline: bool):
    # Register all available objects in slyr_community
    for i in dir(objects):
        obj = getattr(objects, i)
        if type(obj) is type and issubclass(obj, Object):
            REGISTRY.register(obj)

    colors = get_colors_from_lyr(LAYER_FILE)

    # fill
    fill_style, outline_style = generate_mapbox_style(colors)

    print(json.dumps(fill_style))
    if outline:
        print(json.dumps(outline_style))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "colormap", "Export vg67 lyr colromap as mapbox style json"
    )
    parser.add_argument(
        "-o", "--outline", help="Output outline style", action="store_true"
    )
    args = parser.parse_args()
    main(args.outline)
