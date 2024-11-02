import argparse
import glob
import json
import pathlib
import traceback
from collections import defaultdict
from math import sqrt

import shapely
import shapely.ops

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


def calculate_border_lengthes(geoms: list[shapely.Geometry]) -> list[list[float]]:
    points = defaultdict(set)

    # build common point information
    for i, geom in enumerate(geoms):
        match type(geom):
            case shapely.MultiPolygon:
                polygons = geom.geoms  # type: ignore
            case shapely.Polygon:
                polygons = [geom]
            case _:
                raise RuntimeError(f"Unknown shape type: {type(geom)}")

        polygon: shapely.Polygon
        for polygon in polygons:  # type: ignore
            for coord in polygon.exterior.coords:
                points[coord].add(i)
            for interior in polygon.interiors:
                for coord in interior.coords:
                    points[coord].add(i)

    # Common border length map
    geo_border_lengthes: list[list[float]] = [
        [0] * len(geoms) for _ in range(len(geoms))
    ]

    for i, geom in enumerate(geoms):
        match type(geom):
            case shapely.MultiPolygon:
                polygons = geom.geoms  # type: ignore
            case shapely.Polygon:
                polygons = [geom]
            case _:
                raise RuntimeError(f"Unknown shape type: {type(geom)}")

        coords_list = []
        polygon: shapely.Polygon
        for polygon in polygons:  # type: ignore
            coords_list.append(polygon.exterior.coords)

            for interior in polygon.interiors:
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


def main(geojson_pattern: str, output_dir: pathlib.Path):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    files = glob.glob(geojson_pattern, recursive=True)

    for file in files:
        print(file)
        path = pathlib.Path(file)
        out = output_dir / f"{path.stem}.geojson"
        value = json.load(open(path))

        for feature in value["features"]:
            try:
                shapely.geometry.shape(feature["geometry"])
            except:
                print(feature)

        code_geometries = [
            (
                shokusei_kubun(feature["properties"]["H"]),
                shapely.geometry.shape(feature["geometry"]),
            )
            for feature in value["features"]
        ]

        # sort by area size (big -> small)
        code_geometries_sorted = sorted(
            code_geometries, key=(lambda item: -item[1].area)
        )

        # Build common border length map
        geo_border_lengthes = calculate_border_lengthes(
            [geom for _, geom in code_geometries_sorted]
        )

        length_at_first = len(geo_border_lengthes)
        # Small to large
        for reverse_i, (code, geom) in enumerate(reversed(code_geometries_sorted)):
            idx = length_at_first - 1 - reverse_i
            force_merge = False

            # Remove too small shapes (500m^2)
            if geom.area < 0.00001 * 500 * 0.00001 * 500:
                force_merge = True

            # Remove too thin shapes (300m)
            (minx, miny, maxx, maxy) = geom.bounds
            if (maxy - miny) < 0.00001 * 300 or (maxx - minx) < 0.00001 * 300:
                force_merge = True

            # Find the obejct to merge
            # 1. Same code / 2. Max common border length
            objidx_max_len: tuple[None | int, float] = (None, 0)
            objidx_len_to_merge: tuple[None | int, float] = (None, 0)
            for j, length in enumerate(geo_border_lengthes[idx]):  # type: ignore
                if length > objidx_max_len[1]:
                    objidx_max_len = (j, length)

                if (
                    code == code_geometries_sorted[j][0]
                    and length > objidx_len_to_merge[1]
                ):
                    objidx_len_to_merge = (j, length)

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
                code_geometries_sorted[merge_object_idx] = (
                    code_geom_to_merge[0],
                    shapely.unary_union([code_geom_to_merge[1], geom]),
                )
            except Exception as e:
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
            code_geometries_sorted.pop(idx)

            for l in geo_border_lengthes:
                l.pop(idx)

        value["features"] = [
            {
                "type": "Feature",
                "properties": {
                    "S": code,
                },
                "geometry": json.loads(shapely.to_geojson(geo)),
            }
            for code, geo in code_geometries_sorted
        ]

        json.dump(value, open(out, "w"), separators=(",", ":"))


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
        default=(pathlib.Path(__file__).parent / "../data/geojson-trimmed"),
    )
    args = parser.parse_args()
    main(args.geojson_pattern, args.out)
