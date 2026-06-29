function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function totalDistance(route, distMatrix) {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) {
    d += distMatrix[route[i]][route[i + 1]];
  }
  return d;
}

function nearestNeighbor(n, distMatrix) {
  const visited = new Set([0]);
  const route = [0];
  let current = 0;
  while (visited.size < n) {
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distMatrix[current][j] < bestDist) {
        best = j;
        bestDist = distMatrix[current][j];
      }
    }
    route.push(best);
    visited.add(best);
    current = best;
  }
  return route;
}

function twoOpt(route, distMatrix) {
  let improved = true;
  let best = [...route];
  let bestDist = totalDistance(best, distMatrix);

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const newRoute = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const newDist = totalDistance(newRoute, distMatrix);
        if (newDist < bestDist - 0.001) {
          best = newRoute;
          bestDist = newDist;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function optimizeRoute(start, stops) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return [0];

  const points = [start, ...stops];
  const n = points.length;
  const distMatrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => haversine(points[i], points[j]))
  );

  const nnRoute = nearestNeighbor(n, distMatrix);
  const optimized = twoOpt(nnRoute, distMatrix);

  // Return indices of stops (excluding start point at index 0)
  return optimized.filter(i => i !== 0).map(i => i - 1);
}
