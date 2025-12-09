import Phaser from 'phaser';
import { Pinata } from '../entities/Pinata';
import { PinataSpecies, SPECIES_DATA } from '../entities/PinataTypes';
import { EventBus, GameEvents } from '../utils/EventBus';
import { IsoMap } from '../world/IsoMap';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { WORLD_WIDTH, WORLD_HEIGHT, TerrainType } from '../utils/Constants';
import { Pathfinder } from '../world/Pathfinding';
import { ZoneManager } from '../world/Zone';

// Sour piñata types and their mischief
export interface SourPinata {
  pinata: Pinata;
  sourLevel: number; // 0-100, how sour they are
  mischiefTimer: number;
  cureProgress: number; // 0-100
}

const SOUR_MISCHIEF_INTERVAL = 8000; // Every 8 seconds
const SOUR_CURE_THRESHOLD = 100; // Need this much cure progress to convert
const SOUR_SPAWN_CHANCE = 0.3; // 30% chance per spawn check

// What each sour species does
const SOUR_BEHAVIORS: Record<PinataSpecies, { mischief: string; cureItem: ResourceType }> = {
  [PinataSpecies.Sparrowmint]: {
    mischief: 'scatters resources',
    cureItem: ResourceType.Seed,
  },
  [PinataSpecies.Moozipan]: {
    mischief: 'tramples flowers',
    cureItem: ResourceType.CandyMilk,
  },
  [PinataSpecies.Buzzlegum]: {
    mischief: 'steals honey',
    cureItem: ResourceType.Honey,
  },
  [PinataSpecies.Rashberry]: {
    mischief: 'destroys structures',
    cureItem: ResourceType.Berry,
  },
  [PinataSpecies.Pretztail]: {
    mischief: 'hunts relentlessly',
    cureItem: ResourceType.Berry,
  },
};

/**
 * Manages sour (corrupted) piñatas that cause trouble
 */
export class SourPinataSystem {
  private scene: Phaser.Scene;
  private isoMap: IsoMap;
  private resourceManager: ResourceManager;
  private pathfinder: Pathfinder;
  private zoneManager: ZoneManager;
  private pinatas: Pinata[];

  private sourPinatas: Map<number, SourPinata> = new Map();
  private spawnTimer = 0;
  private readonly SPAWN_INTERVAL = 60000; // Check every minute

