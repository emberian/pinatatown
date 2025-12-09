import Phaser from 'phaser';
import { GridPosition, gridToScreen, getDepth } from '../world/IsoUtils';
import { IsoMap } from '../world/IsoMap';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { SeasonSystem, Season } from './SeasonSystem';
import { TerrainType } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

/**
 * Resource nodes are map features that produce resources over time.
 * They can be depleted by harvesting and regenerate slowly.
 */

export enum ResourceNodeType {
  BerryBush = 'berryBush',
  FlowerPatch = 'flowerPatch',
  Hive = 'hive', // Wild bee hive (produces honey slowly)
}

export interface ResourceNodeConfig {
  type: ResourceNodeType;
  produces: ResourceType;
  baseYield: number;          // Resources per harvest
  growthTime: number;         // ms to grow one resource
  maxCapacity: number;        // Maximum stored resources
  seasonalMultipliers: Record<Season, number>;
  emoji: string;              // Visual representation
  terrainRequirement?: TerrainType[];
}

export const NODE_CONFIGS: Record<ResourceNodeType, ResourceNodeConfig> = {
  [ResourceNodeType.BerryBush]: {
    type: ResourceNodeType.BerryBush,
    produces: ResourceType.Berry,
    baseYield: 1,
    growthTime: 20000,        // 20 seconds per berry
    maxCapacity: 5,
    seasonalMultipliers: {
      [Season.Spring]: 1.5,
      [Season.Summer]: 2.0,
      [Season.Autumn]: 1.0,
      [Season.Winter]: 0.1,   // Almost no growth in winter
    },
    emoji: '🫐',
    terrainRequirement: [TerrainType.Grass, TerrainType.Flowers],
  },
  [ResourceNodeType.FlowerPatch]: {
    type: ResourceNodeType.FlowerPatch,
    produces: ResourceType.Seed,
    baseYield: 2,
    growthTime: 30000,        // 30 seconds per seed batch
    maxCapacity: 8,
    seasonalMultipliers: {
      [Season.Spring]: 2.0,
      [Season.Summer]: 1.5,
      [Season.Autumn]: 0.5,
      [Season.Winter]: 0.0,   // No seeds in winter
    },
    emoji: '🌸',
    terrainRequirement: [TerrainType.Flowers],
  },
  [ResourceNodeType.Hive]: {
    type: ResourceNodeType.Hive,
    produces: ResourceType.Honey,
    baseYield: 1,
    growthTime: 60000,        // 60 seconds per honey
    maxCapacity: 3,
    seasonalMultipliers: {
      [Season.Spring]: 1.2,
      [Season.Summer]: 1.5,
      [Season.Autumn]: 0.8,
      [Season.Winter]: 0.0,   // Bees hibernate
    },
    emoji: '🐝',
  },
};

export class ResourceNode extends Phaser.GameObjects.Container {
  public readonly id: number;
  public readonly nodeType: ResourceNodeType;
  public readonly config: ResourceNodeConfig;

  private gridX: number;
  private gridY: number;

  private currentResources: number;
  private growthTimer: number = 0;

  private sprite: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;

