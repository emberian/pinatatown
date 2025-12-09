import Phaser from 'phaser';
import { GridPosition, gridToScreen, getDepth } from '../world/IsoUtils';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { IsoMap } from '../world/IsoMap';
import { EventBus, GameEvents } from '../utils/EventBus';

/**
 * Buildings provide benefits and give players goals.
 * Buildings require resources to construct and a builder piñata to work on them.
 */

export enum BuildingType {
  CandyHouse = 'candyHouse',        // Better rest recovery
  Watchtower = 'watchtower',        // Guards see threats further
  Granary = 'granary',              // Increases stockpile capacity
  Playground = 'playground',         // Better fun recovery
  Fence = 'fence',                  // Blocks predator movement
  WaterWell = 'waterWell',          // Provides water for nearby crops
  Shrine = 'shrine',                // Mood boost for all piñatas
  HoneyPot = 'honeyPot',            // Attracts Buzzlegum faster
  Workshop = 'workshop',            // Work speed bonus nearby
}

export interface BuildingData {
  type: BuildingType;
  name: string;
  description: string;
  icon: string;
  cost: { type: ResourceType; amount: number }[];
  coinCost: number;                // Candy coins required
  buildTime: number;               // Time to construct in ms
  size: { width: number; height: number };  // In tiles
  effect: BuildingEffect;
  color: number;
}

export interface BuildingEffect {
  restBonus?: number;              // Multiplier on rest recovery nearby
  funBonus?: number;               // Multiplier on fun recovery nearby
  sightRange?: number;             // Extra sight range for guards
  storageBonus?: number;           // Extra stockpile capacity
  moodBonus?: number;              // Flat mood boost
  workSpeedBonus?: number;         // Work speed multiplier nearby
  attractionBonus?: string;        // Species attraction bonus
  waterRadius?: number;            // Provides water in this radius
  blockMovement?: boolean;         // Blocks creature movement
  effectRadius?: number;           // How far the effect reaches
}

