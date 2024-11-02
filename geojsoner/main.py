import argparse
import glob
import json
import pathlib

import fiona
import fiona.transform
import shapely
from cleanup import CLEANUP_FUNCTIONS
from fiona.crs import CRS

EPSG_JDG2000 = CRS.from_epsg(4612)
EPSG_WGS84 = CRS.from_epsg(4326)

WGS84_CRS_GEOJSON = {
    "type": "name",
    "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
}

LATLNG_PRECISION = 7  # approx. 1cm


# Pick shallowest path for a mesh
# Background: Some origin data have multiple shapefiles for a mesh. Deeper shapefiles tend to be an old or duplicate one.
def unique_files(files: list[str]) -> list[pathlib.Path]:
    mesh_path = {}
    for f in files:
        path = pathlib.Path(f)
        if p := mesh_path.get(path.stem.lower()):
            if len(p.parents) < len(path.parents):
                # Prior shallower path
                continue

        mesh_path[path.stem.lower()] = path

    return [*mesh_path.values()]


ALLOWED_GEO_TYPES = ["Polygon", "MultiPolygon"]


# Make valid some invalid shapes
def make_valid(geo: shapely.Geometry) -> list[shapely.Polygon | shapely.MultiPolygon]:
    if geo.is_valid:  # type: ignore
        return [shapely.remove_repeated_points(geo)]  # type: ignore

    valid_geo = shapely.make_valid(geo)

    if type(valid_geo) == shapely.GeometryCollection:
        for g in valid_geo.geoms:
            if not g.is_valid:
                print(g.is_valid)
        return [shapely.remove_repeated_points(x) for x in valid_geo.geoms if x.geom_type in ALLOWED_GEO_TYPES]  # type: ignore
    else:
        if valid_geo.geom_type not in ALLOWED_GEO_TYPES:
            # Some shape has zero area coodinates which should be called (Multi)LineStrings.
            return []
        else:
            return [shapely.remove_repeated_points(valid_geo)]  # type: ignore


def main(shapefile_pattern: str, output_dir: pathlib.Path):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    files = unique_files(glob.glob(shapefile_pattern, recursive=True))
    for path in files:
        print(path.absolute())
        out = output_dir / f"{path.stem.lower()}.geojson"
        cleanup_function = CLEANUP_FUNCTIONS.get(path.stem.lower())
        with fiona.open(path, encoding="Shift_JIS", crs=EPSG_JDG2000) as colxn:
            hanrei_key = (
                "HANREI_C" if "HANREI_C" in colxn.schema["properties"] else "Hanrei_C"
            )

            features = []

            for record in colxn:
                if cleanup_function is not None:
                    record = cleanup_function(record)
                    if record is None:
                        continue

                wgs_geom = fiona.transform.transform_geom(
                    EPSG_JDG2000, EPSG_WGS84, record.geometry
                )

                match wgs_geom.type:
                    case "MultiPolygon":
                        new_geom = {
                            "type": "MultiPolygon",
                            "coordinates": [
                                [
                                    [
                                        (
                                            round(x, LATLNG_PRECISION),
                                            round(y, LATLNG_PRECISION),
                                        )
                                        for (x, y) in coordinate
                                    ]
                                    for coordinate in coordinates
                                ]
                                for coordinates in wgs_geom.coordinates
                            ],
                        }
                    case "Polygon":
                        new_geom = {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    (
                                        round(x, LATLNG_PRECISION),
                                        round(y, LATLNG_PRECISION),
                                    )
                                    for (x, y) in coordinate
                                ]
                                for coordinate in wgs_geom.coordinates
                            ],
                        }
                    case _:
                        raise RuntimeError(f"Unknown record type: {record.type}")

                valid_geoms = make_valid(shapely.geometry.shape(new_geom))

                for valid_geom in valid_geoms:
                    new_feature = {
                        "type": "Feature",
                        "geometry": shapely.geometry.mapping(valid_geom),
                        "properties": {"H": int(record.properties[hanrei_key])},  # type: ignore
                    }
                    features.append(new_feature)

        output = {
            "type": "FeatureCollection",
            "name": out.stem.lower(),
            "crs": WGS84_CRS_GEOJSON,
            "features": features,
        }

        json.dump(output, open(out, "w"), separators=(",", ":"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "geojsoner", "Export vg67 shape files as geojson files with some optimization"
    )
    parser.add_argument(
        "-s",
        "--shapefile-pattern",
        help="Python glob library style file pattern locating shapefiles",
        required=True,
        type=str,
    )
    parser.add_argument(
        "-o",
        "--out-dir",
        help="Directory for output geojson files",
        type=pathlib.Path,
        default=pathlib.Path("../data/geojson"),
    )
    args = parser.parse_args()
    main(args.shapefile_pattern, args.out_dir)
