'use client';

import { useEffect, useMemo } from 'react';
import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS, CATEGORY_DISPLAY } from '@/utils/constants';
import { CategoryType, PlaceKind, Restaurant, SortMode } from '@/types';

const CATEGORIES = Object.keys(CATEGORY_COLORS) as CategoryType[];
const RESTAURANT_CATEGORIES = CATEGORIES.filter((category) => category !== 'cafe') as CategoryType[];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'dateIndex', label: '데이트지수' },
  { key: 'rating', label: '평점순' },
  { key: 'reviews', label: '리뷰순' },
  { key: 'name', label: '이름순' },
];

const PLACE_COPY: Record<
  PlaceKind,
  {
    title: string;
    description: string;
    placeholder: string;
  }
> = {
  restaurant: {
    title: '식사 후보',
    description: '플래너가 조합할 식당 후보군입니다. 프랜차이즈/패스트푸드 제외 결과만 보여줍니다.',
    placeholder: '식당 이름 검색...',
  },
  cafe: {
    title: '카페 후보',
    description: '식사 전후 대안으로 쓸 카페만 따로 분리했습니다.',
    placeholder: '카페 이름 검색...',
  },
};

function PlaceSwitch({
  active,
  title,
  count,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  count: number;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[18px] border px-4 py-4 text-left transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">{title}</div>
        <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-white/12 text-white' : 'bg-white text-slate-600'}`}>
          {count}개
        </div>
      </div>
      <div className={`mt-2 text-[12px] leading-5 ${active ? 'text-slate-200' : 'text-slate-500'}`}>
        {description}
      </div>
    </button>
  );
}

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
            {place.operatingScheduleSummary && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                운영정보 있음
              </span>
            )}
          </div>

          <div className="mt-3 truncate text-[12px] text-slate-500">{place.address}</div>
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

  const copy = PLACE_COPY[activePlaceKind];
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
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Place Explorer
        </div>
        <div className="mt-1 text-[20px] font-semibold text-slate-900">식당과 카페를 섞지 않고 봅니다</div>
        <div className="mt-2 text-[13px] leading-6 text-slate-500">
          목록은 탐색 전용입니다. 실제 동선 추천은 플래너에서 현재 위치와 영업시간을 함께 고려해 생성합니다.
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <PlaceSwitch
            active={activePlaceKind === 'restaurant'}
            title="식당"
            count={restaurants.length}
            description="식사 후보만 봅니다."
            onClick={() => setActivePlaceKind('restaurant')}
          />
          <PlaceSwitch
            active={activePlaceKind === 'cafe'}
            title="카페"
            count={cafes.length}
            description="카페 후보만 봅니다."
            onClick={() => setActivePlaceKind('cafe')}
          />
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[18px] font-semibold text-slate-900">{copy.title}</div>
            <div className="mt-1 text-[12px] leading-5 text-slate-500">{copy.description}</div>
          </div>

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
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.placeholder}
            className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
          />
        </div>

        {activePlaceKind === 'restaurant' && (
          <div className="mt-4 flex flex-wrap gap-2">
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

      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Results
            </div>
            <div className="mt-1 text-[18px] font-semibold text-slate-900">
              {list.length}개 결과
            </div>
          </div>
          <div className="text-[12px] text-slate-400">
            전체 {totalCount}개 · 정렬 {sortLabel}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {list.map((place) => (
            <PlaceCard
              key={`${place.placeKind}-${place.id}`}
              place={place}
              active={selectedPlace?.placeKind === place.placeKind && selectedPlace.id === place.id}
              onClick={() => selectPlace(place)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
