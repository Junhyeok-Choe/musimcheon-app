// [TYPE-01] GeoJSON feature types for restaurant data
export interface RestaurantProperties {
  restaurant_name: string;
  category: CategoryType;
  category_display: string;
  road_address: string;
  avg_rating: number;
  review_count_kakao: number;
  review_count_naver: number;
  top_keywords: string[];
  total_good_points: number;
  kakao_link: string;
  naver_link: string;
  // Date index scores (added by process_data.py)
  score_atmosphere?: number;
  score_noise?: number;
  score_waiting?: number;
  score_distance?: number;
  score_date_ratio?: number;
  date_index?: number;
}

export interface RestaurantFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: RestaurantProperties;
}

export interface RestaurantGeoJSON {
  type: 'FeatureCollection';
  features: RestaurantFeature[];
}

// [TYPE-02] Processed restaurant for UI use
export interface Restaurant {
  id: number;
  name: string;
  category: CategoryType;
  categoryDisplay: string;
  rating: number;
  reviewsKakao: number;
  reviewsNaver: number;
  address: string;
  keywords: string[];
  kakaoLink: string;
  naverLink: string;
  lat: number;
  lng: number;
  // Date index scores
  scoreAtmosphere: number;
  scoreNoise: number;
  scoreWaiting: number;
  scoreDistance: number;
  scoreDateRatio: number;
  dateIndex: number;
}

// [TYPE-03] Category types
export type CategoryType =
  | 'korean' | 'western' | 'japanese' | 'chinese' | 'asian'
  | 'meat' | 'chicken' | 'seafood' | 'cafe' | 'pub' | 'fusion' | 'other';

// [TYPE-04] Routing graph
export interface RoutingGraphData {
  nodes: Record<string, [number, number]>; // nodeId -> [lng, lat]
  edges: Array<{
    f: string; // from node
    t: string; // to node
    d: number; // distance
    rn?: string; // road name
    rr?: string; // road rank
    c?: string; // category
  }>;
}

// [TYPE-05] Route result
export interface RouteResult {
  path: [number, number][]; // [[lat, lng], ...]
  distance: number; // meters
  time: number; // minutes
}

// [TYPE-06] Layer key
export type LayerKey =
  | 'adminDongs' | 'busStops' | 'spatialFacilities' | 'transportFacilities'
  | 'sidewalkCenterline' | 'sidewalkBoundary' | 'pedOnlyRoad' | 'streetLamps' | 'routingNodes';

// [TYPE-07] Sort mode
export type SortMode = 'rating' | 'reviews' | 'name' | 'dateIndex';

// [TYPE-08] Tab
export type TabType = 'restaurants' | 'navigation' | 'layers';