  private static idCounter = 0;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    nodeType: ResourceNodeType
  ) {
    const screenPos = gridToScreen(gridX, gridY);
    super(scene, screenPos.x, screenPos.y);

    this.id = ResourceNode.idCounter++;
    this.gridX = gridX;
    this.gridY = gridY;
    this.nodeType = nodeType;
    this.config = NODE_CONFIGS[nodeType];

    // Start partially full
    this.currentResources = Math.floor(this.config.maxCapacity * 0.6);

    // Create visual - emoji representation
    this.sprite = scene.add.text(0, -16, this.config.emoji, {
      fontSize: '24px',
    });
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Resource count indicator
    this.countText = scene.add.text(8, -8, '', {
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.countText.setOrigin(0, 0.5);
    this.add(this.countText);

    this.setDepth(getDepth(gridX, gridY, 0.8));
    this.updateVisuals();

    // Make interactive for harvesting
    this.setSize(32, 32);
    this.setInteractive();

    scene.add.existing(this);
  }

  getGridPosition(): GridPosition {
    return { x: this.gridX, y: this.gridY };
  }

  getCurrentResources(): number {
    return this.currentResources;
  }

  hasResources(): boolean {
    return this.currentResources > 0;
  }

  /**
   * Update growth based on season
   */
  update(delta: number, season: Season): void {
    if (this.currentResources >= this.config.maxCapacity) {
      return; // At capacity
    }

    const seasonMult = this.config.seasonalMultipliers[season];
    if (seasonMult <= 0) {
      return; // No growth this season
    }

    this.growthTimer += delta * seasonMult;

    if (this.growthTimer >= this.config.growthTime) {
      this.growthTimer = 0;
      this.currentResources = Math.min(
        this.config.maxCapacity,
        this.currentResources + 1
      );
      this.updateVisuals();
    }
  }

  /**
   * Harvest resources from this node
   * Returns number of resources harvested
   */
  harvest(): number {
    if (this.currentResources <= 0) {
      return 0;
    }

    const harvested = Math.min(this.config.baseYield, this.currentResources);
    this.currentResources -= harvested;

    this.updateVisuals();
    return harvested;
  }

  private updateVisuals(): void {
    // Show resource count
    if (this.currentResources > 0) {
      this.countText.setText(`×${this.currentResources}`);
      this.sprite.setAlpha(1);
    } else {
      this.countText.setText('');
      this.sprite.setAlpha(0.3); // Faded when depleted
    }
  }
}

/**
 * Manages all resource nodes in the world
 */
export class ResourceNodeSystem {
  private scene: Phaser.Scene;
  private isoMap: IsoMap;
  private resourceManager: ResourceManager;
  private seasonSystem: SeasonSystem | null = null;

  private nodes: ResourceNode[] = [];

  constructor(
    scene: Phaser.Scene,
    isoMap: IsoMap,
    resourceManager: ResourceManager
  ) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.resourceManager = resourceManager;
  }

  setSeasonSystem(seasonSystem: SeasonSystem): void {
    this.seasonSystem = seasonSystem;
  }

  /**
   * Generate natural resource nodes across the map
   */
  generateNodes(): void {
    // Scan map for suitable locations
    for (let x = 2; x < 30; x += 4) {
      for (let y = 2; y < 30; y += 4) {
        const tile = this.isoMap.getTile(x, y);
        if (!tile || !tile.walkable) continue;

        // Random chance to spawn based on terrain
        if (tile.terrain === TerrainType.Flowers && Math.random() < 0.6) {
          // Flower patches produce seeds
          this.createNode(x, y, ResourceNodeType.FlowerPatch);
        } else if (tile.terrain === TerrainType.Grass && Math.random() < 0.3) {
          // Berry bushes on grass
          this.createNode(x, y, ResourceNodeType.BerryBush);
        }
      }
    }

    // Place a few wild hives
    for (let i = 0; i < 2; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = 5 + Math.floor(Math.random() * 22);
        y = 5 + Math.floor(Math.random() * 22);
        attempts++;
      } while (
        (!this.isoMap.isWalkable(x, y) || this.hasNodeAt(x, y)) &&
        attempts < 20
      );

      if (attempts < 20) {
        this.createNode(x, y, ResourceNodeType.Hive);
      }
    }

    console.log(`Generated ${this.nodes.length} resource nodes`);
  }

  private createNode(x: number, y: number, type: ResourceNodeType): ResourceNode {
    const node = new ResourceNode(this.scene, x, y, type);
    this.nodes.push(node);
    return node;
  }

  private hasNodeAt(x: number, y: number): boolean {
    return this.nodes.some(n => {
      const pos = n.getGridPosition();
      return pos.x === x && pos.y === y;
    });
  }

  update(delta: number): void {
    const season = this.seasonSystem?.getSeason() ?? Season.Summer;

    for (const node of this.nodes) {
      node.update(delta, season);
    }
  }

  /**
   * Find nearest harvestable node of type
   */
  findNearestNode(
    pos: GridPosition,
    type?: ResourceNodeType
  ): ResourceNode | null {
    let nearest: ResourceNode | null = null;
    let nearestDist = Infinity;

    for (const node of this.nodes) {
      if (!node.hasResources()) continue;
      if (type && node.nodeType !== type) continue;

      const nodePos = node.getGridPosition();
      const dist = Math.abs(nodePos.x - pos.x) + Math.abs(nodePos.y - pos.y);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Harvest from a specific node and spawn resources
   */
  harvestNode(node: ResourceNode): number {
    const harvested = node.harvest();

    if (harvested > 0) {
      // Spawn physical resources at the node location
      const nodePos = node.getGridPosition();
      for (let i = 0; i < harvested; i++) {
        const resource = this.resourceManager.spawnResource(
          nodePos.x,
          nodePos.y,
          node.config.produces
        );
        EventBus.emit('resource:harvested', node, resource);
      }
    }

    return harvested;
  }

  getNodeAt(pos: GridPosition): ResourceNode | null {
    return this.nodes.find(n => {
      const nPos = n.getGridPosition();
      return nPos.x === pos.x && nPos.y === pos.y;
    }) ?? null;
  }

  getAllNodes(): ResourceNode[] {
    return [...this.nodes];
  }

  getHarvestableNodes(): ResourceNode[] {
    return this.nodes.filter(n => n.hasResources());
  }

  /**
   * Get seasonal yield forecast
   */
  getSeasonalForecast(season: Season): { type: ResourceNodeType; expectedYield: number }[] {
    const forecast: { type: ResourceNodeType; expectedYield: number }[] = [];

    for (const nodeType of Object.values(ResourceNodeType)) {
      const config = NODE_CONFIGS[nodeType];
      const nodesOfType = this.nodes.filter(n => n.nodeType === nodeType);
      const mult = config.seasonalMultipliers[season];

      // Expected yield per minute
      const yieldsPerMinute = nodesOfType.length * (60000 / config.growthTime) * mult;

      forecast.push({
        type: nodeType,
        expectedYield: Math.round(yieldsPerMinute * 10) / 10,
      });
    }

    return forecast;
  }
}
