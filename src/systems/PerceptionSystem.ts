import { EventBus, GameEvents } from '../utils/EventBus';
import { Pinata } from '../entities/Pinata';
import { Resource } from '../entities/Resource';
import { GridPosition } from '../world/IsoUtils';
import { GoalType, GoalSource, createGoal } from './GoalSystem';
import { Trait } from './TraitSystem';
import { RelationshipSystem, RelationshipType } from './RelationshipSystem';

/**
 * Observations are things a piñata has noticed.
 * They can trigger goal creation based on the piñata's personality.
 */
export enum ObservationType {
  // Nearby piñata states
  HungryNearby = 'hungryNearby',
  TiredNearby = 'tiredNearby',
  StressedNearby = 'stressedNearby',
  DyingNearby = 'dyingNearby',
  DeathNearby = 'deathNearby',

  // Threats
  PredatorSpotted = 'predatorSpotted',
  FightNearby = 'fightNearby',

  // Resources
  ResourceSpawned = 'resourceSpawned',
  FoodAvailable = 'foodAvailable',

  // Social
  FriendNearby = 'friendNearby',
  RivalNearby = 'rivalNearby',
  RomanceNearby = 'romanceNearby',

  // World events
  StormStarted = 'stormStarted',
  SunnyDay = 'sunnyDay',
  NoiseHeard = 'noiseHeard',

  // Relationship drama
  JealousyTriggered = 'jealousyTriggered',
}

