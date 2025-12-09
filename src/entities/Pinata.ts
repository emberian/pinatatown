import Phaser from 'phaser';
import { PinataSpecies, SPECIES_DATA, PinataSpeciesData } from './PinataTypes';
import { GridPosition, gridToScreen, getDepth, screenToGridRounded } from '../world/IsoUtils';
import { Pathfinder } from '../world/Pathfinding';
import { NEED_MAX, NEED_DECAY_RATE, MOOD_HAPPY_THRESHOLD, MOOD_STRESSED_THRESHOLD, MOOD_BREAKING_THRESHOLD } from '../utils/Constants';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ZoneManager, ZoneType } from '../world/Zone';
import { ResourceManager, RESOURCE_CONFIGS } from './Resource';

export enum MoodState {
  Happy = 'happy',
  Content = 'content',
  Stressed = 'stressed',
  Breaking = 'breaking',
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
  Working = 'working',
  Socializing = 'socializing',
  MentalBreak = 'mentalBreak',
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

  // Position in grid coordinates
  private gridX: number;
  private gridY: number;

  // Visual components
  private sprite: Phaser.GameObjects.Image;
  private selectionRing: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private statusIcon: Phaser.GameObjects.Text;

  // State
  private needs: PinataNeeds;
  private mood: MoodState = MoodState.Content;
  private behavior: BehaviorState = BehaviorState.Idle;

  // Movement
  private pathfinder: Pathfinder | null = null;
  private currentPath: GridPosition[] = [];
  private pathIndex = 0;

  // External references (set by GameScene)
  private zoneManager: ZoneManager | null = null;
  private resourceManager: ResourceManager | null = null;

  // Activity state
  private activityTimer = 0;
  private idleTimer = 0;
  private targetZoneTile: GridPosition | null = null;

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

  update(delta: number): void {
    // Decay needs over time
    this.updateNeeds(delta);

    // Update mood based on needs
    this.updateMood();

    // Execute behavior (includes need-seeking AI)
    this.updateBehavior(delta);

    // Update visuals
    this.updateVisuals();
    this.updateStatusIcon();
  }

  private updateNeeds(delta: number): void {
    const decayRate = NEED_DECAY_RATE * (delta / 1000);

    // Different activities affect need decay/gain
    let hungerDecay = decayRate;
    let restDecay = decayRate;
    let funDecay = decayRate * 0.8;
    let socialDecay = decayRate * 0.5;

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

      case BehaviorState.MentalBreak:
        this.handleMentalBreak(delta);
        break;

      default:
        break;
    }
  }

  private handleIdleBehavior(delta: number): void {
    this.idleTimer += delta;

    // Check if any needs require attention
    if (this.shouldSeekNeed()) {
      return;
    }

    // After being idle for a bit, start wandering
    if (this.idleTimer > 2000 + Math.random() * 3000) {
      this.startWandering();
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
        if (stockpile) {
          this.targetZoneTile = stockpile.tile;
          if (this.moveToGrid(stockpile.tile.x, stockpile.tile.y)) {
            this.behavior = BehaviorState.SeekingFood;
            return true;
          }
        }
      }
    }

    // Check rest
    if (this.needs.rest < NEED_SEEK_THRESHOLD && this.zoneManager) {
      const sleepZone = this.zoneManager.findNearestZone(
        { x: this.gridX, y: this.gridY },
        ZoneType.Sleep
      );
      if (sleepZone) {
        this.targetZoneTile = sleepZone.tile;
        if (this.moveToGrid(sleepZone.tile.x, sleepZone.tile.y)) {
          this.behavior = BehaviorState.SeekingSleep;
          return true;
        }
      }
    }

    // Check fun
    if (this.needs.fun < NEED_SEEK_THRESHOLD && this.zoneManager) {
      const funZone = this.zoneManager.findNearestZone(
        { x: this.gridX, y: this.gridY },
        ZoneType.Recreation
      );
      if (funZone) {
        this.targetZoneTile = funZone.tile;
        if (this.moveToGrid(funZone.tile.x, funZone.tile.y)) {
          this.behavior = BehaviorState.SeekingFun;
          return true;
        }
      }
    }

    return false;
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

      // Stop playing if fun is satisfied
      if (this.needs.fun >= NEED_SATISFIED_THRESHOLD) {
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
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

      case BehaviorState.Wandering:
      case BehaviorState.Moving:
      default:
        this.behavior = BehaviorState.Idle;
        this.idleTimer = 0;
        break;
    }

    this.targetZoneTile = null;
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
      case BehaviorState.Working:
        icon = '⚒️';
        break;
      case BehaviorState.Socializing:
        icon = '💬';
        break;
      case BehaviorState.MentalBreak:
        icon = '😢';
        break;
      default:
        // Show warning icon if a need is critical
        if (this.needs.hunger < 20) icon = '🍎❗';
        else if (this.needs.rest < 20) icon = '😴❗';
        else if (this.needs.fun < 20) icon = '😐';
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

  getGridPosition(): GridPosition {
    return { x: this.gridX, y: this.gridY };
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

  destroy(): void {
    if (this.bobTween) {
      this.bobTween.destroy();
    }
    super.destroy();
  }
}
