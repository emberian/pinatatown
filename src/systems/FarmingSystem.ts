import Phaser from 'phaser';
import { GridPosition, gridToScreen, getDepth } from '../world/IsoUtils';
import { ZoneManager, ZoneType } from '../world/Zone';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { SeasonSystem, Season } from './SeasonSystem';
import { EventBus } from '../utils/EventBus';
import { TerrainType } from '../utils/Constants';
import { IsoMap } from '../world/IsoMap';

/**
 * The Farming system gives Garden zones purpose.
 * Plant seeds → crops grow over time → harvest resources
 * Different crops attract different species and have different yields.
 */

export enum CropType {
  Carrot = 'carrot',           // Basic, fast growing, feeds everyone
  Sunflower = 'sunflower',     // Attracts Buzzlegum, produces seeds
  Clover = 'clover',           // Attracts Moozipan, boosts milk production
  Chili = 'chili',             // Attracts Rashberry, spicy!
  Pumpkin = 'pumpkin',         // High yield but slow, winter storage
  Turnip = 'turnip',           // Grows even in autumn, emergency food
}

export interface CropData {
  type: CropType;
  name: string;
  icon: string;
  growthTime: number;          // Base time in ms to fully grow
  harvestYield: { type: ResourceType; min: number; max: number };
  seedCost: number;            // Seeds needed to plant
  waterNeeded: boolean;        // Needs water tile nearby?
  preferredSeason: Season | null;  // Grows faster in this season
  canGrowInWinter: boolean;    // Can it survive winter?
  attractsSpecies?: string;    // Bonus to attracting this species
  color: number;               // Visual color when growing
}

export const CROP_DATA: Record<CropType, CropData> = {
  [CropType.Carrot]: {
    type: CropType.Carrot,
    name: 'Carrot',
    icon: '🥕',
    growthTime: 30000,         // 30 seconds
    harvestYield: { type: ResourceType.Berry, min: 2, max: 4 },
    seedCost: 1,
    waterNeeded: false,
    preferredSeason: Season.Spring,
    canGrowInWinter: false,
    color: 0xFFA500,
  },
  [CropType.Sunflower]: {
    type: CropType.Sunflower,
    name: 'Sunflower',
    icon: '🌻',
    growthTime: 45000,
    harvestYield: { type: ResourceType.Seed, min: 3, max: 6 },
    seedCost: 2,
    waterNeeded: true,
    preferredSeason: Season.Summer,
    canGrowInWinter: false,
    attractsSpecies: 'buzzlegum',
    color: 0xFFD700,
  },
  [CropType.Clover]: {
    type: CropType.Clover,
    name: 'Clover',
    icon: '☘️',
    growthTime: 25000,
    harvestYield: { type: ResourceType.Berry, min: 1, max: 2 },
    seedCost: 1,
    waterNeeded: true,
    preferredSeason: Season.Spring,
    canGrowInWinter: false,
    attractsSpecies: 'moozipan',
    color: 0x228B22,
  },
  [CropType.Chili]: {
    type: CropType.Chili,
    name: 'Chili Pepper',
    icon: '🌶️',
    growthTime: 50000,
    harvestYield: { type: ResourceType.Berry, min: 2, max: 5 },
    seedCost: 2,
    waterNeeded: false,
    preferredSeason: Season.Summer,
    canGrowInWinter: false,
    attractsSpecies: 'rashberry',
    color: 0xFF4500,
  },
  [CropType.Pumpkin]: {
    type: CropType.Pumpkin,
    name: 'Pumpkin',
    icon: '🎃',
    growthTime: 90000,         // 1.5 minutes - slow but high yield
    harvestYield: { type: ResourceType.Berry, min: 5, max: 10 },
    seedCost: 3,
    waterNeeded: true,
    preferredSeason: Season.Autumn,
    canGrowInWinter: false,
    color: 0xFF8C00,
  },
  [CropType.Turnip]: {
    type: CropType.Turnip,
    name: 'Turnip',
    icon: '🥬',
    growthTime: 40000,
    harvestYield: { type: ResourceType.Berry, min: 2, max: 4 },
    seedCost: 1,
    waterNeeded: false,
    preferredSeason: Season.Autumn,
    canGrowInWinter: true,     // The only winter-hardy crop!
    color: 0xEE82EE,
  },
};

