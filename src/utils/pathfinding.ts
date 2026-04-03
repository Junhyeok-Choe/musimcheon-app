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
}

// [PATH-02a] Crosswalk proximity threshold (meters)
// Nodes within this distance of a crosswalk are considered "crosswalk-accessible"
const CROSSWALK_PROXIMITY_M = 30;

// [PATH-02b] Penalty multiplier for edges that lead to nodes without a nearby crosswalk
// A value of 1.4 means the effective cost is 40% higher, making the pathfinder
// prefer routes through crosswalk-accessible intersections
const NO_CROSSWALK_PENALTY = 1.4;

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
export function buildAdjacencyList(graph: RoutingGraphData): Record<string, AdjEntry[]> {
  const adj: Record<string, AdjEntry[]> = {};

  for (const nodeId of Object.keys(graph.nodes)) {
    adj[nodeId] = [];
  }

  for (const edge of graph.edges) {
    if (!adj[edge.f]) adj[edge.f] = [];
    if (!adj[edge.t]) adj[edge.t] = [];
    adj[edge.f].push({ to: edge.t, dist: edge.d });
    adj[edge.t].push({ to: edge.f, dist: edge.d }); // bidirectional for walking
  }

  return adj;
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
  adjacencyList: Record<string, AdjEntry[]>,
  crosswalkNodes?: Set<string>
): RouteResult | null {
  const startNode = findNearestNode(startLat, startLng, graph.nodes);
  const endNode = findNearestNode(endLat, endLng, graph.nodes);

  if (!startNode || !endNode) return null;
  if (startNode === endNode) return { path: [], distance: 0, time: 0 };

  // [PATH-05a] A* with priority queue (simple sorted array for small graph)
  const gScore: Record<string, number> = { [startNode]: 0 };
  const fScore: Record<string, number> = {};
  const cameFrom: Record<string, string> = {};
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
      // [PATH-05c] Reconstruct path
      const path: [number, number][] = [];
      let node = endNode;
      while (node) {
        const coords = graph.nodes[node];
        path.unshift([coords[1], coords[0]]); // [lat, lng]
        node = cameFrom[node];
      }

      // Add actual start/end points
      path.unshift([startLat, startLng]);
      path.push([endLat, endLng]);

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

      // [PATH-05d] Apply crosswalk penalty if neighbor node lacks a crosswalk
      let edgeCost = neighbor.dist;
      if (crosswalkNodes && crosswalkNodes.size > 0 && !crosswalkNodes.has(neighbor.to)) {
        edgeCost *= NO_CROSSWALK_PENALTY;
      }

      const tentativeG = (gScore[current] ?? Infinity) + edgeCost;
      const tentativeReal = (realDist[current] ?? Infinity) + neighbor.dist;

      if (tentativeG < (gScore[neighbor.to] ?? Infinity)) {
        cameFrom[neighbor.to] = current;
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
