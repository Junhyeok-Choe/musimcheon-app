#!/usr/bin/env python3
"""
[PROCESS-01] Musimcheon Date Course - Data Processing Script
Processes restaurant + cafe data, computes date index scores, geocodes addresses.
Run locally (requires network for NCP Geocoding API).

Usage:
    python scripts/process_data.py

Requires:
    pip install requests

Environment variables (for geocoding):
    NAVER_MAPS_API_KEY_ID - NCP API Key ID
    NAVER_MAPS_API_KEY    - NCP API Secret Key
"""

import json
import os
import sys
import time
import math

# ============================================================
# [PROCESS-02] Score Computation from Review Keywords
# ============================================================

# Atmosphere-positive keywords (high count = good atmosphere for dates)
ATMOSPHERE_KEYWORDS = {
    "인테리어가 멋져요": 3.0,
    "사진이 잘 나와요": 2.5,
    "대화하기 좋아요": 3.0,
    "아늑해요": 2.5,
    "뷰가 좋아요": 2.5,
    "컨셉이 독특해요": 2.0,
    "차분한 분위기예요": 2.5,
    "음악이 좋아요": 1.5,
    "매장이 청결해요": 1.0,
    "시설이 깔끔해요": 1.0,
    "화장실이 깨끗해요": 0.5,
    "야외공간이 멋져요": 2.0,
    "룸이 잘 되어있어요": 1.5,
    "좌석이 편해요": 1.0,
    "매장이 넓어요": 0.5,
    "오래 머무르기 좋아요": 2.0,
}

# Noise-negative keywords (high count = likely noisy -> lower score)
NOISE_NEGATIVE_KEYWORDS = {
    "단체모임 하기 좋아요": -2.0,
    "아이와 가기 좋아요": -1.5,
    "게임 종류가 다양해요": -1.0,
}

# Noise-positive keywords (high count = likely quiet -> higher score)
NOISE_POSITIVE_KEYWORDS = {
    "집중하기 좋아요": 3.0,
    "대화하기 좋아요": 2.0,
    "아늑해요": 2.0,
    "차분한 분위기예요": 3.0,
    "오래 머무르기 좋아요": 1.5,
}

# Date-purpose weight
DATE_PURPOSE_KEYWORDS = ["데이트", "기념일"]


def compute_scores(reviews):
    """[PROCESS-02a] Compute atmosphere, noise, waiting scores from review data."""
    scores = {
        "atmosphere": 0.0,
        "noise": 5.0,  # default: neutral
        "waiting": 10.0,  # default: no waiting = best
        "date_ratio": 0.0,
    }

    if not reviews:
        return scores

    naver = reviews.get("naver", {})
    kakao = reviews.get("kakao", {})

    # --- Atmosphere Score (1-10) ---
    good_points = naver.get("good_points", [])
    total_gp_count = sum(gp.get("count", 0) for gp in good_points)

    atmo_raw = 0
    for gp in good_points:
        kw = gp["keyword"]
        cnt = gp.get("count", 0)
        if kw in ATMOSPHERE_KEYWORDS:
            # Weighted contribution normalized by total keyword count
            weight = ATMOSPHERE_KEYWORDS[kw]
            atmo_raw += weight * cnt

    # Normalize: log scale to 1-10
    if total_gp_count > 0:
        atmo_normalized = atmo_raw / total_gp_count * 5
        scores["atmosphere"] = max(1, min(10, round(atmo_normalized, 1)))
    else:
        scores["atmosphere"] = 3.0  # no data -> low default

    # --- Noise Score (1=noisy, 10=quiet) ---
    noise_raw = 5.0  # neutral start
    for gp in good_points:
        kw = gp["keyword"]
        cnt = gp.get("count", 0)
        if total_gp_count > 0:
            ratio = cnt / total_gp_count
            if kw in NOISE_POSITIVE_KEYWORDS:
                noise_raw += NOISE_POSITIVE_KEYWORDS[kw] * ratio * 10
            if kw in NOISE_NEGATIVE_KEYWORDS:
                noise_raw += NOISE_NEGATIVE_KEYWORDS[kw] * ratio * 10
    scores["noise"] = max(1, min(10, round(noise_raw, 1)))

    # --- Waiting Score (1=long wait, 10=no wait) ---
    items = naver.get("items", [])
    if items:
        wait_counts = {"바로 입장": 0, "10분 이내": 0, "30분 이내": 0, None: 0}
        for item in items:
            wt = item.get("waiting_time")
            wait_counts[wt] = wait_counts.get(wt, 0) + 1

        total_with_info = sum(v for k, v in wait_counts.items() if k is not None)
        if total_with_info > 0:
            instant_ratio = wait_counts["바로 입장"] / total_with_info
            short_ratio = wait_counts.get("10분 이내", 0) / total_with_info
            # 바로입장=10, 10분이내=6, 30분이내=3
            scores["waiting"] = round(
                instant_ratio * 10 + short_ratio * 6 + (1 - instant_ratio - short_ratio) * 3,
                1
            )

    # --- Date Purpose Ratio ---
    if items:
        date_count = 0
        for item in items:
            purpose = item.get("visit_purpose") or ""
            if any(kw in purpose for kw in DATE_PURPOSE_KEYWORDS):
                date_count += 1
        scores["date_ratio"] = round(date_count / len(items), 2) if items else 0

    return scores


