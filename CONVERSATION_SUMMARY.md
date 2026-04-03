# Musimcheon Date Course Project - Conversation Summary

> Generated: 2026-04-03
> Purpose: 다른 채팅에서 이어서 작업할 수 있도록 이 채팅의 전체 내용을 대화 순서대로 정리

---

## 1. Project Overview

- **Project**: 무심천 데이트코스 프로젝트 (대학 해커톤)
- **Schedule**: 중간발표 4/4, 최종발표 4/12
- **Stack**: Next.js 16.2.1 (App Router), Leaflet, Zustand, Vercel deploy
- **Repo**: https://github.com/Junhyeok-Choe/musimcheon-app.git
- **Branch**: main

---

## 2. Conversation Flow (in order)

### Phase 1: Keyword-based Restaurant Scoring (previous session, compacted)

- `process_data.py`에서 Naver good_points 키워드 기반 Date Index 점수 계산 구현
- 점수 구성: atmosphere(35%) + noise(20%) + waiting(15%) + distance(15%) + date_ratio(15%)
- `restaurants.geojson` 193개 식당에 점수 적용 (Top: 갤리604 7.4, Bottom: 왕천파닭 3.0)
- `cafes.geojson` 140개 카페 geocode + 점수
- Git push -> Vercel 배포 완료

### Phase 2: Crosswalk Data Search (previous session, compacted)

- User reported pathfinding goes straight through intersections ignoring crosswalks
- Searched pathfinder directory: 30 root-level zips, 657 tile zips
- Found crosswalks from 수치지형도 v2:
  - N1P_F0020000: 57 crosswalk points
  - N1P_C0493376: 289 pedestrian signal points (보행용)
  - Deduplicated by 15m proximity -> 284 crosswalk locations
  - Saved to `public/geojson/crosswalks.geojson`
- Coverage: 109/508 (21.5%) routing graph intersections
- User frustrated about initially missing N1P_C0493376 data: "놓치는 거 하나 없이"

### Phase 3: Safemap WMS API Debugging (THIS session)

#### 3a. Initial Attempt - urllib (failed)
- User got safemap API key from safemap.go.kr
- Created `scripts/fetch_crosswalks_safemap.py` with urllib
- ALL requests returned `IncompleteRead(1965 bytes read, 8847 more expected)`
- Misdiagnosed as urllib chunked encoding bug

#### 3b. Switch to requests library (still failed)
- Rewrote with `requests` library
- Same IncompleteRead error persisted
- Created `scripts/debug_safemap.py` to diagnose

#### 3c. Root Cause Discovery #1 - Partial response analysis
- Stream mode captured 1965 bytes of partial response
- Found: `ServiceException: bounding box contains wrong number of coordinates (should have 4): 0`
- Also found: two HTTP responses concatenated (GeoServer XML + gateway 400 HTML)
- Initially misattributed to missing BBOX in GetCapabilities
- But GetMap (which HAS BBOX) showed same error -> BBOX not the only issue

#### 3d. Root Cause Discovery #2 - Official API documentation
- User shared safemap API docs (Java example + OpenLayers example)
- **Three critical mistakes identified:**
  1. **Parameter names must be lowercase**: `bbox`, `srs`, `format` (NOT `BBOX`, `SRS`, `FORMAT`)
  2. **All values must be URL-encoded**: commas as `%2C`, colons as `%3A`, slashes as `%2F`
  3. **Standard WMS params not needed**: No `REQUEST`, `SERVICE`, `VERSION`, `LAYERS`
- The API is a simplified wrapper, NOT a standard WMS endpoint

#### 3e. v5 Script - SUCCESS
- Rewrote with lowercase params + URL encoding
- **GetMap: 200 OK, image/png, 22187 bytes** - crosswalk tile rendered correctly
- **Sidewalk layer also worked**: 121547 bytes
- **GetFeatureInfo: 400 Bad Request** - not supported by the API wrapper
- This means: images work, but vector coordinate extraction is impossible via this API

### Phase 4: WMS Tile Pixel Analysis for Coordinate Extraction

- Since GetFeatureInfo doesn't work, used a different approach:
  1. Request 2048x2048 transparent PNG tile (single API call)
  2. Find all non-transparent pixels (crosswalk features have color)
  3. BFS cluster adjacent pixels (8-connectivity)
  4. Compute cluster centroids -> convert pixel coords to lat/lng
- Created `scripts/extract_crosswalks_from_wms.py`
- Results:
  - 15,272 colored pixels
  - 269 clusters detected (min 7px, max 218px, avg 56.8px)
  - 269 crosswalk coordinates extracted
  - 46 duplicates with existing 284 removed (15m threshold)
  - **223 new unique crosswalks added**
  - **Total: 507 crosswalks** (284 numchijido + 223 safemap WMS)

### Phase 5: Crosswalk-aware A* Routing

- Modified `src/utils/pathfinding.ts`:
  - `buildCrosswalkIndex()`: precompute which nodes are within 30m of a crosswalk
  - `findRoute()`: 1.4x cost penalty for edges leading to nodes without nearby crosswalk
  - `realDist` tracked separately for display (actual meters, not penalized)
- Modified `src/store/mapStore.ts`: added `crosswalks: CrosswalkCoord[]` state
- Modified `src/app/page.tsx`: loads `crosswalks.geojson` on mount
- Modified `src/components/NavigationTab.tsx`: builds crosswalk index, passes to findRoute

### Phase 6: Crosswalk Layer Visibility + UI Review (latest)

