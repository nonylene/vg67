# type: ignore

from dataclasses import dataclass

from slyr_community.parser import objects
from slyr_community.parser.object import Object
from slyr_community.parser.object_registry import REGISTRY
from slyr_community.parser.stream import Stream

LAYER_FILE = "/lyr/origin.lyr"


@dataclass
class RGBA:
    r: int
    g: int
    b: int
    a: int


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


# Register all available objects in slyr_community
for i in dir(objects):
    obj = getattr(objects, i)
    if type(obj) is type and issubclass(obj, Object):
        REGISTRY.register(obj)

with open(LAYER_FILE, "rb") as f:
    stream = Stream(f)
    feature_layer = stream.read_object()  # type: FeatureLayer
    renderer = feature_layer.renderer  # type: UniqueValueRenderer
    legend_group = renderer.groups[0]  # type: LegendGroup
    for hanrei_c, clazz in zip(
        renderer.values, legend_group.classes
    ):  # hanrei_c -> str, clazz -> LegendClass
        label = clazz.label
        hanrei_n = label[len(hanrei_c) :]
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

        print(hanrei_c, hanrei_n, fill_color_rgba, outline_color_rgba)
