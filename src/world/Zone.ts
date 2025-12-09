import Phaser from 'phaser';
import { GridPosition, gridToScreen } from './IsoUtils';

export enum ZoneType {
  Stockpile = 'stockpile',
  Sleep = 'sleep',
  Recreation = 'recreation',
  Garden = 'garden',
}

export interface ZoneConfig {
  type: ZoneType;
  color: number;
  name: string;
  description: string;
}

export const ZONE_CONFIGS: Record<ZoneType, ZoneConfig> = {
  [ZoneType.Stockpile]: {
    type: ZoneType.Stockpile,
    color: 0x8b4513,
    name: 'Stockpile',
    description: 'Store resources here',
  },
  [ZoneType.Sleep]: {
    type: ZoneType.Sleep,
    color: 0x4169e1,
    name: 'Sleeping Area',
    description: 'Piñatas rest here',
  },
  [ZoneType.Recreation]: {
    type: ZoneType.Recreation,
    color: 0xff69b4,
    name: 'Fun Zone',
    description: 'Piñatas play here',
  },
  [ZoneType.Garden]: {
    type: ZoneType.Garden,
    color: 0x228b22,
    name: 'Garden',
    description: 'Grow food here',
  },
};

let zoneIdCounter = 0;

/**
 * Represents a designated zone on the map
 */
export class Zone {
  public readonly id: number;
  public readonly type: ZoneType;
  public readonly config: ZoneConfig;
  private tiles: GridPosition[] = [];
  private graphics: Phaser.GameObjects.Graphics;

  // Track piñatas currently using this zone
  private occupants: Set<number> = new Set();

  constructor(scene: Phaser.Scene, type: ZoneType) {
    this.id = zoneIdCounter++;
    this.type = type;
    this.config = ZONE_CONFIGS[type];

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5); // Just above terrain
  }

  /**
   * Register a piñata as using this zone (e.g., sleeping, playing)
   */
  registerOccupant(pinataId: number): void {
    const wasEmpty = this.occupants.size === 0;
    this.occupants.add(pinataId);
    if (wasEmpty) {
      this.redraw(); // Update visual when first occupant arrives
    }
  }

  /**
   * Unregister a piñata from this zone
   */
  unregisterOccupant(pinataId: number): void {
    this.occupants.delete(pinataId);
    if (this.occupants.size === 0) {
      this.redraw(); // Update visual when last occupant leaves
    }
  }

  /**
   * Check if zone has any occupants
   */
  isOccupied(): boolean {
    return this.occupants.size > 0;
  }

  /**
   * Get number of current occupants
   */
  getOccupantCount(): number {
    return this.occupants.size;
  }

  addTile(pos: GridPosition): void {
    // Check if already in zone
    if (this.tiles.some(t => t.x === pos.x && t.y === pos.y)) {
      return;
    }
    this.tiles.push(pos);
    this.redraw();
  }

  removeTile(pos: GridPosition): void {
    this.tiles = this.tiles.filter(t => t.x !== pos.x || t.y !== pos.y);
    this.redraw();
  }

  containsTile(pos: GridPosition): boolean {
    return this.tiles.some(t => t.x === pos.x && t.y === pos.y);
  }

  getTiles(): GridPosition[] {
    return [...this.tiles];
  }

  getRandomTile(): GridPosition | null {
    if (this.tiles.length === 0) return null;
    return this.tiles[Math.floor(Math.random() * this.tiles.length)];
  }

  private redraw(): void {
    this.graphics.clear();

    if (this.tiles.length === 0) return;

    // Brighter alpha when zone is occupied (activity glow)
    const fillAlpha = this.isOccupied() ? 0.5 : 0.3;
    const borderAlpha = this.isOccupied() ? 0.9 : 0.6;
    const borderWidth = this.isOccupied() ? 2 : 1;

    // Draw each tile with zone color overlay
    for (const tile of this.tiles) {
      const { x, y } = gridToScreen(tile.x, tile.y);

      this.graphics.fillStyle(this.config.color, fillAlpha);
      this.graphics.beginPath();
      this.graphics.moveTo(x, y - 16);
      this.graphics.lineTo(x + 32, y);
      this.graphics.lineTo(x, y + 16);
      this.graphics.lineTo(x - 32, y);
      this.graphics.closePath();
      this.graphics.fillPath();

      // Border (thicker when occupied)
      this.graphics.lineStyle(borderWidth, this.config.color, borderAlpha);
      this.graphics.strokePath();
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}

/**
 * Manages all zones in the game
 */
export class ZoneManager {
  private scene: Phaser.Scene;
  private zones: Zone[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createZone(type: ZoneType): Zone {
    const zone = new Zone(this.scene, type);
    this.zones.push(zone);
    return zone;
  }

  removeZone(zone: Zone): void {
    const index = this.zones.indexOf(zone);
    if (index !== -1) {
      zone.destroy();
      this.zones.splice(index, 1);
    }
  }

  getZoneAt(pos: GridPosition): Zone | null {
    for (const zone of this.zones) {
      if (zone.containsTile(pos)) {
        return zone;
      }
    }
    return null;
  }

  getZonesByType(type: ZoneType): Zone[] {
    return this.zones.filter(z => z.type === type);
  }

  getAllZones(): Zone[] {
    return [...this.zones];
  }

  // Find nearest zone of type from position
  findNearestZone(pos: GridPosition, type: ZoneType): { zone: Zone; tile: GridPosition } | null {
    const zones = this.getZonesByType(type);
    let nearestZone: Zone | null = null;
    let nearestTile: GridPosition | null = null;
    let nearestDist = Infinity;

    for (const zone of zones) {
      for (const tile of zone.getTiles()) {
        const dist = Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestZone = zone;
          nearestTile = tile;
        }
      }
    }

    if (nearestZone && nearestTile) {
      return { zone: nearestZone, tile: nearestTile };
    }
    return null;
  }
}
