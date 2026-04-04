'use client';

import { useMapStore } from '@/store/mapStore';
import { CATEGORY_COLORS } from '@/utils/constants';

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[60px] shrink-0 text-[11px] font-medium text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, (value / 10) * 100))}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-9 text-right text-[11px] font-semibold text-slate-700">{value.toFixed(1)}</span>
    </div>
  );
}

export default function InfoBox() {
  const place = useMapStore((s) => s.selectedPlace);
  const selectPlace = useMapStore((s) => s.selectPlace);

  if (!place) return null;

  const color = CATEGORY_COLORS[place.category] || '#6b7280';
  const totalReviews = place.reviewsKakao + place.reviewsNaver;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1100] md:inset-x-4 md:bottom-4">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-[24px] border border-white/70 bg-white/94 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[20px] font-bold leading-tight text-slate-900">{place.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 font-semibold"
                    style={{ backgroundColor: `${color}16`, color }}
                  >
                    {place.categoryDisplay}
                  </span>
                  <span>평점 {place.rating.toFixed(1)}</span>
                  <span>리뷰 {totalReviews}</span>
                </div>
              </div>

              <button
                onClick={() => selectPlace(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                &times;
              </button>
            </div>

            <div className="mt-2 text-[13px] text-slate-500">{place.address}</div>

            {place.operatingScheduleSummary && (
              <div className="mt-2 rounded-[14px] border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                {place.operatingScheduleSummary}
              </div>
            )}

            {place.keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {place.keywords.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="w-full shrink-0 md:w-[280px]">
            <div className="rounded-[20px] bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-slate-700">데이트 지수</span>
                <span className="text-[26px] font-bold leading-none text-rose-600">
                  {place.dateIndex.toFixed(1)}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                <ScoreBar label="분위기" value={place.scoreAtmosphere} color="#ec4899" />
                <ScoreBar label="소음" value={place.scoreNoise} color="#8b5cf6" />
                <ScoreBar label="웨이팅" value={place.scoreWaiting} color="#10b981" />
                <ScoreBar label="맛" value={place.scoreTaste} color="#3b82f6" />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <a
                href={place.kakaoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-[14px] bg-[#FEE500] px-4 py-2.5 text-center text-[12px] font-semibold text-[#191919] transition-all hover:brightness-95"
              >
                카카오맵
              </a>
              <a
                href={place.naverLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-[14px] bg-[#03C75A] px-4 py-2.5 text-center text-[12px] font-semibold text-white transition-all hover:brightness-95"
              >
                네이버지도
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
