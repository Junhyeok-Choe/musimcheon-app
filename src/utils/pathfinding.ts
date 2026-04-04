import {
  EdgeKind,
  RouteAttempt,
  RouteResult,
  RoutingGraphData,
  RouteSegment,
  RouteConfidence,
  RouteFailureCode,
} from '@/types';
import {
  ROUTE_ATTACHMENT_FAIL_M,
  ROUTE_ATTACHMENT_WARN_M,
  WALKING_SPEED_M_PER_MIN,
} from './constants';

export type CrosswalkCoord = [number, number];

export interface CrosswalkDataset {
  validated: CrosswalkCoord[];
  candidate: CrosswalkCoord[];
}

type InternalEdgeKind = Exclude<EdgeKind, 'approach'> | 'blocked_crossing';

interface IndexedEdge {
  edgeId: string;
  fromNode: string;
  toNode: string;
  dist: number;
  path: [number, number][];
  kind: InternalEdgeKind;
  roadRank: string | null;
}

interface AdjEntry {
  edgeId: string;
  to: string;
  dist: number;
  path: [number, number][];
  kind: InternalEdgeKind;
}

export interface AdjacencyGraph {
  adjacencyList: Record<string, AdjEntry[]>;
  edgesById: Record<string, IndexedEdge>;
}

interface Attachment {
  edgeId: string;
  point: [number, number];
  distanceM: number;
  alongM: number;
  totalM: number;
  fromNode: string;
  toNode: string;
  edgeKind: InternalEdgeKind;
}

