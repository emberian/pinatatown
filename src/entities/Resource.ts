import Phaser from 'phaser';
import { GridPosition, gridToScreen, getDepth } from '../world/IsoUtils';
import { ZoneManager, ZoneType } from '../world/Zone';

export enum ResourceType {
  Berry = 'berry',
  Seed = 'seed',
  Honey = 'honey',
  CandyMilk = 'candyMilk',
}

export interface ResourceConfig {
  type: ResourceType;
  color: number;
  name: string;
  hungerValue: number;
  stackSize: number;
}

export const RESOURCE_CONFIGS: Record<ResourceType, ResourceConfig> = {
  [ResourceType.Berry]: {
    type: ResourceType.Berry,
    color: 0xff6b6b,
    name: 'Berry',
    hungerValue: 25,
    stackSize: 5,
  },
  [ResourceType.Seed]: {
    type: ResourceType.Seed,
    color: 0xdaa520,
    name: 'Seed',
    hungerValue: 10,
    stackSize: 10,
  },
  [ResourceType.Honey]: {
    type: ResourceType.Honey,
    color: 0xffd700,
    name: 'Honey',
    hungerValue: 40,
    stackSize: 3,
  },
  [ResourceType.CandyMilk]: {
    type: ResourceType.CandyMilk,
    color: 0xffb6c1,
    name: 'Candy Milk',
    hungerValue: 40,
    stackSize: 3,
  },
};

let resourceIdCounter = 0;

/**
 * A resource item in the world (can be on ground, carried, or in stockpile)
 */
export class Resource extends Phaser.GameObjects.Container {
  public readonly id: number;
  public readonly resourceType: ResourceType;
  public readonly config: ResourceConfig;

  private gridX: number;
  private gridY: number;

  private sprite: Phaser.GameObjects.Graphics;
  private isBeingCarried = false;
  private isInStockpile = false;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    type: ResourceType
  ) {
    const screenPos = gridToScreen(gridX, gridY);
    super(scene, screenPos.x, screenPos.y);

    this.id = resourceIdCounter++;
    this.gridX = gridX;
    this.gridY = gridY;
    this.resourceType = type;
    this.config = RESOURCE_CONFIGS[type];

    // Create visual
    this.sprite = scene.add.graphics();
    this.drawResource();
    this.add(this.sprite);

    // Set depth
    this.setDepth(getDepth(gridX, gridY, 0.5));

    scene.add.existing(this);
  }

  private drawResource(): void {
    this.sprite.clear();

    // Draw as a small circle with the resource color
    this.sprite.fillStyle(this.config.color, 1);
    this.sprite.fillCircle(0, -8, 6);

    // Add highlight
    this.sprite.fillStyle(0xffffff, 0.3);
    this.sprite.fillCircle(-2, -10, 2);
  }

  getGridPosition(): GridPosition {
    return { x: this.gridX, y: this.gridY };
  }

  setGridPosition(x: number, y: number): void {
    this.gridX = x;
    this.gridY = y;
    const screenPos = gridToScreen(x, y);
    this.setPosition(screenPos.x, screenPos.y);
    this.setDepth(getDepth(x, y, 0.5));
  }

  pickup(): void {
    this.isBeingCarried = true;
    this.setVisible(false); // Hide while being carried
  }

  drop(x: number, y: number): void {
    this.isBeingCarried = false;
    this.setGridPosition(x, y);
    this.setVisible(true);
  }

  storeInStockpile(): void {
    this.isInStockpile = true;
    // No longer hide - resources stay visible in piles
  }

  /**
   * Move resource to a stockpile pile position with vertical stacking
   */
  moveToStockpilePile(pos: GridPosition, stackIndex: number): void {
    this.isInStockpile = true;
    this.isBeingCarried = false;
    this.gridX = pos.x;
    this.gridY = pos.y;

    const screenPos = gridToScreen(pos.x, pos.y);
    // Stack upward with slight random offset for organic look
    const yOffset = -stackIndex * 4;
    const xOffset = (Math.random() - 0.5) * 6;
    this.setPosition(screenPos.x + xOffset, screenPos.y + yOffset - 8);
    this.setDepth(getDepth(pos.x, pos.y, 0.5 + stackIndex * 0.01));
    this.setVisible(true);
  }

  /**
   * Attach resource visually to a carrier (piñata carrying it)
   */
  attachToCarrier(carrier: Phaser.GameObjects.Container): void {
    this.isBeingCarried = true;
    // Reparent to carrier, position above head
    carrier.add(this);
    this.setPosition(0, -50);
    this.setVisible(true);
    this.setDepth(10); // Above carrier sprite
  }

  /**
   * Detach from carrier before dropping/storing
   */
  detachFromCarrier(): void {
    this.isBeingCarried = false;
    // Caller will handle repositioning
  }

  isCarried(): boolean {
    return this.isBeingCarried;
  }

  isStored(): boolean {
    return this.isInStockpile;
  }

  isAvailable(): boolean {
    return !this.isBeingCarried && !this.isInStockpile;
  }
}

