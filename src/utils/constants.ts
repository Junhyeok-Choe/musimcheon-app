import { CategoryType } from '@/types';

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  korean: '#d94841',
  western: '#2563eb',
  japanese: '#ea580c',
  chinese: '#ca8a04',
  asian: '#0f766e',
  meat: '#b91c1c',
  chicken: '#f59e0b',
  seafood: '#0891b2',
  cafe: '#7c5a3a',
  pub: '#be185d',
  fusion: '#65a30d',
  shabu: '#059669',
  other: '#64748b',
};

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
  shabu: '샤브샤브',
  other: '기타',
};

export const MAP_CENTER: [number, number] = [36.635, 127.49];
export const MAP_ZOOM = 16;
export const WALKING_SPEED_M_PER_MIN = 67;

export const ROI_ADMIN_DONG_CODES = [
  '43112101',
  '43112103',
  '43111109',
  '43111110',
  '43111102',
  '43111103',
  '43111104',
  '43111105',
  '43111106',
  '43111107',
  '43111101',
  '43111108',
  '43111111',
  '43111118',
  '43111112',
] as const;

export const ROI_NAME_NORMALIZATION: Record<string, string> = {
  문화로: '문화동',
  사직2동: '사직동',
};

export const ROI_BRIDGE_CENTER: [number, number] = [127.48641145, 36.636700925];
export const ROI_BRIDGE_BUFFER_M = 1000;
export const ROUTE_ATTACHMENT_WARN_M = 60;
export const ROUTE_ATTACHMENT_FAIL_M = 100;
export const RESTAURANT_DWELL_MIN = 70;
export const CAFE_DWELL_MIN = 45;

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
  crosswalks: { label: '검증 횡단보도', file: 'crosswalks.geojson', color: '#f43f5e' },
};