export interface Observation {
  type: ObservationType;
  position: GridPosition;
  sourceEntityId?: number;
  targetEntityId?: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Perception ranges - how far a piñata can "see" different things
const PERCEPTION_RANGES: Partial<Record<ObservationType, number>> = {
  [ObservationType.HungryNearby]: 8,
  [ObservationType.TiredNearby]: 5,
  [ObservationType.StressedNearby]: 6,
  [ObservationType.DyingNearby]: 12,
  [ObservationType.DeathNearby]: 15,
  [ObservationType.PredatorSpotted]: 10,
  [ObservationType.FightNearby]: 12,
  [ObservationType.ResourceSpawned]: 10,
  [ObservationType.FoodAvailable]: 8,
  [ObservationType.FriendNearby]: 12,
  [ObservationType.RivalNearby]: 8,
  [ObservationType.RomanceNearby]: 10,
  [ObservationType.NoiseHeard]: 15,
};

// How observations map to potential goals
interface ObservationGoalMapping {
  goalType: GoalType;
  source: GoalSource;
  priorityBoost?: number;
  requiredTraits?: Trait[];      // Must have one of these
  blockedByTraits?: Trait[];     // Won't create if has any of these
  requiresRelationship?: RelationshipType[]; // Must have this relationship to target
  expiresIn?: number;            // Goal expires after this many ms
}

const OBSERVATION_TO_GOALS: Partial<Record<ObservationType, ObservationGoalMapping[]>> = {
  [ObservationType.HungryNearby]: [
    {
      goalType: GoalType.HelpFriend,
      source: GoalSource.Perception,
      priorityBoost: 20,
      requiredTraits: [Trait.Kind],
      blockedByTraits: [Trait.Greedy],
    },
  ],
  [ObservationType.StressedNearby]: [
    {
      goalType: GoalType.SeekCompanion, // Go comfort them
      source: GoalSource.Relationship,
      priorityBoost: 15,
      requiresRelationship: [RelationshipType.Friend, RelationshipType.BestFriend],
    },
  ],
  [ObservationType.DeathNearby]: [
    {
      goalType: GoalType.MournDeath,
      source: GoalSource.Perception,
      priorityBoost: 50, // Higher priority - grief is significant
      requiresRelationship: [RelationshipType.BestFriend],
      expiresIn: 60000, // Best friends mourn longer
    },
    {
      goalType: GoalType.MournDeath,
      source: GoalSource.Perception,
      priorityBoost: 30,
      requiresRelationship: [RelationshipType.Friend],
      expiresIn: 30000,
    },
    {
      goalType: GoalType.MournDeath, // Kind piñatas mourn even strangers
      source: GoalSource.Perception,
      priorityBoost: 15,
      requiredTraits: [Trait.Kind],
      expiresIn: 15000,
    },
    {
      goalType: GoalType.FleeFromThreat, // Scared by death
      source: GoalSource.Perception,
      requiredTraits: [Trait.Cowardly],
      expiresIn: 10000,
    },
    {
      goalType: GoalType.MentalBreakHide, // Neurotic might break down
      source: GoalSource.Perception,
      requiredTraits: [Trait.Neurotic],
      requiresRelationship: [RelationshipType.BestFriend], // Only if close friend
      priorityBoost: 40,
    },
  ],
  [ObservationType.PredatorSpotted]: [
    {
      goalType: GoalType.FleeFromThreat,
      source: GoalSource.Perception,
      priorityBoost: 40,
    },
    {
      goalType: GoalType.DefendAlly,
      source: GoalSource.Perception,
      priorityBoost: 30,
      requiredTraits: [Trait.Brave, Trait.Aggressive],
    },
  ],
  [ObservationType.FightNearby]: [
    {
      goalType: GoalType.DefendAlly,
      source: GoalSource.Perception,
      priorityBoost: 25,
      requiredTraits: [Trait.Brave, Trait.Kind],
      blockedByTraits: [Trait.Cowardly, Trait.Pacifist],
    },
    {
      goalType: GoalType.FleeFromThreat,
      source: GoalSource.Perception,
      requiredTraits: [Trait.Cowardly],
    },
    {
      goalType: GoalType.InvestigateEvent,
      source: GoalSource.Perception,
      requiredTraits: [Trait.Curious],
      expiresIn: 15000,
    },
  ],
  [ObservationType.ResourceSpawned]: [
    {
      goalType: GoalType.GatherResource,
      source: GoalSource.Perception,
      priorityBoost: 10,
    },
    {
      goalType: GoalType.InvestigateEvent,
      source: GoalSource.Perception,
      requiredTraits: [Trait.Curious],
      expiresIn: 20000,
    },
  ],
  [ObservationType.FriendNearby]: [
    {
      goalType: GoalType.SeekCompanion,
      source: GoalSource.Relationship,
      priorityBoost: 15,
      requiresRelationship: [RelationshipType.Friend, RelationshipType.BestFriend],
    },
  ],
  [ObservationType.RivalNearby]: [
    {
      goalType: GoalType.AvoidRival,
      source: GoalSource.Relationship,
      priorityBoost: 20,
      blockedByTraits: [Trait.Aggressive],
    },
    {
      goalType: GoalType.MentalBreakTantrum, // Might pick a fight
      source: GoalSource.Relationship,
      requiredTraits: [Trait.Aggressive],
      priorityBoost: -60, // Only if already stressed
    },
  ],
  [ObservationType.NoiseHeard]: [
    {
      goalType: GoalType.InvestigateEvent,
      source: GoalSource.Perception,
      requiredTraits: [Trait.Curious],
      expiresIn: 15000,
    },
    {
      goalType: GoalType.FleeFromThreat,
      source: GoalSource.Perception,
      requiredTraits: [Trait.Cowardly],
      priorityBoost: -30, // Low priority unless confirmed threat
    },
  ],
};

/**
 * PerceptionSystem listens to world events and notifies nearby piñatas,
 * allowing them to create goals based on their personality.
 */
export class PerceptionSystem {
  private pinatas: Pinata[] = [];
  private relationshipSystem: RelationshipSystem | null = null;

  constructor() {
    this.setupEventListeners();
  }

  setPinatas(pinatas: Pinata[]): void {
    this.pinatas = pinatas;
  }

  setRelationshipSystem(relationshipSystem: RelationshipSystem): void {
    this.relationshipSystem = relationshipSystem;
  }

  private setupEventListeners(): void {
    // Piñata state events
    EventBus.on(GameEvents.PINATA_HUNGRY, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      this.broadcastObservation({
        type: ObservationType.HungryNearby,
        position: pinata.getGridPosition(),
        sourceEntityId: pinata.id,
        timestamp: Date.now(),
      });
    });

