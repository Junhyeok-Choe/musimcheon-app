'use client';

import { useState, useMemo } from 'react';
import { useMapStore } from '@/store/mapStore';
import { findRoute, buildAdjacencyList, buildCrosswalkIndex } from '@/utils/pathfinding';

export default function NavigationTab() {
  const startPoint = useMapStore((s) => s.startPoint);
  const destination = useMapStore((s) => s.destination);
  const routeResult = useMapStore((s) => s.routeResult);
  const routingGraph = useMapStore((s) => s.routingGraph);
  const crosswalks = useMapStore((s) => s.crosswalks);
  const restaurants = useMapStore((s) => s.restaurants);
  const setDestination = useMapStore((s) => s.setDestination);
  const setRouteResult = useMapStore((s) => s.setRouteResult);
  const resetNavigation = useMapStore((s) => s.resetNavigation);

  const [destSearch, setDestSearch] = useState('');

  // [NAV-01] Filter restaurants for destination search
  const filteredDest = useMemo(() => {
    if (!destSearch) return [];
    const q = destSearch.toLowerCase();
    return restaurants
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [destSearch, restaurants]);

  // [NAV-02] Calculate route with crosswalk awareness
  const handleFindRoute = () => {
    if (!startPoint || !destination || !routingGraph) return;

    const adj = buildAdjacencyList(routingGraph);

    // [NAV-02a] Build crosswalk index for routing penalty
    const crosswalkNodes = crosswalks.length > 0
      ? buildCrosswalkIndex(routingGraph.nodes, crosswalks)
      : undefined;

    const result = findRoute(
      startPoint.lat,
      startPoint.lng,
      destination.lat,
      destination.lng,
      routingGraph,
      adj,
      crosswalkNodes
    );

    if (crosswalkNodes) {
      console.log(`[NAV-02] Crosswalk-aware routing: ${crosswalkNodes.size}/${Object.keys(routingGraph.nodes).length} nodes near crosswalks`);
    }

    setRouteResult(result);
  };

  // [NAV-03] Reset
  const handleReset = () => {
    resetNavigation();
    setDestSearch('');
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* [NAV-04] Start point */}
      <div>
        <label className="text-[12px] font-medium text-slate-500 mb-1.5 block">
          출발지
        </label>
        <div className="px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-slate-50 text-slate-600">
          {startPoint
            ? `${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`
            : '지도를 클릭하여 출발지를 선택하세요'}
        </div>
      </div>

      {/* [NAV-05] Destination search */}
      <div className="relative">
        <label className="text-[12px] font-medium text-slate-500 mb-1.5 block">
          도착지 (식당)
        </label>
        <input
          type="text"
          value={destination ? destination.name : destSearch}
          onChange={(e) => {
            setDestSearch(e.target.value);
            if (destination) setDestination(null);
          }}
          placeholder="식당 이름 검색..."
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-500 transition-all"
        />

        {/* [NAV-05a] Dropdown */}
        {filteredDest.length > 0 && !destination && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
            {filteredDest.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setDestination(r);
                  setDestSearch('');
                }}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <div className="font-medium text-slate-700">{r.name}</div>
                <div className="text-[11px] text-slate-400">{r.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* [NAV-06] Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleFindRoute}
          disabled={!startPoint || !destination}
          className="flex-1 py-2.5 bg-blue-500 text-white text-[13px] font-medium rounded-lg disabled:bg-slate-200 disabled:text-slate-400 hover:bg-blue-600 transition-colors"
        >
          경로 찾기
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2.5 bg-slate-100 text-slate-600 text-[13px] font-medium rounded-lg hover:bg-slate-200 transition-colors"
        >
          초기화
        </button>
      </div>

      {/* [NAV-07] Route result */}
      {routeResult && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-[13px] font-medium text-blue-800 mb-2">
            경로 결과
          </div>
          <div className="flex gap-6">
            <div>
              <div className="text-[11px] text-blue-600">거리</div>
              <div className="text-[16px] font-bold text-blue-900">
                {routeResult.distance >= 1000
                  ? `${(routeResult.distance / 1000).toFixed(1)}km`
                  : `${routeResult.distance}m`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-blue-600">예상 시간</div>
              <div className="text-[16px] font-bold text-blue-900">
                {routeResult.time}분
              </div>
            </div>
          </div>
        </div>
      )}

      {routeResult === null && startPoint && destination && (
        <div className="p-3 bg-red-50 rounded-lg text-[13px] text-red-600">
          경로를 찾을 수 없습니다.
        </div>
      )}
    </div>
  );
}
