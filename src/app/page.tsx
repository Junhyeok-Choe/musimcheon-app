'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import InfoBox from '@/components/InfoBox';
import { useMapStore } from '@/store/mapStore';
import { buildRoiGeometry } from '@/utils/roi';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="text-sm text-slate-400">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const setRestaurants = useMapStore((state) => state.setRestaurants);
  const setCafes = useMapStore((state) => state.setCafes);
  const setRoutingGraph = useMapStore((state) => state.setRoutingGraph);
  const setValidatedCrosswalks = useMapStore((state) => state.setValidatedCrosswalks);
  const setCandidateCrosswalks = useMapStore((state) => state.setCandidateCrosswalks);
  const setRoiGeometry = useMapStore((state) => state.setRoiGeometry);
  const setLoading = useMapStore((state) => state.setLoading);
  const isLoading = useMapStore((state) => state.isLoading);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadError(null);

        const [
          restaurantsRes,
          cafesRes,
          graphRes,
          crosswalksRes,
          crosswalkCandidatesRes,
          adminDongsRes,
        ] = await Promise.all([
          fetch('/geojson/restaurants.geojson'),
          fetch('/geojson/cafes.geojson'),
          fetch('/geojson/routing_graph.json'),
          fetch('/geojson/crosswalks.geojson').catch(() => null),
          fetch('/geojson/crosswalk_candidates.geojson').catch(() => null),
          fetch('/geojson/admin_dongs.geojson'),
        ]);

        if (!restaurantsRes.ok || !cafesRes.ok || !graphRes.ok || !adminDongsRes.ok) {
          throw new Error('필수 GeoJSON 파일을 불러오지 못했습니다.');
        }

        const [restaurantsData, cafesData, graphData, adminDongsData] = await Promise.all([
          restaurantsRes.json(),
          cafesRes.json(),
          graphRes.json(),
          adminDongsRes.json(),
        ]);

        if (crosswalksRes?.ok) {
          const crosswalksData = await crosswalksRes.json();
          const coords = crosswalksData.features.map(
            (feature: { geometry: { coordinates: [number, number] } }) => feature.geometry.coordinates
          );
          setValidatedCrosswalks(coords);
        } else {
          setValidatedCrosswalks([]);
        }

        if (crosswalkCandidatesRes?.ok) {
          const candidateData = await crosswalkCandidatesRes.json();
          const coords = candidateData.features
            .filter((feature: { geometry?: { coordinates?: [number, number] }; properties?: { status?: string } }) => feature.geometry?.coordinates && feature.properties?.status !== 'rejected')
            .map((feature: { geometry: { coordinates: [number, number] } }) => feature.geometry.coordinates);
          setCandidateCrosswalks(coords);
        } else {
          setCandidateCrosswalks([]);
        }

        setRestaurants(restaurantsData);
        setCafes(cafesData);
        setRoutingGraph(graphData);
        setRoiGeometry(buildRoiGeometry(adminDongsData));
      } catch (error) {
        console.error('[page] Failed to load data', error);
        setLoadError(error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [
    setCandidateCrosswalks,
    setCafes,
    setLoading,
    setRestaurants,
    setRoiGeometry,
    setRoutingGraph,
    setValidatedCrosswalks,
  ]);

  return (
    <main className="h-[100dvh] overflow-hidden bg-slate-50 p-0 md:min-h-screen md:p-4">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white md:h-[calc(100vh-2rem)] md:flex-row md:rounded-[32px] md:border md:border-slate-200/60 md:shadow-[0_20px_60px_rgba(15,23,42,0.10)]">

        <Sidebar />

        <div className="relative isolate min-h-[42vh] flex-1 overflow-hidden bg-slate-100 md:min-h-0">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center bg-slate-50">
              <div className="text-[15px] font-medium text-slate-400">불러오는 중...</div>
            </div>
          ) : loadError ? (
            <div className="flex h-full w-full items-center justify-center bg-slate-50 p-6">
              <div className="max-w-md rounded-[20px] border border-rose-100 bg-white px-6 py-5">
                <div className="text-[18px] font-semibold text-slate-900">데이터 로딩 실패</div>
                <div className="mt-2 text-[14px] text-slate-600">{loadError}</div>
              </div>
            </div>
          ) : (
            <>
              <MapView />
              <InfoBox />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
