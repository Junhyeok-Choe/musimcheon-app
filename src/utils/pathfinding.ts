import { RoutingGraphData, RouteResult } from '@/types';
import { WALKING_SPEED_M_PER_MIN } from './constants';

// [PATH-01] Haversine distance between two [lat, lng] points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// [PATH-02] Adjacency list type
interface AdjEntry {
  to: string;
  dist: number;
  path: [number, number][]; // detailed edge polyline as [lat, lng][]
  crosswalkAligned: boolean;
}

// [PATH-02a] Crosswalk proximity threshold (meters)
// Nodes within this distance of a crosswalk are considered "crosswalk-accessible"
const CROSSWALK_PROXIMITY_M = 30;

// [PATH-02b] Edge-level thresholds for conservative crosswalk biasing
// Only short crossing-like edges get a small bonus when they align with a crosswalk.
const CROSSWALK_EDGE_MATCH_M = 16;
const CROSSWALK_EDGE_MAX_M = 40;
const CROSSWALK_EDGE_BONUS = 0.82;

// [PATH-02c] Crosswalk coordinate type: [lng, lat]
export type CrosswalkCoord = [number, number];

// [PATH-02d] Precompute which routing nodes are near a crosswalk
// Returns a Set of nodeIds that have at least one crosswalk within threshold
export function buildCrosswalkIndex(
  nodes: Record<string, [number, number]>,
  crosswalks: CrosswalkCoord[]
): Set<string> {
  const hasCrosswalk = new Set<string>();

  if (crosswalks.length === 0) return hasCrosswalk;

  for (const [nodeId, coords] of Object.entries(nodes)) {
    const nodeLat = coords[1];
    const nodeLng = coords[0];

    for (const cw of crosswalks) {
      const d = haversine(nodeLat, nodeLng, cw[1], cw[0]);
      if (d <= CROSSWALK_PROXIMITY_M) {
        hasCrosswalk.add(nodeId);
        break; // one match is enough
      }
    }
  }

  return hasCrosswalk;
}

// [PATH-03] Build adjacency list from routing graph data
export function buildAdjacencyList(
  graph: RoutingGraphData,
  crosswalks: CrosswalkCoord[] = []
): Record<string, AdjEntry[]> {
  const adj: Record<string, AdjEntry[]> = {};

  for (const nodeId of Object.keys(graph.nodes)) {
    adj[nodeId] = [];
  }

  for (const edge of graph.edges) {
    if (!adj[edge.f]) adj[edge.f] = [];
    if (!adj[edge.t]) adj[edge.t] = [];
    const forwardPath = normalizeEdgePath(graph, edge.f, edge.t, edge.c);
    const reversePath = [...forwardPath].reverse();
    const crosswalkAligned =
      edge.d <= CROSSWALK_EDGE_MAX_M && isPathNearCrosswalk(forwardPath, crosswalks);
    adj[edge.f].push({ to: edge.t, dist: edge.d, path: forwardPath, crosswalkAligned });
    adj[edge.t].push({ to: edge.f, dist: edge.d, path: reversePath, crosswalkAligned }); // bidirectional for walking
  }

  return adj;
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

  if (!rawPath || rawPath.length === 0) {
    return [fromLatLng, toLatLng];
  }

  const asLatLng = rawPath.map(([lng, lat]) => [lat, lng] as [number, number]);
  const forwardCost =
    haversine(asLatLng[0][0], asLatLng[0][1], fromLatLng[0], fromLatLng[1]) +
    haversine(asLatLng[asLatLng.length - 1][0], asLatLng[asLatLng.length - 1][1], toLatLng[0], toLatLng[1]);
  const reverseCost =
    haversine(asLatLng[0][0], asLatLng[0][1], toLatLng[0], toLatLng[1]) +
    haversine(asLatLng[asLatLng.length - 1][0], asLatLng[asLatLng.length - 1][1], fromLatLng[0], fromLatLng[1]);

  return forwardCost <= reverseCost ? asLatLng : [...asLatLng].reverse();
}

function isPathNearCrosswalk(path: [number, number][], crosswalks: CrosswalkCoord[]): boolean {
  if (crosswalks.length === 0 || path.length < 2) {
    return false;
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const [aLat, aLng] = path[i];
    const [bLat, bLng] = path[i + 1];
    for (const [cwLng, cwLat] of crosswalks) {
      if (pointToSegmentDistance(cwLat, cwLng, aLat, aLng, bLat, bLng) <= CROSSWALK_EDGE_MATCH_M) {
        return true;
      }
    }
  }

  return false;
}