interface SearchResult {
  segments: AdjEntry[];
  distance: number;
  usedCandidateCrossings: number;
  usedImplicitCrossings: number;
  blockedSeen: boolean;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
      * Math.cos((lat2 * Math.PI) / 180)
      * Math.sin(dLng / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateWalkingTime(distanceMeters: number): number {
  if (distanceMeters <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(distanceMeters / WALKING_SPEED_M_PER_MIN));
}

function normalizeEdgePath(
  graph: RoutingGraphData,
  fromNode: string,
  toNode: string,
  rawPath?: [number, number][]
): [number, number][] {
  const fromCoords = graph.nodes[fromNode];
  const toCoords = graph.nodes[toNode];
  const fromLatLng: [number, number] = [fromCoords[1], fromCoords[0]];
  const toLatLng: [number, number] = [toCoords[1], toCoords[0]];

  if (!rawPath?.length) {
    return [fromLatLng, toLatLng];
  }

  const path = rawPath.map(([lng, lat]) => [lat, lng] as [number, number]);
  const forwardCost =
    haversine(path[0][0], path[0][1], fromLatLng[0], fromLatLng[1])
    + haversine(path[path.length - 1][0], path[path.length - 1][1], toLatLng[0], toLatLng[1]);
  const reverseCost =
    haversine(path[0][0], path[0][1], toLatLng[0], toLatLng[1])
    + haversine(path[path.length - 1][0], path[path.length - 1][1], fromLatLng[0], fromLatLng[1]);

  return forwardCost <= reverseCost ? path : [...path].reverse();
}

function pointEquals(a?: [number, number], b?: [number, number]): boolean {
  return Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
}

function dedupePath(path: [number, number][]): [number, number][] {
  const deduped: [number, number][] = [];

  for (const point of path) {
    if (!pointEquals(deduped[deduped.length - 1], point)) {
      deduped.push(point);
    }
  }

  return deduped;
}

function cumulativeDistances(path: [number, number][]): number[] {
  const distances = [0];

  for (let i = 1; i < path.length; i += 1) {
    const [prevLat, prevLng] = path[i - 1];
    const [lat, lng] = path[i];
    distances.push(distances[i - 1] + haversine(prevLat, prevLng, lat, lng));
  }

  return distances;
}

function interpolatePoint(
  start: [number, number],
  end: [number, number],
  ratio: number
): [number, number] {
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ];
}

function pointAtDistance(path: [number, number][], targetM: number): [number, number] {
  if (path.length === 0) {
    return [0, 0];
  }

  if (path.length === 1) {
    return path[0];
  }

  const cum = cumulativeDistances(path);
  const clamped = Math.max(0, Math.min(targetM, cum[cum.length - 1]));

  for (let i = 0; i < cum.length - 1; i += 1) {
    if (clamped <= cum[i + 1]) {
      const segLength = cum[i + 1] - cum[i];
      const ratio = segLength === 0 ? 0 : (clamped - cum[i]) / segLength;
      return interpolatePoint(path[i], path[i + 1], ratio);
    }
  }

  return path[path.length - 1];
}

function slicePathBetween(path: [number, number][], startM: number, endM: number): [number, number][] {
  if (path.length === 0) {
    return [];
  }

  if (path.length === 1) {
    return [path[0]];
  }

  const cum = cumulativeDistances(path);
  const total = cum[cum.length - 1];
  const start = Math.max(0, Math.min(startM, total));
  const end = Math.max(0, Math.min(endM, total));
  const forward = start <= end;
  const from = forward ? start : end;
  const to = forward ? end : start;
  const startPoint = pointAtDistance(path, from);
  const endPoint = pointAtDistance(path, to);

  if (from === to) {
    return dedupePath([startPoint, endPoint]);
  }

  const points: [number, number][] = [startPoint];

  for (let i = 1; i < path.length - 1; i += 1) {
    if (cum[i] > from && cum[i] < to) {
      points.push(path[i]);
    }
  }

  points.push(endPoint);
  const sliced = dedupePath(points);
  return forward ? sliced : [...sliced].reverse();
}

function appendPoints(target: [number, number][], source: [number, number][]) {
  for (const point of source) {
    if (!pointEquals(target[target.length - 1], point)) {
      target.push(point);
    }
  }
}

function pointToSegmentProjection(
  pointLat: number,
  pointLng: number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): { distanceM: number; ratio: number; point: [number, number] } {
  const lat0 = ((pointLat + startLat + endLat) / 3) * (Math.PI / 180);
  const scaleX = 111320 * Math.cos(lat0);
  const scaleY = 111320;

  const pointX = pointLng * scaleX;
  const pointY = pointLat * scaleY;
  const startX = startLng * scaleX;
  const startY = startLat * scaleY;
  const endX = endLng * scaleX;
  const endY = endLat * scaleY;

  const vx = endX - startX;
  const vy = endY - startY;
  const wx = pointX - startX;
  const wy = pointY - startY;
  const segLengthSquared = vx * vx + vy * vy;
  const ratio = segLengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (vx * wx + vy * wy) / segLengthSquared));
  const projX = startX + ratio * vx;
  const projY = startY + ratio * vy;
  const projLng = scaleX === 0 ? startLng : projX / scaleX;
  const projLat = projY / scaleY;

  return {
    distanceM: Math.hypot(pointX - projX, pointY - projY),
    ratio,
    point: [projLat, projLng],
  };
}

function pathNearCrosswalk(path: [number, number][], crosswalks: CrosswalkCoord[], thresholdM: number): boolean {
  if (crosswalks.length === 0 || path.length < 2) {
    return false;
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const [aLat, aLng] = path[i];
    const [bLat, bLng] = path[i + 1];

    for (const [cwLng, cwLat] of crosswalks) {
      const projection = pointToSegmentProjection(cwLat, cwLng, aLat, aLng, bLat, bLng);
      if (projection.distanceM <= thresholdM) {
        return true;
      }
    }
  }

  return false;
}

function classifyEdgeKind(
  path: [number, number][],
  dist: number,
  roadRank: string | null,
  crossingSensitive: boolean,
  crosswalks: CrosswalkDataset
): InternalEdgeKind {
  if (!crossingSensitive) {
    return 'sidewalk';
  }

  const nearValidated = pathNearCrosswalk(path, crosswalks.validated, 10);
  const nearCandidate = pathNearCrosswalk(path, crosswalks.candidate, 12);
  const isMajorRoad = roadRank === '103' || roadRank === '105' || roadRank === '106';
  const isLocalRoad = roadRank === '107';

  if (nearValidated) {
    return 'validated_crossing';
  }

  if (nearCandidate) {
    return 'candidate_crossing';
  }

  if (isMajorRoad) {
    return 'blocked_crossing';
  }

  if (isLocalRoad && dist <= 30) {
    return 'implicit_local_crossing';
  }

  return 'sidewalk';
}

