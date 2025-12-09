import Phaser from 'phaser';
import { GridPosition, gridToScreen, getDepth } from '../world/IsoUtils';

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
    this.setVisible(false); // Hidden when in stockpile
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

/**
 * Manages all resources in the game
 */
export class ResourceManager {
  private scene: Phaser.Scene;
  private resources: Resource[] = [];
  private stockpileResources: Map<ResourceType, number> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Initialize stockpile counts
    for (const type of Object.values(ResourceType)) {
      this.stockpileResources.set(type, 0);
    }
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

  // Add to stockpile (resource is consumed/hidden)
  addToStockpile(resource: Resource): void {
    const type = resource.resourceType;
    const current = this.stockpileResources.get(type) ?? 0;
    this.stockpileResources.set(type, current + 1);
    resource.storeInStockpile();
  }

  // Take from stockpile
  takeFromStockpile(type: ResourceType): boolean {
    const current = this.stockpileResources.get(type) ?? 0;
    if (current > 0) {
      this.stockpileResources.set(type, current - 1);
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
}
