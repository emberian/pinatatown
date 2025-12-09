import { Pinata } from '../entities/Pinata';
import { EventBus, GameEvents } from '../utils/EventBus';

export enum RelationshipType {
  Stranger = 'stranger',
  Acquaintance = 'acquaintance',
  Friend = 'friend',
  BestFriend = 'bestFriend',
  RomanticPartner = 'romanticPartner',
  Rival = 'rival',
}

export interface Relationship {
  pinataA: number; // Pinata ID
  pinataB: number; // Pinata ID
  affection: number; // -100 to 100
  lastInteraction: number; // timestamp
  isRomantic: boolean; // Have they mated?
}

// Affection thresholds
const RIVAL_THRESHOLD = -30;
const ACQUAINTANCE_THRESHOLD = 20;
const FRIEND_THRESHOLD = 50;
const BEST_FRIEND_THRESHOLD = 80;

// Affection changes
const SOCIALIZE_GAIN = 5;
const PROXIMITY_GAIN = 0.5; // Per second nearby
const FIGHT_LOSS = 20;
const HELP_GAIN = 10;
const JEALOUSY_LOSS = 25; // How much jealousy hurts a relationship
const DECAY_RATE = 0.1; // Per minute toward 0

/**
 * Manages relationships between piñatas
 */
export class RelationshipSystem {
  private relationships: Map<string, Relationship> = new Map();
  private pinatas: Pinata[] = [];
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 1000; // Check every second

  constructor(pinatas: Pinata[]) {
    this.pinatas = pinatas;
    this.setupEvents();
  }

  private setupEvents(): void {
    // Listen for social interactions
    EventBus.on(GameEvents.PINATA_SOCIALIZED, (...args: unknown[]) => {
      const [pinataA, pinataB] = args as [Pinata, Pinata];
      this.addAffection(pinataA.id, pinataB.id, SOCIALIZE_GAIN);
    });

    // Listen for helping (e.g., sharing food)
    EventBus.on(GameEvents.PINATA_HELPED, (...args: unknown[]) => {
      const [helper, helped] = args as [Pinata, Pinata];
      this.addAffection(helper.id, helped.id, HELP_GAIN);
    });

    // Listen for combat (creates rivalry between attacker and defender)
    EventBus.on(GameEvents.PINATA_DEFENDED, (...args: unknown[]) => {
      const [defender, attacker] = args as [Pinata, Pinata];
      this.addAffection(defender.id, attacker.id, -FIGHT_LOSS);
    });
  }

  private getKey(idA: number, idB: number): string {
    // Always use smaller ID first for consistent key
    const [min, max] = idA < idB ? [idA, idB] : [idB, idA];
    return `${min}-${max}`;
  }

  private getOrCreateRelationship(idA: number, idB: number): Relationship {
    const key = this.getKey(idA, idB);
    let rel = this.relationships.get(key);

    if (!rel) {
      rel = {
        pinataA: Math.min(idA, idB),
        pinataB: Math.max(idA, idB),
        affection: 0,
        lastInteraction: Date.now(),
        isRomantic: false,
      };
      this.relationships.set(key, rel);
    }

    return rel;
  }

  addAffection(idA: number, idB: number, amount: number): void {
    if (idA === idB) return;

    const rel = this.getOrCreateRelationship(idA, idB);
    const oldType = this.getRelationshipType(rel.affection);

    rel.affection = Math.max(-100, Math.min(100, rel.affection + amount));
    rel.lastInteraction = Date.now();

    const newType = this.getRelationshipType(rel.affection);

    // Emit event if relationship type changed
    if (oldType !== newType) {
      EventBus.emit(GameEvents.RELATIONSHIP_CHANGED, idA, idB, newType);

      const pinataA = this.pinatas.find(p => p.id === idA);
      const pinataB = this.pinatas.find(p => p.id === idB);

      if (pinataA && pinataB) {
        if (newType === RelationshipType.Friend) {
          console.log(`${pinataA.nickname} and ${pinataB.nickname} became friends!`);
        } else if (newType === RelationshipType.BestFriend) {
          console.log(`${pinataA.nickname} and ${pinataB.nickname} are best friends!`);
        } else if (newType === RelationshipType.Rival) {
          console.log(`${pinataA.nickname} and ${pinataB.nickname} became rivals!`);
        }
      }
    }
  }

