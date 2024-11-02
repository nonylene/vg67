# Remove invalid data from vg64

import fiona


# id 1490 polygon is invalid; That has only two points in coordinates.
def p584170(record: fiona.Feature) -> fiona.Feature | None:
    if record.id == "1490":  # type: ignore
        return None
    else:
        return record


CLEANUP_FUNCTIONS = {
    "p584170": p584170,
}
