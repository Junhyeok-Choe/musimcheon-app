import { CategoryType } from '@/types';

// [CONST-01] Category color mapping
export const CATEGORY_COLORS: Record<CategoryType, string> = {
  korean: '#ef4444',
  western: '#3b82f6',
  japanese: '#f97316',
  chinese: '#eab308',
  asian: '#a855f7',
  meat: '#dc2626',
  chicken: '#f59e0b',
  seafood: '#06b6d4',
  cafe: '#8b5cf6',
  pub: '#ec4899',
  fusion: '#84cc16',
  other: '#6b7280',
};

// [CONST-02] Category display names
export const CATEGORY_DISPLAY: Record<CategoryType, string> = {
  korean: '한식',
  western: '양식',
  japanese: '일식',
  chinese: '중식',
  asian: '아시안',
  meat: '고기',
  chicken: '치킨',
  seafood: '해산물',
  cafe: '카페',
  pub: '펍',
  fusion: '퓨전',
  other: '기타',
};

// [CONST-03] Map defaults
export const MAP_CENTER: [number, number] = [36.635, 127.490];
export const MAP_ZOOM = 17;
export const WALKING_SPEED_M_PER_MIN = 67; // ~4km/h

// [CONST-04] Layer definitions
export const LAYER_CONFIG: Record<string, { label: string; file: string; color: string; weight?: number; opacity?: number; dashArray?: string }> = {
  adminDongs: { label: '행정구역', file: 'admin_dongs.geojson', color: '#475569', weight: 2.5, opacity: 0.7, dashArray: '6,4' },
  busStops: { label: '버스 정류장', file: 'bus_stops.geojson', color: '#22c55e' },
  spatialFacilities: { label: '공간시설', file: 'spatial_facilities.geojson', color: '#06b6d4' },
  transportFacilities: { label: '교통시설', file: 'transport_facilities.geojson', color: '#8b5cf6' },
  sidewalkCenterline: { label: '보도 중심선', file: 'sidewalk_centerline.geojson', color: '#3b82f6', weight: 1.5, opacity: 0.5 },
  sidewalkBoundary: { label: '보도 경계', file: 'sidewalk_boundary.geojson', color: '#60a5fa', weight: 1, opacity: 0.4 },
  pedOnlyRoad: { label: '보행자 전용', file: 'ped_only_road.geojson', color: '#f59e0b', weight: 3, opacity: 0.7 },
  streetLamps: { label: '가로등', file: 'street_lamps.geojson', color: '#fbbf24' },
  routingNodes: { label: '경로 노드', file: 'nodelink_nodes.geojson', color: '#94a3b8' },
};