function pointToSegmentDistance(
  pointLat: number,
  pointLng: number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): number {
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

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    return Math.hypot(pointX - endX, pointY - endY);
  }

  const t = c1 / c2;
  const projX = startX + t * vx;
  const projY = startY + t * vy;
  return Math.hypot(pointX - projX, pointY - projY);
}

// [PATH-04] Find nearest node to a given lat/lng
export function findNearestNode(
  lat: number,
  lng: number,
  nodes: Record<string, [number, number]>
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [nodeId, coords] of Object.entries(nodes)) {
    const d = haversine(lat, lng, coords[1], coords[0]); // coords = [lng, lat]
    if (d < bestDist) {
      bestDist = d;
      bestId = nodeId;
    }
  }

  return bestId;
}

// [PATH-05] A* pathfinding algorithm with crosswalk awareness
export function findRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  graph: RoutingGraphData,
  adjacencyList: Record<string, AdjEntry[]>
): RouteResult | null {
  const startNode = findNearestNode(startLat, startLng, graph.nodes);
  const endNode = findNearestNode(endLat, endLng, graph.nodes);

  if (!startNode || !endNode) return null;
  if (startNode === endNode) {
    const distance = Math.round(haversine(startLat, startLng, endLat, endLng));
    return {
      path: [[startLat, startLng], [endLat, endLng]],
      distance,
      time: Math.round(distance / WALKING_SPEED_M_PER_MIN),
    };
  }

  // [PATH-05a] A* with priority queue (simple sorted array for small graph)
  const gScore: Record<string, number> = { [startNode]: 0 };
  const fScore: Record<string, number> = {};
  const cameFrom: Record<string, string> = {};
  const cameFromEdge: Record<string, AdjEntry> = {};
  const closedSet = new Set<string>();

  // [PATH-05a-1] Track actual distance separately from penalized cost
  const realDist: Record<string, number> = { [startNode]: 0 };

  const endCoords = graph.nodes[endNode];
  fScore[startNode] = haversine(
    graph.nodes[startNode][1], graph.nodes[startNode][0],
    endCoords[1], endCoords[0]
  );

  const openSet = [startNode];

  while (openSet.length > 0) {
    // [PATH-05b] Pick node with lowest fScore
    openSet.sort((a, b) => (fScore[a] ?? Infinity) - (fScore[b] ?? Infinity));
    const current = openSet.shift()!;

    if (current === endNode) {
      // [PATH-05c] Reconstruct detailed path from edge polylines
      const edgeSegments: [number, number][][] = [];
      let node = endNode;
      while (node !== startNode) {
        const edge = cameFromEdge[node];
        if (!edge) break;
        edgeSegments.unshift(edge.path);
        node = cameFrom[node];
      }

      const path: [number, number][] = [[startLat, startLng]];
      for (const segment of edgeSegments) {
        for (const point of segment) {
          const last = path[path.length - 1];
          if (!last || last[0] !== point[0] || last[1] !== point[1]) {
            path.push(point);
          }
        }
      }
      const last = path[path.length - 1];
      if (!last || last[0] !== endLat || last[1] !== endLng) {
        path.push([endLat, endLng]);
      }

      // [PATH-05c-1] Use real distance (not penalized) for display
      const distance = realDist[endNode];
      return {
        path,
        distance: Math.round(distance),
        time: Math.round(distance / WALKING_SPEED_M_PER_MIN),
      };
    }

    closedSet.add(current);

    const neighbors = adjacencyList[current] || [];
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.to)) continue;

      // [PATH-05d] Apply a conservative bonus only to edges that line up with crosswalk data
      let edgeCost = neighbor.dist;
      if (neighbor.crosswalkAligned) {
        edgeCost *= CROSSWALK_EDGE_BONUS;
      }

      const tentativeG = (gScore[current] ?? Infinity) + edgeCost;
      const tentativeReal = (realDist[current] ?? Infinity) + neighbor.dist;

      if (tentativeG < (gScore[neighbor.to] ?? Infinity)) {
        cameFrom[neighbor.to] = current;
        cameFromEdge[neighbor.to] = neighbor;
        gScore[neighbor.to] = tentativeG;
        realDist[neighbor.to] = tentativeReal;
        const nCoords = graph.nodes[neighbor.to];
        fScore[neighbor.to] =
          tentativeG + haversine(nCoords[1], nCoords[0], endCoords[1], endCoords[0]);

        if (!openSet.includes(neighbor.to)) {
          openSet.push(neighbor.to);
        }
      }
    }
  }

  return null; // no path found
}
