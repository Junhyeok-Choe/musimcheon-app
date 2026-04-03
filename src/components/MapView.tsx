'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS, MAP_CENTER, MAP_ZOOM, LAYER_CONFIG } from '@/utils/constants';
import { buildAdjacencyList } from '@/utils/pathfinding';

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const adjacencyListRef = useRef<Record<string, { to: string; dist: number }[]>>({});
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const {
    restaurants,
    cafes,
    activePlaceKind,
    routingGraph,
    selectedPlace,
    visibleLayers,
    startRestaurant,
    routeResult,
    selectPlace,
  } = useMapStore();

  const visiblePlaces = activePlaceKind === 'restaurant' ? restaurants : cafes;

  // [MAP-01] Initialize Leaflet map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView(MAP_CENTER, MAP_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CartoDB',
      maxZoom: 19,
    }).addTo(map);

    // [MAP-01a] Route layer group
    routeLayerRef.current = L.layerGroup().addTo(map);

    // [MAP-01b] Custom tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'map-tooltip';
    tooltipEl.style.cssText = `
      position: fixed; display: none; pointer-events: none; z-index: 1000;
      background: rgba(20,20,20,0.92); color: white; padding: 8px 12px;
      border-radius: 8px; font-size: 12px; max-width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(tooltipEl);
    tooltipRef.current = tooltipEl;

    map.getContainer().addEventListener('mousemove', (e: MouseEvent) => {
      if (tooltipEl.style.display !== 'none') {
        tooltipEl.style.left = e.clientX + 12 + 'px';
        tooltipEl.style.top = e.clientY - 10 + 'px';
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      tooltipEl.remove();
      mapRef.current = null;
    };
  }, []);

  // [MAP-02] Render restaurant markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || visiblePlaces.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    visiblePlaces.forEach((r) => {
      const color = CATEGORY_COLORS[r.category] || '#6b7280';
      const baseRadius = r.placeKind === 'cafe'
        ? Math.max(4, Math.round(r.rating * 1.3))
        : Math.max(3, Math.round(r.rating * 1.6));
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: baseRadius,
        fillColor: color,
        color: 'white',
        weight: r.placeKind === 'cafe' ? 2.5 : 1.5,
        fillOpacity: r.placeKind === 'cafe' ? 0.72 : 0.9,
      }).addTo(map);

      // [MAP-02a] Click handler
      marker.on('click', () => {
        selectPlace(r);
      });

      // [MAP-02b] Hover tooltip
      marker.on('mouseover', () => {
        marker.setRadius(baseRadius + 4);
        if (tooltipRef.current) {
          tooltipRef.current.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${r.name}</div>
            <div style="font-size:11px;color:#94a3b8">${r.placeKind === 'restaurant' ? '식당' : '카페'} · ${r.categoryDisplay}</div>
            <div style="font-size:11px;color:#fbbf24">${r.rating.toFixed(1)}</div>
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
  }, [visiblePlaces, selectPlace]);

  // [MAP-03] Pan to selected restaurant
  useEffect(() => {
    if (!mapRef.current || !selectedPlace) return;
    mapRef.current.setView([selectedPlace.lat, selectedPlace.lng], 18, { animate: false });
  }, [selectedPlace]);

  // [MAP-04] Render start point marker
  useEffect(() => {
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (!mapRef.current || !startRestaurant) return;

    startMarkerRef.current = L.circleMarker([startRestaurant.lat, startRestaurant.lng], {
      radius: 8,
      fillColor: '#22c55e',
      color: 'white',
      weight: 2,
      fillOpacity: 1,
    }).addTo(mapRef.current);
  }, [startRestaurant]);

  // [MAP-05] Render route
  useEffect(() => {
    if (!routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (!routeResult || routeResult.path.length === 0) return;

    L.polyline(routeResult.path, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.8,
    }).addTo(routeLayerRef.current);
  }, [routeResult]);

  // [MAP-06] Load and manage GeoJSON layers
  const loadLayer = useCallback(async (key: string) => {
    if (layerGroupsRef.current[key]) return;

    const config = LAYER_CONFIG[key];
    if (!config) return;

    try {
      const res = await fetch(`/geojson/${config.file}`);
      const data = await res.json();

      const group = L.layerGroup();

      // [MAP-06a] Handle different geometry types
      if (data.type === 'FeatureCollection') {
        L.geoJSON(data, {
          style: () => ({
            color: config.color,
            weight: config.weight || 2,
            opacity: config.opacity || 0.6,
            fillOpacity: 0.1,
            dashArray: config.dashArray,
          }),
          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 3,
              fillColor: config.color,
              color: config.color,
              weight: 1,
              fillOpacity: 0.7,
            });
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.DONG_NM || feature.properties?.name || feature.properties?.BUSSTOP_NM || '';
            if (name) {
              layer.bindTooltip(name, { sticky: true, opacity: 0.9 });
            }
          },
        }).addTo(group);
      }

      layerGroupsRef.current[key] = group;
    } catch (err) {
      console.error(`[MAP-06] Failed to load layer ${key}:`, err);
    }
  }, []);

  // [MAP-07] Toggle layer visibility
  useEffect(() => {
    if (!mapRef.current) return;

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
        if (group && mapRef.current?.hasLayer(group)) {
          mapRef.current.removeLayer(group);
        }
      }
    });
  }, [visibleLayers, loadLayer]);

  // [MAP-08] Build adjacency list when routing graph loads
  useEffect(() => {
    if (!routingGraph) return;
    adjacencyListRef.current = buildAdjacencyList(routingGraph);
    console.log(`[MAP-08] Adjacency list built: ${Object.keys(adjacencyListRef.current).length} nodes`);
  }, [routingGraph]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" id="map" />
  );
}