export function buildAdjacencyList(
  graph: RoutingGraphData,
  crosswalks: CrosswalkDataset = { validated: [], candidate: [] }
): AdjacencyGraph {
  const adjacencyList: Record<string, AdjEntry[]> = {};
  const edgesById: Record<string, IndexedEdge> = {};
  const nodeDegrees: Record<string, number> = {};
  const roadNames = new Map<string, Set<string>>();

  for (const nodeId of Object.keys(graph.nodes)) {
    adjacencyList[nodeId] = [];
    nodeDegrees[nodeId] = 0;
  }

  for (const edge of graph.edges) {
    nodeDegrees[edge.f] = (nodeDegrees[edge.f] ?? 0) + 1;
    nodeDegrees[edge.t] = (nodeDegrees[edge.t] ?? 0) + 1;

    if (edge.rn && edge.rn !== '-') {
      if (!roadNames.has(edge.f)) {
        roadNames.set(edge.f, new Set());
      }
      if (!roadNames.has(edge.t)) {
        roadNames.set(edge.t, new Set());
      }
      roadNames.get(edge.f)!.add(edge.rn);
      roadNames.get(edge.t)!.add(edge.rn);
    }
  }

  graph.edges.forEach((edge, index) => {
    const edgeId = `${edge.f}:${edge.t}:${index}`;
    const path = normalizeEdgePath(graph, edge.f, edge.t, edge.c);
    const degreeSensitive =
      (nodeDegrees[edge.f] >= 3 && nodeDegrees[edge.t] >= 3)
      || (roadNames.get(edge.f)?.size ?? 0) >= 2
      || (roadNames.get(edge.t)?.size ?? 0) >= 2;
    const crossingSensitive = edge.d <= 30 && degreeSensitive;
    const kind = classifyEdgeKind(path, edge.d, edge.rr ?? null, crossingSensitive, crosswalks);

    edgesById[edgeId] = {
      edgeId,
      fromNode: edge.f,
      toNode: edge.t,
      dist: edge.d,
      path,
      kind,
      roadRank: edge.rr ?? null,
    };

    adjacencyList[edge.f].push({
      edgeId,
      to: edge.t,
      dist: edge.d,
      path,
      kind,
    });

    adjacencyList[edge.t].push({
      edgeId,
      to: edge.f,
      dist: edge.d,
      path: [...path].reverse(),
      kind,
    });
  });

  return { adjacencyList, edgesById };
}

function findNearestEdgeProjection(
  lat: number,
  lng: number,
  adjacencyGraph: AdjacencyGraph
): Attachment | null {
  let best: Attachment | null = null;

  for (const edge of Object.values(adjacencyGraph.edgesById)) {
    const cum = cumulativeDistances(edge.path);

    for (let i = 0; i < edge.path.length - 1; i += 1) {
      const [startLat, startLng] = edge.path[i];
      const [endLat, endLng] = edge.path[i + 1];
      const projection = pointToSegmentProjection(lat, lng, startLat, startLng, endLat, endLng);
      const segLength = cum[i + 1] - cum[i];
      const alongM = cum[i] + segLength * projection.ratio;

      if (!best || projection.distanceM < best.distanceM) {
        best = {
          edgeId: edge.edgeId,
          point: projection.point,
          distanceM: projection.distanceM,
          alongM,
          totalM: cum[cum.length - 1],
          fromNode: edge.fromNode,
          toNode: edge.toNode,
          edgeKind: edge.kind,
        };
      }
    }
  }

  return best;
}

function buildStartApproach(
  startLat: number,
  startLng: number,
  attachment: Attachment,
  edge: IndexedEdge
): Array<{ nodeId: string; path: [number, number][]; distance: number }> {
  const prefix: [number, number][] = [[startLat, startLng], attachment.point];
  const toFromNode = slicePathBetween(edge.path, 0, attachment.alongM).reverse();
  const toToNode = slicePathBetween(edge.path, attachment.alongM, attachment.totalM);

  return [
    {
      nodeId: attachment.fromNode,
      path: dedupePath([...prefix, ...toFromNode]),
      distance: attachment.distanceM + attachment.alongM,
    },
    {
      nodeId: attachment.toNode,
      path: dedupePath([...prefix, ...toToNode]),
      distance: attachment.distanceM + (attachment.totalM - attachment.alongM),
    },
  ];
}