// Import BuildingSystem type for storage bonus
import type { BuildingSystem } from '../systems/BuildingSystem';

const BASE_STORAGE_CAP = 50; // Base maximum resources in stockpile

/**
 * Manages all resources in the game
 */
export class ResourceManager {
  private scene: Phaser.Scene;
  private resources: Resource[] = [];
  private stockpileResources: Map<ResourceType, number> = new Map();

  // Zone manager reference for finding stockpile positions
  private zoneManager: ZoneManager | null = null;

  // Building system reference for storage bonus from Granary
  private buildingSystem: BuildingSystem | null = null;

  // Track resources at each stockpile tile position
  // Key is "x,y", value is array of resources at that position
  private stockpilePiles: Map<string, Resource[]> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Initialize stockpile counts
    for (const type of Object.values(ResourceType)) {
      this.stockpileResources.set(type, 0);
    }
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
  }

  setBuildingSystem(buildingSystem: BuildingSystem): void {
    this.buildingSystem = buildingSystem;
  }

  getStorageCap(): number {
    const bonus = this.buildingSystem?.getTotalStorageBonus() ?? 0;
    return BASE_STORAGE_CAP + bonus;
  }

  getTotalStored(): number {
    let total = 0;
    for (const count of this.stockpileResources.values()) {
      total += count;
    }
    return total;
  }

  isStorageFull(): boolean {
    return this.getTotalStored() >= this.getStorageCap();
  }

  spawnResource(gridX: number, gridY: number, type: ResourceType): Resource {
    const resource = new Resource(this.scene, gridX, gridY, type);
    this.resources.push(resource);
    return resource;
  }

  removeResource(resource: Resource): void {
    const index = this.resources.indexOf(resource);
    if (index !== -1) {
      this.resources.splice(index, 1);
      resource.destroy();
    }
  }

  // Find nearest available resource of type
  findNearestResource(pos: GridPosition, type?: ResourceType): Resource | null {
    let nearest: Resource | null = null;
    let nearestDist = Infinity;

    for (const resource of this.resources) {
      if (!resource.isAvailable()) continue;
      if (type && resource.resourceType !== type) continue;

      const rPos = resource.getGridPosition();
      const dist = Math.abs(rPos.x - pos.x) + Math.abs(rPos.y - pos.y);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = resource;
      }
    }

    return nearest;
  }

  // Find any available resource in an area
  findResourceInArea(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    type?: ResourceType
  ): Resource | null {
    for (const resource of this.resources) {
      if (!resource.isAvailable()) continue;
      if (type && resource.resourceType !== type) continue;

      const pos = resource.getGridPosition();
      if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
        return resource;
      }
    }
    return null;
  }

  // Add to stockpile - resource moves to a visible pile in a stockpile zone
  // Returns false if storage is full
  addToStockpile(resource: Resource): boolean {
    // Check storage cap
    if (this.isStorageFull()) {
      return false; // Storage full - can't add more
    }

    const type = resource.resourceType;
    const current = this.stockpileResources.get(type) ?? 0;
    this.stockpileResources.set(type, current + 1);

    // Find or create a pile position for this resource
    const pile = this.findOrCreatePile(type);
    if (pile) {
      // Move resource to the pile visually
      resource.moveToStockpilePile(pile.position, pile.resources.length);
      pile.resources.push(resource);
    } else {
      // No stockpile zone available - hide as fallback
      resource.storeInStockpile();
    }
    return true;
  }

  /**
   * Find an existing pile of the same type with space, or create a new pile
   */
  private findOrCreatePile(type: ResourceType): { position: GridPosition; resources: Resource[] } | null {
    if (!this.zoneManager) return null;

    const stockpiles = this.zoneManager.getZonesByType(ZoneType.Stockpile);
    if (stockpiles.length === 0) return null;

    const maxPileSize = RESOURCE_CONFIGS[type].stackSize;

    // First pass: find existing pile of same type with space
    for (const zone of stockpiles) {
      for (const tile of zone.getTiles()) {
        const key = `${tile.x},${tile.y}`;
        const existing = this.stockpilePiles.get(key);

        if (existing && existing.length > 0 && existing.length < maxPileSize) {
          // Check if same resource type
          if (existing[0].resourceType === type) {
            return { position: tile, resources: existing };
          }
        }
      }
    }

    // Second pass: find empty tile for new pile
    for (const zone of stockpiles) {
      for (const tile of zone.getTiles()) {
        const key = `${tile.x},${tile.y}`;
        const existing = this.stockpilePiles.get(key);

        if (!existing || existing.length === 0) {
          // Empty tile - create new pile
          const newPile: Resource[] = [];
          this.stockpilePiles.set(key, newPile);
          return { position: tile, resources: newPile };
        }
      }
    }

    return null; // No space available
  }

  // Take from stockpile - removes resource from pile and destroys it
  takeFromStockpile(type: ResourceType): boolean {
    const current = this.stockpileResources.get(type) ?? 0;
    if (current > 0) {
      this.stockpileResources.set(type, current - 1);

      // Find and remove an actual resource from piles
      for (const [key, pile] of this.stockpilePiles.entries()) {
        if (pile.length > 0 && pile[0].resourceType === type) {
          const resource = pile.pop();
          if (resource) {
            // Remove from resources array and destroy
            const index = this.resources.indexOf(resource);
            if (index !== -1) {
              this.resources.splice(index, 1);
            }
            resource.destroy();
          }
          // Clean up empty pile entries
          if (pile.length === 0) {
            this.stockpilePiles.delete(key);
          }
          return true;
        }
      }
      return true;
    }
    return false;
  }

  // Get stockpile count
  getStockpileCount(type: ResourceType): number {
    return this.stockpileResources.get(type) ?? 0;
  }

  // Get total food in stockpile
  getTotalFood(): number {
    return (
      (this.stockpileResources.get(ResourceType.Berry) ?? 0) +
      (this.stockpileResources.get(ResourceType.Seed) ?? 0) +
      (this.stockpileResources.get(ResourceType.Honey) ?? 0) +
      (this.stockpileResources.get(ResourceType.CandyMilk) ?? 0)
    );
  }

  // Take any available food from stockpile
  takeAnyFood(): { type: ResourceType; hungerValue: number } | null {
    // Prefer lower value foods first (save premium for later)
    const priority: ResourceType[] = [
      ResourceType.Seed,
      ResourceType.Berry,
      ResourceType.Honey,
      ResourceType.CandyMilk,
    ];

    for (const type of priority) {
      if (this.takeFromStockpile(type)) {
        return {
          type,
          hungerValue: RESOURCE_CONFIGS[type].hungerValue,
        };
      }
    }
    return null;
  }

  getAllResources(): Resource[] {
    return [...this.resources];
  }

  getAvailableResources(): Resource[] {
    return this.resources.filter(r => r.isAvailable());
  }

  findResourceById(id: number): Resource | null {
    return this.resources.find(r => r.id === id) ?? null;
  }
}
