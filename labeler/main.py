import argparse
import glob
import json
import pathlib
import traceback
from collections import defaultdict
from math import sqrt
from operator import itemgetter

import shapely

LIMIT_AREA_ALPHA = 0.9  # (15 - scale) ^ 2 ^ 2 * 100m * 100m
LIMIT_DISTANCE_ALPHA = 10  # (15 - scale) ^ 2 * 100m

LIMIT_AREA_12_5 = 2 * 16 * LIMIT_AREA_ALPHA * 100 * 100 * 0.00001 * 0.00001
LIMIT_AREA_13 = 16 * LIMIT_AREA_ALPHA * 100 * 100 * 0.00001 * 0.00001
LIMIT_AREA_14 = 4 * LIMIT_AREA_ALPHA * 100 * 100 * 0.00001 * 0.00001
LIMIT_AREA_15 = LIMIT_AREA_ALPHA * 100 * 100 * 0.00001 * 0.00001

LIMIT_DISTANCE_12_5 = sqrt(2) * 4 * LIMIT_DISTANCE_ALPHA * 100 * 0.00001
LIMIT_DISTANCE_13 = 4 * LIMIT_DISTANCE_ALPHA * 100 * 0.00001
LIMIT_DISTANCE_14 = 2 * LIMIT_DISTANCE_ALPHA * 100 * 0.00001
LIMIT_DISTANCE_15 = LIMIT_DISTANCE_ALPHA * 100 * 0.00001


def process_file(input_path: pathlib.Path, output_path: pathlib.Path):
    value = json.load(open(input_path))
    code_point_areas = defaultdict(list)
    for feature in value["features"]:
        code = feature["properties"]["H"]
        try:
            geom: shapely.Polygon | shapely.MultiPolygon = shapely.geometry.shape(feature["geometry"])  # type: ignore
            match type(geom):
                case shapely.MultiPolygon:
                    code_point_areas[code].extend(
                        [(p.representative_point(), p.area) for p in geom.geoms if p.area > LIMIT_AREA_15]  # type: ignore
                    )
                case shapely.Polygon:
                    if geom.area > LIMIT_AREA_15:
                        code_point_areas[code].append(
                            (
                                geom.representative_point(),
                                geom.area,
                            )
                        )
                case _:
                    raise RuntimeError(f"Unknown feature geometry type: {type(geom)}")
        except:
            traceback.print_exc()
            # e.g. Empty polygon as the result of round-off
            print(feature)

    all_points = []
    for code, point_areas in code_point_areas.items():
        sorted_point_areas = list(reversed(sorted(point_areas, key=itemgetter(1))))

        # To gain more performance, we can use cache to calculate the distance
        # Remove points that is not eligible for scale 15
        i = 0
        while i < len(sorted_point_areas):
            point_i = sorted_point_areas[i][0]
            sorted_point_areas = sorted_point_areas[: i + 1] + [
                pa_j
                for pa_j in sorted_point_areas[i + 1 :]
                if shapely.distance(point_i, pa_j[0]) > LIMIT_DISTANCE_15
            ]
            i += 1

        # Filter points that is eligible for scale 14
        idx_14 = [
            idx
            for idx in range(len(sorted_point_areas))
            if sorted_point_areas[idx][1] > LIMIT_AREA_14
        ]
        i = 0
        while i < len(idx_14):
            point_i = sorted_point_areas[i][0]
            idx_14 = idx_14[: i + 1] + [
                j
                for j in idx_14[i + 1 :]
                if shapely.distance(point_i, sorted_point_areas[j][0])
                > LIMIT_DISTANCE_14
            ]
            i += 1

        # Filter points that is eligible for scale 13
        idx_13 = [idx for idx in idx_14 if sorted_point_areas[idx][1] > LIMIT_AREA_13]
        i = 0
        while i < len(idx_13):
            point_i = sorted_point_areas[i][0]
            idx_13 = idx_13[: i + 1] + [
                j
                for j in idx_13[i + 1 :]
                if shapely.distance(point_i, sorted_point_areas[j][0])
                > LIMIT_DISTANCE_13
            ]
            i += 1

        # Filter points that is eligible for scale 12
        idx_12_5 = [
            idx for idx in idx_13 if sorted_point_areas[idx][1] > LIMIT_AREA_12_5
        ]
        i = 0
        while i < len(idx_12_5):
            point_i = sorted_point_areas[i][0]
            idx_12_5 = idx_12_5[: i + 1] + [
                j
                for j in idx_12_5[i + 1 :]
                if shapely.distance(point_i, sorted_point_areas[j][0])
                > LIMIT_DISTANCE_12_5
            ]
            i += 1

        for i, (point, _) in enumerate(sorted_point_areas):
            properties = {"H": code}
            if i in idx_12_5:
                properties["12.5"] = True
            if i in idx_13:
                properties["13"] = True
            if i in idx_14:
                properties["14"] = True

            all_points.append((point, properties))

    value["features"] = [
        {
            "type": "Feature",
            "properties": properties,
            "geometry": json.loads(shapely.to_geojson(geo)),
        }
        for geo, properties in all_points
    ]

    json.dump(value, open(output_path, "w"), separators=(",", ":"))


def main(geojson_pattern: str, output_dir: pathlib.Path):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    files = glob.glob(geojson_pattern, recursive=True)

    for file in files:
        print(file)
        input_path = pathlib.Path(file)
        out = output_dir / f"{input_path.stem}.geojson"
        process_file(input_path, out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser("labeler", "Create label points")
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
    args = parser.parse_args()

    if args.out is None:
        output = pathlib.Path(__file__).parent / "../data/geojson-trimmed/sai-labels"

    main(args.geojson_pattern, output)
