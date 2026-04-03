'use client';

import { useMemo, useState } from 'react';
import { useMapStore } from '@/store/mapStore';
import { Restaurant } from '@/types';
import { buildAdjacencyList, findRoute } from '@/utils/pathfinding';

function filterRestaurants(restaurants: Restaurant[], query: string, excludeId?: number) {
  if (!query) return [];

  const normalized = query.toLowerCase();
  return restaurants
    .filter((restaurant) => restaurant.category !== 'cafe')
    .filter((restaurant) => !restaurant.excludeReason)
    .filter((restaurant) => (excludeId === undefined ? true : restaurant.id !== excludeId))
    .filter((restaurant) => restaurant.name.toLowerCase().includes(normalized))
    .slice(0, 8);
}

function SearchResultList({
  restaurants,
  onSelect,
}: {
  restaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
}) {
  if (restaurants.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
      {restaurants.map((restaurant) => (
        <button
          key={restaurant.id}
          onClick={() => onSelect(restaurant)}
          className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-800">{restaurant.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{restaurant.address}</div>
        </button>
      ))}
    </div>
  );
}

function SelectedPlace({
  title,
  restaurant,
}: {
  title: string;
  restaurant: Restaurant | null;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      {restaurant ? (
        <>
          <div className="mt-1 text-[15px] font-bold text-slate-900">{restaurant.name}</div>
          <div className="mt-1 text-[12px] text-slate-500">{restaurant.address}</div>
          <div className="mt-2 flex gap-2 text-[11px]">
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-amber-600 shadow-sm">
              평점 {restaurant.rating.toFixed(1)}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-rose-600 shadow-sm">
              데이트 {restaurant.dateIndex.toFixed(1)}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-1 text-[13px] text-slate-400">아직 선택되지 않았습니다.</div>
      )}
    </div>
  );
}

export default function NavigationTab() {
  const startRestaurant = useMapStore((s) => s.startRestaurant);
  const destination = useMapStore((s) => s.destination);
  const routeResult = useMapStore((s) => s.routeResult);
  const routingGraph = useMapStore((s) => s.routingGraph);
  const crosswalks = useMapStore((s) => s.crosswalks);
  const restaurants = useMapStore((s) => s.restaurants);
  const setStartRestaurant = useMapStore((s) => s.setStartRestaurant);
  const setDestination = useMapStore((s) => s.setDestination);
  const setRouteResult = useMapStore((s) => s.setRouteResult);
  const resetNavigation = useMapStore((s) => s.resetNavigation);

  const [startSearch, setStartSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [hasAttemptedRoute, setHasAttemptedRoute] = useState(false);

  const filteredStart = useMemo(
    () => filterRestaurants(restaurants, startSearch, destination?.id),
    [destination?.id, restaurants, startSearch]
  );

  const filteredDest = useMemo(
    () => filterRestaurants(restaurants, destSearch, startRestaurant?.id),
    [destSearch, restaurants, startRestaurant?.id]
  );

  const resetRouteState = () => {
    setHasAttemptedRoute(false);
    setRouteResult(null);
  };

  const handleFindRoute = () => {
    if (!startRestaurant || !destination || !routingGraph) return;

    const adjacencyList = buildAdjacencyList(routingGraph, crosswalks);

    const result = findRoute(
      startRestaurant.lat,
      startRestaurant.lng,
      destination.lat,
      destination.lng,
      routingGraph,
      adjacencyList
    );

    setHasAttemptedRoute(true);
    setRouteResult(result);
  };

  const handleReset = () => {
    resetNavigation();
    setStartSearch('');
    setDestSearch('');
    setHasAttemptedRoute(false);
  };

  const selectOrigin = (restaurant: Restaurant) => {
    setStartRestaurant(restaurant);
    setStartSearch('');
    resetRouteState();
  };

  const selectDestination = (restaurant: Restaurant) => {
    setDestination(restaurant);
    setDestSearch('');
    resetRouteState();
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
          Navigation
        </div>
        <div className="mt-1 text-[20px] font-bold text-slate-900">
          식당에서 식당으로 바로 걷는 경로
        </div>
        <div className="mt-2 text-[13px] leading-6 text-slate-500">
          출발지와 도착지를 모두 검색으로 고른 뒤 경로를 계산합니다. 횡단보도 좌표가 있으면 경로 계산에 같이 반영됩니다.
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white">
                1
              </div>
              <div>
                <div className="text-[15px] font-bold text-slate-900">출발 식당 선택</div>
                <div className="text-[12px] text-slate-500">검색 결과에서 한 곳을 고릅니다.</div>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={startRestaurant ? startRestaurant.name : startSearch}
                onChange={(event) => {
                  setStartSearch(event.target.value);
                  if (startRestaurant) {
                    setStartRestaurant(null);
                  }
                  resetRouteState();
                }}
                placeholder="출발 식당 이름 검색..."
                className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />

              {!startRestaurant && (
                <SearchResultList restaurants={filteredStart} onSelect={selectOrigin} />
              )}
            </div>

            <div className="mt-3">
              <SelectedPlace title="Origin" restaurant={startRestaurant} />
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-[13px] font-bold text-white">
                2
              </div>
              <div>
                <div className="text-[15px] font-bold text-slate-900">도착 식당 선택</div>
                <div className="text-[12px] text-slate-500">같은 방식으로 도착지를 고릅니다.</div>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={destination ? destination.name : destSearch}
                onChange={(event) => {
                  setDestSearch(event.target.value);
                  if (destination) {
                    setDestination(null);
                  }
                  resetRouteState();
                }}
                placeholder="도착 식당 이름 검색..."
                className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />

              {!destination && (
                <SearchResultList restaurants={filteredDest} onSelect={selectDestination} />
              )}
            </div>

            <div className="mt-3">
              <SelectedPlace title="Destination" restaurant={destination} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleFindRoute}
            disabled={!startRestaurant || !destination}
            className="flex-1 rounded-[18px] bg-slate-900 px-4 py-3 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            경로 찾기
          </button>
          <button
            onClick={handleReset}
            className="rounded-[18px] bg-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-600 transition-all hover:bg-slate-200"
          >
            초기화
          </button>
        </div>
      </section>

      {routeResult && (
        <section className="rounded-[24px] border border-blue-100 bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)] p-4 shadow-[0_12px_30px_rgba(37,99,235,0.08)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
            Route Result
          </div>
          <div className="mt-1 text-[18px] font-bold text-slate-900">보행 경로 계산 완료</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">
                Distance
              </div>
              <div className="mt-1 text-[22px] font-bold text-slate-900">
                {routeResult.distance >= 1000
                  ? `${(routeResult.distance / 1000).toFixed(1)}km`
                  : `${routeResult.distance}m`}
              </div>
            </div>

            <div className="rounded-[20px] bg-white px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">
                Time
              </div>
              <div className="mt-1 text-[22px] font-bold text-slate-900">{routeResult.time}분</div>
            </div>
          </div>
        </section>
      )}

      {hasAttemptedRoute && routeResult === null && startRestaurant && destination && (
        <div className="rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
          현재 조건에서는 연결 가능한 경로를 찾지 못했습니다.
        </div>
      )}
    </div>
  );
}