export const BUILDING_DATA: Record<BuildingType, BuildingData> = {
  [BuildingType.CandyHouse]: {
    type: BuildingType.CandyHouse,
    name: 'Candy House',
    description: 'Cozy shelter. Rest recovers 50% faster nearby.',
    icon: '🏠',
    cost: [
      { type: ResourceType.Berry, amount: 15 },
    ],
    coinCost: 30,
    buildTime: 20000,
    size: { width: 2, height: 2 },
    effect: { restBonus: 1.5, effectRadius: 5 },
    color: 0xFF69B4,
  },
  [BuildingType.Watchtower]: {
    type: BuildingType.Watchtower,
    name: 'Watchtower',
    description: 'Guards can spot threats from further away.',
    icon: '🗼',
    cost: [
      { type: ResourceType.Berry, amount: 10 },
      { type: ResourceType.Seed, amount: 5 },
    ],
    coinCost: 40,
    buildTime: 25000,
    size: { width: 1, height: 1 },
    effect: { sightRange: 8, effectRadius: 10 },
    color: 0x8B4513,
  },
  [BuildingType.Granary]: {
    type: BuildingType.Granary,
    name: 'Granary',
    description: 'Stores extra food. +50 stockpile capacity.',
    icon: '🏛️',
    cost: [
      { type: ResourceType.Berry, amount: 20 },
      { type: ResourceType.Seed, amount: 10 },
    ],
    coinCost: 60,
    buildTime: 30000,
    size: { width: 2, height: 2 },
    effect: { storageBonus: 50 },
    color: 0xDAA520,
  },
  [BuildingType.Playground]: {
    type: BuildingType.Playground,
    name: 'Playground',
    description: 'Fun equipment! Fun recovers 75% faster nearby.',
    icon: '🎢',
    cost: [
      { type: ResourceType.Berry, amount: 12 },
    ],
    coinCost: 25,
    buildTime: 15000,
    size: { width: 2, height: 1 },
    effect: { funBonus: 1.75, effectRadius: 6 },
    color: 0x00CED1,
  },
  [BuildingType.Fence]: {
    type: BuildingType.Fence,
    name: 'Fence',
    description: 'Blocks predator movement. Build walls to protect your piñatas!',
    icon: '🚧',
    cost: [
      { type: ResourceType.Seed, amount: 3 },
    ],
    coinCost: 5,
    buildTime: 5000,
    size: { width: 1, height: 1 },
    effect: { blockMovement: true },
    color: 0x8B4513,
  },
  [BuildingType.WaterWell]: {
    type: BuildingType.WaterWell,
    name: 'Water Well',
    description: 'Provides water for crops in a 5-tile radius.',
    icon: '🪣',
    cost: [
      { type: ResourceType.Berry, amount: 8 },
      { type: ResourceType.Seed, amount: 4 },
    ],
    coinCost: 20,
    buildTime: 18000,
    size: { width: 1, height: 1 },
    effect: { waterRadius: 5 },
    color: 0x4169E1,
  },
  [BuildingType.Shrine]: {
    type: BuildingType.Shrine,
    name: 'Shrine',
    description: 'Sacred place. All piñatas get a mood boost.',
    icon: '⛩️',
    cost: [
      { type: ResourceType.Berry, amount: 25 },
      { type: ResourceType.Honey, amount: 5 },
    ],
    coinCost: 100,
    buildTime: 40000,
    size: { width: 2, height: 2 },
    effect: { moodBonus: 10, effectRadius: 100 }, // Colony-wide
    color: 0xFF4500,
  },
  [BuildingType.HoneyPot]: {
    type: BuildingType.HoneyPot,
    name: 'Honey Pot',
    description: 'Attracts Buzzlegum visitors faster.',
    icon: '🍯',
    cost: [
      { type: ResourceType.Honey, amount: 3 },
    ],
    coinCost: 35,
    buildTime: 10000,
    size: { width: 1, height: 1 },
    effect: { attractionBonus: 'buzzlegum', effectRadius: 20 },
    color: 0xFFD700,
  },
  [BuildingType.Workshop]: {
    type: BuildingType.Workshop,
    name: 'Workshop',
    description: 'Piñatas work 30% faster nearby.',
    icon: '🔧',
    cost: [
      { type: ResourceType.Berry, amount: 18 },
      { type: ResourceType.Seed, amount: 8 },
    ],
    coinCost: 75,
    buildTime: 35000,
    size: { width: 2, height: 1 },
    effect: { workSpeedBonus: 1.3, effectRadius: 8 },
    color: 0x696969,
  },
};

export enum BuildingState {
  Blueprint = 'blueprint',         // Placed but not started
  UnderConstruction = 'underConstruction',
  Complete = 'complete',
  Damaged = 'damaged',             // Future: can be damaged by sours
}

export interface Building {
  id: number;
  type: BuildingType;
  data: BuildingData;
  position: GridPosition;
  state: BuildingState;
  constructionProgress: number;    // 0-100
  sprite: Phaser.GameObjects.Container;
}

let buildingIdCounter = 0;

export class BuildingSystem {
  private scene: Phaser.Scene;
  private resourceManager: ResourceManager;
  private isoMap: IsoMap;

  private buildings: Map<number, Building> = new Map();
  private buildingsByPosition: Map<string, Building> = new Map();

  // Preview for placing buildings (future use)
  private selectedBuildingType: BuildingType | null = null;

  // Unlock checker and coin spender (set by GameScene)
  private unlockChecker: ((type: BuildingType) => boolean) | null = null;
  private coinSpender: ((amount: number) => boolean) | null = null;
  private coinChecker: (() => number) | null = null;

