import Phaser from 'phaser';
import { EventBus, GameEvents } from '../utils/EventBus';
import { Pinata } from '../entities/Pinata';
import { PinataSpecies } from '../entities/PinataTypes';
import { IsoMap } from '../world/IsoMap';
import { Pathfinder } from '../world/Pathfinding';
import { TimeSystem } from './TimeSystem';
import { ColonySystem, ColonyMood } from './ColonySystem';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../utils/Constants';

/**
 * ThreatSystem manages predator raids and environmental dangers.
 * Creates conflict and tension that drives player engagement.
 */

export enum ThreatLevel {
  None = 'none',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Siege = 'siege', // Sustained attack
}

export interface RaidConfig {
  predatorCount: number;
  species: PinataSpecies;
  intervalMin: number;  // ms between raids
  intervalMax: number;
}

// Raid difficulty scales with colony prosperity
const RAID_CONFIGS: Record<ThreatLevel, RaidConfig> = {
  [ThreatLevel.None]: {
    predatorCount: 0,
    species: PinataSpecies.Pretztail,
    intervalMin: Infinity,
    intervalMax: Infinity,
  },
  [ThreatLevel.Low]: {
    predatorCount: 1,
    species: PinataSpecies.Pretztail,
    intervalMin: 120000, // 2 minutes
    intervalMax: 240000, // 4 minutes
  },
  [ThreatLevel.Medium]: {
    predatorCount: 2,
    species: PinataSpecies.Pretztail,
    intervalMin: 90000,  // 1.5 minutes
    intervalMax: 180000, // 3 minutes
  },
  [ThreatLevel.High]: {
    predatorCount: 3,
    species: PinataSpecies.Pretztail,
    intervalMin: 60000,  // 1 minute
    intervalMax: 120000, // 2 minutes
  },
  [ThreatLevel.Siege]: {
    predatorCount: 4,
    species: PinataSpecies.Pretztail,
    intervalMin: 45000,  // 45 seconds
    intervalMax: 90000,  // 1.5 minutes
  },
};

export class ThreatSystem {
  private scene: Phaser.Scene;
  private isoMap: IsoMap;
  private pathfinder: Pathfinder;
  private pinatas: Pinata[] = [];
  private timeSystem: TimeSystem | null = null;
  private colonySystem: ColonySystem | null = null;

  private threatLevel: ThreatLevel = ThreatLevel.None;
  private raidTimer: number = 0;
  private nextRaidTime: number = 0;

  private activePredators: Pinata[] = [];

  // Night danger settings
  private nightDangerMultiplier: number = 2.0; // Raids twice as likely at night

  constructor(
    scene: Phaser.Scene,
    isoMap: IsoMap,
    pathfinder: Pathfinder
  ) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.pathfinder = pathfinder;

