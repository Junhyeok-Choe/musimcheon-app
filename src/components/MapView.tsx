'use client';

import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS, LAYER_CONFIG, MAP_CENTER, MAP_ZOOM } from '@/utils/constants';
import { getRoiValidationError, isPointInRoi } from '@/utils/roi';

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const originMarkerRef = useRef<L.CircleMarker | null>(null);
  const planMarkersRef = useRef<L.CircleMarker[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const {
    restaurants,
    cafes,
    activePlaceKind,
    selectedPlace,
    visibleLayers,
    origin,
    originSelectionMode,
    roiGeometry,
    routeResult,
    selectedPlan,
    selectPlace,
    setOrigin,
    setOriginSelectionMode,
    setPlannerError,
  } = useMapStore();

  const visiblePlaces = activePlaceKind === 'restaurant' ? restaurants : cafes;
  const originSelectionModeRef = useRef(originSelectionMode);
  const roiGeometryRef = useRef(roiGeometry);

  useEffect(() => {
    originSelectionModeRef.current = originSelectionMode;
  }, [originSelectionMode]);

  useEffect(() => {
    roiGeometryRef.current = roiGeometry;
  }, [roiGeometry]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView(MAP_CENTER, MAP_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CartoDB',
      maxZoom: 19,
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'map-tooltip';
    tooltipEl.style.cssText = `
      position: fixed; display: none; pointer-events: none; z-index: 1000;
      background: rgba(20,20,20,0.92); color: white; padding: 8px 12px;
      border-radius: 8px; font-size: 12px; max-width: 220px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(tooltipEl);
    tooltipRef.current = tooltipEl;

    map.getContainer().addEventListener('mousemove', (event: MouseEvent) => {
      if (tooltipEl.style.display !== 'none') {
        tooltipEl.style.left = `${event.clientX + 12}px`;
        tooltipEl.style.top = `${event.clientY - 10}px`;
      }
    });

    map.on('click', (event) => {
      if (originSelectionModeRef.current !== 'map') {
        return;
      }

      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      const inRoi = isPointInRoi(lat, lng, roiGeometryRef.current);
      if (!inRoi) {
        setPlannerError(getRoiValidationError(false));
        return;
      }

      setOrigin({
        source: 'map_point',
        lat,
        lng,
        label: '지도 선택',
      });
      setOriginSelectionMode('idle');
      setPlannerError(null);
    });

    mapRef.current = map;

    return () => {
      tooltipEl.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [setOrigin, setOriginSelectionMode, setPlannerError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    visiblePlaces.forEach((place) => {
      const color = CATEGORY_COLORS[place.category] || '#64748b';
      const baseRadius = place.placeKind === 'cafe'
        ? Math.max(4, Math.round(place.rating * 1.2))
        : Math.max(4, Math.round(place.rating * 1.45));
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: baseRadius,
        fillColor: color,
        color: 'white',
        weight: place.placeKind === 'cafe' ? 2.2 : 1.4,
        fillOpacity: place.placeKind === 'cafe' ? 0.72 : 0.92,
      }).addTo(map);

      marker.on('click', () => selectPlace(place));
      marker.on('mouseover', () => {
        marker.setRadius(baseRadius + 4);
        if (tooltipRef.current) {
          tooltipRef.current.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${place.name}</div>
            <div style="font-size:11px;color:#cbd5e1">${place.placeKind === 'restaurant' ? '식당' : '카페'} · ${place.categoryDisplay}</div>
            <div style="font-size:11px;color:#fbbf24">평점 ${place.rating.toFixed(1)} · 지수 ${place.dateIndex.toFixed(1)}</div>
          `;
          tooltipRef.current.style.display = 'block';
        }
      });
      marker.on('mouseout', () => {
        marker.setRadius(baseRadius);
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none';
        }
      });

      markersRef.current.push(marker);
    });
  }, [selectPlace, visiblePlaces]);

  useEffect(() => {
    if (!mapRef.current || !selectedPlace) {
      return;
    }
    mapRef.current.setView([selectedPlace.lat, selectedPlace.lng], 18, { animate: false });
  }, [selectedPlace]);

  useEffect(() => {
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    if (!mapRef.current || !origin) {
      return;
    }

    originMarkerRef.current = L.circleMarker([origin.lat, origin.lng], {
      radius: 9,
      fillColor: '#111827',
      color: '#ffffff',
      weight: 2.5,
      fillOpacity: 1,
    })
      .bindTooltip(origin.label ?? '출발점', { direction: 'top', offset: [0, -8] })
      .addTo(mapRef.current);
  }, [origin]);

  useEffect(() => {
    planMarkersRef.current.forEach((marker) => marker.remove());
    planMarkersRef.current = [];

    if (!mapRef.current || !selectedPlan) {
      return;
    }

    selectedPlan.places.forEach((place, index) => {
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 10,
        fillColor: index === 0 ? '#2563eb' : '#f97316',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 1,
      })
        .bindTooltip(`${index + 1}. ${place.name}`, { direction: 'top', offset: [0, -8] })
        .addTo(mapRef.current!);
      planMarkersRef.current.push(marker);
    });
  }, [selectedPlan]);

  useEffect(() => {
    if (!routeLayerRef.current) {
      return;
    }

    routeLayerRef.current.clearLayers();

    if (!routeResult || routeResult.segments.length === 0) {
      return;
    }

    routeResult.segments.forEach((segment) => {
      const isFallback = segment.kind === 'candidate_crossing' || segment.kind === 'implicit_local_crossing';
      L.polyline(segment.path, {
        color: segment.kind === 'approach' ? '#0f172a' : '#2563eb',
        weight: segment.kind === 'approach' ? 4 : 5,
        opacity: 0.88,
        dashArray: isFallback ? '10,8' : undefined,
      }).addTo(routeLayerRef.current!);
    });

    if (mapRef.current) {
      mapRef.current.fitBounds(routeResult.path, {
        padding: [42, 42],
        animate: false,
      });
    }
  }, [routeResult]);

  const loadLayer = useCallback(async (key: string) => {
    if (layerGroupsRef.current[key]) {
      return;
    }

    const config = LAYER_CONFIG[key];
    if (!config) {
      return;
    }

    try {
      const response = await fetch(`/geojson/${config.file}`);
      const data = await response.json();
      const group = L.layerGroup();

      if (data.type === 'FeatureCollection') {
        L.geoJSON(data, {
          style: () => ({
            color: config.color,
            weight: config.weight || 2,
            opacity: config.opacity || 0.6,
            fillOpacity: 0.08,
            dashArray: config.dashArray,
          }),
          pointToLayer: (_, latlng) => L.circleMarker(latlng, {
            radius: 3,
            fillColor: config.color,
            color: config.color,
            weight: 1,
            fillOpacity: 0.72,
          }),
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.DONG_NM
              || feature.properties?.EMD_NM
              || feature.properties?.name
              || feature.properties?.BUSSTOP_NM
              || '';
            if (name) {
              layer.bindTooltip(String(name), { sticky: true, opacity: 0.9 });
            }
          },
        }).addTo(group);
      }

      layerGroupsRef.current[key] = group;
    } catch (error) {
      console.error(`[map] Failed to load layer ${key}`, error);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    Object.entries(visibleLayers).forEach(([key, visible]) => {
      if (visible) {
        loadLayer(key).then(() => {
          const group = layerGroupsRef.current[key];
          if (group && mapRef.current && !mapRef.current.hasLayer(group)) {
            group.addTo(mapRef.current);
          }
        });
      } else {
        const group = layerGroupsRef.current[key];
        if (group && mapRef.current && mapRef.current.hasLayer(group)) {
          mapRef.current.removeLayer(group);
        }
      }
    });
  }, [loadLayer, visibleLayers]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" id="map" />
      {originSelectionMode === 'map' && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-slate-900/88 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          서비스 권역 안에서 출발점을 클릭해 주세요
        </div>
      )}
    </div>
  );
}