  getRelationshipType(affection: number): RelationshipType {
    if (affection <= RIVAL_THRESHOLD) return RelationshipType.Rival;
    if (affection < ACQUAINTANCE_THRESHOLD) return RelationshipType.Stranger;
    if (affection < FRIEND_THRESHOLD) return RelationshipType.Acquaintance;
    if (affection < BEST_FRIEND_THRESHOLD) return RelationshipType.Friend;
    return RelationshipType.BestFriend;
  }

  getRelationship(idA: number, idB: number): RelationshipType {
    const key = this.getKey(idA, idB);
    const rel = this.relationships.get(key);
    if (!rel) return RelationshipType.Stranger;

    // Romantic partners are a special relationship type
    if (rel.isRomantic && rel.affection >= FRIEND_THRESHOLD) {
      return RelationshipType.RomanticPartner;
    }

    return this.getRelationshipType(rel.affection);
  }

  getAffection(idA: number, idB: number): number {
    const key = this.getKey(idA, idB);
    const rel = this.relationships.get(key);
    return rel?.affection ?? 0;
  }

  getFriends(pinataId: number): Pinata[] {
    const friends: Pinata[] = [];

    for (const [, rel] of this.relationships) {
      if (rel.pinataA !== pinataId && rel.pinataB !== pinataId) continue;

      const type = this.getRelationshipType(rel.affection);
      if (type === RelationshipType.Friend || type === RelationshipType.BestFriend) {
        const otherId = rel.pinataA === pinataId ? rel.pinataB : rel.pinataA;
        const other = this.pinatas.find(p => p.id === otherId);
        if (other && other.getIsAlive()) {
          friends.push(other);
        }
      }
    }

    return friends;
  }

  getRivals(pinataId: number): Pinata[] {
    const rivals: Pinata[] = [];

    for (const [, rel] of this.relationships) {
      if (rel.pinataA !== pinataId && rel.pinataB !== pinataId) continue;

      const type = this.getRelationshipType(rel.affection);
      if (type === RelationshipType.Rival) {
        const otherId = rel.pinataA === pinataId ? rel.pinataB : rel.pinataA;
        const other = this.pinatas.find(p => p.id === otherId);
        if (other && other.getIsAlive()) {
          rivals.push(other);
        }
      }
    }

    return rivals;
  }

  update(delta: number): void {
    this.updateTimer += delta;

    if (this.updateTimer < this.UPDATE_INTERVAL) return;
    this.updateTimer = 0;

    // Check for piñatas that are close to each other (proximity bonding)
    const proximityRange = 3; // tiles

    for (let i = 0; i < this.pinatas.length; i++) {
      const pinataA = this.pinatas[i];
      if (!pinataA.getIsAlive()) continue;

      const posA = pinataA.getGridPosition();

      for (let j = i + 1; j < this.pinatas.length; j++) {
        const pinataB = this.pinatas[j];
        if (!pinataB.getIsAlive()) continue;

        const posB = pinataB.getGridPosition();
        const dist = Math.sqrt(
          Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2)
        );

        if (dist <= proximityRange) {
          // Being near each other builds affection slowly
          this.addAffection(pinataA.id, pinataB.id, PROXIMITY_GAIN);
        }
      }
    }