function buildEndApproach(
  endLat: number,
  endLng: number,
  attachment: Attachment,
  edge: IndexedEdge
): Array<{ nodeId: string; path: [number, number][]; distance: number }> {
  const suffix: [number, number][] = [attachment.point, [endLat, endLng]];
  const fromNodePath = slicePathBetween(edge.path, 0, attachment.alongM);
  const toNodePath = slicePathBetween(edge.path, attachment.alongM, attachment.totalM).reverse();

  return [
    {
      nodeId: attachment.fromNode,
      path: dedupePath([...fromNodePath, ...suffix]),
      distance: attachment.alongM + attachment.distanceM,
    },
    {
      nodeId: attachment.toNode,
      path: dedupePath([...toNodePath, ...suffix]),
      distance: (attachment.totalM - attachment.alongM) + attachment.distanceM,
    },
  ];
}

function allowedEdgeCost(kind: InternalEdgeKind, pass: 1 | 2 | 3, usedImplicit: number) {
  if (kind === 'blocked_crossing') {
    return null;
  }

  if (kind === 'candidate_crossing') {
    if (pass < 2) {
      return null;
    }
    return { multiplier: 1.35, nextImplicit: usedImplicit };
  }

  if (kind === 'implicit_local_crossing') {
    if (pass < 3 || usedImplicit >= 1) {
      return null;
    }
    return { multiplier: 2.5, nextImplicit: usedImplicit + 1 };
  }

  return { multiplier: 1, nextImplicit: usedImplicit };
}

function reconstructSearchSegments(
  cameFrom: Record<string, string>,
  cameFromEdge: Record<string, AdjEntry>,
  stateKey: string
): AdjEntry[] {
  const segments: AdjEntry[] = [];
  let currentKey = stateKey;

  while (cameFrom[currentKey]) {
    const edge = cameFromEdge[currentKey];
    if (!edge) {
      break;
    }
    segments.unshift(edge);
    currentKey = cameFrom[currentKey];
  }

  return segments;
}

function runAStar(
  startNode: string,
  endNode: string,
  graph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph,
  pass: 1 | 2 | 3
): SearchResult | null {
  const openStates = [`${startNode}|0`];
  const gScore: Record<string, number> = { [`${startNode}|0`]: 0 };
  const realDistance: Record<string, number> = { [`${startNode}|0`]: 0 };
  const fScore: Record<string, number> = {
    [`${startNode}|0`]: haversine(
      graph.nodes[startNode][1],
      graph.nodes[startNode][0],
      graph.nodes[endNode][1],
      graph.nodes[endNode][0]
    ),
  };
  const cameFrom: Record<string, string> = {};
  const cameFromEdge: Record<string, AdjEntry> = {};
  const closed = new Set<string>();
  let blockedSeen = false;

  while (openStates.length > 0) {
    openStates.sort((a, b) => (fScore[a] ?? Infinity) - (fScore[b] ?? Infinity));
    const currentKey = openStates.shift()!;

    if (closed.has(currentKey)) {
      continue;
    }

    closed.add(currentKey);

    const [currentNode, implicitStr] = currentKey.split('|');
    const implicitUsed = Number(implicitStr);

    if (currentNode === endNode) {
      const segments = reconstructSearchSegments(cameFrom, cameFromEdge, currentKey);
      const usedCandidateCrossings = segments.filter((segment) => segment.kind === 'candidate_crossing').length;
      const usedImplicitCrossings = segments.filter((segment) => segment.kind === 'implicit_local_crossing').length;

      return {
        segments,
        distance: realDistance[currentKey] ?? 0,
        usedCandidateCrossings,
        usedImplicitCrossings,
        blockedSeen,
      };
    }

    for (const neighbor of adjacencyGraph.adjacencyList[currentNode] ?? []) {
      const rule = allowedEdgeCost(neighbor.kind, pass, implicitUsed);
      if (!rule) {
        if (neighbor.kind === 'blocked_crossing') {
          blockedSeen = true;
        }
        continue;
      }

      const nextKey = `${neighbor.to}|${rule.nextImplicit}`;
      const tentativeG = (gScore[currentKey] ?? Infinity) + neighbor.dist * rule.multiplier;
      const tentativeReal = (realDistance[currentKey] ?? Infinity) + neighbor.dist;

      if (tentativeG < (gScore[nextKey] ?? Infinity)) {
        cameFrom[nextKey] = currentKey;
        cameFromEdge[nextKey] = neighbor;
        gScore[nextKey] = tentativeG;
        realDistance[nextKey] = tentativeReal;

        const [endLng, endLat] = graph.nodes[endNode];
        const [nextLng, nextLat] = graph.nodes[neighbor.to];
        fScore[nextKey] = tentativeG + haversine(nextLat, nextLng, endLat, endLng);

        if (!openStates.includes(nextKey)) {
          openStates.push(nextKey);
        }
      }
    }
  }

  return null;
}

