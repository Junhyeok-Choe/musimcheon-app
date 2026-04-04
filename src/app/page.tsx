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
    <main className="h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-0 md:min-h-screen md:p-4">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white md:h-[calc(100vh-2rem)] md:flex-row md:rounded-[32px] md:border md:border-white/60 md:shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_22%)]" />

        <Sidebar />

        <div className="relative min-h-[42vh] flex-1 overflow-hidden bg-slate-100 md:min-h-0">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_42%,#e2e8f0_100%)]">
              <div className="max-w-sm rounded-[28px] border border-white/70 bg-white/84 px-8 py-7 text-center shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Musimcheon
                </div>
                <div className="text-[22px] font-bold text-slate-900">플래너와 보행 그래프를 불러오는 중</div>
                <div className="mt-2 text-[13px] leading-6 text-slate-500">
                  식당, 카페, 서비스 권역, 횡단보도 레이어를 정리하고 있습니다.
                </div>
              </div>
            </div>
          ) : loadError ? (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#fff1f2_0%,#f8fafc_45%,#eff6ff_100%)] p-6">
              <div className="max-w-md rounded-[28px] border border-rose-100 bg-white px-7 py-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">
                  Load Error
                </div>
                <div className="mt-2 text-[22px] font-bold text-slate-900">초기 데이터 로딩에 실패했습니다</div>
                <div className="mt-3 text-[14px] leading-6 text-slate-600">{loadError}</div>
              </div>
            </div>
          ) : (
            <>
              <MapView />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.34),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_22%,rgba(15,23,42,0.14))]" />
              <div className="pointer-events-none absolute left-4 top-4 hidden md:block">
                <div className="rounded-full border border-white/60 bg-white/84 px-4 py-2 text-[12px] font-semibold text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.10)] backdrop-blur">
                  현재 위치 기준 optional plan · ROI 검증 · 안전 보행 라우팅
                </div>
              </div>
              <InfoBox />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