    // Decay relationships toward neutral over time
    const now = Date.now();
    for (const [, rel] of this.relationships) {
      const minutesSinceInteraction = (now - rel.lastInteraction) / 60000;
      if (minutesSinceInteraction > 5) { // Start decaying after 5 minutes
        const decay = DECAY_RATE * (minutesSinceInteraction - 5);
        if (rel.affection > 0) {
          rel.affection = Math.max(0, rel.affection - decay);
        } else if (rel.affection < 0) {
          rel.affection = Math.min(0, rel.affection + decay);
        }
      }
    }
  }

  /**
   * Mark two piñatas as romantic partners after successful mating
   */
  setRomanticPartners(idA: number, idB: number): void {
    const rel = this.getOrCreateRelationship(idA, idB);
    rel.isRomantic = true;
    rel.affection = Math.max(rel.affection, BEST_FRIEND_THRESHOLD); // Ensure high affection
    rel.lastInteraction = Date.now();

    const pinataA = this.pinatas.find(p => p.id === idA);
    const pinataB = this.pinatas.find(p => p.id === idB);
    if (pinataA && pinataB) {
      console.log(`${pinataA.nickname} and ${pinataB.nickname} are now romantic partners!`);
      EventBus.emit('relationship:romance', pinataA, pinataB);
    }
  }

  /**
   * Get the romantic partner of a piñata (if any)
   */
  getRomanticPartner(pinataId: number): Pinata | null {
    for (const [, rel] of this.relationships) {
      if (rel.pinataA !== pinataId && rel.pinataB !== pinataId) continue;
      if (!rel.isRomantic) continue;
      if (rel.affection < FRIEND_THRESHOLD) continue; // Relationship degraded

      const otherId = rel.pinataA === pinataId ? rel.pinataB : rel.pinataA;
      const other = this.pinatas.find(p => p.id === otherId);
      if (other?.getIsAlive()) {
        return other;
      }
    }
    return null;
  }

  /**
   * Check if piñata has a romantic partner
   */
  hasRomanticPartner(pinataId: number): boolean {
    return this.getRomanticPartner(pinataId) !== null;
  }

  /**
   * Handle jealousy when a third party tries to romance someone's partner
   * Returns the jealous piñata if jealousy was triggered
   */
  triggerJealousy(interloper: Pinata, target: Pinata): Pinata | null {
    const existingPartner = this.getRomanticPartner(target.id);
    if (!existingPartner || existingPartner.id === interloper.id) {
      return null; // No jealousy if no partner or same partner
    }

    // The existing partner becomes jealous!
    // Lose affection toward the interloper
    this.addAffection(existingPartner.id, interloper.id, -JEALOUSY_LOSS);

    // Also slightly damage relationship with partner (trust issues)
    this.addAffection(existingPartner.id, target.id, -5);

    console.log(`${existingPartner.nickname} is JEALOUS of ${interloper.nickname}!`);
    EventBus.emit('relationship:jealousy', existingPartner, interloper, target);

    return existingPartner;
  }

  // Get social mood modifier for a piñata
  getSocialMoodModifier(pinataId: number): number {
    let modifier = 0;
    const friends = this.getFriends(pinataId);
    const rivals = this.getRivals(pinataId);

    // Friends nearby boost mood
    for (const friend of friends) {
      const pos = this.pinatas.find(p => p.id === pinataId)?.getGridPosition();
      const friendPos = friend.getGridPosition();
      if (!pos) continue;

      const dist = Math.sqrt(
        Math.pow(pos.x - friendPos.x, 2) + Math.pow(pos.y - friendPos.y, 2)
      );

      if (dist <= 5) {
        modifier += 5; // +5 mood per nearby friend
      }
    }

    // Rivals nearby hurt mood
    for (const rival of rivals) {
      const pos = this.pinatas.find(p => p.id === pinataId)?.getGridPosition();
      const rivalPos = rival.getGridPosition();
      if (!pos) continue;

      const dist = Math.sqrt(
        Math.pow(pos.x - rivalPos.x, 2) + Math.pow(pos.y - rivalPos.y, 2)
      );

      if (dist <= 5) {
        modifier -= 10; // -10 mood per nearby rival
      }
    }

    return modifier;
  }
}
