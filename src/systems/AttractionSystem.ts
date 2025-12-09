import Phaser from 'phaser';
import { PinataSpecies, SPECIES_DATA } from '../entities/PinataTypes';
import { Pinata } from '../entities/Pinata';
import { ZoneManager } from '../world/Zone';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { IsoMap } from '../world/IsoMap';
import { TerrainType, WORLD_WIDTH, WORLD_HEIGHT } from '../utils/Constants';
import { Pathfinder } from '../world/Pathfinding';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { BuildingSystem } from './BuildingSystem';
import { FarmingSystem, CROP_DATA } from './FarmingSystem';

export interface AttractionRequirements {
  grassTiles?: number;
  flowerTiles?: number;
  waterTiles?: number;
  resources?: { type: ResourceType; count: number }[];
  residentPinatas?: number;
  specificSpecies?: { species: PinataSpecies; count: number }[];
}

export const SPECIES_REQUIREMENTS: Record<PinataSpecies, AttractionRequirements> = {
  [PinataSpecies.Sparrowmint]: {
    grassTiles: 10,
    resources: [{ type: ResourceType.Seed, count: 2 }],
  },
  [PinataSpecies.Moozipan]: {
    grassTiles: 20,
    flowerTiles: 5,
    waterTiles: 1,
  },
  [PinataSpecies.Buzzlegum]: {
    flowerTiles: 10,
  },
  [PinataSpecies.Rashberry]: {
    // For now, just needs berries in stockpile
    resources: [{ type: ResourceType.Berry, count: 5 }],
  },
  [PinataSpecies.Pretztail]: {
    residentPinatas: 5, // Predator - needs prey population!
  },
};

export const SPECIES_POPULATION_CAP: Record<PinataSpecies, number> = {
  [PinataSpecies.Sparrowmint]: 5,
  [PinataSpecies.Moozipan]: 3,
  [PinataSpecies.Buzzlegum]: 4,
  [PinataSpecies.Rashberry]: 3,
  [PinataSpecies.Pretztail]: 1, // Only one predator!
};

// Visitor tracking
export interface Visitor {
  pinata: Pinata;
  species: PinataSpecies;
  satisfaction: number; // 0-100
  visitTimer: number;
  maxVisitTime: number;
  hasDecided: boolean;
}

const VISITOR_SATISFACTION_THRESHOLD = 70; // Must be this satisfied to stay
const VISITOR_VISIT_TIME = 20000; // 20 seconds to impress them
const VISITOR_SATISFACTION_GAIN_RATE = 1.5; // Per second when requirements are met

/**
 * Handles attracting new piñata species to the garden
 */
export class AttractionSystem {
  private scene: Phaser.Scene;
  private isoMap: IsoMap;
  private zoneManager: ZoneManager;
  private resourceManager: ResourceManager;
  private pathfinder: Pathfinder;
  private pinatas: Pinata[];

  // Optional system references for bonus calculations
  private buildingSystem: BuildingSystem | null = null;
  private farmingSystem: FarmingSystem | null = null;

  private checkTimer = 0;
  private readonly CHECK_INTERVAL = 15000; // Check every 15 seconds

  // Track terrain counts (cached, updated periodically)
  private terrainCounts: Map<TerrainType, number> = new Map();
  private terrainCountTimer = 0;

  // Visitor tracking
  private visitors: Visitor[] = [];

  constructor(
    scene: Phaser.Scene,
    isoMap: IsoMap,
    zoneManager: ZoneManager,
    resourceManager: ResourceManager,
    pathfinder: Pathfinder,
    pinatas: Pinata[]
  ) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.zoneManager = zoneManager;
    this.resourceManager = resourceManager;
    this.pathfinder = pathfinder;
    this.pinatas = pinatas;