    this.setupEventListeners();
    this.scheduleNextRaid();
  }

  setPinatas(pinatas: Pinata[]): void {
    this.pinatas = pinatas;
  }

  setTimeSystem(timeSystem: TimeSystem): void {
    this.timeSystem = timeSystem;
  }

  setColonySystem(colonySystem: ColonySystem): void {
    this.colonySystem = colonySystem;
  }

  private setupEventListeners(): void {
    // Remove predators from tracking when they die
    EventBus.on(GameEvents.PINATA_DIED, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      const index = this.activePredators.indexOf(pinata);
      if (index !== -1) {
        this.activePredators.splice(index, 1);

        // Colony fear decreases when predator is killed
        EventBus.emit('threat:predatorKilled', pinata);
      }
    });
  }

  update(delta: number): void {
    this.raidTimer += delta;

    // Update threat level based on colony state
    this.updateThreatLevel();

    // Check if it's time for a raid
    if (this.raidTimer >= this.nextRaidTime) {
      this.attemptRaid();
      this.scheduleNextRaid();
    }

    // Clean up dead predators
    this.activePredators = this.activePredators.filter(p => p.getIsAlive());
  }

  private updateThreatLevel(): void {
    // Threat level scales with colony population and prosperity
    const population = this.pinatas.filter(p => p.getIsAlive() && !p.isPredator()).length;

    if (population <= 2) {
      this.threatLevel = ThreatLevel.None; // Small colonies get grace period
    } else if (population <= 5) {
      this.threatLevel = ThreatLevel.Low;
    } else if (population <= 8) {
      this.threatLevel = ThreatLevel.Medium;
    } else if (population <= 12) {
      this.threatLevel = ThreatLevel.High;
    } else {
      this.threatLevel = ThreatLevel.Siege;
    }

    // Adjust for colony mood - desperate colonies attract fewer raids
    if (this.colonySystem) {
      const mood = this.colonySystem.getColonyMood();
      if (mood === ColonyMood.Desperate || mood === ColonyMood.Mourning) {
        // Reduce threat level by one step during hard times
        if (this.threatLevel === ThreatLevel.Siege) {
          this.threatLevel = ThreatLevel.High;
        } else if (this.threatLevel === ThreatLevel.High) {
          this.threatLevel = ThreatLevel.Medium;
        } else if (this.threatLevel === ThreatLevel.Medium) {
          this.threatLevel = ThreatLevel.Low;
        }
      } else if (mood === ColonyMood.Thriving) {
        // Thriving colonies attract MORE predators
        if (this.threatLevel === ThreatLevel.Low) {
          this.threatLevel = ThreatLevel.Medium;
        } else if (this.threatLevel === ThreatLevel.Medium) {
          this.threatLevel = ThreatLevel.High;
        }
      }
    }
  }

  private scheduleNextRaid(): void {
    const config = RAID_CONFIGS[this.threatLevel];
    const baseInterval = config.intervalMin +
      Math.random() * (config.intervalMax - config.intervalMin);

    // Night makes raids more likely (shorter interval)
    let intervalModifier = 1.0;
    if (this.timeSystem?.isNight()) {
      intervalModifier /= this.nightDangerMultiplier;
    }

    this.raidTimer = 0;
    this.nextRaidTime = baseInterval * intervalModifier;
  }

  private attemptRaid(): void {
    if (this.threatLevel === ThreatLevel.None) return;

    const config = RAID_CONFIGS[this.threatLevel];
    const targetCount = config.predatorCount;

    // Limit active predators (don't overwhelm)
    const existingPredators = this.activePredators.length;
    const toSpawn = Math.min(targetCount, 3 - existingPredators);

    if (toSpawn <= 0) return;

    console.log(`Raid incoming! Spawning ${toSpawn} ${config.species}(s)`);
    EventBus.emit('threat:raidStarting', { count: toSpawn, species: config.species });

    for (let i = 0; i < toSpawn; i++) {
      this.spawnPredator(config.species);
    }
  }

  private spawnPredator(species: PinataSpecies): void {
    // Spawn from map edge
    const spawnPos = this.getEdgeSpawnPosition();
    if (!spawnPos) return;

    const predator = new Pinata(
      this.scene,
      spawnPos.x,
      spawnPos.y,
      species,
      this.pathfinder
    );

    // Predators spawned by raid system need configuration
    // The Pinata class already has isPredator() based on species
    // Set as wild via the marker
    predator.markAsWild();

    this.activePredators.push(predator);
    this.pinatas.push(predator);

    // Emit creation event so GameScene can wire up systems
    EventBus.emit(GameEvents.PINATA_CREATED, predator);
    EventBus.emit('threat:predatorSpawned', predator);
  }

  private getEdgeSpawnPosition(): { x: number; y: number } | null {
    // Pick a random edge
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    let attempts = 0;

    do {
      switch (edge) {
        case 0: // Top
          x = Math.floor(Math.random() * WORLD_WIDTH);
          y = 1;
          break;
        case 1: // Right
          x = WORLD_WIDTH - 2;
          y = Math.floor(Math.random() * WORLD_HEIGHT);
          break;
        case 2: // Bottom
          x = Math.floor(Math.random() * WORLD_WIDTH);
          y = WORLD_HEIGHT - 2;
          break;
        case 3: // Left
        default:
          x = 1;
          y = Math.floor(Math.random() * WORLD_HEIGHT);
          break;
      }
      attempts++;
    } while (!this.isoMap.isWalkable(x, y) && attempts < 20);

    if (attempts >= 20) return null;
    return { x, y };
  }

  getThreatLevel(): ThreatLevel {
    return this.threatLevel;
  }

  getActivePredatorCount(): number {
    return this.activePredators.filter(p => p.getIsAlive()).length;
  }

  isNightDanger(): boolean {
    return this.timeSystem?.isNight() ?? false;
  }

  /**
   * Force a raid (for testing or player-triggered events)
   */
  forceRaid(count: number = 1): void {
    const config = RAID_CONFIGS[ThreatLevel.Medium];
    for (let i = 0; i < count; i++) {
      this.spawnPredator(config.species);
    }
  }
}
