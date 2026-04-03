#!/usr/bin/env python3
"""
[CROSSWALK-01] Safemap WMS API - Crosswalk Data Extraction Script (v5)

Based on official safemap API documentation:
  - Parameter names MUST be lowercase (bbox, srs, format, NOT BBOX, SRS, FORMAT)
  - ALL parameter values MUST be URL-encoded (commas, colons, slashes)
  - Standard WMS params (REQUEST, SERVICE, VERSION, LAYERS) are NOT needed
  - The endpoint itself determines the layer (IF_0097_WMS = crosswalk)

Previous failures caused by:
  1. Using uppercase WMS parameter names (gateway didn't recognize them)
  2. Not URL-encoding BBOX commas (gateway split on commas)
  3. Including unnecessary standard WMS parameters

Usage:
    python scripts/fetch_crosswalks_safemap.py YOUR_API_KEY
"""

import sys
import json
import os
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("[CROSSWALK-ERR] 'requests' library not installed.")
    print("  Run: pip install requests")
    sys.exit(1)

# [CROSSWALK-02] Configuration
BBOX_DICT = {
    "min_lng": 127.467,
    "min_lat": 36.619,
    "max_lng": 127.502,
    "max_lat": 36.647,
}

# Safemap API endpoints (each endpoint = specific layer)
WMS_CROSSWALK = "http://safemap.go.kr/openapi2/IF_0097_WMS"
WMS_SIDEWALK = "http://safemap.go.kr/openapi2/IF_0095_WMS"

# Output directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_DIR, "data")


def safe_get(url, timeout=30):
    """[CROSSWALK-03] Fetch URL with stream mode to handle partial responses."""
    try:
        resp = requests.get(url, timeout=timeout, stream=True)
        chunks = []
        try:
            for chunk in resp.iter_content(chunk_size=4096):
                chunks.append(chunk)
        except Exception:
            pass

        data = b"".join(chunks)
        return data, resp.status_code, dict(resp.headers)
    except requests.exceptions.Timeout:
        return b"[TIMEOUT]", 0, {}
    except Exception as e:
        return str(e).encode(), 0, {}


def build_safemap_url(base_url, api_key, srs, bbox_str, width=256, height=256,
                      fmt="image/png", transparent="TRUE"):
    """
    [CROSSWALK-03a] Build safemap WMS URL following official documentation.

    Official Java example:
      serviceKey = URL-encoded auth key
      srs = URL-encoded coordinate system (e.g. EPSG:4326)
      bbox = URL-encoded bounding box (commas encoded as %2C)
      format = URL-encoded image format (image/png -> image%2Fpng)
      width, height = pixel dimensions
      transparent = TRUE/FALSE

    NO standard WMS parameters (REQUEST, SERVICE, VERSION, LAYERS).
    """
    url = (
        f"{base_url}"
        f"?serviceKey={api_key}"
        f"&srs={quote(srs, safe='')}"
        f"&bbox={quote(bbox_str, safe='')}"
        f"&format={quote(fmt, safe='')}"
        f"&width={quote(str(width), safe='')}"
        f"&height={quote(str(height), safe='')}"
        f"&transparent={quote(transparent, safe='')}"
    )
    return url


def make_bbox_str(min_lng, min_lat, max_lng, max_lat):
    """[CROSSWALK-03b] Create comma-separated BBOX string (before encoding)."""
    return f"{min_lng},{min_lat},{max_lng},{max_lat}"


def test_get_map(base_url, api_key, label="crosswalk"):
    """[CROSSWALK-04] Test GetMap with official API format."""
    print(f"\n[CROSSWALK-04] Testing GetMap for {label}...")

    bbox_str = make_bbox_str(
        BBOX_DICT["min_lng"], BBOX_DICT["min_lat"],
        BBOX_DICT["max_lng"], BBOX_DICT["max_lat"]
    )

    # Try EPSG:4326 first (matches official sample), then EPSG:3857
    crs_options = ["EPSG:4326", "EPSG:3857"]

    for srs in crs_options:
        url = build_safemap_url(base_url, api_key, srs, bbox_str, 512, 512)
        print(f"\n  [{srs}] URL: {url[:120]}...")

        data, status, headers = safe_get(url)
        ct = headers.get("Content-Type", "N/A")
        print(f"  Status: {status}, Content-Type: {ct}, Size: {len(data)} bytes")

        if status == 200 and "image" in ct.lower():
            out_path = os.path.join(OUTPUT_DIR, f"{label}_tile_{srs.replace(':', '_')}.png")
            with open(out_path, "wb") as f:
                f.write(data)
            print(f"  [OK] Saved tile to {out_path}")
            print(f"  [OK] API is working with {srs}!")
            return True, srs
        elif len(data) > 0:
            text = data.decode("utf-8", errors="replace")
            if "ServiceException" in text:
                import re
                err = re.search(r"<ServiceException[^>]*>(.*?)</ServiceException>", text, re.DOTALL)
                print(f"  [ERROR] {err.group(1).strip()[:200] if err else text[:200]}")
            elif "400" in text or "Bad Request" in text:
                print(f"  [ERROR] 400 Bad Request")
            else:
                print(f"  [???] Response: {text[:300]}")

    return False, ""


