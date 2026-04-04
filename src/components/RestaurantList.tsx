'use client';

import { useEffect, useMemo } from 'react';
import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS, CATEGORY_DISPLAY } from '@/utils/constants';
import { CategoryType, Restaurant, SortMode } from '@/types';

const CATEGORIES = Object.keys(CATEGORY_COLORS) as CategoryType[];
const RESTAURANT_CATEGORIES = CATEGORIES.filter((category) => category !== 'cafe') as CategoryType[];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'dateIndex', label: '데이트지수' },
  { key: 'rating', label: '평점순' },
  { key: 'reviews', label: '리뷰순' },
  { key: 'name', label: '이름순' },
];

function PlaceCard({
  place,
  active,
  onClick,
}: {
  place: Restaurant;
  active: boolean;
  onClick: () => void;
}) {
  const color = CATEGORY_COLORS[place.category] || '#64748b';
  const totalReviews = place.reviewsKakao + place.reviewsNaver;

  return (
    <button
      id={`card-${place.placeKind}-${place.id}`}
      onClick={onClick}
      className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${
        active
          ? 'border-blue-200 bg-blue-50/70 shadow-[0_10px_28px_rgba(37,99,235,0.08)]'
          : 'border-slate-200/80 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-10 w-10 shrink-0 rounded-2xl"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-slate-900">{place.name}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ backgroundColor: `${color}14`, color }}
                >
                  {place.categoryDisplay}
                </span>
                <span>평점 {place.rating.toFixed(1)}</span>
                <span>리뷰 {totalReviews}</span>
              </div>
            </div>
            <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
              {place.dateIndex.toFixed(1)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {place.keywords.slice(0, 2).map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
              >
                {keyword}
              </span>
            ))}
          </div>

          <div className="mt-2 truncate text-[12px] text-slate-500">{place.address}</div>
        </div>
      </div>
    </button>
  );
}

export default function RestaurantList() {
  const restaurants = useMapStore((state) => state.restaurants);
  const cafes = useMapStore((state) => state.cafes);
  const activePlaceKind = useMapStore((state) => state.activePlaceKind);
  const setActivePlaceKind = useMapStore((state) => state.setActivePlaceKind);
  const searchQuery = useMapStore((state) => state.searchQuery);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const setActiveCategory = useMapStore((state) => state.setActiveCategory);
  const sortMode = useMapStore((state) => state.sortMode);
  const setSortMode = useMapStore((state) => state.setSortMode);
  const filteredPlaces = useMapStore((state) => state.filteredPlaces);
  const selectedPlace = useMapStore((state) => state.selectedPlace);
  const selectPlace = useMapStore((state) => state.selectPlace);

  const list = filteredPlaces();
  const totalCount = activePlaceKind === 'restaurant' ? restaurants.length : cafes.length;
  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.key === sortMode)?.label ?? '데이트지수',
    [sortMode]
  );

  useEffect(() => {
    if (!selectedPlace) {
      return;
    }

    const element = document.getElementById(`card-${selectedPlace.placeKind}-${selectedPlace.id}`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [selectedPlace]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActivePlaceKind('restaurant')}
          className={`rounded-[16px] border px-4 py-3 text-left transition ${
            activePlaceKind === 'restaurant'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">식당</span>
            <span className={`text-[12px] font-medium ${activePlaceKind === 'restaurant' ? 'text-slate-300' : 'text-slate-400'}`}>
              {restaurants.length}
            </span>
          </div>
        </button>
        <button
          onClick={() => setActivePlaceKind('cafe')}
          className={`rounded-[16px] border px-4 py-3 text-left transition ${
            activePlaceKind === 'cafe'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">카페</span>
            <span className={`text-[12px] font-medium ${activePlaceKind === 'cafe' ? 'text-slate-300' : 'text-slate-400'}`}>
              {cafes.length}
            </span>
          </div>
        </button>
      </div>

      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setSortMode(option.key)}
              className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                sortMode === option.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={activePlaceKind === 'restaurant' ? '식당 검색...' : '카페 검색...'}
            className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
          />
        </div>

        {activePlaceKind === 'restaurant' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {RESTAURANT_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  activeCategory === category
                    ? 'border-transparent text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
                style={activeCategory === category ? { backgroundColor: CATEGORY_COLORS[category] } : {}}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeCategory === category ? 'white' : CATEGORY_COLORS[category] }}
                />
                {CATEGORY_DISPLAY[category]}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[16px] font-semibold text-slate-900">
            {activePlaceKind === 'restaurant' ? '식당' : '카페'} {list.length}개
          </div>
          <div className="text-[12px] text-slate-400">
            전체 {totalCount} · {sortLabel}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
            조건에 맞는 결과가 없습니다.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {list.map((place) => (
              <PlaceCard
                key={`${place.placeKind}-${place.id}`}
                place={place}
                active={selectedPlace?.placeKind === place.placeKind && selectedPlace.id === place.id}
                onClick={() => selectPlace(place)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
