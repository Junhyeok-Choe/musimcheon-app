'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapStore } from '@/store/mapStore';
import { buildAdjacencyList, routeFailureMessage } from '@/utils/pathfinding';
import { generatePlanOptions } from '@/utils/planner';
import { getRoiValidationError, isPointInRoi } from '@/utils/roi';
import { RouteConfidence } from '@/types';

function confidenceBadge(confidence: RouteConfidence) {
  if (confidence === 'high') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (confidence === 'medium') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-rose-50 text-rose-700';
}

function originSourceLabel(source: string) {
  if (source === 'device_location') {
    return '현재 위치';
  }
  if (source === 'map_point') {
    return '지도 지정';
  }
  return '디버그 위치';
}

export default function PlannerPanel() {
  const routingGraph = useMapStore((state) => state.routingGraph);
  const restaurants = useMapStore((state) => state.restaurants);
  const cafes = useMapStore((state) => state.cafes);
  const validatedCrosswalks = useMapStore((state) => state.validatedCrosswalks);
  const candidateCrosswalks = useMapStore((state) => state.candidateCrosswalks);
  const roiGeometry = useMapStore((state) => state.roiGeometry);
  const origin = useMapStore((state) => state.origin);
  const originSelectionMode = useMapStore((state) => state.originSelectionMode);
  const plannerInput = useMapStore((state) => state.plannerInput);
  const plannerError = useMapStore((state) => state.plannerError);
  const planOptions = useMapStore((state) => state.planOptions);
  const selectedPlan = useMapStore((state) => state.selectedPlan);
  const setOrigin = useMapStore((state) => state.setOrigin);
  const setOriginSelectionMode = useMapStore((state) => state.setOriginSelectionMode);
  const setPlannerRequestedStartTime = useMapStore((state) => state.setPlannerRequestedStartTime);
  const setPlannerError = useMapStore((state) => state.setPlannerError);
  const setPlanOptions = useMapStore((state) => state.setPlanOptions);
  const setSelectedPlan = useMapStore((state) => state.setSelectedPlan);
  const selectPlace = useMapStore((state) => state.selectPlace);
  const resetPlanner = useMapStore((state) => state.resetPlanner);
  const [isLocating, setIsLocating] = useState(false);
  const debugOriginAppliedRef = useRef(false);

  const adjacencyGraph = useMemo(() => {
    if (!routingGraph) {
      return null;
    }

    return buildAdjacencyList(routingGraph, {
      validated: validatedCrosswalks,
      candidate: candidateCrosswalks,
    });
  }, [candidateCrosswalks, routingGraph, validatedCrosswalks]);

  useEffect(() => {
    if (debugOriginAppliedRef.current || !roiGeometry) {
      return;
    }

    const search = new URLSearchParams(window.location.search);
    const debugOrigin = search.get('debug-origin');
    if (!debugOrigin) {
      debugOriginAppliedRef.current = true;
      return;
    }

    const [latValue, lngValue] = debugOrigin.split(',').map((value) => Number(value.trim()));
    if (Number.isNaN(latValue) || Number.isNaN(lngValue)) {
      debugOriginAppliedRef.current = true;
      return;
    }

    const inRoi = isPointInRoi(latValue, lngValue, roiGeometry);
    if (!inRoi) {
      setPlannerError(getRoiValidationError(false));
      debugOriginAppliedRef.current = true;
      return;
    }

    setOrigin({
      source: 'debug_override',
      lat: latValue,
      lng: lngValue,
      label: '디버그 위치',
    });
    debugOriginAppliedRef.current = true;
  }, [roiGeometry, setOrigin, setPlannerError]);

  const handleLocateMe = () => {
    if (!navigator.geolocation || !roiGeometry) {
      setPlannerError('위치 권한을 가져오지 못했습니다. 지도에서 직접 선택해 주세요.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextOrigin = {
          source: 'device_location' as const,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: '현재 위치',
        };
        const inRoi = isPointInRoi(nextOrigin.lat, nextOrigin.lng, roiGeometry);
        if (!inRoi) {
          setPlannerError(getRoiValidationError(false));
          setIsLocating(false);
          return;
        }

        setOrigin(nextOrigin);
        setIsLocating(false);
      },
      () => {
        setPlannerError('위치 권한을 가져오지 못했습니다. 지도에서 직접 선택해 주세요.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePlan = () => {
    if (!origin) {
      setPlannerError('먼저 현재 위치를 쓰거나 지도에서 출발점을 선택해 주세요.');
      return;
    }
    if (!routingGraph || !adjacencyGraph) {
      setPlannerError('경로 데이터를 아직 불러오는 중입니다.');
      return;
    }

    const options = generatePlanOptions({
      origin,
      requestedStartTime: plannerInput.requestedStartTime,
      restaurants,
      cafes,
      routingGraph,
      adjacencyGraph,
    });

    if (options.length === 0) {
      setPlanOptions([]);
      setSelectedPlan(null);
      setPlannerError(routeFailureMessage('no_connected_pedestrian_path'));
      return;
    }

    setPlannerError(null);
    setPlanOptions(options);
    setSelectedPlan(options[0]);
    selectPlace(options[0].places[0] ?? null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4">
        <div className="text-[18px] font-semibold text-slate-900">플랜 추천</div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            onClick={handleLocateMe}
            className="rounded-[18px] bg-slate-900 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-slate-800"
          >
            {isLocating ? '위치 확인 중...' : '현재 위치 사용'}
          </button>
          <button
            onClick={() => {
              setOriginSelectionMode(originSelectionMode === 'map' ? 'idle' : 'map');
              setPlannerError(originSelectionMode === 'map' ? null : '지도에서 출발점을 한 번 클릭해 주세요.');
            }}
            className={`rounded-[18px] px-4 py-3 text-[13px] font-semibold transition ${
              originSelectionMode === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {originSelectionMode === 'map' ? '지도 선택 취소' : '지도에서 선택'}
          </button>
          <button
            onClick={() => {
              resetPlanner();
              setPlannerError(null);
            }}
            className="rounded-[18px] bg-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            초기화
          </button>
        </div>

        <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
          {origin ? (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                  {originSourceLabel(origin.source)}
                </span>
                <span className="text-[12px] text-slate-500">
                  {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                </span>
              </div>
            </>
          ) : (
            <div className="text-[13px] text-slate-400">출발점을 선택해 주세요.</div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="planner-time" className="text-[13px] font-semibold text-slate-700">
            시작 시각
          </label>
          <input
            id="planner-time"
            type="time"
            value={plannerInput.requestedStartTime}
            onChange={(event) => setPlannerRequestedStartTime(event.target.value)}
            className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          />
          <button
            onClick={handlePlan}
            className="ml-auto rounded-[16px] bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-blue-500"
          >
            플랜 추천
          </button>
        </div>
      </section>

      {plannerError && (
        <div className="rounded-[18px] border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {plannerError}
        </div>
      )}

      {planOptions.length > 0 && (
        <section className="rounded-[22px] border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[16px] font-semibold text-slate-900">추천 코스</div>
            <div className="text-[12px] text-slate-400">{planOptions.length}개</div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {planOptions.map((option) => {
              const active = selectedPlan?.id === option.id;
              const distanceLabel = option.combinedRoute
                ? option.combinedRoute.distance >= 1000
                  ? `${(option.combinedRoute.distance / 1000).toFixed(1)}km`
                  : `${option.combinedRoute.distance}m`
                : '-';

              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setSelectedPlan(option);
                    selectPlace(option.places[0] ?? null);
                  }}
                  className={`rounded-[20px] border px-4 py-4 text-left transition ${
                    active
                      ? 'border-blue-200 bg-blue-50/70 shadow-[0_10px_28px_rgba(37,99,235,0.08)]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-semibold text-slate-900">{option.title}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{option.subtitle}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confidenceBadge(option.confidence)}`}>
                      {option.confidence === 'high' ? '확신 높음' : option.confidence === 'medium' ? '보통' : '저신뢰 포함'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">
                      도보 {distanceLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">
                      예상 {option.combinedRoute?.time ?? 0}분
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">
                      시작 {plannerInput.requestedStartTime}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {option.timeline.map((item) => (
                      <div key={`${option.id}-${item.label}-${item.startsAt}`} className="rounded-[16px] bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {item.note ?? 'Stop'}
                        </div>
                        <div className="mt-1 text-[14px] font-semibold text-slate-900">{item.label}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                          {item.startsAt}
                          {item.endsAt ? ` - ${item.endsAt}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>

                  {option.hoursSummary.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1 text-[12px] text-slate-500">
                      {option.hoursSummary.map((summary) => (
                        <div key={summary}>{summary}</div>
                      ))}
                    </div>
                  )}

                  {option.warnings.length > 0 && (
                    <div className="mt-3 rounded-[16px] border border-amber-100 bg-amber-50 px-3 py-3 text-[12px] text-amber-800">
                      {option.warnings.join(' / ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedPlan?.combinedRoute && (
        <div className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 text-[13px] text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          선택된 플랜 도보는 {selectedPlan.combinedRoute.distance >= 1000
            ? `${(selectedPlan.combinedRoute.distance / 1000).toFixed(1)}km`
            : `${selectedPlan.combinedRoute.distance}m`} / {selectedPlan.combinedRoute.time}분 기준입니다.
        </div>
      )}
    </div>
  );
}