def compute_date_index(scores, distance_score=5.0):
    """[PROCESS-02b] Compute final date index (1-10) from component scores."""
    # Weights: atmosphere 35%, noise 20%, waiting 15%, distance 15%, date_ratio 15%
    idx = (
        scores["atmosphere"] * 0.35
        + scores["noise"] * 0.20
        + scores["waiting"] * 0.15
        + distance_score * 0.15
        + scores["date_ratio"] * 10 * 0.15  # scale 0-1 to 0-10
    )
    return round(max(1, min(10, idx)), 1)


# ============================================================
# [PROCESS-03] Geocoding via NCP (Naver Cloud Platform)
# ============================================================

def geocode_address(address, api_key_id, api_key):
    """[PROCESS-03a] Geocode a single address using NCP Geocoding API."""
    import requests

    url = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
    headers = {
        "X-NCP-APIGW-API-KEY-ID": api_key_id,
        "X-NCP-APIGW-API-KEY": api_key,
    }
    params = {"query": address}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=5)
        data = resp.json()
        if data.get("addresses") and len(data["addresses"]) > 0:
            addr = data["addresses"][0]
            return float(addr["x"]), float(addr["y"])  # lng, lat
    except Exception as e:
        print(f"  [PROCESS-03a] Geocode error for '{address}': {e}")

    return None, None


# ============================================================
# [PROCESS-04] Main Processing Pipeline
# ============================================================

# Musimcheon center for distance calculation
MUSIMCHEON_CENTER = (36.635, 127.490)


