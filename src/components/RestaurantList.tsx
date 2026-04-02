'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS, CATEGORY_DISPLAY } from '@/utils/constants';
import { CategoryType, SortMode } from '@/types';

const CATEGORIES = Object.keys(CATEGORY_COLORS) as CategoryType[];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'dateIndex', label: '데이트지수' },
  { key: 'rating', label: '평점순' },
  { key: 'reviews', label: '리뷰순' },
  { key: 'name', label: '이름순' },
];

export default function RestaurantList() {
  const searchQuery = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const activeCategory = useMapStore((s) => s.activeCategory);
  const setActiveCategory = useMapStore((s) => s.setActiveCategory);
  const sortMode = useMapStore((s) => s.sortMode);
  const setSortMode = useMapStore((s) => s.setSortMode);
  const selectRestaurant = useMapStore((s) => s.selectRestaurant);
  const selectedRestaurant = useMapStore((s) => s.selectedRestaurant);
  const filteredRestaurants = useMapStore((s) => s.filteredRestaurants);
  const listRef = useRef<HTMLDivElement>(null);

  const list = filteredRestaurants();

  // [LIST-01] Scroll selected card into view
  useEffect(() => {
    if (!selectedRestaurant) return;
    const el = document.getElementById(`card-${selectedRestaurant.id}`);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [selectedRestaurant]);

  const handleCategoryClick = useCallback(
    (cat: CategoryType) => {
      setActiveCategory(activeCategory === cat ? null : cat);
    },
    [activeCategory, setActiveCategory]
  );

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* [LIST-02] Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="식당 이름 검색..."
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
      />

      {/* [LIST-03] Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              activeCategory === cat
                ? 'border-transparent text-white'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
            style={
              activeCategory === cat
                ? { backgroundColor: CATEGORY_COLORS[cat] }
                : {}
            }
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            {CATEGORY_DISPLAY[cat]}
          </button>
        ))}
      </div>

      {/* [LIST-04] Sort buttons */}
      <div className="flex gap-1.5">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortMode(opt.key)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              sortMode === opt.key
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* [LIST-05] Count */}
      <div className="text-[12px] text-slate-400">
        {list.length}개 장소
      </div>

      {/* [LIST-06] Restaurant cards */}
      <div ref={listRef} className="flex flex-col gap-2">
        {list.map((r) => {
          const color = CATEGORY_COLORS[r.category] || '#6b7280';
          const isActive = selectedRestaurant?.id === r.id;
          const totalReviews = r.reviewsKakao + r.reviewsNaver;

          return (
            <div
              key={r.id}
              id={`card-${r.id}`}
              onClick={() => selectRestaurant(r)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-semibold text-[14px] text-slate-800 truncate">
                  {r.name}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mb-1">
                {r.categoryDisplay}
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-amber-500 font-medium">
                  {r.rating.toFixed(1)}
                </span>
                <span className="text-slate-400">
                  리뷰 {totalReviews}
                </span>
                {r.dateIndex > 0 && (
                  <span className="ml-auto text-rose-500 font-semibold text-[12px]">
                    {r.dateIndex.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
