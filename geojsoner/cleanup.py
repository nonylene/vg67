# Remove invalid data from vg64

import fiona


# id 1490 polygon is invalid; That has only two points in coordinates.
def p584170(
    collection: fiona.Collection, record: fiona.Feature
) -> fiona.Feature | None:
    if record.id == "1490":  # type: ignore
        return None
    else:
        return record


# Many polygons reside apart; Round with ~1m
def p573926(
    collection: fiona.Collection, record: fiona.Feature
) -> fiona.Feature | None:
    geom: fiona.Geometry
    geom = record.geometry  # type: ignore
    latlng_precision = 5  # approx. 1m
    minx, miny, maxx, maxy = collection.bounds  # type: ignore

    def round_p(x, y):
        r_x = round(x, latlng_precision)
        r_y = round(y, latlng_precision)

        # Border check. Use original value if border; will be rounded after
        new_x = x if r_x < minx or r_x > maxx else r_x
        new_y = y if r_y < miny or r_y > maxy else r_y

        return new_x, new_y

    match geom.type:
        case "MultiPolygon":
            new_geom = fiona.Geometry(
                type=geom.type,
                coordinates=[
                    [
                        [round_p(x, y) for (x, y) in coordinate]
                        for coordinate in coordinates
                    ]
                    for coordinates in geom.coordinates  # type: ignore
                ],
            )
        case "Polygon":
            new_geom = fiona.Geometry(
                type=geom.type,
                coordinates=[
                    [round_p(x, y) for (x, y) in coordinate]
                    for coordinate in geom.coordinates  # type: ignore
                ],
            )
        case _:
            raise RuntimeError(f"Unknown record type: {record.type}")

    return fiona.Feature(
        geometry=new_geom,
        properties=record.properties,
    )


CLEANUP_FUNCTIONS = {
    "p584170": p584170,
    "p573926": p573926,
}