export enum CropStage {
  Planted = 'planted',
  Sprouting = 'sprouting',
  Growing = 'growing',
  Mature = 'mature',
  Withered = 'withered',       // Died from lack of care or winter
}

export interface PlantedCrop {
  id: number;
  type: CropType;
  position: GridPosition;
  stage: CropStage;
  growthProgress: number;      // 0-100
  needsWater: boolean;
  waterLevel: number;          // 0-100
  sprite: Phaser.GameObjects.Container;
}

export const FarmingEvents = {
  CROP_PLANTED: 'farming:planted',
  CROP_READY: 'farming:ready',
  CROP_HARVESTED: 'farming:harvested',
  CROP_WITHERED: 'farming:withered',
} as const;

let cropIdCounter = 0;

export class FarmingSystem {
  private scene: Phaser.Scene;
  private zoneManager: ZoneManager;
  private resourceManager: ResourceManager;
  private seasonSystem: SeasonSystem | null = null;
  private isoMap: IsoMap;

  private crops: Map<number, PlantedCrop> = new Map();
  private cropsByPosition: Map<string, PlantedCrop> = new Map();

  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 1000; // Update every second

  // Selected crop type for planting
  private selectedCropType: CropType = CropType.Carrot;

  constructor(
    scene: Phaser.Scene,
    zoneManager: ZoneManager,
    resourceManager: ResourceManager,
    isoMap: IsoMap
  ) {
    this.scene = scene;
    this.zoneManager = zoneManager;
    this.resourceManager = resourceManager;
    this.isoMap = isoMap;
  }

  setSeasonSystem(seasonSystem: SeasonSystem): void {
    this.seasonSystem = seasonSystem;
  }

  update(delta: number): void {
    this.updateTimer += delta;
    if (this.updateTimer < this.UPDATE_INTERVAL) return;
    this.updateTimer = 0;

    const seasonMult = this.seasonSystem?.getCropGrowthMultiplier() ?? 1;
    const currentSeason = this.seasonSystem?.getSeason() ?? Season.Spring;

    for (const [, crop] of this.crops) {
      if (crop.stage === CropStage.Withered || crop.stage === CropStage.Mature) {
        continue;
      }

      const cropData = CROP_DATA[crop.type];

      // Check for winter death
      if (currentSeason === Season.Winter && !cropData.canGrowInWinter) {
        this.witherCrop(crop);
        continue;
      }

      // Water level decay
      if (cropData.waterNeeded) {
        crop.waterLevel -= 2;
        if (crop.waterLevel <= 0) {
          crop.needsWater = true;
          // Crops don't grow without water
          this.updateCropVisual(crop);
          continue;
        }
      }

      // Calculate growth rate
      let growthRate = 1;

      // Season bonus
      if (cropData.preferredSeason === currentSeason) {
        growthRate *= 1.5;
      }

      // Apply season multiplier
      growthRate *= seasonMult;

      // Calculate growth per update
      const baseGrowthPerSecond = 100 / (cropData.growthTime / 1000);
      const growth = baseGrowthPerSecond * growthRate;

      crop.growthProgress = Math.min(100, crop.growthProgress + growth);

      // Update stage
      const oldStage = crop.stage as CropStage;
      let justMatured = false;

      if (crop.growthProgress < 25) {
        crop.stage = CropStage.Planted;
      } else if (crop.growthProgress < 50) {
        crop.stage = CropStage.Sprouting;
      } else if (crop.growthProgress < 100) {
        crop.stage = CropStage.Growing;
      } else {
        crop.stage = CropStage.Mature;
        justMatured = oldStage !== CropStage.Mature;
      }

      // Check if we just matured
      if (justMatured) {
        EventBus.emit(FarmingEvents.CROP_READY, crop);
        console.log(`${cropData.name} is ready to harvest!`);
      }

      this.updateCropVisual(crop);
    }
  }

  private posKey(pos: GridPosition): string {
    return `${pos.x},${pos.y}`;
  }

