'use client';

import { useMemo } from 'react';
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
      <span className="w-[74px] shrink-0 text-[11px] font-medium text-slate-500">{label}</span>
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

  const summary = useMemo(() => {
    if (!place) return [];

    return [
      {
        label: '분위기',
        value: place.scoreAtmosphere,
        text: place.scoreAtmosphere >= 8 ? '분위기 점수가 높아 데이트 장소로 설명하기 좋습니다.' : '분위기 점수는 보통 수준입니다.',
      },
      {
        label: '소음',
        value: place.scoreNoise,
        text: place.scoreNoise >= 8 ? '대화가 가능한 조용한 장소로 해석할 수 있습니다.' : '정숙성은 다른 후보와 비교가 필요합니다.',
      },
      {
        label: '웨이팅',
        value: place.scoreWaiting,
        text: place.scoreWaiting >= 8 ? '대기 리스크가 낮은 편입니다.' : '웨이팅 가능성을 같이 설명하는 편이 안전합니다.',
      },
      {
        label: '방문목적',
        value: place.scoreVisitTarget,
        text: place.scoreVisitTarget >= 8 ? '데이트/연인 방문 맥락이 강하게 잡힙니다.' : '방문 목적 데이터는 강하지 않은 편입니다.',
      },
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);
  }, [place]);

  if (!place) return null;

  const color = CATEGORY_COLORS[place.category] || '#6b7280';
  const totalReviews = place.reviewsKakao + place.reviewsNaver;
  const kindLabel = place.placeKind === 'restaurant' ? '식당' : '카페';

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 md:inset-x-4 md:bottom-4">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-white/70 bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                style={{ backgroundColor: color }}
              >
                {place.placeKind === 'restaurant' ? '식당' : '카페'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[22px] font-bold leading-tight text-slate-900">{place.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 font-semibold"
                        style={{ backgroundColor: `${color}16`, color }}
                      >
                        {place.categoryDisplay}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                        {kindLabel}
                      </span>
                      <span>평점 {place.rating.toFixed(1)}</span>
                      <span>리뷰 {totalReviews}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => selectPlace(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  >
                    &times;
                  </button>
                </div>

                <div className="mt-3 text-[13px] leading-6 text-slate-500">{place.address}</div>

                {place.operatingScheduleSummary && (
                  <div className="mt-3 rounded-[18px] border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                    {place.operatingScheduleSummary}
                  </div>
                )}

                {place.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {place.keywords.slice(0, 5).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Why it stands out
              </div>
              <div className="mt-2 space-y-2 text-[13px] leading-6 text-slate-600">
                {summary.map((item) => (
                  <p key={item.label}>
                    <span className="font-semibold text-slate-900">{item.label}</span>
                    {' '}
                    {item.text}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 md:w-[320px]">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] p-4 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">
                  Date Index
                </div>
                <div className="mt-1 text-[15px] font-semibold text-slate-900">점수 분해</div>
              </div>
              <div className="text-[28px] font-bold leading-none text-rose-600">
                  {place.dateIndex.toFixed(1)}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
                <ScoreBar label="분위기" value={place.scoreAtmosphere} color="#ec4899" />
                <ScoreBar label="소음" value={place.scoreNoise} color="#8b5cf6" />
                <ScoreBar label="웨이팅" value={place.scoreWaiting} color="#10b981" />
                <ScoreBar label="방문목적" value={place.scoreVisitTarget} color="#f59e0b" />
                <ScoreBar label="맛" value={place.scoreTaste} color="#3b82f6" />
                <ScoreBar label="서비스" value={place.scoreService} color="#0ea5e9" />
                <ScoreBar label="거리" value={place.scoreDistance} color="#6366f1" />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <a
                href={place.kakaoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-[18px] bg-[#FEE500] px-4 py-3 text-center text-[12px] font-semibold text-[#191919] transition-all hover:brightness-95"
              >
                카카오맵
              </a>
              <a
                href={place.naverLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-[18px] bg-[#03C75A] px-4 py-3 text-center text-[12px] font-semibold text-white transition-all hover:brightness-95"
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
