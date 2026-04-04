'use client';

import { useMapStore } from '@/store/mapStore';
import { TabType } from '@/types';
import LayersTab from './LayersTab';
import PlannerPanel from './PlannerPanel';
import RestaurantList from './RestaurantList';

const TABS: { key: TabType; label: string }[] = [
  { key: 'restaurants', label: '장소' },
  { key: 'planner', label: '플래너' },
  { key: 'layers', label: '레이어' },
];

export default function Sidebar() {
  const activeTab = useMapStore((state) => state.activeTab);
  const setActiveTab = useMapStore((state) => state.setActiveTab);

  return (
    <aside className="z-10 flex h-[52vh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200/70 bg-white/84 backdrop-blur-xl md:h-full md:w-[430px] md:border-b-0 md:border-r">
      <div className="shrink-0 border-b border-slate-200/70 px-4 pb-3 pt-4 md:px-5 md:pb-4 md:pt-5">
        <h1 className="text-[20px] font-semibold text-slate-900">무심천 데이트코스</h1>

        <div className="mt-3 flex gap-2 rounded-[22px] bg-slate-100/90 p-1.5">
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
        {activeTab === 'planner' && <PlannerPanel />}
        {activeTab === 'layers' && <LayersTab />}
      </div>
    </aside>
  );
}
