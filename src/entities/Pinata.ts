import Phaser from 'phaser';
import { PinataSpecies, SPECIES_DATA, PinataSpeciesData } from './PinataTypes';
import { GridPosition, gridToScreen, getDepth, screenToGridRounded } from '../world/IsoUtils';
import { Pathfinder } from '../world/Pathfinding';
import { NEED_MAX, NEED_DECAY_RATE, MOOD_HAPPY_THRESHOLD, MOOD_STRESSED_THRESHOLD, MOOD_BREAKING_THRESHOLD } from '../utils/Constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ZoneManager, ZoneType } from '../world/Zone';
import { ResourceManager, Resource, ResourceType } from './Resource';
import { TimeSystem } from '../systems/TimeSystem';
import { RelationshipSystem } from '../systems/RelationshipSystem';
import { Trait, TraitEffects, generateTraits, getCombinedEffects, TRAIT_INFO, describeTraits } from '../systems/TraitSystem';
import { SeasonSystem } from '../systems/SeasonSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { FarmingSystem, CropStage } from '../systems/FarmingSystem';

export enum MoodState {
  Happy = 'happy',
  Content = 'content',
  Stressed = 'stressed',
  Breaking = 'breaking',
}

export enum JobType {
  Idle = 'idle',
  Gatherer = 'gatherer',
  Farmer = 'farmer',
  Guard = 'guard',
  Hunter = 'hunter',
}

export enum BehaviorState {
  Idle = 'idle',
  Wandering = 'wandering',
  Moving = 'moving',
  SeekingFood = 'seekingFood',
  Eating = 'eating',
  SeekingSleep = 'seekingSleep',
  Sleeping = 'sleeping',
  SeekingFun = 'seekingFun',
  Playing = 'playing',
  SeekingSocial = 'seekingSocial',
  // Gatherer behaviors
  SeekingResource = 'seekingResource',
  PickingUpResource = 'pickingUp',
  CarryingToStockpile = 'carryingToStockpile',
  DroppingResource = 'droppingResource',
  Working = 'working',
  Socializing = 'socializing',
  MentalBreak = 'mentalBreak',
  // Predator/prey behaviors
  Hunting = 'hunting',
  Chasing = 'chasing',
  Attacking = 'attacking',
  Fleeing = 'fleeing',
  Guarding = 'guarding',
  Fighting = 'fighting',
  Dead = 'dead',
  // Work task behaviors
  GoingToWork = 'goingToWork',
  Farming = 'farming',
  Building = 'building',
}

export interface PinataNeeds {
  hunger: number;
  rest: number;
  fun: number;
  social: number;
}

// Thresholds for seeking needs
const NEED_SEEK_THRESHOLD = 40; // Start seeking when need drops below this
const NEED_SATISFIED_THRESHOLD = 80; // Stop activity when need rises above this

let pinataIdCounter = 0;

/**
 * Main Pinata creature class
 */
export class Pinata extends Phaser.GameObjects.Container {
  public readonly id: number;
  public readonly species: PinataSpecies;
  public readonly speciesData: PinataSpeciesData;

  // Traits - personality system
  public readonly traits: Trait[];
  private traitEffects: TraitEffects;

  // Position in grid coordinates
  private gridX: number;
  private gridY: number;

  // Visual components
  private sprite: Phaser.GameObjects.Image;
  private selectionRing: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private statusIcon: Phaser.GameObjects.Text;
  private traitIcons: Phaser.GameObjects.Text;

  // State
  private needs: PinataNeeds;
  private mood: MoodState = MoodState.Content;
  private behavior: BehaviorState = BehaviorState.Idle;
  private job: JobType = JobType.Idle;

  // Movement
  private pathfinder: Pathfinder | null = null;
  private currentPath: GridPosition[] = [];
  private pathIndex = 0;

  // External references (set by GameScene)
  private zoneManager: ZoneManager | null = null;
  private resourceManager: ResourceManager | null = null;
  private timeSystem: TimeSystem | null = null;
  private relationshipSystem: RelationshipSystem | null = null;
  private seasonSystem: SeasonSystem | null = null;
  private buildingSystem: BuildingSystem | null = null;
  private farmingSystem: FarmingSystem | null = null;

  // Work task (assigned by WorkSystem)
  private currentWorkTask: { type: string; data: unknown; position: GridPosition } | null = null;

  // Activity state
  private activityTimer = 0;
  private idleTimer = 0;

  // Gatherer state
  private carriedResource: Resource | null = null;
  private targetResource: Resource | null = null;

  // Predator/prey state
  private targetPrey: Pinata | null = null;
  private threat: Pinata | null = null;
  private allPinatas: Pinata[] = [];
  private isAlive = true;
  private huntCooldown = 0;

  // Social state
  private socialTarget: Pinata | null = null;

  // Production state
  private productionTimer = 0;

  // Animation
  private bobTween: Phaser.Tweens.Tween | null = null;

