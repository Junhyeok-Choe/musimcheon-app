import {
  AdjacencyGraph,
  findRouteAttempt,
  routeFailureMessage,
} from '@/utils/pathfinding';
import {
  CAFE_DWELL_MIN,
  RESTAURANT_DWELL_MIN,
} from '@/utils/constants';
import {
  OriginPoint,
  PlanKind,
  PlanLeg,
  PlanOption,
  PlannerTimelineItem,
  Restaurant,
  RouteConfidence,
  RouteResult,
  RoutingGraphData,
} from '@/types';
import {
  formatMinutes,
  getPlaceAvailability,
  normalizeRequestedTime,
} from './hours';

interface PlannerContext {
  origin: OriginPoint;
  requestedStartTime: string;
  restaurants: Restaurant[];
  cafes: Restaurant[];
  routingGraph: RoutingGraphData;
  adjacencyGraph: AdjacencyGraph;
  now?: Date;
}

function topPlaces(places: Restaurant[], count: number): Restaurant[] {
  return [...places]
    .filter((place) => !place.excludeReason)
    .sort((a, b) => b.dateIndex - a.dateIndex || b.rating - a.rating)
    .slice(0, count);
}

function dwellMinutes(place: Restaurant): number {
  return place.placeKind === 'restaurant' ? RESTAURANT_DWELL_MIN : CAFE_DWELL_MIN;
}

function mergeRouteResults(routes: RouteResult[]): RouteResult | null {
  if (routes.length === 0) {
    return null;
  }

  const confidence: RouteConfidence = routes.some((route) => route.confidence === 'low')
    ? 'low'
    : routes.some((route) => route.confidence === 'medium')
      ? 'medium'
      : 'high';

  const warnings = [...new Set(routes.flatMap((route) => route.warnings))];

  return {
    path: routes.flatMap((route) => route.path),
    segments: routes.flatMap((route) => route.segments),
    distance: routes.reduce((sum, route) => sum + route.distance, 0),
    time: routes.reduce((sum, route) => sum + route.time, 0),
    confidence,
    warnings,
    startAttachmentM: routes[0].startAttachmentM,
    endAttachmentM: routes[routes.length - 1].endAttachmentM,
    usedCandidateCrossings: routes.reduce((sum, route) => sum + route.usedCandidateCrossings, 0),
    usedImplicitLocalCrossings: routes.reduce((sum, route) => sum + route.usedImplicitLocalCrossings, 0),
  };
}

function buildTimeline(
  startMinutes: number,
  originLabel: string,
  places: Restaurant[],
  legs: RouteResult[]
): PlannerTimelineItem[] {
  const timeline: PlannerTimelineItem[] = [
    {
      label: originLabel,
      startsAt: formatMinutes(startMinutes),
      note: '출발',
    },
  ];

  let cursor = startMinutes;

  places.forEach((place, index) => {
    const route = legs[index];
    cursor += route?.time ?? 0;

    const stay = dwellMinutes(place);
    timeline.push({
      label: place.name,
      startsAt: formatMinutes(cursor),
      endsAt: formatMinutes(cursor + stay),
      note: place.placeKind === 'restaurant' ? '식사' : '카페',
    });
    cursor += stay;
  });

  return timeline;
}

function optionTitle(kind: PlanKind): string {
  switch (kind) {
    case 'origin_to_restaurant':
      return '지금 바로 가능한 식사안';
    case 'origin_to_cafe':
      return '가볍게 시작하는 카페안';
    case 'origin_to_restaurant_to_cafe':
      return '식사 후 카페까지 이어지는 코스';
    case 'origin_to_cafe_to_restaurant':
      return '카페 후 식사로 넘어가는 대안';
    default:
      return '추천 플랜';
  }
}

function baseScore(places: Restaurant[], routes: RouteResult[], unknownHoursCount: number): number {
  const placeScore = places.reduce((sum, place) => sum + place.dateIndex * 10, 0);
  const routePenalty = routes.reduce((sum, route) => sum + route.distance / 45, 0);
  const confidencePenalty = unknownHoursCount * 8 + routes.reduce((sum, route) => sum + route.usedImplicitLocalCrossings * 12 + route.usedCandidateCrossings * 5, 0);
  return placeScore - routePenalty - confidencePenalty;
}

function buildLeg(fromLabel: string, toLabel: string, route: RouteResult): PlanLeg {
  return { fromLabel, toLabel, route };
}

function buildWarnings(hoursSummaries: string[], routes: RouteResult[], fallbackWarnings: string[]): string[] {
  return [...new Set([
    ...fallbackWarnings,
    ...hoursSummaries.filter((summary) => summary.includes('미확인')),
    ...routes.flatMap((route) => route.warnings),
  ])];
}

