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

// [PATH-05] A* pathfinding algorithm
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
  if (startNode === endNode) return { path: [], distance: 0, time: 0 };

  // [PATH-05a] A* with priority queue (simple sorted array for small graph)
  const gScore: Record<string, number> = { [startNode]: 0 };
  const fScore: Record<string, number> = {};
  const cameFrom: Record<string, string> = {};
  const closedSet = new Set<string>();

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

      const distance = gScore[endNode];
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

      const tentativeG = (gScore[current] ?? Infinity) + neighbor.dist;

      if (tentativeG < (gScore[neighbor.to] ?? Infinity)) {
        cameFrom[neighbor.to] = current;
        gScore[neighbor.to] = tentativeG;
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
