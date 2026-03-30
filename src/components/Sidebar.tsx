'use client';

import { useMapStore } from '@/store/mapStore';
import { TabType } from '@/types';
import RestaurantList from './RestaurantList';
import NavigationTab from './NavigationTab';
import LayersTab from './LayersTab';

const TABS: { key: TabType; label: string }[] = [
  { key: 'restaurants', label: '식당 목록' },
  { key: 'navigation', label: '길찾기' },
  { key: 'layers', label: '레이어' },
];

export default function Sidebar() {
  const activeTab = useMapStore((s) => s.activeTab);
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  return (
    <aside className="w-[400px] bg-white border-r border-slate-100 flex flex-col shadow-sm z-10 h-screen">
      {/* [SIDEBAR-01] Tab bar */}
      <div className="flex gap-2 p-3 border-b border-slate-100">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-4 text-[13px] font-medium rounded-full transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-500 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* [SIDEBAR-02] Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'restaurants' && <RestaurantList />}
        {activeTab === 'navigation' && <NavigationTab />}
        {activeTab === 'layers' && <LayersTab />}
      </div>
    </aside>
  );
}
