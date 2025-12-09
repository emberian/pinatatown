import Phaser from 'phaser';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TerrainType,
} from '../utils/Constants';
import { gridToScreen, getDepth, screenToGridRounded, isValidGridPosition } from './IsoUtils';

interface TileData {
  terrain: TerrainType;
  walkable: boolean;
}

/**
 * Isometric tilemap for the game world
 */
export class IsoMap {
  private scene: Phaser.Scene;
  private tiles: TileData[][] = [];
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.initializeTiles();
    this.renderTiles();
  }

  private initializeTiles(): void {
    // Initialize with simple procedural generation
    for (let x = 0; x < WORLD_WIDTH; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        // Simple terrain generation
        const noise = this.simpleNoise(x, y);

        let terrain: TerrainType;
        let walkable = true;

        if (noise < 0.15) {
          terrain = TerrainType.Water;
          walkable = false;
        } else if (noise < 0.25) {
          terrain = TerrainType.Dirt;
        } else if (noise > 0.7 && Math.random() > 0.7) {
          terrain = TerrainType.Flowers;
        } else {
          terrain = TerrainType.Grass;
        }

        this.tiles[x][y] = { terrain, walkable };
      }
    }
  }

  private simpleNoise(x: number, y: number): number {
    // Simple pseudo-random noise for terrain variety
    const scale = 0.1;
    const value =
      Math.sin(x * scale * 2.1 + 0.5) * 0.5 +
      Math.cos(y * scale * 1.7 + 0.3) * 0.5 +
      Math.sin((x + y) * scale * 0.9) * 0.3;
    return (value + 1.3) / 2.6; // Normalize to 0-1
  }

  private renderTiles(): void {
    // Render tiles in correct order for isometric depth
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const tile = this.tiles[x][y];
        const { x: screenX, y: screenY } = gridToScreen(x, y);

        const textureKey = `tile-${tile.terrain}`;
        const sprite = this.scene.add.image(screenX, screenY, textureKey);

        // Set origin to top-center for proper isometric alignment
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(getDepth(x, y, 0));

        // Make tiles interactive for click detection
        sprite.setInteractive();
        sprite.setData('gridX', x);
        sprite.setData('gridY', y);

        this.tileSprites[y][x] = sprite;
        this.container.add(sprite);
      }
    }
  }

  getTile(gridX: number, gridY: number): TileData | null {
    if (!isValidGridPosition(gridX, gridY)) return null;
    return this.tiles[gridX][gridY];
  }

  isWalkable(gridX: number, gridY: number): boolean {
    const tile = this.getTile(gridX, gridY);
    return tile ? tile.walkable : false;
  }

  setTerrain(gridX: number, gridY: number, terrain: TerrainType): void {
    if (!isValidGridPosition(gridX, gridY)) return;

    this.tiles[gridX][gridY].terrain = terrain;
    this.tiles[gridX][gridY].walkable = terrain !== TerrainType.Water;

    // Update sprite
    const sprite = this.tileSprites[gridY][gridX];
    sprite.setTexture(`tile-${terrain}`);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Get grid position from screen coordinates (accounting for camera)
   */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const pos = screenToGridRounded(screenX, screenY);
    if (isValidGridPosition(pos.x, pos.y)) {
      return pos;
    }
    return null;
  }
}
