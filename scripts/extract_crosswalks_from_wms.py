#!/usr/bin/env python3
"""
[EXTRACT-01] Extract crosswalk coordinates from Safemap WMS tile imagery.

Strategy:
  1. Request a high-resolution transparent PNG from the crosswalk WMS layer
  2. Non-transparent pixels = crosswalk features
  3. Cluster adjacent colored pixels into distinct crosswalk features
  4. Compute each cluster's centroid in pixel space
  5. Convert pixel coordinates to lat/lng
  6. Output as GeoJSON

This works because safemap GetMap with TRANSPARENT=TRUE returns only
crosswalk features as colored pixels on a transparent background.

Usage:
    python scripts/extract_crosswalks_from_wms.py YOUR_API_KEY
"""

import sys
import json
import os
from urllib.parse import quote
from collections import deque

try:
    import requests
except ImportError:
    print("[EXTRACT-ERR] pip install requests")
    sys.exit(1)

try:
    from PIL import Image
    import io
except ImportError:
    print("[EXTRACT-ERR] pip install Pillow")
    sys.exit(1)

# [EXTRACT-02] Configuration
BBOX = {
    "min_lng": 127.467,
    "min_lat": 36.619,
    "max_lng": 127.502,
    "max_lat": 36.647,
}

WMS_CROSSWALK = "http://safemap.go.kr/openapi2/IF_0097_WMS"
WMS_SIDEWALK = "http://safemap.go.kr/openapi2/IF_0095_WMS"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_DIR, "data")
PUBLIC_DIR = os.path.join(PROJECT_DIR, "public", "geojson")

# [EXTRACT-02a] Tile resolution
# Higher resolution = more precise coordinates but larger download
# 2048x2048 at this BBOX = ~1.7m per pixel (sufficient for crosswalk detection)
TILE_WIDTH = 2048
TILE_HEIGHT = 2048

# [EXTRACT-02b] Minimum cluster size (pixels) to count as a crosswalk
# Small noise clusters (< 4 pixels) are filtered out
MIN_CLUSTER_PIXELS = 4

# [EXTRACT-02c] Transparency threshold
# Pixels with alpha > this value are considered "colored" (crosswalk)
ALPHA_THRESHOLD = 50


def fetch_wms_tile(base_url, api_key, srs="EPSG:4326", width=2048, height=2048):
    """[EXTRACT-03] Fetch a single high-resolution WMS tile."""
    bbox_str = (
        f"{BBOX['min_lng']},{BBOX['min_lat']},"
        f"{BBOX['max_lng']},{BBOX['max_lat']}"
    )

    url = (
        f"{base_url}"
        f"?serviceKey={api_key}"
        f"&srs={quote(srs, safe='')}"
        f"&bbox={quote(bbox_str, safe='')}"
        f"&format={quote('image/png', safe='')}"
        f"&width={quote(str(width), safe='')}"
        f"&height={quote(str(height), safe='')}"
        f"&transparent={quote('TRUE', safe='')}"
    )

    print(f"[EXTRACT-03] Fetching {width}x{height} tile...")
    try:
        resp = requests.get(url, timeout=60, stream=True)
        chunks = []
        try:
            for chunk in resp.iter_content(chunk_size=8192):
                chunks.append(chunk)
        except Exception:
            pass

        data = b"".join(chunks)
        ct = resp.headers.get("Content-Type", "")
        print(f"  Status: {resp.status_code}, Content-Type: {ct}, Size: {len(data)} bytes")

        if resp.status_code == 200 and "image" in ct.lower():
            return data
        else:
            text = data.decode("utf-8", errors="replace")
            print(f"  [ERROR] Response: {text[:300]}")
            return None
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None


def find_colored_pixels(img):
    """[EXTRACT-04] Find all non-transparent pixels in a PNG image."""
    pixels = img.load()
    w, h = img.size
    colored = set()

    for y in range(h):
        for x in range(w):
            pixel = pixels[x, y]
            # RGBA: check alpha channel
            if len(pixel) == 4:
                r, g, b, a = pixel
                if a > ALPHA_THRESHOLD:
                    colored.add((x, y))
            # RGB: check if not white/near-white (fallback for non-RGBA)
            elif len(pixel) == 3:
                r, g, b = pixel
                if not (r > 240 and g > 240 and b > 240):
                    colored.add((x, y))

    return colored