function trySingleStopOption(
  kind: PlanKind,
  origin: OriginPoint,
  place: Restaurant,
  requestedStartMinutes: number,
  routingGraph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph,
  now: Date
): PlanOption | null {
  const availability = getPlaceAvailability(place, requestedStartMinutes, dwellMinutes(place), now);
  if (availability.status === 'closed' || availability.status === 'break_time' || availability.status === 'holiday') {
    return null;
  }

  const routeAttempt = findRouteAttempt(origin.lat, origin.lng, place.lat, place.lng, routingGraph, adjacencyGraph);
  if (!routeAttempt.route) {
    return null;
  }

  const hoursSummaries = [`${place.name}: ${availability.summary}`];
  const warnings = buildWarnings(hoursSummaries, [routeAttempt.route], routeAttempt.failureCode ? [routeFailureMessage(routeAttempt.failureCode)] : []);

  return {
    id: `${kind}-${place.placeKind}-${place.id}`,
    kind,
    title: optionTitle(kind),
    subtitle: `${place.name} 하나만 먼저 확정하는 단순 플랜`,
    places: [place],
    timeline: buildTimeline(requestedStartMinutes, '현재 위치', [place], [routeAttempt.route]),
    legs: [buildLeg('현재 위치', place.name, routeAttempt.route)],
    combinedRoute: routeAttempt.route,
    confidence: availability.status === 'unknown' || routeAttempt.route.confidence !== 'high' ? 'medium' : 'high',
    warnings,
    score: baseScore([place], [routeAttempt.route], availability.status === 'unknown' ? 1 : 0),
    hoursSummary: hoursSummaries,
  };
}

function tryTwoStopOption(
  kind: PlanKind,
  origin: OriginPoint,
  first: Restaurant,
  second: Restaurant,
  requestedStartMinutes: number,
  routingGraph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph,
  now: Date
): PlanOption | null {
  const firstAvailability = getPlaceAvailability(first, requestedStartMinutes, dwellMinutes(first), now);
  if (firstAvailability.status === 'closed' || firstAvailability.status === 'break_time' || firstAvailability.status === 'holiday') {
    return null;
  }

  const firstLegAttempt = findRouteAttempt(origin.lat, origin.lng, first.lat, first.lng, routingGraph, adjacencyGraph);
  if (!firstLegAttempt.route) {
    return null;
  }

  const secondStartMinutes = requestedStartMinutes + firstLegAttempt.route.time + dwellMinutes(first);
  const secondAvailability = getPlaceAvailability(second, secondStartMinutes, dwellMinutes(second), now);
  if (secondAvailability.status === 'closed' || secondAvailability.status === 'break_time' || secondAvailability.status === 'holiday') {
    return null;
  }

  const secondLegAttempt = findRouteAttempt(first.lat, first.lng, second.lat, second.lng, routingGraph, adjacencyGraph);
  if (!secondLegAttempt.route) {
    return null;
  }

  const routes = [firstLegAttempt.route, secondLegAttempt.route];
  const combinedRoute = mergeRouteResults(routes);
  const hoursSummaries = [
    `${first.name}: ${firstAvailability.summary}`,
    `${second.name}: ${secondAvailability.summary}`,
  ];
  const unknownHoursCount = [firstAvailability, secondAvailability].filter((item) => item.status === 'unknown').length;
  const warnings = buildWarnings(hoursSummaries, routes, []);

  return {
    id: `${kind}-${first.id}-${second.id}`,
    kind,
    title: optionTitle(kind),
    subtitle: `${first.name} → ${second.name}`,
    places: [first, second],
    timeline: buildTimeline(requestedStartMinutes, '현재 위치', [first, second], routes),
    legs: [
      buildLeg('현재 위치', first.name, firstLegAttempt.route),
      buildLeg(first.name, second.name, secondLegAttempt.route),
    ],
    combinedRoute,
    confidence:
      unknownHoursCount > 0 || routes.some((route) => route.confidence === 'low')
        ? 'low'
        : routes.some((route) => route.confidence === 'medium')
          ? 'medium'
          : 'high',
    warnings,
    score: baseScore([first, second], routes, unknownHoursCount),
    hoursSummary: hoursSummaries,
  };
}

export function generatePlanOptions({
  origin,
  requestedStartTime,
  restaurants,
  cafes,
  routingGraph,
  adjacencyGraph,
  now = new Date(),
}: PlannerContext): PlanOption[] {
  const normalizedStartTime = normalizeRequestedTime(requestedStartTime, now);
  const [hour, minute] = normalizedStartTime.split(':').map(Number);
  const requestedStartMinutes = hour * 60 + minute;

  const topRestaurants = topPlaces(restaurants, 8);
  const topCafes = topPlaces(cafes, 8);
  const options: PlanOption[] = [];

  topRestaurants.slice(0, 4).forEach((restaurant) => {
    const option = trySingleStopOption(
      'origin_to_restaurant',
      origin,
      restaurant,
      requestedStartMinutes,
      routingGraph,
      adjacencyGraph,
      now
    );
    if (option) {
      options.push(option);
    }
  });

  topCafes.slice(0, 4).forEach((cafe) => {
    const option = trySingleStopOption(
      'origin_to_cafe',
      origin,
      cafe,
      requestedStartMinutes,
      routingGraph,
      adjacencyGraph,
      now
    );
    if (option) {
      options.push(option);
    }
  });

  topRestaurants.slice(0, 4).forEach((restaurant) => {
    topCafes.slice(0, 4).forEach((cafe) => {
      const option = tryTwoStopOption(
        'origin_to_restaurant_to_cafe',
        origin,
        restaurant,
        cafe,
        requestedStartMinutes,
        routingGraph,
        adjacencyGraph,
        now
      );
      if (option) {
        options.push(option);
      }
    });
  });

  topCafes.slice(0, 3).forEach((cafe) => {
    topRestaurants.slice(0, 3).forEach((restaurant) => {
      const option = tryTwoStopOption(
        'origin_to_cafe_to_restaurant',
        origin,
        cafe,
        restaurant,
        requestedStartMinutes,
        routingGraph,
        adjacencyGraph,
        now
      );
      if (option) {
        options.push(option);
      }
    });
  });

  return options
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