def haversine(lat1, lon1, lat2, lon2):
    """[PROCESS-04a] Haversine distance in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_score(lat, lng):
    """[PROCESS-04b] Distance score: closer to Musimcheon center = higher score."""
    dist = haversine(lat, lng, MUSIMCHEON_CENTER[0], MUSIMCHEON_CENTER[1])
    # 0m=10, 500m=8, 1000m=5, 2000m=2, 3000m+=1
    if dist <= 500:
        return round(10 - dist / 500 * 2, 1)
    elif dist <= 1500:
        return round(8 - (dist - 500) / 1000 * 5, 1)
    else:
        return 1.0


def load_existing_restaurants():
    """[PROCESS-04c] Load existing restaurants.geojson with coordinates."""
    geojson_path = os.path.join(os.path.dirname(__file__), "..", "public", "geojson", "restaurants.geojson")
    geojson_path = os.path.normpath(geojson_path)
    with open(geojson_path, "r", encoding="utf-8") as f:
        return json.load(f)


def process_cafes(cafes_path, api_key_id=None, api_key=None):
    """[PROCESS-04d] Process cafes: compute scores, geocode, output GeoJSON features."""
    with open(cafes_path, "r", encoding="utf-8") as f:
        cafes = json.load(f)["restaurants"]

    features = []
    geocode_cache_path = os.path.join(os.path.dirname(__file__), "geocode_cache.json")
    geocode_cache = {}
    if os.path.exists(geocode_cache_path):
        with open(geocode_cache_path, "r", encoding="utf-8") as f:
            geocode_cache = json.load(f)

    for i, cafe in enumerate(cafes):
        name = cafe["restaurant_name"]
        address = cafe["road_address"]
        reviews = cafe.get("reviews", {})

        # Geocode
        lng, lat = None, None
        if address in geocode_cache:
            lng, lat = geocode_cache[address]
        elif api_key_id and api_key:
            print(f"  [PROCESS-04d] Geocoding ({i+1}/{len(cafes)}): {name}")
            lng, lat = geocode_address(address, api_key_id, api_key)
            geocode_cache[address] = [lng, lat]
            time.sleep(0.1)  # rate limit

        if lat is None or lng is None:
            print(f"  [PROCESS-04d] WARNING: No coordinates for '{name}' ({address})")
            continue

        # Compute scores
        scores = compute_scores(reviews)
        dist_score = distance_score(lat, lng)
        date_idx = compute_date_index(scores, dist_score)

        # Determine category
        kakao_cat = cafe.get("category", {}).get("kakao", "")
        naver_cat = cafe.get("category", {}).get("naver", "")
        category = "cafe"
        category_display = naver_cat or kakao_cat.split(">")[-1].strip()

        # Review counts
        kakao_count = reviews.get("kakao", {}).get("review_count", 0) or 0
        naver_count = len(reviews.get("naver", {}).get("items", []))
        avg_rating = reviews.get("kakao", {}).get("avg_rating", 0) or 0

        # Top keywords from good_points
        good_points = reviews.get("naver", {}).get("good_points", [])
        top_keywords = [gp["keyword"] for gp in sorted(good_points, key=lambda x: -x.get("count", 0))[:5]]

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat],
            },
            "properties": {
                "restaurant_name": name,
                "category": category,
                "category_display": category_display,
                "road_address": address,
                "avg_rating": avg_rating,
                "review_count_kakao": kakao_count,
                "review_count_naver": naver_count,
                "top_keywords": top_keywords,
                "total_good_points": sum(gp.get("count", 0) for gp in good_points),
                "kakao_link": cafe.get("links", {}).get("kakao_map", ""),
                "naver_link": cafe.get("links", {}).get("naver_map", ""),
                # New score fields
                "score_atmosphere": scores["atmosphere"],
                "score_noise": scores["noise"],
                "score_waiting": scores["waiting"],
                "score_distance": dist_score,
                "score_date_ratio": scores["date_ratio"],
                "date_index": date_idx,
            },
        }
        features.append(feature)

    # Save geocode cache
    with open(geocode_cache_path, "w", encoding="utf-8") as f:
        json.dump(geocode_cache, f, ensure_ascii=False, indent=2)

    return features


# [PROCESS-04e-1] Restaurant-specific atmosphere keywords (date-friendly)
RESTAURANT_ATMO_KEYWORDS = {
    "인테리어가 멋져요": 3.0,
    "특별한 날 가기 좋아요": 4.0,
    "대화하기 좋아요": 3.0,
    "아늑해요": 2.5,
    "사진이 잘 나와요": 2.5,
    "컨셉이 독특해요": 2.0,
    "차분한 분위기예요": 2.5,
    "음악이 좋아요": 1.5,
    "뷰가 좋아요": 2.5,
    "매장이 청결해요": 1.0,
    "화장실이 깨끗해요": 0.5,
    "매장이 넓어요": 0.5,
}

# [PROCESS-04e-2] Franchise/fast-food name patterns (penalty applied)
FRANCHISE_PATTERNS = [
    "치킨", "BHC", "BBQ", "굽네", "교촌", "bhc", "네네", "호식이",
    "맥도날드", "롯데리아", "버거킹", "KFC", "피자헛", "도미노",
    "김밥천국", "편의점",
]

CATEGORY_PENALTY = {"chicken": 0.6, "other": 0.7}


def add_scores_to_restaurants(geojson, step2_path=None):
    """[PROCESS-04e] Add keyword-based scores to restaurants using step2 review data."""

    # [PROCESS-04e-3] Load step2 review data and build lookup by name
    step2_lookup = {}
    if step2_path and os.path.exists(step2_path):
        with open(step2_path, "r", encoding="utf-8") as f:
            step2_data = json.load(f)["restaurants"]
        for r in step2_data:
            step2_lookup[r["restaurant_name"]] = r.get("reviews", {})
        print(f"  [PROCESS-04e] Loaded step2 review data for {len(step2_lookup)} restaurants")

    for feat in geojson["features"]:
        props = feat["properties"]
        lat = feat["geometry"]["coordinates"][1]
        lng = feat["geometry"]["coordinates"][0]
        name = props.get("restaurant_name", "")
        category = props.get("category", "other")
        cat_display = props.get("category_display", "")

        # [PROCESS-04e-4] Get step2 review data for this restaurant
        reviews = step2_lookup.get(name, {})
        has_keyword_data = bool(reviews)

        if has_keyword_data:
            # Use keyword-based scoring (same approach as cafes)
            scores = compute_scores(reviews)

            # Override atmosphere with restaurant-specific keywords
            naver = reviews.get("naver", {})
            good_points = naver.get("good_points", [])
            total_gp = sum(gp.get("count", 0) for gp in good_points)

            if total_gp > 0:
                atmo_raw = 0
                for gp in good_points:
                    kw = gp["keyword"]
                    cnt = gp.get("count", 0)
                    if kw in RESTAURANT_ATMO_KEYWORDS:
                        atmo_raw += RESTAURANT_ATMO_KEYWORDS[kw] * cnt
                atmo = max(1, min(10, round(atmo_raw / total_gp * 5, 1)))
            else:
                atmo = scores["atmosphere"]

            noise = scores["noise"]
            waiting = scores["waiting"]
            date_ratio = scores["date_ratio"]
        else:
            # Fallback: rating-based proxy
            rating = props.get("avg_rating") or 0
            atmo = max(1, min(7.0, round(rating * 1.4, 1))) if rating > 0 else 2.0
            noise = 5.0
            review_count = (props.get("review_count_kakao") or 0) + (props.get("review_count_naver") or 0)
            if review_count > 80: waiting = 4.0
            elif review_count > 40: waiting = 6.0
            else: waiting = 8.0
            date_ratio = 0.25

        # [PROCESS-04e-5] Category and franchise penalties
        is_franchise = any(pat in name or pat in cat_display for pat in FRANCHISE_PATTERNS)
        cat_pen = CATEGORY_PENALTY.get(category, 1.0)
        atmo = round(atmo * cat_pen, 1)
        if is_franchise:
            atmo = round(atmo * 0.5, 1)
            date_ratio = min(date_ratio, 0.05)

        # [PROCESS-04e-6] Review count confidence penalty
        review_count = (props.get("review_count_kakao") or 0) + (props.get("review_count_naver") or 0)
        if review_count < 5:
            atmo = min(atmo, 3.0)
        elif review_count < 10:
            atmo = round(atmo * 0.85, 1)

        dist_sc = distance_score(lat, lng)
        date_idx = compute_date_index(
            {"atmosphere": atmo, "noise": noise, "waiting": waiting, "date_ratio": date_ratio},
            dist_sc,
        )

        props["score_atmosphere"] = atmo
        props["score_noise"] = noise
        props["score_waiting"] = waiting
        props["score_distance"] = dist_sc
        props["score_date_ratio"] = date_ratio
        props["date_index"] = date_idx

        # [PROCESS-04e-7] Extract top keywords from step2 good_points
        if has_keyword_data:
            naver_data = reviews.get("naver", {})
            gp_list = naver_data.get("good_points", [])
            sorted_gp = sorted(gp_list, key=lambda x: x.get("count", 0), reverse=True)
            props["top_keywords"] = [gp["keyword"] for gp in sorted_gp[:5]]
        elif not props.get("top_keywords"):
            props["top_keywords"] = []

    return geojson


def main():
    print("[PROCESS-01] Musimcheon Data Processing Start")
    print("=" * 60)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    output_dir = os.path.join(project_dir, "public", "geojson")

    # NCP API keys
    api_key_id = os.environ.get("NAVER_MAPS_API_KEY_ID")
    api_key = os.environ.get("NAVER_MAPS_API_KEY")

    if not api_key_id or not api_key:
        print("[PROCESS-01] WARNING: NCP API keys not set. Cafe geocoding will be skipped.")
        print("  Set NAVER_MAPS_API_KEY_ID and NAVER_MAPS_API_KEY environment variables.")
        print("  Or use cached coordinates from previous runs.")
    else:
        print("[PROCESS-01] NCP API keys found. Geocoding enabled.")

    # --- Step 1: Process existing restaurants ---
    print("\n[PROCESS-04e] Processing existing restaurants...")
    restaurants_geojson = load_existing_restaurants()
    step2_path = os.path.join(project_dir, "data", "restaurants_step2.json")
    restaurants_geojson = add_scores_to_restaurants(restaurants_geojson, step2_path)
    print(f"  Processed {len(restaurants_geojson['features'])} restaurants with scores")

    # Save updated restaurants
    restaurants_out = os.path.join(output_dir, "restaurants.geojson")
    with open(restaurants_out, "w", encoding="utf-8") as f:
        json.dump(restaurants_geojson, f, ensure_ascii=False)
    print(f"  Saved: {restaurants_out}")

    # --- Step 2: Process cafes ---
    cafes_path = os.path.join(script_dir, "..", "data", "cafes_step2.json")
    if not os.path.exists(cafes_path):
        # Try alternative locations
        for alt in [
            os.path.join(project_dir, "cafes_step2.json"),
            os.path.join(project_dir, "data", "cafes_step2.json"),
        ]:
            if os.path.exists(alt):
                cafes_path = alt
                break

    if os.path.exists(cafes_path):
        print(f"\n[PROCESS-04d] Processing cafes from {cafes_path}...")
        cafe_features = process_cafes(cafes_path, api_key_id, api_key)
        print(f"  Processed {len(cafe_features)} cafes with coordinates and scores")

        cafes_geojson = {
            "type": "FeatureCollection",
            "features": cafe_features,
        }
        cafes_out = os.path.join(output_dir, "cafes.geojson")
        with open(cafes_out, "w", encoding="utf-8") as f:
            json.dump(cafes_geojson, f, ensure_ascii=False)
        print(f"  Saved: {cafes_out}")
    else:
        print(f"\n[PROCESS-04d] WARNING: cafes_step2.json not found at {cafes_path}")
        print("  Place cafes_step2.json in the 'data/' folder.")

    # --- Step 3: Print Top 5 summary ---
    print("\n" + "=" * 60)
    print("[PROCESS-05] Top 5 Date Index - Restaurants")
    rest_sorted = sorted(
        restaurants_geojson["features"],
        key=lambda f: f["properties"].get("date_index", 0),
        reverse=True,
    )
    for i, f in enumerate(rest_sorted[:5]):
        p = f["properties"]
        print(f"  {i+1}. {p['restaurant_name']} - Date Index: {p['date_index']}"
              f" (atmo:{p['score_atmosphere']} noise:{p['score_noise']}"
              f" wait:{p['score_waiting']} dist:{p['score_distance']})")

    if os.path.exists(cafes_path) and cafe_features:
        print("\n[PROCESS-05] Top 5 Date Index - Cafes")
        cafe_sorted = sorted(cafe_features, key=lambda f: f["properties"].get("date_index", 0), reverse=True)
        for i, f in enumerate(cafe_sorted[:5]):
            p = f["properties"]
            print(f"  {i+1}. {p['restaurant_name']} - Date Index: {p['date_index']}"
                  f" (atmo:{p['score_atmosphere']} noise:{p['score_noise']}"
                  f" wait:{p['score_waiting']} dist:{p['score_distance']})")

    print("\n[PROCESS-01] Done!")


if __name__ == "__main__":
    main()
