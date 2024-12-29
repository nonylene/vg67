import argparse
import glob
import json
import pathlib
import traceback
from collections import defaultdict
from operator import itemgetter

import shapely

LIMIT_AREA_ALPHA = 0.25  # (16 - scale) ^ 2 ^ 2 * 100m * 100m
LIMIT_DISTANCE_ALPHA = 5  # (16 - scale) ^ 2 * 100m

LIMIT_AREA_16 = LIMIT_AREA_ALPHA * 100 * 100 * 0.00001 * 0.00001

LIMIT_DISTANCE_16 = LIMIT_DISTANCE_ALPHA * 100 * 0.00001

SCALES = {
    "25": 2**3.5,  # 12.5
    "3": 2**3,  # 13
    "4": 2**2,  # 14
    "5": 2,  # 15
}


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
                        [(p.representative_point(), p.area) for p in geom.geoms if p.area > LIMIT_AREA_16]  # type: ignore
                    )
                case shapely.Polygon:
                    if geom.area > LIMIT_AREA_16:
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
        distance_cache = {}

        def get_distance(i, j):
            if cache := distance_cache.get((i, j), None):
                return cache

            distance = shapely.distance(
                sorted_point_areas[i][0], sorted_point_areas[j][0]
            )
            distance_cache[(i, j)] = distance
            return distance

        i = 0
        while i < len(sorted_point_areas):
            point_i = sorted_point_areas[i][0]
            sorted_point_areas = sorted_point_areas[: i + 1] + [
                pa_j
                for pa_j in sorted_point_areas[i + 1 :]
                if shapely.distance(point_i, pa_j[0]) > LIMIT_DISTANCE_16
            ]
            i += 1

        properties = [{"H": code} for _ in sorted_point_areas]
        for key, scale in SCALES.items():
            # Filter points that is eligible for scale 14
            idxes = [
                idx
                for idx in range(len(sorted_point_areas))
                if sorted_point_areas[idx][1] > (LIMIT_AREA_16 * scale * scale)
            ]

            i = 0
            while i < len(idxes):
                idxes = idxes[: i + 1] + [
                    j
                    for j in idxes[i + 1 :]
                    if get_distance(i, j) > (LIMIT_DISTANCE_16 * scale)
                ]
                i += 1

            for i in idxes:
                properties[i][key] = True

        for i, (point, _) in enumerate(sorted_point_areas):
            all_points.append((point, properties[i]))

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
