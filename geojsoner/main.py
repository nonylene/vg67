import argparse
import glob
import pathlib

import fiona
import fiona.transform
from fiona.crs import CRS

GEOJSON_SCHEMA = {"geometry": ("Polygon", "MultiPolygon"), "properties": {"H": "int"}}

EPSG_JDG2000 = CRS.from_epsg(4612)
EPSG_WGS84 = CRS.from_epsg(4326)

LATLNG_PRECISION = 5


# Pick shallowest path for a mesh
# Background: Some origin data have multiple shapefiles for a mesh. Deeper shapefiles tend to be an old or duplicate one.
def unique_files(files: list[str]) -> list[pathlib.Path]:
    mesh_path = {}
    for f in files:
        path = pathlib.Path(f)
        if p := mesh_path.get(path.stem):
            if len(p.parents) < len(path.parents):
                # Prior shallower path
                continue

        mesh_path[path.stem] = path

    return [*mesh_path.values()]


def main(shapefile_pattern: str, output_dir: pathlib.Path):
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(
            f"Output directory: {output_dir.absolute()} is not a directory"
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    files = unique_files(glob.glob(shapefile_pattern, recursive=True))
    for path in files:
        print(path.absolute())
        out = output_dir / f"{path.stem}.geojson"
        with fiona.open(path, encoding="Shift_JIS", crs=EPSG_JDG2000) as colxn:
            hanrei_key = (
                "HANREI_C" if "HANREI_C" in colxn.schema["properties"] else "Hanrei_C"
            )

            with fiona.open(
                out,
                "w",
                driver="GeoJSON",
                crs=EPSG_WGS84,
                schema=GEOJSON_SCHEMA,
            ) as dst:
                for record in colxn:
                    wgs_geom = fiona.transform.transform_geom(
                        EPSG_JDG2000, EPSG_WGS84, record.geometry
                    )

                    match wgs_geom.type:
                        case "MultiPolygon":
                            new_geom = fiona.Geometry(
                                type="MultiPolygon",
                                coordinates=[
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
                            )
                        case "Polygon":
                            new_geom = fiona.Geometry(
                                type="Polygon",
                                coordinates=[
                                    [
                                        (
                                            round(x, LATLNG_PRECISION),
                                            round(y, LATLNG_PRECISION),
                                        )
                                        for (x, y) in coordinate
                                    ]
                                    for coordinate in wgs_geom.coordinates
                                ],
                            )
                        case _:
                            raise RuntimeError(f"Unknown record type: {record.type}")

                    new_feature = fiona.Feature(
                        geometry=new_geom,
                        properties=fiona.Properties.from_dict(
                            {"H": int(record.properties[hanrei_key])}
                        ),
                    )
                    dst.write(new_feature)


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