  constructor(
    scene: Phaser.Scene,
    isoMap: IsoMap,
    resourceManager: ResourceManager,
    pathfinder: Pathfinder,
    zoneManager: ZoneManager,
    pinatas: Pinata[]
  ) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.resourceManager = resourceManager;
    this.pathfinder = pathfinder;
    this.zoneManager = zoneManager;
    this.pinatas = pinatas;
  }

  update(delta: number): void {
    // Check for sour spawning
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      this.checkSourSpawn();
    }

    // Update sour piñatas
    for (const [id, sour] of this.sourPinatas) {
      if (!sour.pinata.getIsAlive()) {
        this.sourPinatas.delete(id);
        continue;
      }

      sour.mischiefTimer += delta;

      // Perform mischief periodically
      if (sour.mischiefTimer >= SOUR_MISCHIEF_INTERVAL) {
        sour.mischiefTimer = 0;
        this.performMischief(sour);
      }

      // Update visual effect (pulsing dark tint)
      this.updateSourVisual(sour);
    }
  }

  private checkSourSpawn(): void {
    // Only spawn sours if garden is doing well (5+ piñatas)
    if (this.pinatas.length < 5) return;

    // Random chance to spawn a sour
    if (Math.random() > SOUR_SPAWN_CHANCE) return;

    // Pick a random sour-able species (not Pretztail for now)
    const sourableSpecies = [
      PinataSpecies.Sparrowmint,
      PinataSpecies.Moozipan,
      PinataSpecies.Buzzlegum,
      PinataSpecies.Rashberry,
    ];
    const species = sourableSpecies[Math.floor(Math.random() * sourableSpecies.length)];

    this.spawnSourPinata(species);
  }

  private spawnSourPinata(species: PinataSpecies): void {
    // Find spawn position at edge
    const edge = Math.floor(Math.random() * 4);
    let spawnX: number, spawnY: number;

    switch (edge) {
      case 0:
        spawnX = Math.floor(Math.random() * WORLD_WIDTH);
        spawnY = 0;
        break;
      case 1:
        spawnX = WORLD_WIDTH - 1;
        spawnY = Math.floor(Math.random() * WORLD_HEIGHT);
        break;
      case 2:
        spawnX = Math.floor(Math.random() * WORLD_WIDTH);
        spawnY = WORLD_HEIGHT - 1;
        break;
      default:
        spawnX = 0;
        spawnY = Math.floor(Math.random() * WORLD_HEIGHT);
        break;
    }

    const walkable = this.pathfinder.findNearestWalkable({ x: spawnX, y: spawnY });
    if (!walkable) return;

    // Create piñata
    const pinata = new Pinata(this.scene, walkable.x, walkable.y, species, this.pathfinder);
    pinata.setZoneManager(this.zoneManager);
    pinata.setResourceManager(this.resourceManager);
    pinata.setPinataList(this.pinatas);
    this.pinatas.push(pinata);

    // Mark as sour
    const sour: SourPinata = {
      pinata,
      sourLevel: 100,
      mischiefTimer: 0,
      cureProgress: 0,
    };
    this.sourPinatas.set(pinata.id, sour);

    // Apply sour visual
    this.applySourVisual(pinata);

    // Show warning
    this.showSourWarning(species);

    console.log(`A sour ${SPECIES_DATA[species].name} has invaded the garden!`);
    EventBus.emit(GameEvents.SOUR_PINATA_SPAWNED, pinata);
  }

  private applySourVisual(_pinata: Pinata): void {
    // The visual will be updated in updateSourVisual
  }

  private updateSourVisual(_sour: SourPinata): void {
    // Sour piñatas get a pulsing dark purple tint
    // This is handled by checking sour status in the Pinata's updateVisuals
  }

  private performMischief(sour: SourPinata): void {
    const species = sour.pinata.species;
    const pos = sour.pinata.getGridPosition();

    switch (species) {
      case PinataSpecies.Sparrowmint:
        // Scatter nearby resources
        this.scatterResources(pos.x, pos.y, 5);
        break;

      case PinataSpecies.Moozipan:
        // Trample flowers to dirt
        this.trampleFlowers(pos.x, pos.y, 3);
        break;

      case PinataSpecies.Buzzlegum:
        // Steal honey from stockpile
        this.stealFromStockpile(ResourceType.Honey);
        break;

      case PinataSpecies.Rashberry:
        // Just cause general chaos (scare nearby piñatas)
        this.scarePinatas(pos.x, pos.y, 5);
        break;

      default:
        break;
    }

    // Show mischief indicator
    const text = this.scene.add.text(sour.pinata.x, sour.pinata.y - 50, '😈', {
      fontSize: '24px',
    });
    text.setOrigin(0.5);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 20,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private scatterResources(x: number, y: number, radius: number): void {
    const resources = this.resourceManager.getAvailableResources();
    for (const resource of resources) {
      const rPos = resource.getGridPosition();
      const dist = Math.sqrt(Math.pow(rPos.x - x, 2) + Math.pow(rPos.y - y, 2));
      if (dist <= radius) {
        // Move to random nearby position
        const newX = rPos.x + Math.floor(Math.random() * 6) - 3;
        const newY = rPos.y + Math.floor(Math.random() * 6) - 3;
        if (this.isoMap.isWalkable(newX, newY)) {
          resource.setGridPosition(newX, newY);
        }
      }
    }
  }

  private trampleFlowers(x: number, y: number, radius: number): void {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.isoMap.getTile(tx, ty);
        if (tile && tile.terrain === TerrainType.Flowers) {
          this.isoMap.setTerrain(tx, ty, TerrainType.Dirt);
        }
      }
    }
  }

  private stealFromStockpile(type: ResourceType): void {
    this.resourceManager.takeFromStockpile(type);
  }

  private scarePinatas(x: number, y: number, radius: number): void {
    for (const pinata of this.pinatas) {
      if (this.isSour(pinata.id)) continue;

      const pos = pinata.getGridPosition();
      const dist = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
      if (dist <= radius) {
        // Reduce fun need
        pinata.play(-10);
      }
    }
  }

  private showSourWarning(species: PinataSpecies): void {
    const speciesData = SPECIES_DATA[species];
    const behavior = SOUR_BEHAVIORS[species];

    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `Sour ${speciesData.name} appeared! It ${behavior.mischief}!`,
      {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#8b008b',
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
      duration: 4000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // Try to cure a sour piñata by feeding it the right item
  tryCure(pinataId: number, itemType: ResourceType): boolean {
    const sour = this.sourPinatas.get(pinataId);
    if (!sour) return false;

    const requiredItem = SOUR_BEHAVIORS[sour.pinata.species].cureItem;
    if (itemType !== requiredItem) return false;

    // Progress toward cure
    sour.cureProgress += 35;

    if (sour.cureProgress >= SOUR_CURE_THRESHOLD) {
      this.curePinata(sour);
      return true;
    }

    // Show progress
    const text = this.scene.add.text(sour.pinata.x, sour.pinata.y - 50, '💚', {
      fontSize: '20px',
    });
    text.setOrigin(0.5);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 20,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });

    return true;
  }

  private curePinata(sour: SourPinata): void {
    const pinata = sour.pinata;
    const speciesData = SPECIES_DATA[pinata.species];

    // Remove from sour tracking
    this.sourPinatas.delete(pinata.id);

    // Reset visual (handled by Pinata's updateVisuals when not sour)

    // Show cure celebration
    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `${pinata.nickname} was cured!`,
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

    console.log(`${pinata.nickname} the ${speciesData.name} has been cured!`);
    EventBus.emit(GameEvents.SOUR_PINATA_CURED, pinata);
  }

  isSour(pinataId: number): boolean {
    return this.sourPinatas.has(pinataId);
  }

  getSourLevel(pinataId: number): number {
    return this.sourPinatas.get(pinataId)?.sourLevel ?? 0;
  }

  getCureProgress(pinataId: number): number {
    return this.sourPinatas.get(pinataId)?.cureProgress ?? 0;
  }

  getSourPinatas(): SourPinata[] {
    return Array.from(this.sourPinatas.values());
  }
}