  // Name
  public nickname: string;

  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    species: PinataSpecies,
    pathfinder?: Pathfinder
  ) {
    const screenPos = gridToScreen(gridX, gridY);
    super(scene, screenPos.x, screenPos.y);

    this.id = pinataIdCounter++;
    this.gridX = gridX;
    this.gridY = gridY;
    this.species = species;
    this.speciesData = SPECIES_DATA[species];
    this.pathfinder = pathfinder ?? null;

    // Generate traits - this defines personality!
    this.traits = generateTraits(species, 2 + Math.floor(Math.random() * 2)); // 2-3 traits
    this.traitEffects = getCombinedEffects(this.traits);

    // Generate a cute name
    this.nickname = this.generateName();

    // Initialize needs
    this.needs = {
      hunger: NEED_MAX * 0.8 + Math.random() * NEED_MAX * 0.2,
      rest: NEED_MAX * 0.8 + Math.random() * NEED_MAX * 0.2,
      fun: NEED_MAX * 0.6 + Math.random() * NEED_MAX * 0.4,
      social: NEED_MAX * 0.6 + Math.random() * NEED_MAX * 0.4,
    };

    // Create sprite
    this.sprite = scene.add.image(0, 0, this.speciesData.textureKey);
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Create selection ring (hidden by default)
    this.selectionRing = scene.add.image(0, 0, 'selection');
    this.selectionRing.setOrigin(0.5, 0.5);
    this.selectionRing.setY(0);
    this.selectionRing.setVisible(false);
    this.add(this.selectionRing);

    // Create name text (hidden by default)
    this.nameText = scene.add.text(0, -50, this.nickname, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameText.setOrigin(0.5, 1);
    this.nameText.setVisible(false);
    this.add(this.nameText);

    // Create status icon (shows what piñata is doing)
    this.statusIcon = scene.add.text(0, -60, '', {
      fontSize: '16px',
    });
    this.statusIcon.setOrigin(0.5, 1);
    this.add(this.statusIcon);

    // Create trait icons (shown when selected)
    const traitIconStr = this.traits.map(t => TRAIT_INFO[t].icon).join('');
    this.traitIcons = scene.add.text(0, -70, traitIconStr, {
      fontSize: '10px',
    });
    this.traitIcons.setOrigin(0.5, 1);
    this.traitIcons.setVisible(false);
    this.add(this.traitIcons);

    // Set depth based on position
    this.updateDepth();

    // Start idle animation
    this.startIdleAnimation();

    // Make interactive
    this.setSize(32, 48);
    this.setInteractive();
    this.on('pointerdown', () => this.onClicked());

    scene.add.existing(this);
  }

  private generateName(): string {
    const prefixes = ['Sir', 'Lady', 'Captain', 'Professor', 'Baron', 'Duke', 'Earl', 'Lord'];
    const names = ['Sprinkles', 'Confetti', 'Taffy', 'Gummy', 'Jellybean', 'Caramel', 'Toffee', 'Marshmallow', 'Butterscotch', 'Peppermint', 'Cinnamon', 'Fudge', 'Truffle', 'Bonbon'];

    const usePrefix = Math.random() > 0.7;
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const name = names[Math.floor(Math.random() * names.length)];

    return usePrefix ? `${prefix} ${name}` : name;
  }

  setPathfinder(pathfinder: Pathfinder): void {
    this.pathfinder = pathfinder;
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
  }

  setResourceManager(resourceManager: ResourceManager): void {
    this.resourceManager = resourceManager;
  }

  setTimeSystem(timeSystem: TimeSystem): void {
    this.timeSystem = timeSystem;
  }

  setRelationshipSystem(relationshipSystem: RelationshipSystem): void {
    this.relationshipSystem = relationshipSystem;
  }

  setSeasonSystem(seasonSystem: SeasonSystem): void {
    this.seasonSystem = seasonSystem;
  }

  setBuildingSystem(buildingSystem: BuildingSystem): void {
    this.buildingSystem = buildingSystem;
  }

  setFarmingSystem(farmingSystem: FarmingSystem): void {
    this.farmingSystem = farmingSystem;
  }

  // Called by WorkSystem to assign a task
  assignWorkTask(type: string, position: GridPosition, data: unknown): void {
    this.currentWorkTask = { type, position, data };
  }

  // Called by WorkSystem to send piñata to work location
  goToWork(gridX: number, gridY: number): boolean {
    if (this.moveToGrid(gridX, gridY)) {
      this.behavior = BehaviorState.GoingToWork;
      return true;
    }
    return false;
  }

  clearWorkTask(): void {
    this.currentWorkTask = null;
  }

  getTraits(): Trait[] {
    return [...this.traits];
  }

  getTraitEffects(): TraitEffects {
    return { ...this.traitEffects };
  }

  describeTraits(): string {
    return describeTraits(this.traits);
  }

  setPinataList(pinatas: Pinata[]): void {
    this.allPinatas = pinatas;
  }

  isPredator(): boolean {
    return this.species === PinataSpecies.Pretztail;
  }

  isGuard(): boolean {
    return this.species === PinataSpecies.Rashberry || this.job === JobType.Guard;
  }

  getIsAlive(): boolean {
    return this.isAlive;
  }

  update(delta: number): void {
    // Dead piñatas don't update
    if (!this.isAlive) {
      return;
    }

    // Update hunt cooldown
    if (this.huntCooldown > 0) {
      this.huntCooldown -= delta;
    }

    // Check for nearby threats (flee from predators!)
    this.checkForThreats();

    // Decay needs over time
    this.updateNeeds(delta);

    // Update mood based on needs
    this.updateMood();

    // Execute behavior (includes need-seeking AI)
    this.updateBehavior(delta);

    // Handle production (for producers like Moozipan, Buzzlegum)
    this.updateProduction(delta);

    // Update visuals
    this.updateVisuals();
    this.updateStatusIcon();
  }

  private updateProduction(delta: number): void {
    // Only producer species produce
    if (!this.speciesData.produces || !this.speciesData.productionTime) return;

    // Need to be well-fed and not stressed to produce
    if (this.needs.hunger < 40 || this.mood === MoodState.Breaking || this.mood === MoodState.Stressed) {
      return;
    }

    // Need resource manager to spawn resources
    if (!this.resourceManager) return;

    // Update timer
    this.productionTimer += delta;

    // Happy piñatas produce faster
    const speedMultiplier = this.mood === MoodState.Happy ? 0.75 : 1;
    const productionTime = this.speciesData.productionTime * speedMultiplier;

    if (this.productionTimer >= productionTime) {
      this.productionTimer = 0;

      // Produce resource at current location
      const resource = this.resourceManager.spawnResource(
        this.gridX,
        this.gridY,
        this.speciesData.produces
      );

      // Producing costs hunger
      this.needs.hunger = Math.max(0, this.needs.hunger - 15);

      EventBus.emit(GameEvents.RESOURCE_SPAWNED, this, resource);
      console.log(`${this.nickname} produced ${this.speciesData.produces}!`);
    }
  }

  private updateNeeds(delta: number): void {
    const decayRate = NEED_DECAY_RATE * (delta / 1000);

    // Time of day affects rest decay (get sleepier at night)
    const timeMultiplier = this.timeSystem?.getRestDecayMultiplier() ?? 1.0;

    // Season affects need decay
    const seasonHungerMult = this.seasonSystem?.getHungerDecayMultiplier() ?? 1.0;
    const seasonRestMult = this.seasonSystem?.getRestDecayMultiplier() ?? 1.0;

    // Trait effects on need decay
    const hungerTraitMult = this.traitEffects.hungerDecayMult ?? 1.0;
    const restTraitMult = this.traitEffects.restDecayMult ?? 1.0;
    const funTraitMult = this.traitEffects.funDecayMult ?? 1.0;
    const socialTraitMult = this.traitEffects.socialDecayMult ?? 1.0;

    // Different activities affect need decay/gain
    let hungerDecay = decayRate * seasonHungerMult * hungerTraitMult;
    let restDecay = decayRate * timeMultiplier * seasonRestMult * restTraitMult;
    let funDecay = decayRate * 0.8 * funTraitMult;
    let socialDecay = decayRate * 0.5 * socialTraitMult;

    // Working makes you hungry and tired faster
    if (this.behavior === BehaviorState.Working) {
      hungerDecay *= 1.5;
      restDecay *= 1.2;
      funDecay *= 1.5;
    }

    // Sleeping restores rest
    if (this.behavior === BehaviorState.Sleeping) {
      restDecay = -decayRate * 3; // Gain rest while sleeping
      hungerDecay *= 0.5; // Less hungry while sleeping
    }

    // Playing restores fun
    if (this.behavior === BehaviorState.Playing) {
      funDecay = -decayRate * 2.5; // Gain fun while playing
      restDecay *= 1.2; // Playing is tiring
    }

    // Socializing restores social
    if (this.behavior === BehaviorState.Socializing) {
      socialDecay = -decayRate * 2;
    }

    this.needs.hunger = Math.max(0, Math.min(NEED_MAX, this.needs.hunger - hungerDecay));
    this.needs.rest = Math.max(0, Math.min(NEED_MAX, this.needs.rest - restDecay));
    this.needs.fun = Math.max(0, Math.min(NEED_MAX, this.needs.fun - funDecay));
    this.needs.social = Math.max(0, Math.min(NEED_MAX, this.needs.social - socialDecay));

    // Emit events when needs get critical
    if (this.needs.hunger < 20) {
      EventBus.emit(GameEvents.PINATA_HUNGRY, this);
    }
    if (this.needs.rest < 20) {
      EventBus.emit(GameEvents.PINATA_TIRED, this);
    }
  }

  private updateMood(): void {
    const avgNeed = (this.needs.hunger + this.needs.rest + this.needs.fun + this.needs.social) / 4;
    const minNeed = Math.min(this.needs.hunger, this.needs.rest, this.needs.fun, this.needs.social);

    let newMood: MoodState;

    if (minNeed < MOOD_BREAKING_THRESHOLD) {
      newMood = MoodState.Breaking;
    } else if (avgNeed < MOOD_STRESSED_THRESHOLD) {
      newMood = MoodState.Stressed;
    } else if (avgNeed > MOOD_HAPPY_THRESHOLD) {
      newMood = MoodState.Happy;
    } else {
      newMood = MoodState.Content;
    }

    if (newMood !== this.mood) {
      this.mood = newMood;
      EventBus.emit(GameEvents.PINATA_MOOD_CHANGED, this, this.mood);

      // Trigger mental break behavior
      if (this.mood === MoodState.Breaking) {
        this.behavior = BehaviorState.MentalBreak;
      }
    }
  }

  private updateBehavior(delta: number): void {
    // Mental break takes priority
    if (this.mood === MoodState.Breaking && this.behavior !== BehaviorState.MentalBreak) {
      this.behavior = BehaviorState.MentalBreak;
    }

    switch (this.behavior) {
      case BehaviorState.Idle:
        this.handleIdleBehavior(delta);
        break;

      case BehaviorState.Wandering:
      case BehaviorState.Moving:
      case BehaviorState.SeekingFood:
      case BehaviorState.SeekingSleep:
      case BehaviorState.SeekingFun:
      case BehaviorState.SeekingSocial:
      case BehaviorState.SeekingResource:
      case BehaviorState.CarryingToStockpile:
        this.updateMovement(delta);
        break;

      case BehaviorState.Eating:
        this.handleEating(delta);
        break;

      case BehaviorState.Sleeping:
        this.handleSleeping(delta);
        break;

      case BehaviorState.Playing:
        this.handlePlaying(delta);
        break;

      case BehaviorState.Socializing:
        this.handleSocializing(delta);
        break;

      case BehaviorState.PickingUpResource:
        this.handlePickingUp(delta);
        break;

      case BehaviorState.DroppingResource:
        this.handleDroppingResource(delta);
        break;

      case BehaviorState.MentalBreak:
        this.handleMentalBreak(delta);
        break;

      // Predator/prey behaviors
      case BehaviorState.Hunting:
        this.handleHunting(delta);
        break;

      case BehaviorState.Chasing:
        this.handleChasing(delta);
        break;

      case BehaviorState.Attacking:
        this.handleAttacking(delta);
        break;

      case BehaviorState.Fleeing:
        this.handleFleeing(delta);
        break;

      case BehaviorState.Fighting:
        this.handleFighting(delta);
        break;

      case BehaviorState.Dead:
        // Dead piñatas don't do anything
        break;

      // Work task behaviors
      case BehaviorState.GoingToWork:
        this.updateMovement(delta);
        break;

      case BehaviorState.Farming:
        this.handleFarmingWork(delta);
        break;

      case BehaviorState.Building:
        this.handleBuildingWork(delta);
        break;

      default:
        break;
    }
  }

  private handleIdleBehavior(delta: number): void {
    this.idleTimer += delta;

    // Predators hunt when hungry and cooldown is done
    if (this.isPredator() && this.huntCooldown <= 0 && this.needs.hunger < 60) {
      const prey = this.findPrey();
      if (prey) {
        this.targetPrey = prey;
        this.behavior = BehaviorState.Hunting;
        return;
      }
    }

    // Check if any needs require urgent attention
    if (this.shouldSeekNeed()) {
      return;
    }

    // Auto-assign job if idle
    this.autoAssignJob();

    // Do job work
    if (this.job === JobType.Gatherer) {
      if (this.tryGatherResource()) {
        return;
      }
    }

    // After being idle for a bit, start wandering
    if (this.idleTimer > 2000 + Math.random() * 3000) {
      this.startWandering();
    }
  }

  private autoAssignJob(): void {
    // Only auto-assign if currently idle job
    if (this.job !== JobType.Idle) return;

    // Check if colony needs gatherers (low food in stockpile, resources available)
    if (this.resourceManager && this.zoneManager) {
      const foodCount = this.resourceManager.getTotalFood();
      const hasResources = this.resourceManager.getAvailableResources().length > 0;
      const hasStockpile = this.zoneManager.getZonesByType(ZoneType.Stockpile).length > 0;

      // Need gatherers if low on food and resources exist
      if (foodCount < 15 && hasResources && hasStockpile) {
        // Sparrowmints are best gatherers
        if (this.species === PinataSpecies.Sparrowmint || Math.random() < 0.3) {
          this.job = JobType.Gatherer;
        }
      }
    }
  }

  private tryGatherResource(): boolean {
    if (!this.resourceManager || !this.zoneManager) return false;

    // Find nearest available resource
    const resource = this.resourceManager.findNearestResource(
      { x: this.gridX, y: this.gridY }
    );

    if (resource) {
      this.targetResource = resource;
      const pos = resource.getGridPosition();
      if (this.moveToGrid(pos.x, pos.y)) {
        this.behavior = BehaviorState.SeekingResource;
        return true;
      }
    }

    // No resources to gather, go back to idle job
    this.job = JobType.Idle;
    return false;
  }

  private handlePickingUp(delta: number): void {
    this.activityTimer += delta;

    // Picking up takes 0.5 seconds
    if (this.activityTimer >= 500) {
      this.activityTimer = 0;

      if (this.targetResource && this.targetResource.isAvailable()) {
        this.carriedResource = this.targetResource;
        this.carriedResource.pickup();
        this.targetResource = null;

        // Now carry to stockpile
        if (this.zoneManager) {
          const stockpile = this.zoneManager.findNearestZone(
            { x: this.gridX, y: this.gridY },
            ZoneType.Stockpile
          );
          if (stockpile && this.moveToGrid(stockpile.tile.x, stockpile.tile.y)) {
            this.behavior = BehaviorState.CarryingToStockpile;
            return;
          }
        }
      }

      // Failed to pick up or no stockpile - go idle
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
    }
  }

  private handleDroppingResource(delta: number): void {
    this.activityTimer += delta;

    // Dropping takes 0.3 seconds
    if (this.activityTimer >= 300) {
      this.activityTimer = 0;

      if (this.carriedResource && this.resourceManager) {
        this.resourceManager.addToStockpile(this.carriedResource);
        EventBus.emit(GameEvents.RESOURCE_COLLECTED, this, this.carriedResource);
        this.carriedResource = null;
      }

      // Look for more resources to gather
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
    }
  }

  private shouldSeekNeed(): boolean {
    // Priority: Hunger > Rest > Fun > Social

    // Check hunger
    if (this.needs.hunger < NEED_SEEK_THRESHOLD && this.resourceManager) {
      if (this.resourceManager.getTotalFood() > 0 && this.zoneManager) {
        const stockpile = this.zoneManager.findNearestZone(
          { x: this.gridX, y: this.gridY },
          ZoneType.Stockpile
        );
        if (stockpile && this.moveToGrid(stockpile.tile.x, stockpile.tile.y)) {
          this.behavior = BehaviorState.SeekingFood;
          return true;
        }
      }
    }

    // Check rest
    if (this.needs.rest < NEED_SEEK_THRESHOLD && this.zoneManager) {
      const sleepZone = this.zoneManager.findNearestZone(
        { x: this.gridX, y: this.gridY },
        ZoneType.Sleep
      );
      if (sleepZone && this.moveToGrid(sleepZone.tile.x, sleepZone.tile.y)) {
        this.behavior = BehaviorState.SeekingSleep;
        return true;
      }
    }

    // Check fun
    if (this.needs.fun < NEED_SEEK_THRESHOLD && this.zoneManager) {
      const funZone = this.zoneManager.findNearestZone(
        { x: this.gridX, y: this.gridY },
        ZoneType.Recreation
      );
      if (funZone && this.moveToGrid(funZone.tile.x, funZone.tile.y)) {
        this.behavior = BehaviorState.SeekingFun;
        return true;
      }
    }

    // Check social - find someone to talk to
    if (this.needs.social < NEED_SEEK_THRESHOLD) {
      const target = this.findSocialTarget();
      if (target) {
        const targetPos = target.getGridPosition();
        if (this.moveToGrid(targetPos.x, targetPos.y)) {
          this.socialTarget = target;
          this.behavior = BehaviorState.SeekingSocial;
          return true;
        }
      }
    }

    return false;
  }

  private findSocialTarget(): Pinata | null {
    // First, prefer friends (from relationship system)
    if (this.relationshipSystem) {
      const friends = this.relationshipSystem.getFriends(this.id);
      if (friends.length > 0) {
        // Find nearest friend
        let closest: Pinata | null = null;
        let closestDist = Infinity;
        for (const friend of friends) {
          const dist = this.distanceTo(friend);
          if (dist < closestDist) {
            closest = friend;
            closestDist = dist;
          }
        }
        if (closest) return closest;
      }
    }

    // Otherwise find any nearby piñata (not a predator or self)
    const range = 15;
    let closest: Pinata | null = null;
    let closestDist = Infinity;

    for (const other of this.allPinatas) {
      if (other === this || !other.isAlive || other.isPredator()) continue;

      const dist = this.distanceTo(other);
      if (dist < range && dist < closestDist) {
        closest = other;
        closestDist = dist;
      }
    }

    return closest;
  }

  private handleEating(delta: number): void {
    this.activityTimer += delta;

    // Eating takes 1.5 seconds
    if (this.activityTimer >= 1500) {
      // Try to get food from stockpile
      if (this.resourceManager) {
        const food = this.resourceManager.takeAnyFood();
        if (food) {
          this.needs.hunger = Math.min(NEED_MAX, this.needs.hunger + food.hungerValue);
          EventBus.emit(GameEvents.PINATA_ATE, this, food.type);
        }
      }

      this.activityTimer = 0;

      // Keep eating if still hungry, otherwise go idle
      if (this.needs.hunger >= NEED_SATISFIED_THRESHOLD || !this.resourceManager?.getTotalFood()) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
      }
    }
  }

  private handleSleeping(delta: number): void {
    this.activityTimer += delta;

    // Check every second if we should wake up
    if (this.activityTimer >= 1000) {
      this.activityTimer = 0;

      // Apply building rest bonus (Candy House)
      let restGain = 8; // Base rest per second
      if (this.buildingSystem) {
        const effects = this.buildingSystem.getEffectsAt({ x: this.gridX, y: this.gridY });
        if (effects.restBonus) {
          restGain *= effects.restBonus;
        }
      }

      this.needs.rest = Math.min(NEED_MAX, this.needs.rest + restGain);

      // Wake up if rested enough
      if (this.needs.rest >= NEED_SATISFIED_THRESHOLD) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
      }
    }
  }

  private handlePlaying(delta: number): void {
    this.activityTimer += delta;

    // Check every second if we should stop playing
    if (this.activityTimer >= 1000) {
      this.activityTimer = 0;

      // Apply building fun bonus (Playground)
      let funGain = 6; // Base fun per second
      if (this.buildingSystem) {
        const effects = this.buildingSystem.getEffectsAt({ x: this.gridX, y: this.gridY });
        if (effects.funBonus) {
          funGain *= effects.funBonus;
        }
      }

      this.needs.fun = Math.min(NEED_MAX, this.needs.fun + funGain);

      // Stop playing if fun is satisfied
      if (this.needs.fun >= NEED_SATISFIED_THRESHOLD) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
      }
    }
  }

  private handleSocializing(delta: number): void {
    this.activityTimer += delta;

    // Each second of socializing
    if (this.activityTimer >= 1000) {
      this.activityTimer = 0;

      // Check if social target is still nearby
      if (this.socialTarget && this.socialTarget.getIsAlive()) {
        const dist = this.distanceTo(this.socialTarget);

        if (dist <= 3) {
          // Emit socialized event - builds relationship
          EventBus.emit(GameEvents.PINATA_SOCIALIZED, this, this.socialTarget);

          // Both piñatas gain social satisfaction
          const socialGain = 15;
          this.needs.social = Math.min(NEED_MAX, this.needs.social + socialGain);
        } else {
          // Target moved away, chase them
          const targetPos = this.socialTarget.getGridPosition();
          this.moveToGrid(targetPos.x, targetPos.y);
          this.behavior = BehaviorState.SeekingSocial;
          return;
        }
      }

      // Stop socializing if satisfied or target gone
      if (this.needs.social >= NEED_SATISFIED_THRESHOLD || !this.socialTarget?.getIsAlive()) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        this.socialTarget = null;
      }
    }
  }

  private handleMentalBreak(delta: number): void {
    // Wander aimlessly
    this.updateMovement(delta);

    // Occasionally start wandering if stopped
    if (this.currentPath.length === 0 && Math.random() < 0.01) {
      this.startWandering();
    }

    // Recover from mental break if needs improve
    const avgNeed = (this.needs.hunger + this.needs.rest + this.needs.fun + this.needs.social) / 4;
    if (avgNeed > 50 && Math.min(this.needs.hunger, this.needs.rest, this.needs.fun, this.needs.social) > 30) {
      this.behavior = BehaviorState.Idle;
      this.mood = MoodState.Stressed; // Recover to stressed first
    }
  }

  // ========== Work Task Behaviors ==========

  private handleFarmingWork(delta: number): void {
    this.activityTimer += delta;

    if (!this.currentWorkTask || !this.farmingSystem) {
      this.finishWorkTask();
      return;
    }

    const taskData = this.currentWorkTask.data as { action: string; cropId: number };
    const crop = this.farmingSystem.getCropAt(this.currentWorkTask.position);

    if (!crop) {
      // Crop was harvested/withered already
      this.finishWorkTask();
      return;
    }

    // Farming takes 2 seconds per action
    if (this.activityTimer >= 2000) {
      this.activityTimer = 0;

      if (taskData.action === 'harvest' && crop.stage === CropStage.Mature) {
        this.farmingSystem.harvest(crop);
        console.log(`${this.nickname} harvested crop!`);
        EventBus.emit(GameEvents.RESOURCE_COLLECTED, this, { resourceType: 'crop' });
      } else if (taskData.action === 'water' && crop.needsWater) {
        this.farmingSystem.waterCrop(crop);
        console.log(`${this.nickname} watered crop!`);
      }

      this.finishWorkTask();
    }
  }

  private handleBuildingWork(delta: number): void {
    this.activityTimer += delta;

    if (!this.currentWorkTask || !this.buildingSystem) {
      this.finishWorkTask();
      return;
    }

    const building = this.buildingSystem.getBuildingAt(this.currentWorkTask.position);

    if (!building || building.constructionProgress >= 100) {
      // Building complete or removed
      this.finishWorkTask();
      return;
    }

    // Work on building every second
    if (this.activityTimer >= 1000) {
      this.activityTimer = 0;

      // Work speed affected by traits
      const workSpeed = this.traitEffects.workSpeedMult ?? 1.0;
      this.buildingSystem.workOnBuilding(building, workSpeed);

      // Building work is tiring
      this.needs.hunger = Math.max(0, this.needs.hunger - 2);
      this.needs.rest = Math.max(0, this.needs.rest - 1);

      // Check if building is now complete
      if (building.constructionProgress >= 100) {
        console.log(`${this.nickname} finished building ${building.data.name}!`);
        this.finishWorkTask();
      }
    }
  }

  private finishWorkTask(): void {
    this.currentWorkTask = null;
    this.behavior = BehaviorState.Idle;
    this.idleTimer = 0;
    // WorkSystem will clear its assignment when it sees we're idle
  }

  // ========== Predator/Prey Behaviors ==========

  private checkForThreats(): void {
    // Predators don't flee
    if (this.isPredator()) return;

    // Already fleeing or fighting
    if (this.behavior === BehaviorState.Fleeing || this.behavior === BehaviorState.Fighting) {
      return;
    }

    // Find nearby predators
    const threatRange = 8; // tiles
    for (const other of this.allPinatas) {
      if (!other.isPredator() || !other.isAlive) continue;

      const dist = this.distanceTo(other);
      if (dist < threatRange) {
        // Found a threat!
        this.threat = other;

        // Guards fight, others flee
        if (this.isGuard()) {
          this.behavior = BehaviorState.Fighting;
          this.activityTimer = 0;
        } else {
          this.startFleeing(other);
        }
        return;
      }
    }
  }

  private distanceTo(other: Pinata): number {
    const otherPos = other.getGridPosition();
    const dx = this.gridX - otherPos.x;
    const dy = this.gridY - otherPos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private startFleeing(predator: Pinata): void {
    if (!this.pathfinder) return;

    const predatorPos = predator.getGridPosition();
    // Run away from predator
    const dx = this.gridX - predatorPos.x;
    const dy = this.gridY - predatorPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Flee 10 tiles in opposite direction
    const fleeX = Math.round(this.gridX + (dx / dist) * 10);
    const fleeY = Math.round(this.gridY + (dy / dist) * 10);

    if (this.moveToGrid(fleeX, fleeY)) {
      this.behavior = BehaviorState.Fleeing;
      this.threat = predator;
    }
  }

  private handleHunting(delta: number): void {
    // Find prey if we don't have one
    if (!this.targetPrey || !this.targetPrey.isAlive) {
      this.targetPrey = this.findPrey();

      if (!this.targetPrey) {
        // No prey found, go back to idle
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        return;
      }
    }

    // Move towards prey
    const preyPos = this.targetPrey.getGridPosition();
    const dist = this.distanceTo(this.targetPrey);

    if (dist <= 1) {
      // Close enough to attack!
      this.behavior = BehaviorState.Attacking;
      this.activityTimer = 0;
    } else {
      // Keep chasing - update path periodically
      if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) {
        this.moveToGrid(preyPos.x, preyPos.y);
        this.behavior = BehaviorState.Chasing;
      }
      this.updateMovement(delta);
    }
  }

  private handleChasing(delta: number): void {
    if (!this.targetPrey || !this.targetPrey.isAlive) {
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
      this.targetPrey = null;
      return;
    }

    const dist = this.distanceTo(this.targetPrey);

    if (dist <= 1) {
      // Caught up!
      this.behavior = BehaviorState.Attacking;
      this.activityTimer = 0;
    } else if (dist > 15) {
      // Prey escaped
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
      this.targetPrey = null;
    } else {
      // Update chase path if reached end
      if (this.pathIndex >= this.currentPath.length) {
        const preyPos = this.targetPrey.getGridPosition();
        this.moveToGrid(preyPos.x, preyPos.y);
      }
      this.updateMovement(delta);
    }
  }

  private handleAttacking(delta: number): void {
    this.activityTimer += delta;

    // Attack takes 1 second
    if (this.activityTimer >= 1000) {
      this.activityTimer = 0;

      if (this.targetPrey && this.targetPrey.isAlive) {
        const dist = this.distanceTo(this.targetPrey);
        if (dist <= 2) {
          // Successful attack!
          this.targetPrey.takeDamage(this);
          this.huntCooldown = 30000; // 30 second cooldown after successful hunt
        }
      }

      this.targetPrey = null;
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
    }
  }

  private handleFleeing(delta: number): void {
    // Keep moving along flee path
    this.updateMovement(delta);

    // Check if threat is still nearby
    if (this.threat && this.threat.isAlive) {
      const dist = this.distanceTo(this.threat);

      if (dist < 5 && this.pathIndex >= this.currentPath.length) {
        // Still too close, keep fleeing
        this.startFleeing(this.threat);
      } else if (dist > 12) {
        // Escaped!
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        this.threat = null;
      }
    } else {
      // Threat gone
      if (this.pathIndex >= this.currentPath.length) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        this.threat = null;
      }
    }
  }

  private handleFighting(delta: number): void {
    this.activityTimer += delta;

    // Check if threat still nearby
    if (!this.threat || !this.threat.isAlive) {
      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
      this.threat = null;
      return;
    }

    const dist = this.distanceTo(this.threat);

    if (dist > 2) {
      // Move towards threat
      const threatPos = this.threat.getGridPosition();
      if (this.pathIndex >= this.currentPath.length) {
        this.moveToGrid(threatPos.x, threatPos.y);
      }
      this.updateMovement(delta);
    } else if (this.activityTimer >= 1500) {
      // Fight! Guards have combat bonus
      this.activityTimer = 0;

      // 60% chance to drive off predator (Rashberry bonus)
      const success = Math.random() < 0.6;
      if (success) {
        // Predator flees!
        this.threat.forceFlee(this);
        EventBus.emit(GameEvents.PINATA_DEFENDED, this, this.threat);
        console.log(`${this.nickname} defended against ${this.threat.nickname}!`);
      }

      this.behavior = BehaviorState.Idle;
      this.idleTimer = 0;
      this.threat = null;
    }
  }

  private findPrey(): Pinata | null {
    const huntRange = 12;
    let closest: Pinata | null = null;
    let closestDist = Infinity;

    for (const other of this.allPinatas) {
      // Don't hunt other predators, guards, or self
      if (other === this || other.isPredator() || !other.isAlive) continue;

      // Avoid guards if possible
      if (other.isGuard()) continue;

      const dist = this.distanceTo(other);
      if (dist < huntRange && dist < closestDist) {
        closest = other;
        closestDist = dist;
      }
    }

    return closest;
  }

  forceFlee(from: Pinata): void {
    this.startFleeing(from);
    this.huntCooldown = 20000; // Scared off for 20 seconds
  }

  takeDamage(attacker: Pinata): void {
    // Piñata is "broken open" - dies
    this.isAlive = false;
    this.behavior = BehaviorState.Dead;

    // Visual feedback
    this.sprite.setTint(0x888888);
    this.sprite.setAlpha(0.5);

    // Drop candy on death (resources)
    if (this.resourceManager) {
      // Spawn some candy at death location
      for (let i = 0; i < 3; i++) {
        this.resourceManager.spawnResource(this.gridX, this.gridY, ResourceType.Berry);
      }
    }

    EventBus.emit(GameEvents.PINATA_DIED, this, attacker);
    console.log(`${this.nickname} was caught by ${attacker.nickname}!`);

    // Fade out and destroy after a delay
    this.scene.time.delayedCall(3000, () => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 1000,
        onComplete: () => this.destroy(),
      });
    });
  }

  private startWandering(): void {
    if (!this.pathfinder) return;

    // Pick a random nearby destination
    const range = 5;
    const targetX = this.gridX + Math.floor(Math.random() * range * 2) - range;
    const targetY = this.gridY + Math.floor(Math.random() * range * 2) - range;

    this.moveToGrid(targetX, targetY);
    this.behavior = BehaviorState.Wandering;
  }

  moveToGrid(gridX: number, gridY: number): boolean {
    if (!this.pathfinder) return false;

    const path = this.pathfinder.findPath(
      { x: this.gridX, y: this.gridY },
      { x: gridX, y: gridY }
    );

    if (path && path.length > 1) {
      this.currentPath = path;
      this.pathIndex = 1; // Skip starting position
      return true;
    }

    return false;
  }

  private updateMovement(delta: number): void {
    if (this.pathIndex >= this.currentPath.length) {
      // Reached destination - what were we seeking?
      this.onReachedDestination();
      return;
    }

    const target = this.currentPath[this.pathIndex];
    const targetScreen = gridToScreen(target.x, target.y);

    // Move towards target
    const dx = targetScreen.x - this.x;
    const dy = targetScreen.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const speed = this.speciesData.baseSpeed * (this.mood === MoodState.Happy ? 1.2 : 1);
    const moveDistance = speed * (delta / 1000);

    if (distance <= moveDistance) {
      // Reached this waypoint
      this.x = targetScreen.x;
      this.y = targetScreen.y;
      this.gridX = target.x;
      this.gridY = target.y;
      this.pathIndex++;
      this.updateDepth();
    } else {
      // Move towards waypoint
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;

      // Update grid position (approximate)
      const approxGrid = screenToGridRounded(this.x, this.y);
      if (approxGrid.x !== this.gridX || approxGrid.y !== this.gridY) {
        this.gridX = approxGrid.x;
        this.gridY = approxGrid.y;
        this.updateDepth();
      }
    }
  }

  private onReachedDestination(): void {
    this.currentPath = [];
    this.pathIndex = 0;

    switch (this.behavior) {
      case BehaviorState.SeekingFood:
        // Start eating
        this.behavior = BehaviorState.Eating;
        this.activityTimer = 0;
        break;

      case BehaviorState.SeekingSleep:
        // Start sleeping
        this.behavior = BehaviorState.Sleeping;
        this.activityTimer = 0;
        break;

      case BehaviorState.SeekingFun:
        // Start playing
        this.behavior = BehaviorState.Playing;
        this.activityTimer = 0;
        break;

      case BehaviorState.SeekingSocial:
        // Start socializing
        this.behavior = BehaviorState.Socializing;
        this.activityTimer = 0;
        break;

      case BehaviorState.SeekingResource:
        // Start picking up resource
        this.behavior = BehaviorState.PickingUpResource;
        this.activityTimer = 0;
        break;

      case BehaviorState.CarryingToStockpile:
        // Start dropping resource
        this.behavior = BehaviorState.DroppingResource;
        this.activityTimer = 0;
        break;

      case BehaviorState.GoingToWork:
        // Arrived at work task location - start working
        if (this.currentWorkTask) {
          this.activityTimer = 0;
          if (this.currentWorkTask.type === 'farm') {
            this.behavior = BehaviorState.Farming;
          } else if (this.currentWorkTask.type === 'build') {
            this.behavior = BehaviorState.Building;
          } else if (this.currentWorkTask.type === 'gather') {
            // Gathering uses existing behavior
            const taskData = this.currentWorkTask.data as { resourceId: number };
            const resource = this.resourceManager?.findResourceById(taskData.resourceId);
            if (resource && resource.isAvailable()) {
              this.targetResource = resource;
              this.behavior = BehaviorState.PickingUpResource;
            } else {
              this.finishWorkTask();
            }
          } else {
            this.finishWorkTask();
          }
        } else {
          this.behavior = BehaviorState.Idle;
          this.idleTimer = 0;
        }
        break;

      case BehaviorState.Wandering:
      case BehaviorState.Moving:
      default:
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        break;
    }
  }

  private updateDepth(): void {
    this.setDepth(getDepth(this.gridX, this.gridY, 1));
  }

  private startIdleAnimation(): void {
    // Gentle bobbing animation
    this.bobTween = this.scene.tweens.add({
      targets: this.sprite,
      y: -4,
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateVisuals(): void {
    // Tint based on mood
    switch (this.mood) {
      case MoodState.Happy:
        this.sprite.setTint(0xffffff);
        break;
      case MoodState.Content:
        this.sprite.setTint(0xffffff);
        break;
      case MoodState.Stressed:
        this.sprite.setTint(0xffcccc);
        break;
      case MoodState.Breaking:
        // Pulsing red tint
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
        this.sprite.setTint(Phaser.Display.Color.GetColor(255, 128 + pulse * 127, 128 + pulse * 127));
        break;
    }
  }

  private updateStatusIcon(): void {
    // Show icon based on current behavior
    let icon = '';

    switch (this.behavior) {
      case BehaviorState.Eating:
      case BehaviorState.SeekingFood:
        icon = '🍎';
        break;
      case BehaviorState.Sleeping:
        icon = '💤';
        break;
      case BehaviorState.SeekingSleep:
        icon = '😴';
        break;
      case BehaviorState.Playing:
      case BehaviorState.SeekingFun:
        icon = '🎉';
        break;
      case BehaviorState.SeekingResource:
      case BehaviorState.PickingUpResource:
        icon = '📦';
        break;
      case BehaviorState.CarryingToStockpile:
      case BehaviorState.DroppingResource:
        icon = '📦➡️';
        break;
      case BehaviorState.Working:
        icon = '⚒️';
        break;
      case BehaviorState.Socializing:
      case BehaviorState.SeekingSocial:
        icon = '💬';
        break;
      case BehaviorState.MentalBreak:
        icon = '😢';
        break;
      case BehaviorState.Hunting:
      case BehaviorState.Chasing:
        icon = '🦊';
        break;
      case BehaviorState.Attacking:
        icon = '⚔️';
        break;
      case BehaviorState.Fleeing:
        icon = '😱';
        break;
      case BehaviorState.Fighting:
        icon = '🛡️';
        break;
      case BehaviorState.Dead:
        icon = '💀';
        break;
      case BehaviorState.GoingToWork:
        icon = '🚶';
        break;
      case BehaviorState.Farming:
        icon = '🌾';
        break;
      case BehaviorState.Building:
        icon = '🔨';
        break;
      default:
        // Show warning icon if a need is critical
        if (this.needs.hunger < 20) icon = '🍎❗';
        else if (this.needs.rest < 20) icon = '😴❗';
        else if (this.needs.fun < 20) icon = '😐';
        else if (this.needs.social < 20) icon = '😔';
        break;
    }

    this.statusIcon.setText(icon);
  }

  private onClicked(): void {
    EventBus.emit(GameEvents.PINATA_SELECTED, this);
  }

  select(): void {
    this.selectionRing.setVisible(true);
    this.nameText.setVisible(true);
    this.traitIcons.setVisible(true);

    // Pulse animation on selection ring
    this.scene.tweens.add({
      targets: this.selectionRing,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  deselect(): void {
    this.selectionRing.setVisible(false);
    this.nameText.setVisible(false);
    this.traitIcons.setVisible(false);
    this.scene.tweens.killTweensOf(this.selectionRing);
    this.selectionRing.setScale(1);
  }

  // Getters for UI display
  getNeeds(): PinataNeeds {
    return { ...this.needs };
  }

  getMood(): MoodState {
    return this.mood;
  }

  getBehavior(): BehaviorState {
    return this.behavior;
  }

  getJob(): JobType {
    return this.job;
  }

  getGridPosition(): GridPosition {
    return { x: this.gridX, y: this.gridY };
  }

  getProductionProgress(): number | null {
    if (!this.speciesData.produces || !this.speciesData.productionTime) return null;
    return Math.min(100, (this.productionTimer / this.speciesData.productionTime) * 100);
  }

  canProduce(): boolean {
    return this.speciesData.produces !== undefined;
  }

  // Actions
  feed(amount: number): void {
    this.needs.hunger = Math.min(NEED_MAX, this.needs.hunger + amount);
  }

  restoreRest(amount: number): void {
    this.needs.rest = Math.min(NEED_MAX, this.needs.rest + amount);
  }

  play(amount: number): void {
    this.needs.fun = Math.min(NEED_MAX, this.needs.fun + amount);
  }

  socialize(): void {
    this.behavior = BehaviorState.Socializing;
  }

  // Player command methods
  commandMoveTo(gridX: number, gridY: number): boolean {
    if (this.moveToGrid(gridX, gridY)) {
      this.behavior = BehaviorState.Moving;
      this.job = JobType.Idle; // Clear job when given direct orders
      console.log(`${this.nickname} moving to (${gridX}, ${gridY})`);
      return true;
    }
    return false;
  }

  commandPickUp(resource: Resource): boolean {
    if (!resource.isAvailable()) return false;

    const pos = resource.getGridPosition();
    if (this.moveToGrid(pos.x, pos.y)) {
      this.targetResource = resource;
      this.behavior = BehaviorState.SeekingResource;
      this.job = JobType.Gatherer;
      console.log(`${this.nickname} going to pick up resource`);
      return true;
    }
    return false;
  }

  commandGuard(gridX: number, gridY: number): void {
    this.job = JobType.Guard;
    if (this.moveToGrid(gridX, gridY)) {
      this.behavior = BehaviorState.Moving;
    }
    console.log(`${this.nickname} guarding area around (${gridX}, ${gridY})`);
  }

  commandStay(): void {
    this.currentPath = [];
    this.pathIndex = 0;
    this.behavior = BehaviorState.Idle;
    this.idleTimer = 0;
    console.log(`${this.nickname} staying put`);
  }

  destroy(): void {
    if (this.bobTween) {
      this.bobTween.destroy();
    }
    super.destroy();
  }
}
