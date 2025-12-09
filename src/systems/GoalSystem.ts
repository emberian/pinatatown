import { GridPosition } from '../world/IsoUtils';
import { Trait } from './TraitSystem';

/**
 * Goals represent what a piñata wants to do.
 * Unlike simple behavior states, goals have priorities, sources, and can be
 * interrupted or re-evaluated based on changing circumstances.
 */

export enum GoalType {
  // Survival needs - baseline priorities
  SatisfyHunger = 'satisfyHunger',
  SatisfyRest = 'satisfyRest',
  SatisfyFun = 'satisfyFun',
  SatisfySocial = 'satisfySocial',

  // Reactive goals - triggered by perception
  FleeFromThreat = 'fleeFromThreat',
  HelpFriend = 'helpFriend',
  DefendAlly = 'defendAlly',
  InvestigateEvent = 'investigateEvent',
  MournDeath = 'mournDeath',

  // Social goals
  SeekCompanion = 'seekCompanion',
  AvoidRival = 'avoidRival',
  Romance = 'romance',

  // Work goals - assigned or self-directed
  GatherResource = 'gatherResource',
  DeliverResource = 'deliverResource',
  FarmCrop = 'farmCrop',
  BuildStructure = 'buildStructure',
  GuardArea = 'guardArea',

  // Predator goals
  Hunt = 'hunt',
  Stalk = 'stalk',

  // Idle/default
  Wander = 'wander',
  Idle = 'idle',

  // Mental break variants - personality-specific
  MentalBreakTantrum = 'mentalBreakTantrum',
  MentalBreakHide = 'mentalBreakHide',
  MentalBreakWander = 'mentalBreakWander',
  MentalBreakFire = 'mentalBreakFire', // Pyromaniac
}

export enum GoalSource {
  Internal = 'internal',       // From own needs
  Perception = 'perception',   // From observing something
  Assignment = 'assignment',   // From work system
  Instinct = 'instinct',       // Species-specific drives
  Relationship = 'relationship', // From social bonds
}

export enum GoalStatus {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Failed = 'failed',
  Interrupted = 'interrupted',
  Expired = 'expired',
}

export interface Goal {
  id: number;
  type: GoalType;
  source: GoalSource;
  status: GoalStatus;

  // Priority (higher = more urgent). Modified by traits, relationships, context.
  basePriority: number;
  currentPriority: number;

  // What/where is this goal about?
  targetEntityId?: number;      // Another piñata
  targetPosition?: GridPosition;
  targetResourceId?: number;

  // Metadata
  createdAt: number;
  expiresAt?: number;           // Some goals expire (e.g., "investigate noise")
  data?: Record<string, unknown>; // Goal-specific data

  // Progress tracking
  progress?: number;            // 0-100 for goals that take time
}

// Base priorities for different goal types
// These get modified by urgency, traits, and context
export const BASE_PRIORITIES: Record<GoalType, number> = {
  // Survival - scales with need level
  [GoalType.SatisfyHunger]: 50,
  [GoalType.SatisfyRest]: 45,
  [GoalType.SatisfyFun]: 30,
  [GoalType.SatisfySocial]: 25,

  // Reactive - generally high priority
  [GoalType.FleeFromThreat]: 95,
  [GoalType.DefendAlly]: 85,
  [GoalType.HelpFriend]: 60,
  [GoalType.MournDeath]: 55,
  [GoalType.InvestigateEvent]: 35,

  // Social
  [GoalType.SeekCompanion]: 40,
  [GoalType.AvoidRival]: 45,
  [GoalType.Romance]: 50,

  // Work - moderate, can be adjusted by player
  [GoalType.GatherResource]: 35,
  [GoalType.DeliverResource]: 40,
  [GoalType.FarmCrop]: 35,
  [GoalType.BuildStructure]: 30,
  [GoalType.GuardArea]: 40,

  // Predator
  [GoalType.Hunt]: 70,
  [GoalType.Stalk]: 60,

  // Default
  [GoalType.Wander]: 10,
  [GoalType.Idle]: 5,

  // Mental breaks override almost everything
  [GoalType.MentalBreakTantrum]: 90,
  [GoalType.MentalBreakHide]: 90,
  [GoalType.MentalBreakWander]: 90,
  [GoalType.MentalBreakFire]: 90,
};

// How traits modify goal priorities
// Positive = more likely to pursue, negative = less likely
export const TRAIT_GOAL_MODIFIERS: Partial<Record<Trait, Partial<Record<GoalType, number>>>> = {
  [Trait.Kind]: {
    [GoalType.HelpFriend]: 30,
    [GoalType.DefendAlly]: 15,
    [GoalType.SeekCompanion]: 10,
  },
  [Trait.Greedy]: {
    [GoalType.HelpFriend]: -40, // Won't help
    [GoalType.GatherResource]: 20,
    [GoalType.DeliverResource]: -15, // Reluctant to give up resources
  },
  [Trait.Brave]: {
    [GoalType.FleeFromThreat]: -30,
    [GoalType.DefendAlly]: 25,
    [GoalType.GuardArea]: 15,
  },
  [Trait.Cowardly]: {
    [GoalType.FleeFromThreat]: 30,
    [GoalType.DefendAlly]: -30,
    [GoalType.GuardArea]: -20,
    [GoalType.Hunt]: -20,
  },
  [Trait.SocialButterfly]: {
    [GoalType.SatisfySocial]: 20,
    [GoalType.SeekCompanion]: 25,
  },
  [Trait.Loner]: {
    [GoalType.SatisfySocial]: -20,
    [GoalType.SeekCompanion]: -30,
    [GoalType.Wander]: 15,
  },
  [Trait.Industrious]: {
    [GoalType.GatherResource]: 15,
    [GoalType.FarmCrop]: 15,
    [GoalType.BuildStructure]: 15,
    [GoalType.Idle]: -20,
    [GoalType.Wander]: -10,
  },
  [Trait.Lazy]: {
    [GoalType.GatherResource]: -15,
    [GoalType.FarmCrop]: -15,
    [GoalType.BuildStructure]: -15,
    [GoalType.Idle]: 20,
    [GoalType.SatisfyRest]: 15,
  },
  [Trait.Curious]: {
    [GoalType.InvestigateEvent]: 30,
    [GoalType.Wander]: 20,
  },
  [Trait.Homebody]: {
    [GoalType.Wander]: -20,
    [GoalType.InvestigateEvent]: -15,
  },
  [Trait.Aggressive]: {
    [GoalType.DefendAlly]: 20,
    [GoalType.Hunt]: 20,
    [GoalType.MentalBreakTantrum]: 30,
  },
  [Trait.Pacifist]: {
    [GoalType.DefendAlly]: -20,
    [GoalType.Hunt]: -50,
    [GoalType.FleeFromThreat]: 15,
  },
  [Trait.Pyromaniac]: {
    [GoalType.MentalBreakFire]: 50, // Will choose fire break
  },
  [Trait.Neurotic]: {
    [GoalType.MentalBreakHide]: 20,
  },
};

