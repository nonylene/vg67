import argparse
import glob
import json
import pathlib
import traceback
from collections import defaultdict
from enum import Enum, auto
from math import pi, sqrt

import shapely
import shapely.ops
from attr import dataclass

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
    # 11 -> Water (original)
    # 19 -> Paddy field
}
DAI_SHOKUSEI_MAP = {}


for shokusei, rng in _DAI_SHOKUSEI_MAP_SEED.items():
    for dai in rng:
        DAI_SHOKUSEI_MAP[dai] = shokusei


class Kubun(Enum):
    # chu kubun
    CHU = auto()
    # shokusei kubun
    SHOKUSEI = auto()


@dataclass
class KubunConfig:
    kubun: Kubun
    key: str
    force_merge_area_limit: float
    force_merge_simplify_limit: float
    force_merge_thinness_area_step_1: float
    force_merge_thinness_area_step_2: float
    force_merge_thinness_area_step_3: float
    code_merge_minimum_ratio: float


SHOKUSEI_CONFIG = KubunConfig(
    kubun=Kubun.SHOKUSEI,
    key="S",
    # 750m ^2
    force_merge_area_limit=0.00001 * 750 * 0.00001 * 750,
    # 150m
    force_merge_simplify_limit=0.00001 * 150,
    # 5km * 1000m
    force_merge_thinness_area_step_1=0.00001 * 1000 * 0.00001 * 5 * 1000,
    # 15km * 1000m
    force_merge_thinness_area_step_2=0.00001 * 1000 * 0.00001 * 15 * 1000,
    # 30km * 1000m
    force_merge_thinness_area_step_3=0.00001 * 1000 * 0.00001 * 30 * 1000,
    # 13% common border required
    code_merge_minimum_ratio=0.13,
)

CHU_CONFIG = KubunConfig(
    kubun=Kubun.CHU,
    key="C",
    # 200m ^2
    force_merge_area_limit=0.00001 * 200 * 0.00001 * 200,
    # 40m
    force_merge_simplify_limit=0.00001 * 40,
    # 500m * 1000m
    force_merge_thinness_area_step_1=0.00001 * 1000 * 0.00001 * 500,
    # 1km * 1000m
    force_merge_thinness_area_step_2=0.00001 * 1000 * 0.00001 * 1000,
    # 3km * 1000m
    force_merge_thinness_area_step_3=0.00001 * 1000 * 0.00001 * 3 * 1000,
    # 10% common border required
    code_merge_minimum_ratio=0.15,
)


