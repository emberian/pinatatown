import { EventBus, GameEvents } from '../utils/EventBus';
import { Pinata } from '../entities/Pinata';
import { ResourceManager } from '../entities/Resource';
import { SeasonSystem, Season } from './SeasonSystem';

/**
 * Colony-wide state that affects all piñatas.
 * Creates emergent gameplay through shared consequences.
 */

export enum ColonyMood {
  Thriving = 'thriving',     // Abundant food, no recent deaths
  Stable = 'stable',         // Adequate resources
  Worried = 'worried',       // Food getting low
  Desperate = 'desperate',   // Starvation imminent
  Mourning = 'mourning',     // Recent death
  UnderAttack = 'underAttack', // Active predator threat
}

export interface ColonyState {
  mood: ColonyMood;
  foodSecurity: number;      // 0-100, how secure is food supply
  recentDeaths: number;      // Deaths in last 60 seconds
  mourningUntil: number;     // Timestamp when mourning ends
  fearLevel: number;         // 0-100, colony-wide fear from threats
  winterPrepScore: number;   // How prepared for winter (stockpile vs population)
}

/**
 * Tracks colony health, applies pressure, creates emergent drama.
 */
export class ColonySystem {
  private pinatas: Pinata[] = [];
  private resourceManager: ResourceManager;
  private seasonSystem: SeasonSystem | null = null;

  private state: ColonyState = {
    mood: ColonyMood.Stable,
    foodSecurity: 50,
    recentDeaths: 0,
    mourningUntil: 0,
    fearLevel: 0,
    winterPrepScore: 0,
  };

  // Starvation tracking
  private starvationDamageTimer = 0;
  private readonly STARVATION_DAMAGE_INTERVAL = 5000; // Check every 5 seconds
  private readonly STARVATION_THRESHOLD = 10; // Hunger below this = starving

  // Death memory
  private deathTimestamps: number[] = [];
  private readonly DEATH_MEMORY_DURATION = 60000; // Remember deaths for 60 seconds