let goalIdCounter = 0;

/**
 * Creates a new goal
 */
export function createGoal(
  type: GoalType,
  source: GoalSource,
  options: Partial<Omit<Goal, 'id' | 'type' | 'source' | 'status' | 'createdAt'>> = {}
): Goal {
  const now = Date.now();

  return {
    id: goalIdCounter++,
    type,
    source,
    status: GoalStatus.Pending,
    basePriority: options.basePriority ?? BASE_PRIORITIES[type],
    currentPriority: options.currentPriority ?? options.basePriority ?? BASE_PRIORITIES[type],
    targetEntityId: options.targetEntityId,
    targetPosition: options.targetPosition,
    targetResourceId: options.targetResourceId,
    createdAt: now,
    expiresAt: options.expiresAt,
    data: options.data,
    progress: options.progress,
  };
}

/**
 * Calculate modified priority based on traits
 */
export function calculateTraitModifiedPriority(
  goal: Goal,
  traits: Trait[]
): number {
  let priority = goal.basePriority;

  for (const trait of traits) {
    const modifiers = TRAIT_GOAL_MODIFIERS[trait];
    if (modifiers && modifiers[goal.type] !== undefined) {
      priority += modifiers[goal.type]!;
    }
  }

  return Math.max(0, priority);
}

/**
 * Check if a goal has expired
 */
export function isGoalExpired(goal: Goal): boolean {
  if (!goal.expiresAt) return false;
  return Date.now() > goal.expiresAt;
}

/**
 * Check if a goal can interrupt another (higher priority)
 */
export function canInterrupt(newGoal: Goal, currentGoal: Goal | null): boolean {
  if (!currentGoal) return true;

  // Need significant priority difference to interrupt
  const interruptThreshold = 15;
  return newGoal.currentPriority > currentGoal.currentPriority + interruptThreshold;
}

/**
 * Goal queue for a single piñata
 */
export class GoalQueue {
  private goals: Goal[] = [];
  private activeGoal: Goal | null = null;

  add(goal: Goal): void {
    // Don't add duplicates of same type/target
    const isDuplicate = this.goals.some(g =>
      g.type === goal.type &&
      g.targetEntityId === goal.targetEntityId &&
      g.targetPosition?.x === goal.targetPosition?.x &&
      g.targetPosition?.y === goal.targetPosition?.y
    );

    if (!isDuplicate) {
      this.goals.push(goal);
    }
  }

  remove(goalId: number): void {
    this.goals = this.goals.filter(g => g.id !== goalId);
    if (this.activeGoal?.id === goalId) {
      this.activeGoal = null;
    }
  }

  getActive(): Goal | null {
    return this.activeGoal;
  }

  setActive(goal: Goal | null): void {
    if (this.activeGoal && this.activeGoal !== goal) {
      this.activeGoal.status = GoalStatus.Interrupted;
    }
    this.activeGoal = goal;
    if (goal) {
      goal.status = GoalStatus.Active;
    }
  }

  /**
   * Get the highest priority goal that isn't expired
   */
  getHighestPriority(): Goal | null {
    // Clean up expired goals
    this.goals = this.goals.filter(g => !isGoalExpired(g));

    if (this.goals.length === 0) return null;

    return this.goals.reduce((best, current) =>
      current.currentPriority > best.currentPriority ? current : best
    );
  }

  /**
   * Re-evaluate and potentially switch active goal
   */
  evaluate(traits: Trait[]): Goal | null {
    // Update priorities for all goals based on traits
    for (const goal of this.goals) {
      goal.currentPriority = calculateTraitModifiedPriority(goal, traits);
    }

    const best = this.getHighestPriority();

    if (best && canInterrupt(best, this.activeGoal)) {
      this.setActive(best);
    }

    return this.activeGoal;
  }

  completeActive(): void {
    if (this.activeGoal) {
      this.activeGoal.status = GoalStatus.Completed;
      this.remove(this.activeGoal.id);
      this.activeGoal = null;
    }
  }

  failActive(): void {
    if (this.activeGoal) {
      this.activeGoal.status = GoalStatus.Failed;
      this.remove(this.activeGoal.id);
      this.activeGoal = null;
    }
  }

  clear(): void {
    this.goals = [];
    this.activeGoal = null;
  }

  getAll(): Goal[] {
    return [...this.goals];
  }

  hasGoalOfType(type: GoalType): boolean {
    return this.goals.some(g => g.type === type);
  }
}