def test_get_map_wms_style(base_url, api_key, label="crosswalk"):
    """[CROSSWALK-04b] Fallback: try standard WMS format but with lowercase params."""
    print(f"\n[CROSSWALK-04b] Trying standard WMS format with lowercase params...")

    bbox_str = make_bbox_str(
        BBOX_DICT["min_lng"], BBOX_DICT["min_lat"],
        BBOX_DICT["max_lng"], BBOX_DICT["max_lat"]
    )

    # Based on the OpenLayers example which uses layers and styles
    url = (
        f"{base_url}"
        f"?serviceKey={api_key}"
        f"&layers={quote('A2SM_RBLNG_3', safe='')}"
        f"&styles={quote('A2SM_RBLNG_3', safe='')}"
        f"&srs={quote('EPSG:4326', safe='')}"
        f"&bbox={quote(bbox_str, safe='')}"
        f"&format={quote('image/png', safe='')}"
        f"&width=512"
        f"&height=512"
        f"&transparent={quote('TRUE', safe='')}"
    )

    print(f"  URL: {url[:120]}...")
    data, status, headers = safe_get(url)
    ct = headers.get("Content-Type", "N/A")
    print(f"  Status: {status}, Content-Type: {ct}, Size: {len(data)} bytes")

    if status == 200 and "image" in ct.lower():
        out_path = os.path.join(OUTPUT_DIR, f"{label}_tile_wms_style.png")
        with open(out_path, "wb") as f:
            f.write(data)
        print(f"  [OK] Saved tile (WMS style) to {out_path}")
        return True
    elif len(data) > 0:
        text = data.decode("utf-8", errors="replace")
        print(f"  Response: {text[:300]}")

    return False


def test_get_feature_info(base_url, api_key, srs, lng, lat, name="test"):
    """[CROSSWALK-05] Test GetFeatureInfo (if supported by this WMS wrapper)."""
    print(f"\n[CROSSWALK-05] GetFeatureInfo at {name} [{lng}, {lat}]...")

    delta = 0.002
    bbox_str = make_bbox_str(lng - delta, lat - delta, lng + delta, lat + delta)
    w, h = 256, 256

    formats = ["application/json", "text/xml", "text/html", "text/plain"]

    for fmt in formats:
        # Try adding WMS GetFeatureInfo params alongside safemap params
        url = (
            f"{base_url}"
            f"?serviceKey={api_key}"
            f"&request={quote('GetFeatureInfo', safe='')}"
            f"&service={quote('WMS', safe='')}"
            f"&version={quote('1.1.1', safe='')}"
            f"&layers={quote('A2SM_RBLNG_3', safe='')}"
            f"&query_layers={quote('A2SM_RBLNG_3', safe='')}"
            f"&styles="
            f"&srs={quote(srs, safe='')}"
            f"&bbox={quote(bbox_str, safe='')}"
            f"&width={w}&height={h}"
            f"&format={quote('image/png', safe='')}"
            f"&info_format={quote(fmt, safe='')}"
            f"&x={w // 2}&y={h // 2}"
            f"&feature_count=50"
        )

        data, status, headers = safe_get(url, timeout=15)
        ct = headers.get("Content-Type", "N/A")
        text = data.decode("utf-8", errors="replace")
        has_data = len(text.strip()) > 20 and "ServiceException" not in text
        print(f"  [{fmt}]: status={status}, ct={ct}, len={len(text)}, useful={has_data}")

        if has_data and status == 200:
            print(f"    Preview: {text[:300]}")
            return {"format": fmt, "text": text}

    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_crosswalks_safemap.py YOUR_SAFEMAP_API_KEY")
        sys.exit(1)

    api_key = sys.argv[1]
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("[CROSSWALK-01] Safemap WMS Crosswalk Extraction v5")
    print(f"  requests v{requests.__version__}")
    print(f"  Using official API format (lowercase params, URL-encoded values)")
    print("=" * 60)

    # Step 1: GetMap with official simplified format
    print("\n--- Step 1: GetMap (official simplified format) ---")
    map_ok, working_srs = test_get_map(WMS_CROSSWALK, api_key, "crosswalk")

    # Step 1b: Fallback - try OpenLayers-style WMS with layers/styles
    if not map_ok:
        print("\n--- Step 1b: GetMap (OpenLayers WMS style) ---")
        wms_ok = test_get_map_wms_style(WMS_CROSSWALK, api_key, "crosswalk")
        if wms_ok:
            working_srs = "EPSG:4326"
            map_ok = True

    if map_ok:
        print("\n--- Step 1c: Sidewalk layer test ---")
        test_get_map(WMS_SIDEWALK, api_key, "sidewalk")

    # Step 2: GetFeatureInfo (to extract coordinates)
    if map_ok:
        print("\n--- Step 2: GetFeatureInfo ---")
        test_points = [
            (127.4905, 36.6350, "sajik_intersection"),
            (127.4850, 36.6300, "musimcheon_mid"),
            (127.4780, 36.6250, "musimcheon_south"),
        ]

        for lng, lat, name in test_points:
            result = test_get_feature_info(
                WMS_CROSSWALK, api_key, working_srs, lng, lat, name
            )
            if result:
                print(f"\n  [OK] GetFeatureInfo works with {result['format']}!")
                break
    else:
        print("\n[RESULT] GetMap also failed.")
        print("  Possible issues:")
        print("  1. API key not activated for IF_0097_WMS")
        print("  2. API key expired or invalid")
        print("  3. safemap server is currently down")
        print("  Using existing 284 crosswalks from numchijido data")

    print("\n" + "=" * 60)
    print("[CROSSWALK-01] Done.")
    print("=" * 60)


if __name__ == "__main__":
    main()