  constructor(
    scene: Phaser.Scene,
    resourceManager: ResourceManager,
    isoMap: IsoMap
  ) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.isoMap = isoMap;
  }

  setUnlockChecker(checker: (type: BuildingType) => boolean): void {
    this.unlockChecker = checker;
  }

  setCoinHandlers(checker: () => number, spender: (amount: number) => boolean): void {
    this.coinChecker = checker;
    this.coinSpender = spender;
  }

  isUnlocked(buildingType: BuildingType): boolean {
    if (!this.unlockChecker) return true; // No checker = all unlocked
    return this.unlockChecker(buildingType);
  }

  private posKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  canAfford(buildingType: BuildingType): boolean {
    const data = BUILDING_DATA[buildingType];

    // Check coin cost
    if (this.coinChecker && data.coinCost > 0) {
      if (this.coinChecker() < data.coinCost) {
        return false;
      }
    }

    // Check resource costs
    for (const cost of data.cost) {
      if (this.resourceManager.getStockpileCount(cost.type) < cost.amount) {
        return false;
      }
    }
    return true;
  }

  getCoinCost(buildingType: BuildingType): number {
    return BUILDING_DATA[buildingType].coinCost;
  }

  canPlace(position: GridPosition, buildingType: BuildingType): boolean {
    const data = BUILDING_DATA[buildingType];

    // Check all tiles the building would occupy
    for (let dx = 0; dx < data.size.width; dx++) {
      for (let dy = 0; dy < data.size.height; dy++) {
        const x = position.x + dx;
        const y = position.y + dy;

        // Must be walkable terrain
        if (!this.isoMap.isWalkable(x, y)) {
          return false;
        }

        // Must not have existing building
        if (this.buildingsByPosition.has(this.posKey(x, y))) {
          return false;
        }
      }
    }

    return true;
  }

  placeBlueprint(position: GridPosition, buildingType: BuildingType): Building | null {
    // Check if unlocked
    if (!this.isUnlocked(buildingType)) {
      console.log('Building not unlocked yet!');
      return null;
    }

    if (!this.canPlace(position, buildingType)) {
      return null;
    }

    if (!this.canAfford(buildingType)) {
      console.log('Cannot afford this building!');
      return null;
    }

    const data = BUILDING_DATA[buildingType];

    // Deduct coins
    if (this.coinSpender && data.coinCost > 0) {
      if (!this.coinSpender(data.coinCost)) {
        console.log('Failed to spend coins!');
        return null;
      }
    }

    // Deduct resources
    for (const cost of data.cost) {
      for (let i = 0; i < cost.amount; i++) {
        this.resourceManager.takeFromStockpile(cost.type);
      }
    }

    // Create building
    const building: Building = {
      id: buildingIdCounter++,
      type: buildingType,
      data,
      position: { ...position },
      state: BuildingState.Blueprint,
      constructionProgress: 0,
      sprite: this.createBuildingSprite(position, buildingType, BuildingState.Blueprint),
    };

    // Register on all tiles
    for (let dx = 0; dx < data.size.width; dx++) {
      for (let dy = 0; dy < data.size.height; dy++) {
        this.buildingsByPosition.set(
          this.posKey(position.x + dx, position.y + dy),
          building
        );
      }
    }

    this.buildings.set(building.id, building);

    console.log(`Placed blueprint for ${data.name} at (${position.x}, ${position.y})`);
    return building;
  }

  // Called by builder piñatas to work on construction
  workOnBuilding(building: Building, workAmount: number): void {
    if (building.state !== BuildingState.Blueprint &&
        building.state !== BuildingState.UnderConstruction) {
      return;
    }

    building.state = BuildingState.UnderConstruction;

    // Work amount is percentage of completion
    const progressPerMs = 100 / building.data.buildTime;
    building.constructionProgress += workAmount * progressPerMs * 1000;

    if (building.constructionProgress >= 100) {
      this.completeBuilding(building);
    } else {
      this.updateBuildingSprite(building);
    }
  }

  private completeBuilding(building: Building): void {
    building.state = BuildingState.Complete;
    building.constructionProgress = 100;
    this.updateBuildingSprite(building);

    console.log(`${building.data.name} construction complete!`);
    EventBus.emit(GameEvents.BUILDING_COMPLETE, building);

    // Show completion effect
    const text = this.scene.add.text(
      building.sprite.x,
      building.sprite.y - 40,
      `${building.data.icon} Complete!`,
      { fontSize: '16px', color: '#00ff00' }
    );
    text.setOrigin(0.5);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 2000,
      onComplete: () => text.destroy(),
    });
  }

  private createBuildingSprite(
    position: GridPosition,
    buildingType: BuildingType,
    state: BuildingState
  ): Phaser.GameObjects.Container {
    const data = BUILDING_DATA[buildingType];
    const screenPos = gridToScreen(position.x, position.y);

    // Offset for multi-tile buildings
    const offsetX = (data.size.width - 1) * 16;
    const offsetY = (data.size.height - 1) * 8;

    const container = this.scene.add.container(
      screenPos.x + offsetX,
      screenPos.y + offsetY
    );

    this.drawBuildingGraphics(container, data, state, 0);

    container.setDepth(getDepth(position.x, position.y, 0.8));

    return container;
  }

  private updateBuildingSprite(building: Building): void {
    // Clear existing graphics
    building.sprite.removeAll(true);

    this.drawBuildingGraphics(
      building.sprite,
      building.data,
      building.state,
      building.constructionProgress
    );
  }

  private drawBuildingGraphics(
    container: Phaser.GameObjects.Container,
    data: BuildingData,
    state: BuildingState,
    progress: number
  ): void {
    const graphics = this.scene.add.graphics();

    const width = data.size.width * 32;
    const height = data.size.height * 20;

    switch (state) {
      case BuildingState.Blueprint:
        // Dotted outline
        graphics.lineStyle(2, data.color, 0.5);
        graphics.strokeRect(-width / 2, -height - 10, width, height);

        // Blueprint pattern
        graphics.fillStyle(data.color, 0.2);
        graphics.fillRect(-width / 2, -height - 10, width, height);
        break;

      case BuildingState.UnderConstruction:
        // Partial building based on progress
        const builtHeight = (height * progress) / 100;

        graphics.fillStyle(data.color, 0.6);
        graphics.fillRect(-width / 2, -builtHeight - 10, width, builtHeight);

        // Scaffold lines
        graphics.lineStyle(1, 0x8B4513, 0.8);
        graphics.lineBetween(-width / 2, -10, -width / 2, -height - 10);
        graphics.lineBetween(width / 2, -10, width / 2, -height - 10);

        // Progress bar
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillRect(-20, 5, 40, 6);
        graphics.fillStyle(0x00FF00, 0.8);
        graphics.fillRect(-19, 6, 38 * progress / 100, 4);
        break;

      case BuildingState.Complete:
        // Full building
        graphics.fillStyle(data.color, 1);
        graphics.fillRect(-width / 2, -height - 10, width, height);

        // Roof/top
        graphics.fillStyle(data.color, 0.7);
        graphics.beginPath();
        graphics.moveTo(-width / 2 - 4, -height - 10);
        graphics.lineTo(0, -height - 20);
        graphics.lineTo(width / 2 + 4, -height - 10);
        graphics.closePath();
        graphics.fillPath();

        // Border
        graphics.lineStyle(2, 0x000000, 0.3);
        graphics.strokeRect(-width / 2, -height - 10, width, height);
        break;

      case BuildingState.Damaged:
        graphics.fillStyle(data.color, 0.5);
        graphics.fillRect(-width / 2, -height - 10, width, height);

        // Cracks
        graphics.lineStyle(2, 0x000000, 0.5);
        graphics.lineBetween(-10, -height / 2, 5, -height / 2 - 10);
        graphics.lineBetween(5, -height / 2 - 10, 10, -height / 2);
        break;
    }

    container.add(graphics);

    // Icon
    const icon = this.scene.add.text(0, -height / 2 - 15, data.icon, {
      fontSize: state === BuildingState.Complete ? '24px' : '16px',
    });
    icon.setOrigin(0.5);
    icon.setAlpha(state === BuildingState.Complete ? 1 : 0.6);
    container.add(icon);
  }

  // Get all effects at a position
  getEffectsAt(position: GridPosition): BuildingEffect {
    const combined: BuildingEffect = {};

    for (const building of this.buildings.values()) {
      if (building.state !== BuildingState.Complete) continue;

      const effect = building.data.effect;
      const radius = effect.effectRadius ?? 0;

      if (radius === 0) {
        // Global effect (like granary storage)
        this.mergeEffects(combined, effect);
        continue;
      }

      // Check distance
      const dx = position.x - building.position.x;
      const dy = position.y - building.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        this.mergeEffects(combined, effect);
      }
    }

    return combined;
  }

  private mergeEffects(target: BuildingEffect, source: BuildingEffect): void {
    if (source.restBonus) {
      target.restBonus = (target.restBonus ?? 1) * source.restBonus;
    }
    if (source.funBonus) {
      target.funBonus = (target.funBonus ?? 1) * source.funBonus;
    }
    if (source.workSpeedBonus) {
      target.workSpeedBonus = (target.workSpeedBonus ?? 1) * source.workSpeedBonus;
    }
    if (source.moodBonus) {
      target.moodBonus = (target.moodBonus ?? 0) + source.moodBonus;
    }
    if (source.storageBonus) {
      target.storageBonus = (target.storageBonus ?? 0) + source.storageBonus;
    }
    if (source.sightRange) {
      target.sightRange = Math.max(target.sightRange ?? 0, source.sightRange);
    }
    if (source.waterRadius) {
      target.waterRadius = Math.max(target.waterRadius ?? 0, source.waterRadius);
    }
  }

  // Check if position is blocked by a fence or building
  isBlocked(x: number, y: number): boolean {
    const building = this.buildingsByPosition.get(this.posKey(x, y));
    if (!building) return false;

    if (building.state !== BuildingState.Complete) return false;

    return building.data.effect.blockMovement === true;
  }

  // Get buildings needing construction work
  getBlueprintsAndConstruction(): Building[] {
    return Array.from(this.buildings.values()).filter(
      b => b.state === BuildingState.Blueprint || b.state === BuildingState.UnderConstruction
    );
  }

  getCompletedBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter(
      b => b.state === BuildingState.Complete
    );
  }

  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getBuildingAt(position: GridPosition): Building | null {
    return this.buildingsByPosition.get(this.posKey(position.x, position.y)) ?? null;
  }

  // For UI
  getSelectedBuildingType(): BuildingType | null {
    return this.selectedBuildingType;
  }

  setSelectedBuildingType(type: BuildingType | null): void {
    this.selectedBuildingType = type;
  }

  getBuildingTypes(): BuildingType[] {
    return Object.values(BuildingType);
  }

  getBuildingData(type: BuildingType): BuildingData {
    return BUILDING_DATA[type];
  }

  // Get total storage bonus from all granaries
  getTotalStorageBonus(): number {
    let bonus = 0;
    for (const building of this.buildings.values()) {
      if (building.state === BuildingState.Complete &&
          building.data.effect.storageBonus) {
        bonus += building.data.effect.storageBonus;
      }
    }
    return bonus;
  }

  // Check if there's a water source nearby (well or water tile)
  hasWaterNearby(position: GridPosition): boolean {
    for (const building of this.buildings.values()) {
      if (building.state !== BuildingState.Complete) continue;
      if (!building.data.effect.waterRadius) continue;

      const dx = position.x - building.position.x;
      const dy = position.y - building.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= building.data.effect.waterRadius) {
        return true;
      }
    }
    return false;
  }
}