  canPlant(position: GridPosition): boolean {
    // Must be in a garden zone
    const zone = this.zoneManager.getZoneAt(position);
    if (!zone || zone.type !== ZoneType.Garden) {
      return false;
    }

    // Must not already have a crop
    if (this.cropsByPosition.has(this.posKey(position))) {
      return false;
    }

    // Must be walkable terrain
    if (!this.isoMap.isWalkable(position.x, position.y)) {
      return false;
    }

    return true;
  }

  plant(position: GridPosition, cropType: CropType): PlantedCrop | null {
    if (!this.canPlant(position)) {
      return null;
    }

    const cropData = CROP_DATA[cropType];

    // Check seed cost
    const seedCount = this.resourceManager.getStockpileCount(ResourceType.Seed);
    if (seedCount < cropData.seedCost) {
      console.log(`Not enough seeds to plant ${cropData.name} (need ${cropData.seedCost})`);
      return null;
    }

    // Deduct seeds
    for (let i = 0; i < cropData.seedCost; i++) {
      this.resourceManager.takeFromStockpile(ResourceType.Seed);
    }

    // Check water requirement
    const hasWater = this.hasWaterNearby(position);
    const needsWater = cropData.waterNeeded && !hasWater;

    // Create crop
    const crop: PlantedCrop = {
      id: cropIdCounter++,
      type: cropType,
      position: { ...position },
      stage: CropStage.Planted,
      growthProgress: 0,
      needsWater,
      waterLevel: hasWater ? 100 : 50,
      sprite: this.createCropSprite(position, cropType),
    };

    this.crops.set(crop.id, crop);
    this.cropsByPosition.set(this.posKey(position), crop);

    EventBus.emit(FarmingEvents.CROP_PLANTED, crop);
    console.log(`Planted ${cropData.name} at (${position.x}, ${position.y})`);

    return crop;
  }