- Added `crosswalks` to `LayerKey` type and `LAYER_CONFIG`
- Color: `#f43f5e` (rose), file: `crosswalks.geojson`
- Added to `visibleLayers` default state (off by default)
- **NOT YET PUSHED** - needs git commit

---

## 3. Current File Inventory

### Source Files (src/)

| File | Status | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modified externally | Added `shabu` category, `PlaceKind`, new score fields, `crosswalks` LayerKey |
| `src/utils/pathfinding.ts` | Modified | Crosswalk-aware A*, `buildCrosswalkIndex()` |
| `src/utils/constants.ts` | Modified externally + this session | Added `shabu`, `crosswalks` layer config |
| `src/store/mapStore.ts` | Modified externally + this session | Separated restaurants/cafes, crosswalks state, new score fields |
| `src/app/page.tsx` | Modified externally + this session | Loads crosswalks.geojson, separate restaurant/cafe loading |
| `src/components/NavigationTab.tsx` | Modified externally | Restaurant-to-restaurant routing with crosswalk index |
| `src/components/MapView.tsx` | Modified externally | Handles restaurant/cafe markers, layers |
| `src/components/Sidebar.tsx` | Modified externally | Restaurant/cafe count display |
| `src/components/LayersTab.tsx` | No change | Layer toggle UI |
| `src/components/InfoBox.tsx` | Unknown | Not reviewed this session |
| `src/components/RestaurantList.tsx` | Unknown | Not reviewed this session |

### Data Files (public/geojson/)

| File | Count | Source |
|------|-------|--------|
| `restaurants.geojson` | 193 restaurants | process_data.py (keyword scoring) |
| `cafes.geojson` | 140 cafes | process_data.py |
| `crosswalks.geojson` | 507 crosswalks | 284 numchijido + 223 safemap WMS |
| `routing_graph.json` | 1018 nodes, 1400 edges | nodelink data |
| Various layer files | - | admin_dongs, bus_stops, sidewalks, etc. |

### Scripts (scripts/)

| File | Purpose |
|------|---------|
| `process_data.py` | Main data pipeline (restaurants + cafes scoring) |
| `fetch_crosswalks_safemap.py` | Safemap WMS API caller (v5, working) |
| `extract_crosswalks_from_wms.py` | WMS tile pixel analysis for coordinate extraction |
| `debug_safemap.py` | Diagnostic script (can be deleted) |

---

## 4. Known Issues & Pending Work

### Critical
1. **Route still goes diagonal through intersections** (screenshot confirmed)
   - Crosswalk penalty (1.4x) may not be strong enough
   - Or the routing graph edges themselves are diagonal (graph structure issue, not penalty issue)
   - Need to verify: is the graph edge connecting nodes ACROSS the intersection without an intermediate node AT the intersection?

### Needs Push
2. **Crosswalk layer added but not pushed**: `types/index.ts`, `constants.ts`, `mapStore.ts` changes
   - `crosswalks` added to `LayerKey`, `LAYER_CONFIG`, `visibleLayers`

### UI/Type Changes (done externally, not by this session)
3. **New types added**: `PlaceKind`, `shabu` category, new score fields
   - `score_visit_target`, `score_taste`, `score_service`, `score_base`, `score_final`
   - `is_fastfood`, `is_franchise`, `exclude_reason`
   - Store now has separate `restaurants` and `cafes` arrays
   - Navigation changed from map-click start point to restaurant-to-restaurant

### Not Yet Done
4. **Safemap WMS overlay on map** (optional visual enhancement)
5. **Stronger crosswalk penalty or graph restructuring** to prevent diagonal intersection crossing
6. **InfoBox.tsx and RestaurantList.tsx** not reviewed this session

---

## 5. Safemap API Reference

### Working Endpoint Format
```
http://safemap.go.kr/openapi2/IF_0097_WMS
  ?serviceKey=YOUR_KEY
  &srs=EPSG%3A4326
  &bbox=127.467%2C36.619%2C127.502%2C36.647
  &format=image%2Fpng
  &width=2048
  &height=2048
  &transparent=TRUE
```

### Key Rules
- All parameter names LOWERCASE
- All values URL-encoded (commas, colons, slashes)
- NO standard WMS params (REQUEST, SERVICE, VERSION, LAYERS)
- GetMap: works (returns PNG tiles)
- GetFeatureInfo: NOT supported (returns 400)
- IF_0097_WMS = crosswalk layer
- IF_0095_WMS = sidewalk layer

---

## 6. Git History (this session)

```
6af81f17 feat: crosswalk-aware A* routing + safemap API v5 fix
4afb24ed feat: extract 223 new crosswalks from safemap WMS tile analysis
```

### Unpushed Changes
- `src/types/index.ts`: added `crosswalks` to LayerKey
- `src/utils/constants.ts`: added crosswalks to LAYER_CONFIG
- `src/store/mapStore.ts`: added crosswalks to visibleLayers default

---

## 7. Routing Graph Details

- **Nodes**: 1,018
- **Edges**: 1,400
- **Bounds**: lng 127.467~127.502, lat 36.619~36.647
- **CRS**: EPSG:4326 (WGS84)
- **Crosswalk coverage**: 507 crosswalks, ~30m proximity matching to nodes
- **Penalty**: 1.4x edge cost for nodes without nearby crosswalk

---

## 8. Pedestrian Routing Libraries (research done)

For future reference if A* needs replacement:
- **TMAP API**: Best Korean pedestrian routing (includes crosswalk/signal info)
- **OSRM/Valhalla/GraphHopper**: Overkill for 1000-node graph
- **Current A***: Sufficient for hackathon scale, already has crosswalk penalty
