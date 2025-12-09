import Phaser from 'phaser';
import { Pinata, MoodState } from '../entities/Pinata';
import { EventBus, GameEvents } from '../utils/EventBus';
import { RelationshipSystem } from './RelationshipSystem';
import { Pathfinder } from '../world/Pathfinding';
import { ZoneManager } from '../world/Zone';
import { ResourceManager } from '../entities/Resource';
import { TimeSystem } from './TimeSystem';

export interface RomanceCandidate {
  pinataA: Pinata;
  pinataB: Pinata;
  courtshipProgress: number;
}

// Requirements for romance
const ROMANCE_AFFECTION_THRESHOLD = 60; // Must be friends or better
const ROMANCE_NEED_THRESHOLD = 50; // All needs above this
const ROMANCE_MOOD_REQUIREMENT = [MoodState.Happy, MoodState.Content];
const COURTSHIP_DURATION = 5000; // 5 seconds of dance

/**
 * Manages romance and breeding between piñatas
 */
export class RomanceSystem {
  private scene: Phaser.Scene;
  private pinatas: Pinata[];
  private relationshipSystem: RelationshipSystem;
  private pathfinder: Pathfinder;
  private zoneManager: ZoneManager;
  private resourceManager: ResourceManager;
  private timeSystem: TimeSystem;

  private activeCourtships: Map<string, RomanceCandidate> = new Map();
  private romanceCooldowns: Map<number, number> = new Map(); // Pinata ID -> cooldown time
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 2000; // Check every 2 seconds
  private readonly ROMANCE_COOLDOWN = 120000; // 2 minute cooldown after having a baby

  constructor(
    scene: Phaser.Scene,
    pinatas: Pinata[],
    relationshipSystem: RelationshipSystem,
    pathfinder: Pathfinder,
    zoneManager: ZoneManager,
    resourceManager: ResourceManager,
    timeSystem: TimeSystem
  ) {
    this.scene = scene;
    this.pinatas = pinatas;
    this.relationshipSystem = relationshipSystem;
    this.pathfinder = pathfinder;
    this.zoneManager = zoneManager;
    this.resourceManager = resourceManager;
    this.timeSystem = timeSystem;
  }

  private getCourtshipKey(idA: number, idB: number): string {
    const [min, max] = idA < idB ? [idA, idB] : [idB, idA];
    return `${min}-${max}`;
  }

  update(delta: number): void {
    // Update cooldowns
    for (const [id, cooldown] of this.romanceCooldowns) {
      const newCooldown = cooldown - delta;
      if (newCooldown <= 0) {
        this.romanceCooldowns.delete(id);
      } else {
        this.romanceCooldowns.set(id, newCooldown);
      }
    }

    // Update active courtships
    for (const [key, courtship] of this.activeCourtships) {
      courtship.courtshipProgress += delta;

      // Check if courtship is complete
      if (courtship.courtshipProgress >= COURTSHIP_DURATION) {
        this.completeCourtship(courtship);
        this.activeCourtships.delete(key);
      }
    }

    // Periodically check for new romance opportunities
    this.updateTimer += delta;
    if (this.updateTimer < this.UPDATE_INTERVAL) return;
    this.updateTimer = 0;

    this.checkForRomanceOpportunities();
  }