  private hasWaterNearby(position: GridPosition): boolean {
    const range = 3;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const tile = this.isoMap.getTile(position.x + dx, position.y + dy);
        if (tile && tile.terrain === TerrainType.Water) {
          return true;
        }
      }
    }
    return false;
  }

  harvest(cropOrId: PlantedCrop | number): boolean {
    const crop = typeof cropOrId === 'number'
      ? this.crops.get(cropOrId)
      : cropOrId;

    if (!crop || crop.stage !== CropStage.Mature) {
      return false;
    }

    const cropData = CROP_DATA[crop.type];

    // Calculate yield
    const yieldAmount = cropData.harvestYield.min +
      Math.floor(Math.random() * (cropData.harvestYield.max - cropData.harvestYield.min + 1));

    // Spawn resources on ground for gatherers to collect
    for (let i = 0; i < yieldAmount; i++) {
      this.resourceManager.spawnResource(
        crop.position.x,
        crop.position.y,
        cropData.harvestYield.type
      );
    }

    // Bonus: chance to get seeds back
    if (Math.random() < 0.3) {
      this.resourceManager.spawnResource(crop.position.x, crop.position.y, ResourceType.Seed);
    }

    EventBus.emit(FarmingEvents.CROP_HARVESTED, crop, yieldAmount);
    console.log(`Harvested ${yieldAmount} ${cropData.harvestYield.type} from ${cropData.name}`);

    // Remove crop
    this.removeCrop(crop);

    return true;
  }

  waterCrop(crop: PlantedCrop): void {
    crop.waterLevel = 100;
    crop.needsWater = false;
    this.updateCropVisual(crop);
  }

  private witherCrop(crop: PlantedCrop): void {
    crop.stage = CropStage.Withered;
    EventBus.emit(FarmingEvents.CROP_WITHERED, crop);

    const cropData = CROP_DATA[crop.type];
    console.log(`${cropData.name} withered!`);

    // Visual update
    this.updateCropVisual(crop);

    // Remove after delay
    this.scene.time.delayedCall(5000, () => {
      this.removeCrop(crop);
    });
  }

  private removeCrop(crop: PlantedCrop): void {
    crop.sprite.destroy();
    this.crops.delete(crop.id);
    this.cropsByPosition.delete(this.posKey(crop.position));
  }

  private createCropSprite(position: GridPosition, cropType: CropType): Phaser.GameObjects.Container {
    const screenPos = gridToScreen(position.x, position.y);
    const container = this.scene.add.container(screenPos.x, screenPos.y);

    const cropData = CROP_DATA[cropType];

    // Base plant graphic
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(cropData.color, 1);
    graphics.fillCircle(0, -4, 4); // Seed dot
    container.add(graphics);

    // Growth text (will show stage)
    const text = this.scene.add.text(0, -20, cropData.icon, { fontSize: '12px' });
    text.setOrigin(0.5);
    text.setAlpha(0.5); // Dim until grown
    container.add(text);

    container.setDepth(getDepth(position.x, position.y, 0.3));

    return container;
  }

  private updateCropVisual(crop: PlantedCrop): void {
    const cropData = CROP_DATA[crop.type];
    const graphics = crop.sprite.list[0] as Phaser.GameObjects.Graphics;
    const text = crop.sprite.list[1] as Phaser.GameObjects.Text;

    graphics.clear();

    switch (crop.stage) {
      case CropStage.Planted:
        graphics.fillStyle(cropData.color, 0.5);
        graphics.fillCircle(0, -4, 3);
        text.setAlpha(0.3);
        text.setScale(0.6);
        break;

      case CropStage.Sprouting:
        graphics.fillStyle(0x228B22, 1); // Green stem
        graphics.fillRect(-1, -8, 2, 8);
        graphics.fillStyle(cropData.color, 0.7);
        graphics.fillCircle(0, -10, 4);
        text.setAlpha(0.5);
        text.setScale(0.8);
        break;

      case CropStage.Growing:
        graphics.fillStyle(0x228B22, 1);
        graphics.fillRect(-2, -14, 4, 14);
        // Leaves
        graphics.fillEllipse(-5, -10, 6, 3);
        graphics.fillEllipse(5, -10, 6, 3);
        graphics.fillStyle(cropData.color, 0.9);
        graphics.fillCircle(0, -16, 6);
        text.setAlpha(0.8);
        text.setScale(1);
        text.setY(-28);
        break;

      case CropStage.Mature:
        graphics.fillStyle(0x228B22, 1);
        graphics.fillRect(-2, -16, 4, 16);
        graphics.fillEllipse(-6, -12, 8, 4);
        graphics.fillEllipse(6, -12, 8, 4);
        graphics.fillStyle(cropData.color, 1);
        graphics.fillCircle(0, -20, 8);
        // Highlight to show ready
        graphics.lineStyle(2, 0xFFFF00, 0.8);
        graphics.strokeCircle(0, -20, 10);
        text.setAlpha(1);
        text.setScale(1.2);
        text.setY(-34);
        break;

      case CropStage.Withered:
        graphics.fillStyle(0x8B4513, 0.6);
        graphics.fillRect(-1, -8, 2, 8);
        graphics.fillStyle(0x654321, 0.5);
        graphics.fillCircle(0, -10, 4);
        text.setAlpha(0.3);
        text.setTint(0x888888);
        break;
    }

    // Water indicator
    if (crop.needsWater) {
      const waterText = this.scene.add.text(8, -12, '💧', { fontSize: '10px' });
      waterText.setOrigin(0, 0.5);
      crop.sprite.add(waterText);

      // Pulse animation
      this.scene.tweens.add({
        targets: waterText,
        alpha: 0.3,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // Getters
  getCropAt(position: GridPosition): PlantedCrop | null {
    return this.cropsByPosition.get(this.posKey(position)) ?? null;
  }

  getAllCrops(): PlantedCrop[] {
    return Array.from(this.crops.values());
  }

  getMatureCrops(): PlantedCrop[] {
    return this.getAllCrops().filter(c => c.stage === CropStage.Mature);
  }

  getCropsNeedingWater(): PlantedCrop[] {
    return this.getAllCrops().filter(c => c.needsWater && c.stage !== CropStage.Withered);
  }

  getSelectedCropType(): CropType {
    return this.selectedCropType;
  }

  setSelectedCropType(type: CropType): void {
    this.selectedCropType = type;
  }

  getCropTypes(): CropType[] {
    return Object.values(CropType);
  }

  getCropData(type: CropType): CropData {
    return CROP_DATA[type];
  }
}
