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
  score_atmosphere?: number;
  score_noise?: number;
  score_waiting?: number;
  score_distance?: number;
  score_date_ratio?: number;
  score_visit_target?: number;
  score_taste?: number;
  score_service?: number;
  score_base?: number;
  score_final?: number;
  date_index?: number;
  is_fastfood?: boolean;
  is_franchise?: boolean;
  exclude_reason?: string | null;
  operating_schedule_summary?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  break_time?: string | null;
  holiday?: string | null;
  last_order?: string | null;
  hours_confidence?: HoursConfidence | null;
  hours_source?: string | null;
}

export interface RestaurantFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: RestaurantProperties;
}

export interface RestaurantGeoJSON {
  type: 'FeatureCollection';
  features: RestaurantFeature[];
}

export interface Restaurant {
  id: number;
  placeKind: PlaceKind;
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
  scoreAtmosphere: number;
  scoreNoise: number;
  scoreWaiting: number;
  scoreDistance: number;
  scoreDateRatio: number;
  scoreVisitTarget: number;
  scoreTaste: number;
  scoreService: number;
  scoreBase: number;
  scoreFinal: number;
  dateIndex: number;
  isFastfood: boolean;
  isFranchise: boolean;
  excludeReason: string | null;
  operatingScheduleSummary: string | null;
  openTime: string | null;
  closeTime: string | null;
  breakTime: string | null;
  holiday: string | null;
  lastOrder: string | null;
  hoursConfidence: HoursConfidence;
  hoursSource: string | null;
}

export type CategoryType =
  | 'korean' | 'western' | 'japanese' | 'chinese' | 'asian'
  | 'meat' | 'chicken' | 'seafood' | 'cafe' | 'pub' | 'fusion' | 'shabu' | 'other';

export type PlaceKind = 'restaurant' | 'cafe';

export interface RoutingGraphEdge {
  f: string;
  t: string;
  d: number;
  rn?: string;
  rr?: string;
  c?: [number, number][];
}

export interface RoutingGraphData {
  nodes: Record<string, [number, number]>;
  edges: RoutingGraphEdge[];
}

export type RouteConfidence = 'high' | 'medium' | 'low';
export type HoursConfidence = 'high' | 'low';
export type EdgeKind =
  | 'approach'
  | 'sidewalk'
  | 'validated_crossing'
  | 'candidate_crossing'
  | 'implicit_local_crossing';

export interface RouteSegment {
  kind: EdgeKind;
  path: [number, number][];
}

export interface RouteResult {
  path: [number, number][];
  segments: RouteSegment[];
  distance: number;
  time: number;
  confidence: RouteConfidence;
  warnings: string[];
  startAttachmentM: number;
  endAttachmentM: number;
  usedCandidateCrossings: number;
  usedImplicitLocalCrossings: number;
}

export type RouteFailureCode =
  | 'start_attachment_too_far'
  | 'end_attachment_too_far'
  | 'major_road_crossing_blocked'
  | 'no_connected_pedestrian_path';

export interface RouteAttempt {
  route: RouteResult | null;
  failureCode?: RouteFailureCode;
}

export type LayerKey =
  | 'adminDongs' | 'busStops' | 'spatialFacilities' | 'transportFacilities'
  | 'sidewalkCenterline' | 'sidewalkBoundary' | 'pedOnlyRoad' | 'streetLamps' | 'routingNodes' | 'crosswalks';

export type SortMode = 'rating' | 'reviews' | 'name' | 'dateIndex';

export type TabType = 'restaurants' | 'navigation' | 'planner' | 'layers';

export type OriginSource = 'device_location' | 'map_point' | 'debug_override';
export type OriginSelectionMode = 'idle' | 'map';

export interface OriginPoint {
  source: OriginSource;
  lat: number;
  lng: number;
  label?: string;
}

export interface PlannerInput {
  origin: OriginPoint | null;
  requestedStartTime: string;
}

export interface PlannerTimelineItem {
  label: string;
  startsAt: string;
  endsAt?: string;
  note?: string;
}

export interface PlanLeg {
  fromLabel: string;
  toLabel: string;
  route: RouteResult;
}

export type PlanKind =
  | 'origin_to_restaurant'
  | 'origin_to_cafe'
  | 'origin_to_restaurant_to_cafe'
  | 'origin_to_cafe_to_restaurant';

export interface PlanOption {
  id: string;
  kind: PlanKind;
  title: string;
  subtitle: string;
  places: Restaurant[];
  timeline: PlannerTimelineItem[];
  legs: PlanLeg[];
  combinedRoute: RouteResult | null;
  confidence: RouteConfidence;
  warnings: string[];
  score: number;
  hoursSummary: string[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates?: unknown;
    geometries?: Array<{ type: string; coordinates?: unknown }>;
  };
  properties?: Record<string, unknown>;
}

export interface RoiPolygon {
  outer: [number, number][];
  holes: [number, number][][];
}

export interface RoiGeometry {
  polygons: RoiPolygon[];
  adminCodes: string[];
  bridgeCenter: [number, number];
  bridgeRadiusM: number;
}