function flattenSegments(segments: RouteSegment[]): [number, number][] {
  const path: [number, number][] = [];

  for (const segment of segments) {
    appendPoints(path, segment.path);
  }

  return path;
}

function buildConfidence(warnings: string[], usedImplicit: number, usedCandidate: number): RouteConfidence {
  if (usedImplicit > 0 || warnings.some((warning) => warning.includes('저신뢰'))) {
    return 'low';
  }

  if (usedCandidate > 0 || warnings.length > 0) {
    return 'medium';
  }

  return 'high';
}

function finalizeRoute(
  segments: RouteSegment[],
  distance: number,
  startAttachmentM: number,
  endAttachmentM: number,
  usedCandidateCrossings: number,
  usedImplicitLocalCrossings: number
): RouteResult {
  const warnings: string[] = [];

  if (startAttachmentM > ROUTE_ATTACHMENT_WARN_M) {
    warnings.push(`출발점이 보행 네트워크에서 ${Math.round(startAttachmentM)}m 떨어져 있습니다.`);
  }
  if (endAttachmentM > ROUTE_ATTACHMENT_WARN_M) {
    warnings.push(`도착점이 보행 네트워크에서 ${Math.round(endAttachmentM)}m 떨어져 있습니다.`);
  }
  if (usedCandidateCrossings > 0) {
    warnings.push('검증 전 횡단보도 후보를 포함한 구간이 있습니다.');
  }
  if (usedImplicitLocalCrossings > 0) {
    warnings.push('저신뢰 골목 횡단 fallback이 포함되어 있습니다.');
  }

  return {
    path: flattenSegments(segments),
    segments,
    distance: Math.round(distance),
    time: estimateWalkingTime(distance),
    confidence: buildConfidence(warnings, usedImplicitLocalCrossings, usedCandidateCrossings),
    warnings,
    startAttachmentM: Math.round(startAttachmentM),
    endAttachmentM: Math.round(endAttachmentM),
    usedCandidateCrossings,
    usedImplicitLocalCrossings,
  };
}

function mergeSegments(startSegments: RouteSegment[], graphSegments: RouteSegment[], endSegments: RouteSegment[]): RouteSegment[] {
  return [...startSegments, ...graphSegments, ...endSegments].filter((segment) => segment.path.length >= 2);
}