  // Update timer
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 2000; // Update colony state every 2 seconds

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
    this.setupEventListeners();
  }

  setPinatas(pinatas: Pinata[]): void {
    this.pinatas = pinatas;
  }

  setSeasonSystem(seasonSystem: SeasonSystem): void {
    this.seasonSystem = seasonSystem;
  }

  private setupEventListeners(): void {
    // Track deaths for mourning
    EventBus.on(GameEvents.PINATA_DIED, () => {
      this.deathTimestamps.push(Date.now());
      this.state.recentDeaths++;
      this.state.mourningUntil = Date.now() + 30000; // 30 seconds of mourning

      // Broadcast colony-wide grief
      this.broadcastGrief();
    });

    // Track predator activity for fear
    EventBus.on(GameEvents.PINATA_DEFENDED, () => {
      this.state.fearLevel = Math.min(100, this.state.fearLevel + 30);
    });

    // Reduce fear when predator is driven off
    EventBus.on(GameEvents.PINATA_DIED, (...args: unknown[]) => {
      const [, attacker] = args as [Pinata, Pinata | null];
      if (attacker?.isPredator()) {
        // Predator killed someone - massive fear spike
        this.state.fearLevel = Math.min(100, this.state.fearLevel + 50);
      }
    });
  }

  update(delta: number): void {
    this.updateTimer += delta;
    this.starvationDamageTimer += delta;

    // Periodic state update
    if (this.updateTimer >= this.UPDATE_INTERVAL) {
      this.updateTimer = 0;
      this.updateColonyState();
    }

    // Starvation damage check
    if (this.starvationDamageTimer >= this.STARVATION_DAMAGE_INTERVAL) {
      this.starvationDamageTimer = 0;
      this.applyStarvationEffects();
    }

    // Decay fear over time
    if (this.state.fearLevel > 0) {
      this.state.fearLevel = Math.max(0, this.state.fearLevel - delta * 0.01);
    }

    // Clean up old death memories
    const now = Date.now();
    this.deathTimestamps = this.deathTimestamps.filter(
      t => now - t < this.DEATH_MEMORY_DURATION
    );
    this.state.recentDeaths = this.deathTimestamps.length;
  }

  private updateColonyState(): void {
    const alivePinatas = this.pinatas.filter(p => p.getIsAlive());
    const population = alivePinatas.length;

    if (population === 0) {
      this.state.mood = ColonyMood.Desperate;
      this.state.foodSecurity = 0;
      return;
    }

    // Calculate food security
    const totalFood = this.resourceManager.getTotalFood();
    const foodPerPinata = totalFood / population;

    // Food security: how many "meals" of buffer do we have?
    // A pinata eats roughly every 30-60 seconds when hungry
    // So 5 food per pinata is about 2-3 minutes of security
    this.state.foodSecurity = Math.min(100, foodPerPinata * 20);

    // Winter preparation score
    if (this.seasonSystem) {
      const season = this.seasonSystem.getSeason();
      if (season === Season.Winter) {
        // In winter, need MORE food per pinata
        this.state.winterPrepScore = Math.min(100, foodPerPinata * 10);
      } else if (season === Season.Autumn) {
        // Autumn: warning - should be stockpiling
        this.state.winterPrepScore = Math.min(100, foodPerPinata * 15);
      } else {
        this.state.winterPrepScore = 100; // Not worried outside autumn/winter
      }
    }

    // Determine colony mood
    const now = Date.now();
    if (now < this.state.mourningUntil) {
      this.state.mood = ColonyMood.Mourning;
    } else if (this.state.fearLevel > 50) {
      this.state.mood = ColonyMood.UnderAttack;
    } else if (this.state.foodSecurity < 20) {
      this.state.mood = ColonyMood.Desperate;
    } else if (this.state.foodSecurity < 40) {
      this.state.mood = ColonyMood.Worried;
    } else if (this.state.foodSecurity > 70 && this.state.recentDeaths === 0) {
      this.state.mood = ColonyMood.Thriving;
    } else {
      this.state.mood = ColonyMood.Stable;
    }

    // Apply colony mood effects to individuals
    this.applyColonyMoodEffects();
  }

  private applyColonyMoodEffects(): void {
    // Colony mood affects individual stress levels
    for (const pinata of this.pinatas) {
      if (!pinata.getIsAlive()) continue;

      // Desperation: broadcast hunger warnings more aggressively
      if (this.state.mood === ColonyMood.Desperate) {
        const needs = pinata.getNeeds();
        if (needs.hunger < 40) {
          EventBus.emit(GameEvents.PINATA_HUNGRY, pinata);
        }
      }
    }
  }

  private applyStarvationEffects(): void {
    for (const pinata of this.pinatas) {
      if (!pinata.getIsAlive()) continue;

      const needs = pinata.getNeeds();

      // Starving piñatas take damage
      if (needs.hunger < this.STARVATION_THRESHOLD) {
        // Severe starvation - this could lead to death
        // For now, just log it - actual death would need health system
        console.log(`${pinata.nickname} is STARVING! (hunger: ${needs.hunger.toFixed(1)})`);

        // Emit event for UI notification
        EventBus.emit('colony:starvation', pinata);
      }
    }
  }

  private broadcastGrief(): void {
    // All piñatas who knew the deceased should grieve
    // Emit grief event so PerceptionSystem can generate mourn goals
    for (const pinata of this.pinatas) {
      if (!pinata.getIsAlive()) continue;
      // Perception system will detect this and add mourn goals
      EventBus.emit('colony:grief', pinata);
    }
  }

  // Public getters for UI
  getColonyState(): ColonyState {
    return { ...this.state };
  }

  getColonyMood(): ColonyMood {
    return this.state.mood;
  }

  getFoodSecurity(): number {
    return this.state.foodSecurity;
  }

  getPopulation(): number {
    return this.pinatas.filter(p => p.getIsAlive()).length;
  }

  isWinterComing(): boolean {
    if (!this.seasonSystem) return false;
    const season = this.seasonSystem.getSeason();
    return season === Season.Autumn || season === Season.Winter;
  }

  getWinterReadiness(): number {
    return this.state.winterPrepScore;
  }

  /**
   * Calculate food needed to survive winter
   */
  getFoodNeededForWinter(): number {
    const population = this.getPopulation();
    // Assume winter lasts ~3 minutes in game time
    // Each pinata needs ~1 food per 30 seconds when hungry
    // So roughly 6 food per pinata for winter
    return population * 8;
  }
}
