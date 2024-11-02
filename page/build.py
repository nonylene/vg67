import json
import pathlib
import tomllib


def build_variables(data_dir: pathlib.Path) -> dict[str, str]:
    # special
    mapbox_styles = json.load(open(data_dir / "style/vg67_style.json"))
    mapbox_shokusei_styles = json.load(
        open(data_dir / "style/vg67_shokusei_style.json")
    )

    variables = {
        '"__TEMPLATE_FILL_COLOR_MATCHER__"': json.dumps(
            mapbox_styles, separators=(",", ":")
        ),
        '"__TEMPLATE_FILL_COLOR_SHOKUSEI_MATCHER__"': json.dumps(
            mapbox_shokusei_styles, separators=(",", ":")
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


TEMPLATES = ["index.html"]

data_dir = pathlib.Path(__file__).parent.parent / "data"
out_dir = data_dir / "page"
out_dir.mkdir(parents=True, exist_ok=True)

variables = build_variables(data_dir)

for template_file in TEMPLATES:
    content = template(pathlib.Path(__file__).with_name(template_file), variables)
    with open(out_dir / template_file, "w") as f:
        f.write(content)