    EventBus.on(GameEvents.PINATA_TIRED, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      this.broadcastObservation({
        type: ObservationType.TiredNearby,
        position: pinata.getGridPosition(),
        sourceEntityId: pinata.id,
        timestamp: Date.now(),
      });
    });

    EventBus.on(GameEvents.PINATA_MOOD_CHANGED, (...args: unknown[]) => {
      const [pinata, mood] = args as [Pinata, string];
      if (mood === 'stressed' || mood === 'breaking') {
        this.broadcastObservation({
          type: ObservationType.StressedNearby,
          position: pinata.getGridPosition(),
          sourceEntityId: pinata.id,
          timestamp: Date.now(),
          data: { mood },
        });
      }
    });

    EventBus.on(GameEvents.PINATA_DIED, (...args: unknown[]) => {
      const [pinata, attacker] = args as [Pinata, Pinata | null];
      this.broadcastObservation({
        type: ObservationType.DeathNearby,
        position: pinata.getGridPosition(),
        sourceEntityId: pinata.id,
        targetEntityId: attacker?.id,
        timestamp: Date.now(),
        data: { wasAttack: !!attacker },
      });
    });

    // Combat events
    EventBus.on(GameEvents.PINATA_DEFENDED, (...args: unknown[]) => {
      const [defender, attacker] = args as [Pinata, Pinata];
      this.broadcastObservation({
        type: ObservationType.FightNearby,
        position: defender.getGridPosition(),
        sourceEntityId: defender.id,
        targetEntityId: attacker.id,
        timestamp: Date.now(),
      });
    });

    // Resource events
    EventBus.on(GameEvents.RESOURCE_SPAWNED, (...args: unknown[]) => {
      const [, resource] = args as [Pinata | null, Resource];
      this.broadcastObservation({
        type: ObservationType.ResourceSpawned,
        position: resource.getGridPosition(),
        timestamp: Date.now(),
        data: { resourceType: resource.resourceType },
      });
    });

