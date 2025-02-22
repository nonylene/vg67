import json
import pathlib
import tomllib


def build_variables(data_dir: pathlib.Path) -> dict[str, str]:
    legend_dai = json.load(open(data_dir / "hanrei/names/dai.json"))
    legend_chu = json.load(open(data_dir / "hanrei/names/chu.json"))
    legend_sai = json.load(open(data_dir / "hanrei/names/sai.json"))
    legend_shokusei = json.load(open(data_dir / "hanrei/names/shokusei.json"))

    # special
    mapbox_sai_styles = json.load(open(data_dir / "style/vg67_sai_style.json"))
    mapbox_dai_styles = json.load(open(data_dir / "style/vg67_dai_style.json"))
    mapbox_chu_styles = json.load(open(data_dir / "style/vg67_chu_style.json"))

    variables = {
        '"__TEMPLATE_CODE_COLORS_SAI_MATCHER__"': json.dumps(
            mapbox_sai_styles, separators=(",", ":")
        ),
        '"__TEMPLATE_CODE_COLORS_CHU_MATCHER__"': json.dumps(
            mapbox_chu_styles, separators=(",", ":")
        ),
        '"__TEMPLATE_CODE_COLORS_DAI_MATCHER__"': json.dumps(
            mapbox_dai_styles, separators=(",", ":")
        ),
        '"__TEMPLATE_LEGEND_SAI__"': json.dumps(
            legend_sai, separators=(",", ":"), ensure_ascii=False
        ),
        '"__TEMPLATE_LEGEND_CHU__"': json.dumps(
            legend_chu, separators=(",", ":"), ensure_ascii=False
        ),
        '"__TEMPLATE_LEGEND_DAI__"': json.dumps(
            legend_dai, separators=(",", ":"), ensure_ascii=False
        ),
        '"__TEMPLATE_LEGEND_SHOKUSEI__"': json.dumps(
            legend_shokusei, separators=(",", ":"), ensure_ascii=False
        ),
    }

    toml_variables = tomllib.load(
        open(pathlib.Path(__file__).with_name("variables.toml"), "rb")
    )
    for key, value in toml_variables.items():
        variables[f'"__TEMPLATE_{key}__"'] = value

    return variables


def template(path: pathlib.Path, variables: dict[str, str]) -> str:
    with open(path) as f:
        content = f.read()

    for key, value in variables.items():
        content = content.replace(key, value)

    return content


TEMPLATES = [
    "index.html",
    "index.js",
    "control.js",
    "consts.js",
    "url.js",
    "variables.js",
    "localStorage.js",
    "mapFunction.js",
    "index.css",
    "assets/compass.svg",
    "assets/compass_active.svg",
]

data_dir = pathlib.Path(__file__).parent.parent / "data"
out_dir = data_dir / "page"
out_dir.mkdir(parents=True, exist_ok=True)

variables = build_variables(data_dir)

for template_file in TEMPLATES:
    content = template(pathlib.Path(__file__).parent / template_file, variables)
    dst = out_dir / template_file
    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(out_dir / template_file, "w") as f:
        f.write(content)
