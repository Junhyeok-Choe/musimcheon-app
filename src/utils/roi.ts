import { GeoJsonFeature, RoiGeometry, RoiPolygon } from '@/types';
import { ROI_ADMIN_DONG_CODES, ROI_BRIDGE_BUFFER_M, ROI_BRIDGE_CENTER } from './constants';

function extractPolygonGeometries(feature: GeoJsonFeature): [number, number][][][] {
  const geometry = feature.geometry;

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates as [number, number][][]];
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates as [number, number][][][];
  }

  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    const polygons: [number, number][][][] = [];

    geometry.geometries.forEach((child) => {
      if (child.type === 'Polygon' && Array.isArray(child.coordinates)) {
        polygons.push(child.coordinates as [number, number][][]);
        return;
      }
      if (child.type === 'MultiPolygon' && Array.isArray(child.coordinates)) {
        polygons.push(...(child.coordinates as [number, number][][][]));
      }
    });

    return polygons;
  }

  return [];
}

function polygonRingsToShape(rings: [number, number][][]): RoiPolygon | null {
  if (!rings.length || rings[0].length < 4) {
    return null;
  }

  return {
    outer: rings[0],
    holes: rings.slice(1).filter((ring) => ring.length >= 4),
  };
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat
      && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
      * Math.cos((lat2 * Math.PI) / 180)
      * Math.sin(dLng / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildRoiGeometry(data: { features?: GeoJsonFeature[] }): RoiGeometry {
  const polygons: RoiPolygon[] = [];

  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const adminCode = String(props.EMD_CD ?? props.ADM_DR_CD ?? props.adm_cd ?? '');
    if (!ROI_ADMIN_DONG_CODES.includes(adminCode as typeof ROI_ADMIN_DONG_CODES[number])) {
      continue;
    }

    for (const polygonCoords of extractPolygonGeometries(feature)) {
      const polygon = polygonRingsToShape(polygonCoords);
      if (polygon) {
        polygons.push(polygon);
      }
    }
  }

  return {
    polygons,
    adminCodes: [...ROI_ADMIN_DONG_CODES],
    bridgeCenter: ROI_BRIDGE_CENTER,
    bridgeRadiusM: ROI_BRIDGE_BUFFER_M,
  };
}

export function isPointInRoi(lat: number, lng: number, roi: RoiGeometry | null): boolean {
  if (!roi) {
    return false;
  }

  for (const polygon of roi.polygons) {
    const insideOuter = pointInRing(lng, lat, polygon.outer);
    const insideHole = polygon.holes.some((hole) => pointInRing(lng, lat, hole));
    if (insideOuter && !insideHole) {
      return true;
    }
  }

  return haversine(lat, lng, roi.bridgeCenter[1], roi.bridgeCenter[0]) <= roi.bridgeRadiusM;
}

export function getRoiValidationError(inRoi: boolean): string | null {
  if (inRoi) {
    return null;
  }

  return '설정된 서비스 권역 밖의 출발점입니다. 권역 안에서 다시 선택해 주세요.';
}