  private checkForRomanceOpportunities(): void {
    // Look for pairs that could start courting
    for (let i = 0; i < this.pinatas.length; i++) {
      const pinataA = this.pinatas[i];
      if (!this.canRomance(pinataA)) continue;

      for (let j = i + 1; j < this.pinatas.length; j++) {
        const pinataB = this.pinatas[j];
        if (!this.canRomance(pinataB)) continue;

        // Must be same species
        if (pinataA.species !== pinataB.species) continue;

        // Check if already courting
        const key = this.getCourtshipKey(pinataA.id, pinataB.id);
        if (this.activeCourtships.has(key)) continue;

        // Check affection level
        const affection = this.relationshipSystem.getAffection(pinataA.id, pinataB.id);
        if (affection < ROMANCE_AFFECTION_THRESHOLD) continue;

        // Check proximity
        const posA = pinataA.getGridPosition();
        const posB = pinataB.getGridPosition();
        const dist = Math.sqrt(
          Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2)
        );

        if (dist <= 3) {
          // Start courtship!
          this.startCourtship(pinataA, pinataB);
        }
      }
    }
  }

  private canRomance(pinata: Pinata): boolean {
    // Must be alive
    if (!pinata.getIsAlive()) return false;

    // Check cooldown
    if (this.romanceCooldowns.has(pinata.id)) return false;

    // Check mood
    const mood = pinata.getMood();
    if (!ROMANCE_MOOD_REQUIREMENT.includes(mood)) return false;

    // Check needs - all must be above threshold
    const needs = pinata.getNeeds();
    if (needs.hunger < ROMANCE_NEED_THRESHOLD) return false;
    if (needs.rest < ROMANCE_NEED_THRESHOLD) return false;
    if (needs.fun < ROMANCE_NEED_THRESHOLD) return false;
    if (needs.social < ROMANCE_NEED_THRESHOLD) return false;

    // Not a predator (Pretztails don't romance in this version)
    if (pinata.isPredator()) return false;

    return true;
  }

  private startCourtship(pinataA: Pinata, pinataB: Pinata): void {
    const key = this.getCourtshipKey(pinataA.id, pinataB.id);

    const courtship: RomanceCandidate = {
      pinataA,
      pinataB,
      courtshipProgress: 0,
    };

    this.activeCourtships.set(key, courtship);

    console.log(`${pinataA.nickname} and ${pinataB.nickname} are dancing together!`);
    EventBus.emit(GameEvents.PINATA_ROMANCE_STARTED, pinataA, pinataB);

    // Create heart particles
    this.createHeartEffect(pinataA);
    this.createHeartEffect(pinataB);
  }

  private completeCourtship(courtship: RomanceCandidate): void {
    const { pinataA, pinataB } = courtship;

    // Both parents go on cooldown
    this.romanceCooldowns.set(pinataA.id, this.ROMANCE_COOLDOWN);
    this.romanceCooldowns.set(pinataB.id, this.ROMANCE_COOLDOWN);

    // Create baby piñata!
    const posA = pinataA.getGridPosition();
    const posB = pinataB.getGridPosition();
    const babyX = Math.floor((posA.x + posB.x) / 2);
    const babyY = Math.floor((posA.y + posB.y) / 2);

    // Create new piñata of same species
    const baby = new Pinata(
      this.scene,
      babyX,
      babyY,
      pinataA.species,
      this.pathfinder
    );

    // Connect to systems
    baby.setZoneManager(this.zoneManager);
    baby.setResourceManager(this.resourceManager);
    baby.setTimeSystem(this.timeSystem);
    baby.setPinataList(this.pinatas);

    // Add to pinata list
    this.pinatas.push(baby);

    // Baby starts with relationship to parents
    this.relationshipSystem.addAffection(baby.id, pinataA.id, 50);
    this.relationshipSystem.addAffection(baby.id, pinataB.id, 50);

    console.log(`${pinataA.nickname} and ${pinataB.nickname} had a baby: ${baby.nickname}!`);
    EventBus.emit(GameEvents.PINATA_BORN, baby, pinataA, pinataB);

    // Create celebration effect
    this.createBirthEffect(baby);
  }

  private createHeartEffect(pinata: Pinata): void {
    const text = this.scene.add.text(pinata.x, pinata.y - 40, '💕', {
      fontSize: '24px',
    });
    text.setOrigin(0.5);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  private createBirthEffect(baby: Pinata): void {
    const text = this.scene.add.text(baby.x, baby.y - 40, '🎉👶🎉', {
      fontSize: '20px',
    });
    text.setOrigin(0.5);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 40,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 2000,
      onComplete: () => text.destroy(),
    });
  }

  getActiveCourtships(): RomanceCandidate[] {
    return Array.from(this.activeCourtships.values());
  }

  isOnCooldown(pinataId: number): boolean {
    return this.romanceCooldowns.has(pinataId);
  }

  getCooldownRemaining(pinataId: number): number {
    return this.romanceCooldowns.get(pinataId) ?? 0;
  }
}