def shokusei_kubun(code: int):
    if code == 580600:
        return 11

    if code == 570400:
        return 19

    return DAI_SHOKUSEI_MAP[code // 10000]


def calculate_border_lengthes(geoms: list[shapely.Polygon]) -> list[list[float]]:
    points = defaultdict(set)

    # build common point information
    for i, geom in enumerate(geoms):
        for coord in geom.exterior.coords:
            points[coord].add(i)
        for interior in geom.interiors:
            for coord in interior.coords:
                points[coord].add(i)

    # Common border length map
    geo_border_lengthes: list[list[float]] = [
        [0] * len(geoms) for _ in range(len(geoms))
    ]

    for i, geom in enumerate(geoms):
        coords_list = [geom.exterior.coords]

        for interior in geom.interiors:
            coords_list.append(interior.coords)

        past_xy: tuple[float, float] = (0, 0)
        for coords in coords_list:
            past_geom_polygons = set()

            for coord in coords:
                distance = sqrt(
                    (past_xy[0] - coord[0]) ** 2 + (past_xy[1] - coord[1]) ** 2
                )
                past_xy = coord
                touching_indexes = points[coord]

                for j in past_geom_polygons:
                    if i == j:
                        continue

                    if j in touching_indexes:
                        geo_border_lengthes[i][j] += distance

                past_geom_polygons = touching_indexes

    return geo_border_lengthes


def get_code_polygons(
    config: KubunConfig, features: list[dict]
) -> list[tuple[int, shapely.Polygon]]:
    code_geometries: list[tuple[int, shapely.Polygon]] = []

    for feature in features:
        if config.kubun == Kubun.CHU:
            code = feature["properties"]["H"] // 100
        else:
            code = shokusei_kubun(feature["properties"]["H"])
        shape = shapely.geometry.shape(feature["geometry"])
        match shape.geom_type:
            case "Polygon":
                code_geometries.append((code, shape))  # type: ignore
            case "MultiPolygon":
                for geom in shape.geoms:  # type: ignore
                    code_geometries.append((code, geom))  # type: ignore
            case _:
                raise RuntimeError(f"Unknown shape type: {shape.geom_type}")

    return code_geometries


# Remove small holes due to coord gaps in the original data
def remove_small_holes(config: KubunConfig, polygon: shapely.Polygon):
    interiors = []
    for interior in polygon.interiors:
        if shapely.Polygon(interior).area >= config.force_merge_area_limit:
            interiors.append(interior)

    return shapely.Polygon(polygon.exterior, holes=interiors)


def process_file(
    config: KubunConfig, input_path: pathlib.Path, output_path: pathlib.Path
):
    value = json.load(open(input_path))

    code_geometries = get_code_polygons(config, value["features"])
    # sort by area size (big -> small)
    code_geometries_sorted = sorted(code_geometries, key=(lambda item: -item[1].area))

    # Build common border length map
    geo_border_lengthes = calculate_border_lengthes(
        [geom for _, geom in code_geometries_sorted]
    )
    geo_area_lengthes = [(geom.area, geom.length) for _, geom in code_geometries_sorted]

    length_at_first = len(geo_border_lengthes)
    # Small to large
    for reverse_i, (code, geom) in enumerate(reversed(code_geometries_sorted)):
        idx = length_at_first - 1 - reverse_i
        force_merge = False

        area, length = geo_area_lengthes[idx]  # length includes exterior and interior

        # Remove too small shapes (750^2)
        if area < config.force_merge_area_limit:
            force_merge = True

        # Remove too thin and relativity small shapes
        if not force_merge:
            simplified = geom.simplify(config.force_merge_simplify_limit)
            if simplified.geom_type == "Polygon":
                permeter = simplified.exterior.length  # type: ignore
            else:
                # Simplified Polygon may be a MultiPolygon
                permeter = sum(geom.exterior.length for geom in simplified.geoms)  # type: ignore
            thinness = 4 * pi * area / permeter**2

            # Smaller object should be merged aggressively
            if area < config.force_merge_thinness_area_step_1:
                force_merge = thinness < 0.1
            elif area < config.force_merge_thinness_area_step_2:
                force_merge = thinness < 0.05
            elif area < config.force_merge_thinness_area_step_3:
                force_merge = thinness < 0.02

        # Find the obejct to merge
        # 1. Same code / 2. Max common border length
        objidx_max_len: tuple[None | int, float] = (None, 0)
        objidx_len_to_merge: tuple[None | int, float] = (None, 0)
        for j, border_length in enumerate(geo_border_lengthes[idx]):  # type: ignore
            if border_length > objidx_max_len[1]:
                objidx_max_len = (j, border_length)

            if (
                code == code_geometries_sorted[j][0]
                and border_length > objidx_len_to_merge[1]
            ):
                # Get the ratio of the common border to the total length the smaller object
                j_area, j_length = geo_area_lengthes[j]
                if j_area > area:
                    ratio = border_length / length
                else:
                    ratio = border_length / j_length

                if ratio > config.code_merge_minimum_ratio:
                    objidx_len_to_merge = (j, border_length)

        if objidx_len_to_merge[0] is None and force_merge:
            # Smaller object should merge even non-common code object
            objidx_len_to_merge = objidx_max_len

        if objidx_len_to_merge[0] is None:
            # No object to merge (Too big etc.)
            continue

        merge_object_idx, length = objidx_len_to_merge
        code_geom_to_merge = code_geometries_sorted[merge_object_idx]

        # Merge object!
        try:
            merged_geom = shapely.unary_union([code_geom_to_merge[1], geom])
            code_geometries_sorted[merge_object_idx] = (  # type: ignore
                code_geom_to_merge[0],
                merged_geom,
            )
            geo_area_lengthes[merge_object_idx] = (
                area + geo_area_lengthes[merge_object_idx][0],
                merged_geom.length,
            )
        except Exception:
            traceback.print_exc()

        # Remove merged object data
        # Keeping the original sort order; Biggest shape should be priored
        for j, l in enumerate(geo_border_lengthes[idx]):
            if j == merge_object_idx:
                continue
            # This method does not work when multiple polygons share some area (not only border)
            # I don't care these invalid polygons for this
            new_length = geo_border_lengthes[merge_object_idx][j] + l
            geo_border_lengthes[merge_object_idx][j] = new_length
            geo_border_lengthes[j][merge_object_idx] = new_length

        geo_border_lengthes.pop(idx)
        geo_area_lengthes.pop(idx)
        code_geometries_sorted.pop(idx)

        for l in geo_border_lengthes:
            l.pop(idx)

    code_geometries_sorted = [
        (code, remove_small_holes(config, p)) for code, p in code_geometries_sorted
    ]

    value["features"] = [
        {
            "type": "Feature",
            "properties": {
                config.key: code,
            },
            "geometry": json.loads(shapely.to_geojson(geo)),
        }
        for code, geo in code_geometries_sorted
    ]

    json.dump(value, open(output_path, "w"), separators=(",", ":"))


def main(geojson_pattern: str, output_dir: pathlib.Path, kubun: Kubun):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    match kubun:
        case Kubun.CHU:
            config = CHU_CONFIG
        case Kubun.SHOKUSEI:
            config = SHOKUSEI_CONFIG

    files = glob.glob(geojson_pattern, recursive=True)

    for file in files:
        print(file)
        input_path = pathlib.Path(file)
        out = output_dir / f"{input_path.stem}.geojson"
        process_file(config, input_path, out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "trimmer", "Merge features and trim too small features"
    )
    parser.add_argument(
        "-g",
        "--geojson-pattern",
        help="Python glob library style file pattern locating geojsons",
        required=True,
        type=str,
    )
    parser.add_argument(
        "-o",
        "--out",
        help="Directory for output geojson files",
        type=pathlib.Path,
    )
    parser.add_argument(
        "-k",
        "--kubun",
        help="Target kubun",
        required=True,
        type=str,
        choices={"chu", "shokusei"},
    )
    args = parser.parse_args()

    match args.kubun:
        case "chu":
            kubun = Kubun.CHU
        case "shokusei":
            kubun = Kubun.SHOKUSEI

    if args.out is None:
        match kubun:
            case Kubun.CHU:
                output = pathlib.Path(__file__).parent / "../data/geojson-trimmed/chu"
            case Kubun.SHOKUSEI:
                output = (
                    pathlib.Path(__file__).parent / "../data/geojson-trimmed/shokusei"
                )

    main(args.geojson_pattern, output, kubun)
