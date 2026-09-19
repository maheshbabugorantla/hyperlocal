"""Build public/austin-zips.geojson: simplified Census ZCTA outlines for the pipeline's ZIPS.

Usage: python pipeline/boundaries.py   (downloads ~67 MB once into pipeline/.cache)
"""

import io
import json
import zipfile

import requests
import shapefile
from shapely.geometry import mapping, shape
from shapely.ops import polylabel

from pipeline import CACHE, ROOT, ZIP_NAMES, ZIPS

SOURCE_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"
SIMPLIFY_DEGREES = 0.0004  # ~40 m, invisible at city zoom
OUT = ROOT.parent / "public" / "austin-zips.geojson"


def rounded(o, digits=5):
    if isinstance(o, float):
        return round(o, digits)
    if isinstance(o, (list, tuple)):
        return [rounded(x, digits) for x in o]
    if isinstance(o, dict):
        return {k: rounded(v, digits) for k, v in o.items()}
    return o


def main():
    CACHE.mkdir(exist_ok=True)
    path = CACHE / "cb_zcta.zip"
    if not path.exists():
        path.write_bytes(requests.get(SOURCE_URL, timeout=600).content)
    zf = zipfile.ZipFile(path)
    base = next(n for n in zf.namelist() if n.endswith(".shp"))[:-4]
    reader = shapefile.Reader(**{ext: io.BytesIO(zf.read(f"{base}.{ext}")) for ext in ("shp", "shx", "dbf")})
    key = next(f[0] for f in reader.fields[1:] if f[0].startswith("ZCTA5"))

    features = []
    for sr in reader.iterShapeRecords():
        zip_code = sr.record[key]
        if zip_code not in ZIPS:
            continue
        geom = shape(sr.shape.__geo_interface__).simplify(SIMPLIFY_DEGREES, preserve_topology=True)
        largest = max(getattr(geom, "geoms", [geom]), key=lambda g: g.area)
        label = polylabel(largest, tolerance=0.0005)  # visual center, always inside the shape
        features.append({
            "type": "Feature",
            "properties": {"zip": zip_code, "name": ZIP_NAMES[zip_code], "label_lat": label.y, "label_lng": label.x},
            "geometry": json.loads(json.dumps(mapping(geom), default=list)),
        })

    OUT.write_text(json.dumps(rounded({
        "type": "FeatureCollection",
        "source": "U.S. Census Bureau, 2020 cartographic boundary ZCTAs (cb_2020_us_zcta520_500k), simplified",
        "features": features,
    }), separators=(",", ":")))
    print(f"wrote {len(features)} zip outlines to {OUT}")


if __name__ == "__main__":
    main()
