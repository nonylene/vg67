# type: ignore

import argparse
import colorsys
import json
import pathlib
from dataclasses import dataclass
from operator import itemgetter
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


ADDITIONAL_COLORS = {
    9999: RGBA(0, 0, 0, 0),
    40106: RGBA(112, 168, 0, 1),  # ダケカンバ‐エゾマツ群落（風倒跡地自然再生林）
    120109: RGBA(140, 179, 140, 1),  # ミズナラ‐アカエゾマツ群落
    540701: RGBA(255, 167, 127, 1),  # カラマツ群落（火砕流堆積地）
    521302: RGBA(230, 230, 179, 1),  # カラマツ－ミネヤナギ群落
    521500: RGBA(76, 230, 0, 1),  # サラサドウダン群落
    520202: RGBA(0, 230, 169, 1),  # クマイザサ－イソツツジ群落
    580102: RGBA(168, 56, 0, 1),  # 太陽光発電施設
    470418: RGBA(0, 128, 204, 1),  # ヨシ群落（代償植生）
    220112: RGBA(209, 255, 115, 1),  # チシマザサ－ブナ群集（Ｖ）
    70107: RGBA(201, 158, 201, 1),  # タテヤマアザミ‐ホソバトリカブト群集
    401000: RGBA(38, 115, 0, 1),  # ユズリハ二次林
    141701: RGBA(36, 87, 61, 1),  # キタゴヨウ‐アカエゾマツ群落
    20608: RGBA(66, 82, 163, 1),  # コメススキ－イワツメクサ群集
}

WATER_AREA = 580600

DAI_COLOR_OVERWRITES = {
    0: 9999,  # transparent
    57: 570300,  # light brown
    91: 580600,  # Sky blue
    99: 570400,  # Sky blue
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
        if hanrei in colors:
            raise RuntimeError(
                f"Color map already has Hanrei code defined in ADDITIONAL_COLORS: {hanrei}"
            )
        colors[hanrei] = (color, RGBA(0, 0, 0, 1))

    return colors


def darken_fill(colors: dict[int, Tuple[RGBA, RGBA]]) -> dict[int, Tuple[RGBA, RGBA]]:
    darken_colors = {}
    for key, (fill, outline) in colors.items():
        (h, l, s) = colorsys.rgb_to_hls(fill.r / 255, fill.g / 255, fill.b / 255)
        # Adjust light
        new_l = l
        darken_base = 0.5
        darken_up = 0.9
        if WATER_AREA != key and l > darken_base:  # Water area should be as is
            new_l = darken_base + (l - darken_base) * (darken_up - darken_base) / (
                1 - darken_base
            )
        (r, g, b) = colorsys.hls_to_rgb(h, new_l, s)

        darken_colors[key] = (RGBA(r * 255, g * 255, b * 255, fill.a), outline)

    return darken_colors


def pick_color_for_chu(
    sai_colors: dict[int, Tuple[RGBA, RGBA]]
) -> dict[int, Tuple[RGBA, RGBA]]:
    chu_color = {}
    for i, colors in sorted(sai_colors.items(), key=itemgetter(0)):
        chu = i // 100
        if chu not in chu_color:
            chu_color[chu] = colors

    return chu_color


def pick_color_for_dai(
    sai_colors: dict[int, Tuple[RGBA, RGBA]]
) -> dict[int, Tuple[RGBA, RGBA]]:
    dai_color = {}
    for i, colors in sorted(sai_colors.items(), key=itemgetter(0)):
        dai = i // 10000
        if dai not in dai_color:
            dai_color[dai] = colors

    for dai, hanrei_c in DAI_COLOR_OVERWRITES.items():
        dai_color[dai] = sai_colors[hanrei_c]

    return dai_color


def main(output_dir: pathlib.Path):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    # Register all available objects in slyr_community
    for i in dir(objects):
        obj = getattr(objects, i)
        if type(obj) is type and issubclass(obj, Object):
            REGISTRY.register(obj)

    colors = darken_fill(get_colors_from_lyr(LAYER_FILE))

    def pick_fill_colors(colors):
        return {code: fill.mapbox_style() for code, (fill, _) in colors.items()}

    sai_fill_style = pick_fill_colors(colors)
    chu_fill_style = pick_fill_colors(pick_color_for_chu(colors))
    dai_fill_style = pick_fill_colors(pick_color_for_dai(colors))

    def dump(path, style):
        json.dump(style, open(path, "w"), separators=(",", ":"))

    dump(output_dir / "vg67_sai_style.json", sai_fill_style)
    dump(output_dir / "vg67_chu_style.json", chu_fill_style)
    dump(output_dir / "vg67_dai_style.json", dai_fill_style)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "colormap", "Export vg67 lyr colromap as mapbox style json"
    )
    parser.add_argument(
        "-o",
        "--out",
        help="Output directory",
        type=pathlib.Path,
        default=pathlib.Path("/data/style"),
    )
    args = parser.parse_args()

    main(args.out)