    // Random events
    EventBus.on(GameEvents.RANDOM_EVENT_STARTED, (...args: unknown[]) => {
      const event = args[0] as { type: string };
      if (event.type === 'storm') {
        // Broadcast to all piñatas (global event)
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            this.notifyPinata(pinata, {
              type: ObservationType.StormStarted,
              position: pinata.getGridPosition(),
              timestamp: Date.now(),
            });
          }
        }
      }
    });

    // Colony-wide grief event from ColonySystem
    EventBus.on('colony:grief', (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      // The colony system sends this to each living pinata
      // to acknowledge colony-wide mourning
      const traits = pinata.getTraits();
      const traitSet = new Set(traits);

      // Social butterflies feel colony grief more acutely
      if (traitSet.has(Trait.SocialButterfly)) {
        const goal = createGoal(GoalType.MournDeath, GoalSource.Perception, {
          basePriority: 25,
          expiresAt: Date.now() + 20000,
          data: { colonyMourning: true },
        });
        pinata.addGoal(goal);
      }
    });

    // Jealousy event from RelationshipSystem
    EventBus.on('relationship:jealousy', (...args: unknown[]) => {
      const [jealousPinata, interloper, _partner] = args as [Pinata, Pinata, Pinata];

      // Jealous piñata gets an AvoidRival or aggressive goal
      const traits = jealousPinata.getTraits();
      const traitSet = new Set(traits);

      if (traitSet.has(Trait.Aggressive)) {
        // Aggressive piñatas confront the interloper
        const goal = createGoal(GoalType.MentalBreakTantrum, GoalSource.Relationship, {
          basePriority: 70,
          targetEntityId: interloper.id,
          expiresAt: Date.now() + 30000,
          data: { reason: 'jealousy' },
        });
        jealousPinata.addGoal(goal);
      } else {
        // Most piñatas just avoid the rival
        const goal = createGoal(GoalType.AvoidRival, GoalSource.Relationship, {
          basePriority: 50,
          targetEntityId: interloper.id,
          expiresAt: Date.now() + 60000,
          data: { reason: 'jealousy' },
        });
        jealousPinata.addGoal(goal);
      }
    });
  }

  /**
   * Broadcast an observation to all nearby piñatas
   */
  private broadcastObservation(observation: Observation): void {
    const range = PERCEPTION_RANGES[observation.type] ?? 10;

    for (const pinata of this.pinatas) {
      if (!pinata.getIsAlive()) continue;
      if (pinata.id === observation.sourceEntityId) continue; // Don't notify self

      const pos = pinata.getGridPosition();
      const dist = Math.sqrt(
        Math.pow(pos.x - observation.position.x, 2) +
        Math.pow(pos.y - observation.position.y, 2)
      );

      if (dist <= range) {
        this.notifyPinata(pinata, observation);
      }
    }
  }

  /**
   * Notify a specific piñata of an observation, potentially creating goals
   */
  private notifyPinata(pinata: Pinata, observation: Observation): void {
    const mappings = OBSERVATION_TO_GOALS[observation.type];
    if (!mappings) return;

    const traits = pinata.getTraits();
    const traitSet = new Set(traits);

    for (const mapping of mappings) {
      // Check required traits
      if (mapping.requiredTraits && mapping.requiredTraits.length > 0) {
        const hasRequired = mapping.requiredTraits.some(t => traitSet.has(t));
        if (!hasRequired) continue;
      }

      // Check blocked traits
      if (mapping.blockedByTraits) {
        const hasBlocked = mapping.blockedByTraits.some(t => traitSet.has(t));
        if (hasBlocked) continue;
      }

      // Check relationship requirements
      if (mapping.requiresRelationship && observation.sourceEntityId !== undefined) {
        if (!this.relationshipSystem) continue;

        const relationship = this.relationshipSystem.getRelationship(
          pinata.id,
          observation.sourceEntityId
        );

        if (!mapping.requiresRelationship.includes(relationship)) continue;
      }

      // Create the goal
      const goal = createGoal(mapping.goalType, mapping.source, {
        basePriority: (mapping.priorityBoost ?? 0) +
          (pinata.getGoalQueue().getActive()?.basePriority ?? 0),
        targetEntityId: observation.sourceEntityId,
        targetPosition: observation.position,
        expiresAt: mapping.expiresIn ? Date.now() + mapping.expiresIn : undefined,
        data: observation.data,
      });

      pinata.addGoal(goal);
    }
  }

  /**
   * Periodic scan for nearby entities (friends, rivals, predators)
   * Called each update tick to maintain situational awareness
   */
  scanNearbyEntities(pinata: Pinata): void {
    if (!pinata.getIsAlive()) return;

    const pos = pinata.getGridPosition();

    for (const other of this.pinatas) {
      if (other === pinata || !other.getIsAlive()) continue;

      const otherPos = other.getGridPosition();
      const dist = Math.sqrt(
        Math.pow(pos.x - otherPos.x, 2) +
        Math.pow(pos.y - otherPos.y, 2)
      );

      // Check for predators
      if (other.isPredator() && dist <= (PERCEPTION_RANGES[ObservationType.PredatorSpotted] ?? 10)) {
        this.notifyPinata(pinata, {
          type: ObservationType.PredatorSpotted,
          position: otherPos,
          sourceEntityId: other.id,
          timestamp: Date.now(),
        });
      }

      // Check for friends/rivals if we have relationship system
      if (this.relationshipSystem && dist <= 12) {
        const relationship = this.relationshipSystem.getRelationship(pinata.id, other.id);

        if (relationship === RelationshipType.Friend || relationship === RelationshipType.BestFriend) {
          // Only notify occasionally (not every tick)
          if (Math.random() < 0.1) {
            this.notifyPinata(pinata, {
              type: ObservationType.FriendNearby,
              position: otherPos,
              sourceEntityId: other.id,
              timestamp: Date.now(),
            });
          }
        } else if (relationship === RelationshipType.Rival) {
          this.notifyPinata(pinata, {
            type: ObservationType.RivalNearby,
            position: otherPos,
            sourceEntityId: other.id,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  update(_delta: number): void {
    // Periodic environmental scans (not every frame)
    // Individual piñatas call scanNearbyEntities in their own update
  }
}
