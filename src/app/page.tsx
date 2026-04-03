'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import InfoBox from '@/components/InfoBox';
import { useMapStore } from '@/store/mapStore';

// [PAGE-01] Dynamic import MapView - no SSR (Leaflet requires window)
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const setRestaurants = useMapStore((s) => s.setRestaurants);
  const setRoutingGraph = useMapStore((s) => s.setRoutingGraph);
  const setCrosswalks = useMapStore((s) => s.setCrosswalks);
  const setLoading = useMapStore((s) => s.setLoading);
  const isLoading = useMapStore((s) => s.isLoading);

  // [PAGE-02] Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        console.log('[PAGE-02] Loading data...');
        const [restaurantsRes, graphRes, cafesRes, crosswalksRes] = await Promise.all([
          fetch('/geojson/restaurants.geojson'),
          fetch('/geojson/routing_graph.json'),
          fetch('/geojson/cafes.geojson').catch(() => null),
          fetch('/geojson/crosswalks.geojson').catch(() => null),
        ]);

        const restaurantsData = await restaurantsRes.json();
        const graphData = await graphRes.json();

        // [PAGE-02a] Merge cafes into restaurants if available
        if (cafesRes && cafesRes.ok) {
          const cafesData = await cafesRes.json();
          if (cafesData.features && cafesData.features.length > 0) {
            restaurantsData.features = [
              ...restaurantsData.features,
              ...cafesData.features,
            ];
            console.log(`[PAGE-02] Merged ${cafesData.features.length} cafes`);
          }
        }

        // [PAGE-02b] Load crosswalk coordinates for pathfinding
        if (crosswalksRes && crosswalksRes.ok) {
          const crosswalksData = await crosswalksRes.json();
          const coords = crosswalksData.features.map(
            (f: { geometry: { coordinates: [number, number] } }) => f.geometry.coordinates
          );
          setCrosswalks(coords);
          console.log(`[PAGE-02] Loaded ${coords.length} crosswalk locations`);
        }

        setRestaurants(restaurantsData);
        setRoutingGraph(graphData);
        console.log(`[PAGE-02] Loaded ${restaurantsData.features.length} total places, ${Object.keys(graphData.nodes).length} routing nodes`);
      } catch (err) {
        console.error('[PAGE-02] Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [setRestaurants, setRoutingGraph, setCrosswalks, setLoading]);

  return (
    <main className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-50">
            <div className="text-slate-400 text-sm">데이터 로딩 중...</div>
          </div>
        ) : (
          <MapView />
        )}
      </div>
      <InfoBox />
    </main>
  );
}