def cluster_pixels(colored_pixels):
    """[EXTRACT-05] BFS clustering of adjacent colored pixels."""
    visited = set()
    clusters = []

    for start in colored_pixels:
        if start in visited:
            continue

        # BFS from this pixel
        cluster = []
        queue = deque([start])
        visited.add(start)

        while queue:
            x, y = queue.popleft()
            cluster.append((x, y))

            # 8-connectivity (including diagonals)
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in colored_pixels and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        queue.append((nx, ny))

        if len(cluster) >= MIN_CLUSTER_PIXELS:
            clusters.append(cluster)

    return clusters


def pixel_to_lnglat(px, py, img_width, img_height):
    """[EXTRACT-06] Convert pixel coordinates to lng/lat."""
    # Linear interpolation within the BBOX
    lng = BBOX["min_lng"] + (px / img_width) * (BBOX["max_lng"] - BBOX["min_lng"])
    # Y axis is inverted (pixel 0 = top = max_lat)
    lat = BBOX["max_lat"] - (py / img_height) * (BBOX["max_lat"] - BBOX["min_lat"])
    return round(lng, 7), round(lat, 7)


def cluster_centroid_lnglat(cluster, img_width, img_height):
    """[EXTRACT-07] Compute the centroid of a pixel cluster in lng/lat."""
    avg_x = sum(x for x, y in cluster) / len(cluster)
    avg_y = sum(y for x, y in cluster) / len(cluster)
    return pixel_to_lnglat(avg_x, avg_y, img_width, img_height)


def deduplicate_with_existing(new_coords, existing_geojson_path, threshold_m=15):
    """[EXTRACT-08] Remove new crosswalks that are too close to existing ones."""
    from math import radians, sin, cos, sqrt, atan2

    def haversine(lat1, lng1, lat2, lng2):
        R = 6371000
        dlat = radians(lat2 - lat1)
        dlng = radians(lng2 - lng1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))

    existing = []
    if os.path.exists(existing_geojson_path):
        with open(existing_geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for feat in data.get("features", []):
            coords = feat["geometry"]["coordinates"]
            existing.append((coords[0], coords[1]))  # [lng, lat]

    print(f"[EXTRACT-08] Deduplicating: {len(new_coords)} new vs {len(existing)} existing (threshold={threshold_m}m)")

    unique = []
    for lng, lat in new_coords:
        is_dup = False
        for ex_lng, ex_lat in existing:
            if haversine(lat, lng, ex_lat, ex_lng) < threshold_m:
                is_dup = True
                break
        if not is_dup:
            unique.append((lng, lat))
            existing.append((lng, lat))  # also check against newly added

    print(f"  {len(new_coords) - len(unique)} duplicates removed, {len(unique)} new unique crosswalks")
    return unique


def build_geojson(coords, source="safemap_wms"):
    """[EXTRACT-09] Build GeoJSON FeatureCollection from coordinate list."""
    features = []
    for lng, lat in coords:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat],
            },
            "properties": {
                "type": "crosswalk",
                "source": source,
            },
        })
    return {
        "type": "FeatureCollection",
        "features": features,
    }