function searchBetweenAttachments(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  startAttachment: Attachment,
  endAttachment: Attachment,
  graph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph
): RouteAttempt {
  const startEdge = adjacencyGraph.edgesById[startAttachment.edgeId];
  const endEdge = adjacencyGraph.edgesById[endAttachment.edgeId];

  if (!startEdge || !endEdge) {
    return { route: null, failureCode: 'no_connected_pedestrian_path' };
  }

  if (startAttachment.distanceM > ROUTE_ATTACHMENT_FAIL_M) {
    return { route: null, failureCode: 'start_attachment_too_far' };
  }
  if (endAttachment.distanceM > ROUTE_ATTACHMENT_FAIL_M) {
    return { route: null, failureCode: 'end_attachment_too_far' };
  }

  if (startAttachment.edgeId === endAttachment.edgeId) {
    let middlePath = slicePathBetween(startEdge.path, startAttachment.alongM, endAttachment.alongM);
    if (startAttachment.alongM > endAttachment.alongM) {
      middlePath = [...middlePath].reverse();
    }

    const segments: RouteSegment[] = mergeSegments(
      [{ kind: 'approach', path: dedupePath([[startLat, startLng], startAttachment.point]) }],
      [{ kind: startEdge.kind === 'blocked_crossing' ? 'sidewalk' : startEdge.kind, path: middlePath }],
      [{ kind: 'approach', path: dedupePath([endAttachment.point, [endLat, endLng]]) }]
    );

    const distance =
      startAttachment.distanceM
      + endAttachment.distanceM
      + Math.abs(endAttachment.alongM - startAttachment.alongM);

    return {
      route: finalizeRoute(
        segments,
        distance,
        startAttachment.distanceM,
        endAttachment.distanceM,
        startEdge.kind === 'candidate_crossing' ? 1 : 0,
        startEdge.kind === 'implicit_local_crossing' ? 1 : 0
      ),
    };
  }

  const startChoices = buildStartApproach(startLat, startLng, startAttachment, startEdge);
  const endChoices = buildEndApproach(endLat, endLng, endAttachment, endEdge);

  let bestAttempt: RouteResult | null = null;
  let blockedSeen = false;

  for (const startChoice of startChoices) {
    for (const endChoice of endChoices) {
      let search: SearchResult | null = null;

      for (const pass of [1, 2, 3] as const) {
        search = runAStar(startChoice.nodeId, endChoice.nodeId, graph, adjacencyGraph, pass);
        if (search) {
          break;
        }
      }

      blockedSeen = blockedSeen || Boolean(search?.blockedSeen);

      if (!search) {
        continue;
      }

      const graphSegments: RouteSegment[] = search.segments.map((segment) => ({
        kind: segment.kind === 'blocked_crossing' ? 'sidewalk' : segment.kind,
        path: segment.path,
      }));

      const segments = mergeSegments(
        [{ kind: 'approach', path: startChoice.path }],
        graphSegments,
        [{ kind: 'approach', path: endChoice.path }]
      );

      const route = finalizeRoute(
        segments,
        startChoice.distance + search.distance + endChoice.distance,
        startAttachment.distanceM,
        endAttachment.distanceM,
        search.usedCandidateCrossings,
        search.usedImplicitCrossings
      );

      if (!bestAttempt || route.distance < bestAttempt.distance) {
        bestAttempt = route;
      }
    }
  }

  if (!bestAttempt) {
    return {
      route: null,
      failureCode: blockedSeen ? 'major_road_crossing_blocked' : 'no_connected_pedestrian_path',
    };
  }

  return { route: bestAttempt };
}

export function findRouteAttempt(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  graph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph
): RouteAttempt {
  const startAttachment = findNearestEdgeProjection(startLat, startLng, adjacencyGraph);
  const endAttachment = findNearestEdgeProjection(endLat, endLng, adjacencyGraph);

  if (!startAttachment || !endAttachment) {
    return { route: null, failureCode: 'no_connected_pedestrian_path' };
  }

  return searchBetweenAttachments(
    startLat,
    startLng,
    endLat,
    endLng,
    startAttachment,
    endAttachment,
    graph,
    adjacencyGraph
  );
}

export function findRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  graph: RoutingGraphData,
  adjacencyGraph: AdjacencyGraph
): RouteResult | null {
  return findRouteAttempt(startLat, startLng, endLat, endLng, graph, adjacencyGraph).route;
}

export function routeFailureMessage(code?: RouteFailureCode): string {
  switch (code) {
    case 'start_attachment_too_far':
    case 'end_attachment_too_far':
      return '출발점은 권역 안이지만 보행 네트워크와 너무 멉니다. 더 가까운 지점을 선택해 주세요.';
    case 'major_road_crossing_blocked':
      return '검증된 횡단보도 없이 큰 도로를 건너야 해서 경로를 만들지 않았습니다.';
    case 'no_connected_pedestrian_path':
    default:
      return '현재 조건에서는 연결 가능한 보행 경로를 찾지 못했습니다.';
  }
}
