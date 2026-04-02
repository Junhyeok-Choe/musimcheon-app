'use client';

import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS } from '@/utils/constants';

export default function InfoBox() {
  const restaurant = useMapStore((s) => s.selectedRestaurant);
  const selectRestaurant = useMapStore((s) => s.selectRestaurant);

  if (!restaurant) return null;

  const color = CATEGORY_COLORS[restaurant.category] || '#6b7280';

  return (
    <div className="fixed bottom-4 right-4 left-[416px] bg-white rounded-xl shadow-lg z-50 flex gap-5 p-4 items-start">
      {/* [INFO-01] Main content */}
      <div className="flex-1 min-w-0">
        {/* [INFO-01a] Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-[17px] font-bold text-slate-800">{restaurant.name}</h3>
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white mt-1"
              style={{ backgroundColor: color }}
            >
              {restaurant.categoryDisplay}
            </span>
          </div>
          <button
            onClick={() => selectRestaurant(null)}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none pl-2"
          >
            &times;
          </button>
        </div>

        {/* [INFO-01b] Rating and reviews */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-amber-500 font-bold text-[22px] leading-none">
            {restaurant.rating.toFixed(1)}
          </span>
          <div className="flex items-center gap-0.5 text-amber-400 text-[14px]">
            {'★'.repeat(Math.floor(restaurant.rating))}
            {restaurant.rating % 1 >= 0.5 ? '✦' : ''}
          </div>
          <div className="flex gap-3 text-[12px] text-slate-400 ml-1">
            <span>카카오 {restaurant.reviewsKakao}</span>
            <span>네이버 {restaurant.reviewsNaver}</span>
          </div>
        </div>

        {/* [INFO-01c] Address */}
        <div className="text-[12px] text-slate-500">{restaurant.address}</div>
      </div>

      {/* [INFO-02] Side content */}
      <div className="flex-shrink-0 w-[280px] flex flex-col gap-2">
        {/* [INFO-02a] Date Index Score */}
        {restaurant.dateIndex > 0 && (
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-rose-700">Date Index</span>
              <span className="text-[20px] font-bold text-rose-600">{restaurant.dateIndex.toFixed(1)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Atmosphere', value: restaurant.scoreAtmosphere, color: '#f472b6' },
                { label: 'Noise (quiet)', value: restaurant.scoreNoise, color: '#a78bfa' },
                { label: 'Waiting', value: restaurant.scoreWaiting, color: '#34d399' },
                { label: 'Distance', value: restaurant.scoreDistance, color: '#60a5fa' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-[70px] shrink-0">{item.label}</span>
                  <div className="flex-1 bg-slate-200 rounded-full h-[5px] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(item.value / 10) * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 w-[22px] text-right">{item.value.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* [INFO-02b] Keywords */}
        {restaurant.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {restaurant.keywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px]"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* [INFO-02c] External links */}
        <div className="flex gap-1.5">
          <a
            href={restaurant.kakaoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 bg-[#FEE500] text-[#191919] text-[12px] font-medium rounded-lg hover:brightness-95 transition-all"
          >
            카카오맵
          </a>
          <a
            href={restaurant.naverLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 bg-[#03C75A] text-white text-[12px] font-medium rounded-lg hover:brightness-95 transition-all"
          >
            네이버지도
          </a>
        </div>
      </div>
    </div>
  );
}