def merge_geojson(path, new_features):
    """[EXTRACT-10] Merge new features into existing GeoJSON file."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"type": "FeatureCollection", "features": []}

    original_count = len(data["features"])
    data["features"].extend(new_features)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    print(f"[EXTRACT-10] Merged: {original_count} existing + {len(new_features)} new = {len(data['features'])} total")
    return len(data["features"])


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_crosswalks_from_wms.py YOUR_SAFEMAP_API_KEY")
        sys.exit(1)

    api_key = sys.argv[1]
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("[EXTRACT-01] Crosswalk Extraction via WMS Tile Analysis")
    print(f"  Area: [{BBOX['min_lng']}, {BBOX['min_lat']}] to [{BBOX['max_lng']}, {BBOX['max_lat']}]")
    print(f"  Tile: {TILE_WIDTH}x{TILE_HEIGHT} px")
    pixel_size_lng = (BBOX["max_lng"] - BBOX["min_lng"]) / TILE_WIDTH * 111000
    pixel_size_lat = (BBOX["max_lat"] - BBOX["min_lat"]) / TILE_HEIGHT * 111000
    print(f"  Resolution: ~{pixel_size_lng:.1f}m x {pixel_size_lat:.1f}m per pixel")
    print("=" * 60)

    # Step 1: Fetch high-res crosswalk tile
    print("\n--- Step 1: Fetch WMS tile ---")
    tile_data = fetch_wms_tile(WMS_CROSSWALK, api_key, width=TILE_WIDTH, height=TILE_HEIGHT)
    if not tile_data:
        print("[EXTRACT-ERR] Failed to fetch tile. Exiting.")
        sys.exit(1)

    # Save tile for inspection
    tile_path = os.path.join(OUTPUT_DIR, "crosswalk_hires_tile.png")
    with open(tile_path, "wb") as f:
        f.write(tile_data)
    print(f"  Saved tile to {tile_path}")

    # Step 2: Load image and find colored pixels
    print("\n--- Step 2: Analyze pixels ---")
    img = Image.open(io.BytesIO(tile_data)).convert("RGBA")
    print(f"  Image size: {img.size}")

    colored = find_colored_pixels(img)
    print(f"  Colored pixels (alpha > {ALPHA_THRESHOLD}): {len(colored)}")

    if len(colored) == 0:
        print("  [WARN] No colored pixels found. The tile may be entirely transparent.")
        print("  Check the saved tile image manually.")
        sys.exit(0)

    # Step 3: Cluster pixels into crosswalk features
    print("\n--- Step 3: Cluster pixels ---")
    clusters = cluster_pixels(colored)
    print(f"  Clusters found: {len(clusters)} (min {MIN_CLUSTER_PIXELS} pixels)")
    if clusters:
        sizes = [len(c) for c in clusters]
        print(f"  Cluster sizes: min={min(sizes)}, max={max(sizes)}, avg={sum(sizes)/len(sizes):.1f}")

    # Step 4: Convert to lat/lng
    print("\n--- Step 4: Convert to coordinates ---")
    coords = []
    for cluster in clusters:
        lng, lat = cluster_centroid_lnglat(cluster, img.size[0], img.size[1])
        coords.append((lng, lat))
    print(f"  Extracted {len(coords)} crosswalk coordinates")

    # Step 5: Deduplicate with existing crosswalks.geojson
    print("\n--- Step 5: Deduplicate ---")
    existing_path = os.path.join(PUBLIC_DIR, "crosswalks.geojson")
    unique_coords = deduplicate_with_existing(coords, existing_path, threshold_m=15)

    # Step 6: Save results
    print("\n--- Step 6: Save ---")

    # Save WMS-extracted crosswalks separately (for inspection)
    wms_geojson = build_geojson(coords, source="safemap_wms")
    wms_path = os.path.join(OUTPUT_DIR, "crosswalks_wms_extracted.json")
    with open(wms_path, "w", encoding="utf-8") as f:
        json.dump(wms_geojson, f, ensure_ascii=False, indent=2)
    print(f"  Saved all WMS crosswalks to {wms_path}")

    # Merge unique new crosswalks into public/geojson/crosswalks.geojson
    if unique_coords:
        new_features = build_geojson(unique_coords, source="safemap_wms")["features"]
        total = merge_geojson(existing_path, new_features)
        print(f"  Updated crosswalks.geojson: {total} total crosswalks")
    else:
        print("  No new unique crosswalks to add")

    # Summary
    print("\n" + "=" * 60)
    print("[EXTRACT-01] Summary")
    print(f"  WMS colored pixels: {len(colored)}")
    print(f"  Clusters detected: {len(clusters)}")
    print(f"  Crosswalk coordinates: {len(coords)}")
    print(f"  New unique (after dedup): {len(unique_coords)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