    // Initial terrain count
    this.updateTerrainCounts();
  }

  setBuildingSystem(buildingSystem: BuildingSystem): void {
    this.buildingSystem = buildingSystem;
  }

  setFarmingSystem(farmingSystem: FarmingSystem): void {
    this.farmingSystem = farmingSystem;
  }

  update(delta: number): void {
    // Update terrain counts periodically
    this.terrainCountTimer += delta;
    if (this.terrainCountTimer >= 30000) { // Every 30 seconds
      this.terrainCountTimer = 0;
      this.updateTerrainCounts();
    }

    // Update visitors
    this.updateVisitors(delta);

    // Check for new attractions
    this.checkTimer += delta;
    if (this.checkTimer >= this.CHECK_INTERVAL) {
      this.checkTimer = 0;
      this.checkAttractions();
    }
  }

  private updateVisitors(delta: number): void {
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const visitor = this.visitors[i];
      if (visitor.hasDecided) continue;

      visitor.visitTimer += delta;

      // Increase satisfaction if requirements are still met
      if (this.meetsRequirements(visitor.species)) {
        visitor.satisfaction += VISITOR_SATISFACTION_GAIN_RATE * (delta / 1000);
        visitor.satisfaction = Math.min(100, visitor.satisfaction);
      }

      // Check if time is up
      if (visitor.visitTimer >= visitor.maxVisitTime) {
        visitor.hasDecided = true;

        if (visitor.satisfaction >= VISITOR_SATISFACTION_THRESHOLD) {
          // Visitor decides to stay!
          this.convertVisitorToResident(visitor);
        } else {
          // Visitor leaves disappointed
          this.dismissVisitor(visitor);
        }

        this.visitors.splice(i, 1);
      }
    }
  }

  private convertVisitorToResident(visitor: Visitor): void {
    const pinata = visitor.pinata;
    const speciesData = SPECIES_DATA[pinata.species];

    // Show celebration
    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `${pinata.nickname} decided to stay!`,
      {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#' + speciesData.color.toString(16).padStart(6, '0'),
        padding: { x: 20, y: 10 },
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: 50,
      alpha: 0,
      duration: 3000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    console.log(`${pinata.nickname} (${speciesData.name}) liked the garden and decided to stay!`);
    EventBus.emit(GameEvents.SPECIES_ATTRACTED, pinata.species, pinata);
  }

  private dismissVisitor(visitor: Visitor): void {
    const pinata = visitor.pinata;
    const speciesData = SPECIES_DATA[pinata.species];

    // Show disappointed message
    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `${speciesData.name} wasn't impressed and left...`,
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#666666',
        padding: { x: 20, y: 10 },
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: 50,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Remove piñata from the list and destroy
    const idx = this.pinatas.indexOf(pinata);
    if (idx !== -1) {
      this.pinatas.splice(idx, 1);
    }

    // Fade out and destroy
    this.scene.tweens.add({
      targets: pinata,
      alpha: 0,
      duration: 1000,
      onComplete: () => pinata.destroy(),
    });

    console.log(`${speciesData.name} visitor wasn't impressed (${Math.round(visitor.satisfaction)}% satisfaction) and left.`);
  }

  private updateTerrainCounts(): void {
    this.terrainCounts.clear();

    for (let x = 0; x < WORLD_WIDTH; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const tile = this.isoMap.getTile(x, y);
        if (tile) {
          const count = this.terrainCounts.get(tile.terrain) ?? 0;
          this.terrainCounts.set(tile.terrain, count + 1);
        }
      }
    }
  }

  private checkAttractions(): void {
    for (const species of Object.values(PinataSpecies)) {
      // Check if at population cap
      const currentCount = this.pinatas.filter(p => p.species === species).length;
      const cap = SPECIES_POPULATION_CAP[species];

      if (currentCount >= cap) continue;

      // Check requirements
      if (this.meetsRequirements(species)) {
        // Calculate attraction chance modifier from bonuses
        let attractionChance = 1.0;

        // Check building bonuses (HoneyPot, etc.)
        if (this.buildingSystem) {
          for (const building of this.buildingSystem.getCompletedBuildings()) {
            if (building.data.effect.attractionBonus === species) {
              attractionChance += 0.5; // +50% per matching building
            }
          }
        }

        // Check crop attraction bonuses
        if (this.farmingSystem) {
          for (const crop of this.farmingSystem.getAllCrops()) {
            const cropData = CROP_DATA[crop.type];
            if (cropData.attractsSpecies === species) {
              attractionChance += 0.25; // +25% per matching crop
            }
          }
        }

        // Roll for attraction with bonuses
        if (Math.random() < attractionChance) {
          this.attractPinata(species);
          return; // Only attract one per check
        }
      }
    }
  }

  private meetsRequirements(species: PinataSpecies): boolean {
    const reqs = SPECIES_REQUIREMENTS[species];

    // Check grass tiles
    if (reqs.grassTiles) {
      const grassCount = this.terrainCounts.get(TerrainType.Grass) ?? 0;
      if (grassCount < reqs.grassTiles) return false;
    }

    // Check flower tiles
    if (reqs.flowerTiles) {
      const flowerCount = this.terrainCounts.get(TerrainType.Flowers) ?? 0;
      if (flowerCount < reqs.flowerTiles) return false;
    }

    // Check water tiles
    if (reqs.waterTiles) {
      const waterCount = this.terrainCounts.get(TerrainType.Water) ?? 0;
      if (waterCount < reqs.waterTiles) return false;
    }

    // Check resources in stockpile
    if (reqs.resources) {
      for (const resourceReq of reqs.resources) {
        const count = this.resourceManager.getStockpileCount(resourceReq.type);
        if (count < resourceReq.count) return false;
      }
    }

    // Check resident piñatas (for predators)
    if (reqs.residentPinatas) {
      if (this.pinatas.length < reqs.residentPinatas) return false;
    }

    // Check specific species requirements
    if (reqs.specificSpecies) {
      for (const speciesReq of reqs.specificSpecies) {
        const count = this.pinatas.filter(p => p.species === speciesReq.species).length;
        if (count < speciesReq.count) return false;
      }
    }

    return true;
  }

  private attractPinata(species: PinataSpecies): void {
    // Find a spawn position at map edge
    const edge = Math.floor(Math.random() * 4);
    let spawnX: number, spawnY: number;

    switch (edge) {
      case 0: // Top edge
        spawnX = Math.floor(Math.random() * WORLD_WIDTH);
        spawnY = 0;
        break;
      case 1: // Right edge
        spawnX = WORLD_WIDTH - 1;
        spawnY = Math.floor(Math.random() * WORLD_HEIGHT);
        break;
      case 2: // Bottom edge
        spawnX = Math.floor(Math.random() * WORLD_WIDTH);
        spawnY = WORLD_HEIGHT - 1;
        break;
      default: // Left edge
        spawnX = 0;
        spawnY = Math.floor(Math.random() * WORLD_HEIGHT);
        break;
    }

    // Find nearest walkable position
    const walkable = this.pathfinder.findNearestWalkable({ x: spawnX, y: spawnY });
    if (!walkable) return;

    // Create new piñata as visitor
    const pinata = new Pinata(this.scene, walkable.x, walkable.y, species, this.pathfinder);
    pinata.setZoneManager(this.zoneManager);
    pinata.setResourceManager(this.resourceManager);
    pinata.setPinataList(this.pinatas); // For predator/prey detection
    this.pinatas.push(pinata);

    // Emit event so GameScene connects all systems
    EventBus.emit(GameEvents.PINATA_CREATED, pinata);

    // Create visitor tracking
    const visitor: Visitor = {
      pinata,
      species,
      satisfaction: 30, // Start with some goodwill
      visitTimer: 0,
      maxVisitTime: VISITOR_VISIT_TIME,
      hasDecided: false,
    };
    this.visitors.push(visitor);

    // Show visitor arrival notification
    this.showVisitorArrival(pinata);

    console.log(`A wild ${SPECIES_DATA[species].name} is visiting! Impress them to make them stay.`);
  }

  private showVisitorArrival(pinata: Pinata): void {
    const speciesData = SPECIES_DATA[pinata.species];

    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `A ${speciesData.name} is visiting! Impress them!`,
      {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#' + speciesData.color.toString(16).padStart(6, '0'),
        padding: { x: 20, y: 10 },
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: 50,
      alpha: 0,
      duration: 3000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // For external checking (e.g., UI display)
  getAttractionProgress(species: PinataSpecies): { met: string[]; unmet: string[] } {
    const reqs = SPECIES_REQUIREMENTS[species];
    const met: string[] = [];
    const unmet: string[] = [];

    if (reqs.grassTiles) {
      const count = this.terrainCounts.get(TerrainType.Grass) ?? 0;
      const req = `Grass: ${count}/${reqs.grassTiles}`;
      (count >= reqs.grassTiles ? met : unmet).push(req);
    }

    if (reqs.flowerTiles) {
      const count = this.terrainCounts.get(TerrainType.Flowers) ?? 0;
      const req = `Flowers: ${count}/${reqs.flowerTiles}`;
      (count >= reqs.flowerTiles ? met : unmet).push(req);
    }

    if (reqs.waterTiles) {
      const count = this.terrainCounts.get(TerrainType.Water) ?? 0;
      const req = `Water: ${count}/${reqs.waterTiles}`;
      (count >= reqs.waterTiles ? met : unmet).push(req);
    }

    if (reqs.resources) {
      for (const resourceReq of reqs.resources) {
        const count = this.resourceManager.getStockpileCount(resourceReq.type);
        const req = `${resourceReq.type}: ${count}/${resourceReq.count}`;
        (count >= resourceReq.count ? met : unmet).push(req);
      }
    }

    if (reqs.residentPinatas) {
      const count = this.pinatas.length;
      const req = `Residents: ${count}/${reqs.residentPinatas}`;
      (count >= reqs.residentPinatas ? met : unmet).push(req);
    }

    return { met, unmet };
  }

  getVisitors(): Visitor[] {
    return [...this.visitors];
  }

  isVisitor(pinataId: number): boolean {
    return this.visitors.some(v => v.pinata.id === pinataId);
  }

  getVisitorSatisfaction(pinataId: number): number | null {
    const visitor = this.visitors.find(v => v.pinata.id === pinataId);
    return visitor ? visitor.satisfaction : null;
  }
}
