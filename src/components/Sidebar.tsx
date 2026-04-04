'use client';

import { useMapStore } from '@/store/mapStore';
import { TabType } from '@/types';
import LayersTab from './LayersTab';
import NavigationTab from './NavigationTab';
import RestaurantList from './RestaurantList';

const TABS: { key: TabType; label: string }[] = [
  { key: 'restaurants', label: '장소' },
  { key: 'navigation', label: '플래너' },
  { key: 'layers', label: '레이어' },
];

export default function Sidebar() {
  const activeTab = useMapStore((state) => state.activeTab);
  const setActiveTab = useMapStore((state) => state.setActiveTab);
  const restaurants = useMapStore((state) => state.restaurants);
  const cafes = useMapStore((state) => state.cafes);
  const activePlaceKind = useMapStore((state) => state.activePlaceKind);
  const filteredCount = useMapStore((state) => state.filteredPlaces().length);
  const activeLabel = activePlaceKind === 'restaurant' ? '식당' : '카페';

  return (
    <aside className="z-10 flex h-[52vh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200/70 bg-white/84 backdrop-blur-xl md:h-full md:w-[430px] md:border-b-0 md:border-r">
      <div className="shrink-0 border-b border-slate-200/70 px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Musimcheon Planner
          </div>
          <h1 className="mt-2 text-[22px] font-semibold leading-[1.2] text-slate-900 md:text-[24px]">
            무심천 데이트 플래너
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">
            서비스 권역 안에서 출발점을 정하고, 식당과 카페 후보를 분리해서 본 뒤 실현 가능한 옵션만 골라 제안합니다.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                식당
              </div>
              <div className="mt-1 text-[20px] font-semibold text-slate-900">{restaurants.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                카페
              </div>
              <div className="mt-1 text-[20px] font-semibold text-slate-900">{cafes.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                현재 보기
              </div>
              <div className="mt-1 text-[20px] font-semibold text-slate-900">{filteredCount}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm">
              현재 섹션 {activeLabel}
            </div>
            <div className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm">
              후보 {filteredCount}개
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 rounded-[22px] bg-slate-100/90 p-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-[18px] px-3 py-2.5 text-[13px] font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'restaurants' && <RestaurantList />}
        {activeTab === 'navigation' && <NavigationTab />}
        {activeTab === 'layers' && <LayersTab />}
      </div>
    </aside>
  );
}
