import { GridPosition, manhattanDistance, getNeighbors } from './IsoUtils';

interface PathNode {
  pos: GridPosition;
  g: number; // Cost from start
  h: number; // Heuristic (estimated cost to goal)
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

/**
 * A* pathfinding implementation for isometric grid
 */
export class Pathfinder {
  private walkableCheck: (x: number, y: number) => boolean;

  constructor(walkableCheck: (x: number, y: number) => boolean) {
    this.walkableCheck = walkableCheck;
  }

  /**
   * Find path from start to goal using A*
   * @returns Array of grid positions from start to goal, or null if no path exists
   */
  findPath(start: GridPosition, goal: GridPosition): GridPosition[] | null {
    // Quick check if goal is walkable
    if (!this.walkableCheck(goal.x, goal.y)) {
      return null;
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      pos: start,
      g: 0,
      h: manhattanDistance(start, goal),
      f: manhattanDistance(start, goal),
      parent: null,
    };

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      // Check if we've reached the goal
      if (current.pos.x === goal.x && current.pos.y === goal.y) {
        return this.reconstructPath(current);
      }

      closedSet.add(`${current.pos.x},${current.pos.y}`);

      // Check all neighbors
      const neighbors = getNeighbors(current.pos);

      for (const neighborPos of neighbors) {
        const key = `${neighborPos.x},${neighborPos.y}`;

        // Skip if already evaluated or not walkable
        if (closedSet.has(key) || !this.walkableCheck(neighborPos.x, neighborPos.y)) {
          continue;
        }

        const g = current.g + 1;
        const h = manhattanDistance(neighborPos, goal);
        const f = g + h;

        // Check if this path is better than any existing one
        const existingNode = openSet.find(
          n => n.pos.x === neighborPos.x && n.pos.y === neighborPos.y
        );

        if (existingNode) {
          if (g < existingNode.g) {
            existingNode.g = g;
            existingNode.f = f;
            existingNode.parent = current;
          }
        } else {
          openSet.push({
            pos: neighborPos,
            g,
            h,
            f,
            parent: current,
          });
        }
      }
    }

    // No path found
    return null;
  }

  private reconstructPath(node: PathNode): GridPosition[] {
    const path: GridPosition[] = [];
    let current: PathNode | null = node;

    while (current !== null) {
      path.unshift(current.pos);
      current = current.parent;
    }

    return path;
  }

  /**
   * Find nearest walkable position to target
   */
  findNearestWalkable(target: GridPosition): GridPosition | null {
    if (this.walkableCheck(target.x, target.y)) {
      return target;
    }

    // Spiral outward to find nearest walkable
    for (let radius = 1; radius < 10; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const x = target.x + dx;
            const y = target.y + dy;
            if (this.walkableCheck(x, y)) {
              return { x, y };
            }
          }
        }
      }
    }

    return null;
  }
}
