import { TILE_WIDTH, TILE_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from '../utils/Constants';

/**
 * Isometric coordinate utilities
 *
 * Grid coordinates: (x, y) where x and y are tile indices
 * Screen coordinates: (screenX, screenY) pixel positions
 *
 * Isometric projection uses a 2:1 ratio diamond pattern
 */

export interface GridPosition {
  x: number;
  y: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Convert grid coordinates to screen (isometric) coordinates
 */
export function gridToScreen(gridX: number, gridY: number): ScreenPosition {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/**
 * Convert screen coordinates to grid coordinates
 */
export function screenToGrid(screenX: number, screenY: number): GridPosition {
  // Inverse of the isometric transform
  const x = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const y = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2;
  return { x, y };
}

/**
 * Round screen coordinates to nearest grid cell
 */
export function screenToGridRounded(screenX: number, screenY: number): GridPosition {
  const { x, y } = screenToGrid(screenX, screenY);
  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

/**
 * Check if grid position is within world bounds
 */
export function isValidGridPosition(gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridX < WORLD_WIDTH && gridY >= 0 && gridY < WORLD_HEIGHT;
}

/**
 * Get the center of the world in screen coordinates
 */
export function getWorldCenter(): ScreenPosition {
  return gridToScreen(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
}

/**
 * Calculate depth for proper isometric rendering (higher Y = rendered later)
 */
export function getDepth(gridX: number, gridY: number, layer: number = 0): number {
  return (gridX + gridY) * 10 + layer;
}

/**
 * Get Manhattan distance between two grid positions (for pathfinding heuristic)
 */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Get adjacent grid positions (4-directional)
 */
export function getNeighbors(pos: GridPosition): GridPosition[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ].filter(p => isValidGridPosition(p.x, p.y));
}
