import { PinataSpecies } from '../entities/PinataTypes';

/**
 * Traits give each piñata a unique personality that affects behavior.
 * This creates emergent stories: "My best gatherer is a coward who keeps fleeing!"
 */

export enum Trait {
  // Work ethic
  Industrious = 'industrious',   // Works faster, less idle time
  Lazy = 'lazy',                 // Works slower, more idle time

  // Courage
  Brave = 'brave',               // Fights instead of flees, higher threat tolerance
  Cowardly = 'cowardly',         // Flees earlier, avoids conflict

  // Appetite
  Glutton = 'glutton',           // Hunger decays faster, eats more
  Ascetic = 'ascetic',           // Hunger decays slower, eats less

  // Social
  SocialButterfly = 'socialButterfly', // Social need decays faster, gains more from socializing
  Loner = 'loner',               // Social need decays slower, prefers solitude

  // Energy
  NightOwl = 'nightOwl',         // Active at night, sleepy during day
  EarlyBird = 'earlyBird',       // Active during day, sleepy at night

  // Personality quirks
  Pyromaniac = 'pyromaniac',     // May start fires when stressed (future)
  Jealous = 'jealous',           // Gets mood penalty when others romance
  Kind = 'kind',                 // Helps feed/heal others, mood boost from helping
  Greedy = 'greedy',             // Hoards resources, won't share
  Neurotic = 'neurotic',         // Needs decay faster, more mental breaks
  Tough = 'tough',               // Higher health, slower need decay
  Clumsy = 'clumsy',             // Drops resources sometimes, trips
  Lucky = 'lucky',               // Better outcomes, finds extra resources
  Curious = 'curious',           // Wanders more, discovers things
  Homebody = 'homebody',         // Stays near home zones, mood penalty far from base
  Aggressive = 'aggressive',     // Picks fights, higher damage
  Pacifist = 'pacifist',         // Won't fight, calms others
  Fertile = 'fertile',           // Romance cooldown reduced
  Mentor = 'mentor',             // Nearby piñatas work faster
  Pessimist = 'pessimist',       // Mood bonuses reduced, penalties increased
  Optimist = 'optimist',         // Mood bonuses increased, penalties reduced
}

// Traits that conflict (can't have both)
export const CONFLICTING_TRAITS: [Trait, Trait][] = [
  [Trait.Industrious, Trait.Lazy],
  [Trait.Brave, Trait.Cowardly],
  [Trait.Glutton, Trait.Ascetic],
  [Trait.SocialButterfly, Trait.Loner],
  [Trait.NightOwl, Trait.EarlyBird],
  [Trait.Kind, Trait.Greedy],
  [Trait.Aggressive, Trait.Pacifist],
  [Trait.Pessimist, Trait.Optimist],
  [Trait.Curious, Trait.Homebody],
];

// Trait effects on various stats
export interface TraitEffects {
  workSpeedMult?: number;        // Multiplier on work speed
  idleTimeMult?: number;         // Multiplier on how long before wandering
  fleeThreshold?: number;        // Distance at which to flee from threats
  fightChance?: number;          // Chance to fight instead of flee
  hungerDecayMult?: number;      // Multiplier on hunger decay
  restDecayMult?: number;        // Multiplier on rest decay
  funDecayMult?: number;         // Multiplier on fun decay
  socialDecayMult?: number;      // Multiplier on social decay
  socialGainMult?: number;       // Multiplier on social gains
  nightActivityMult?: number;    // Activity multiplier at night
  dayActivityMult?: number;      // Activity multiplier during day
  moodBonusMult?: number;        // Multiplier on positive mood changes
  moodPenaltyMult?: number;      // Multiplier on negative mood changes
  romanceCooldownMult?: number;  // Multiplier on romance cooldown
  mentalBreakThreshold?: number; // Adjust when mental breaks happen
  resourceFindBonus?: number;    // Bonus chance to find extra resources
  dropChance?: number;           // Chance to drop carried items
  helpChance?: number;           // Chance to help nearby piñatas
  hoardChance?: number;          // Chance to keep resources instead of stockpiling
  damageMultiplier?: number;     // Combat damage multiplier
  nearbyWorkBonus?: number;      // Work speed bonus for nearby piñatas
}

export const TRAIT_EFFECTS: Record<Trait, TraitEffects> = {
  [Trait.Industrious]: { workSpeedMult: 1.4, idleTimeMult: 0.5 },
  [Trait.Lazy]: { workSpeedMult: 0.6, idleTimeMult: 2.0 },

  [Trait.Brave]: { fleeThreshold: 3, fightChance: 0.7 },
  [Trait.Cowardly]: { fleeThreshold: 12, fightChance: 0.1 },

  [Trait.Glutton]: { hungerDecayMult: 1.5 },
  [Trait.Ascetic]: { hungerDecayMult: 0.6 },

  [Trait.SocialButterfly]: { socialDecayMult: 1.5, socialGainMult: 1.5 },
  [Trait.Loner]: { socialDecayMult: 0.4, socialGainMult: 0.7 },

  [Trait.NightOwl]: { nightActivityMult: 1.3, dayActivityMult: 0.7, restDecayMult: 0.7 },
  [Trait.EarlyBird]: { dayActivityMult: 1.3, nightActivityMult: 0.7, restDecayMult: 0.7 },

  [Trait.Pyromaniac]: { mentalBreakThreshold: 20 }, // Breaks earlier
  [Trait.Jealous]: { moodPenaltyMult: 1.5 },
  [Trait.Kind]: { helpChance: 0.3, moodBonusMult: 1.2 },
  [Trait.Greedy]: { hoardChance: 0.4 },
  [Trait.Neurotic]: {
    hungerDecayMult: 1.2,
    restDecayMult: 1.2,
    funDecayMult: 1.3,
    socialDecayMult: 1.2,
    mentalBreakThreshold: 25
  },
  [Trait.Tough]: {
    hungerDecayMult: 0.85,
    restDecayMult: 0.85,
    funDecayMult: 0.9,
    socialDecayMult: 0.9
  },
  [Trait.Clumsy]: { dropChance: 0.15, workSpeedMult: 0.9 },
  [Trait.Lucky]: { resourceFindBonus: 0.25 },
  [Trait.Curious]: { idleTimeMult: 0.3 }, // Wanders more
  [Trait.Homebody]: { idleTimeMult: 1.5 },
  [Trait.Aggressive]: { fightChance: 0.8, damageMultiplier: 1.3 },
  [Trait.Pacifist]: { fightChance: 0, moodBonusMult: 1.1 },
  [Trait.Fertile]: { romanceCooldownMult: 0.5 },
  [Trait.Mentor]: { nearbyWorkBonus: 0.2 },
  [Trait.Pessimist]: { moodBonusMult: 0.7, moodPenaltyMult: 1.4 },
  [Trait.Optimist]: { moodBonusMult: 1.4, moodPenaltyMult: 0.7 },
};

// Trait display info
export interface TraitInfo {
  name: string;
  description: string;
  icon: string;
  isPositive: boolean;
}

export const TRAIT_INFO: Record<Trait, TraitInfo> = {
  [Trait.Industrious]: {
    name: 'Industrious',
    description: 'Works 40% faster and stays busy',
    icon: '⚡',
    isPositive: true
  },
  [Trait.Lazy]: {
    name: 'Lazy',
    description: 'Works slowly and idles frequently',
    icon: '🦥',
    isPositive: false
  },
  [Trait.Brave]: {
    name: 'Brave',
    description: 'Stands ground against threats',
    icon: '🦁',
    isPositive: true
  },
  [Trait.Cowardly]: {
    name: 'Cowardly',
    description: 'Flees at the first sign of danger',
    icon: '🐔',
    isPositive: false
  },
  [Trait.Glutton]: {
    name: 'Glutton',
    description: 'Always hungry, eats 50% more',
    icon: '🍔',
    isPositive: false
  },
  [Trait.Ascetic]: {
    name: 'Ascetic',
    description: 'Needs little food to stay satisfied',
    icon: '🧘',
    isPositive: true
  },
  [Trait.SocialButterfly]: {
    name: 'Social Butterfly',
    description: 'Craves company but thrives on interaction',
    icon: '🦋',
    isPositive: true
  },
  [Trait.Loner]: {
    name: 'Loner',
    description: 'Prefers solitude, rarely needs company',
    icon: '🐺',
    isPositive: true
  },
  [Trait.NightOwl]: {
    name: 'Night Owl',
    description: 'Active at night, sluggish during day',
    icon: '🦉',
    isPositive: true
  },
  [Trait.EarlyBird]: {
    name: 'Early Bird',
    description: 'Most productive in morning, tired at night',
    icon: '🐦',
    isPositive: true
  },
  [Trait.Pyromaniac]: {
    name: 'Pyromaniac',
    description: 'May start fires during mental breaks',
    icon: '🔥',
    isPositive: false
  },
  [Trait.Jealous]: {
    name: 'Jealous',
    description: 'Gets upset when others find romance',
    icon: '💚',
    isPositive: false
  },
  [Trait.Kind]: {
    name: 'Kind',
    description: 'Helps others and feels good doing it',
    icon: '💕',
    isPositive: true
  },
  [Trait.Greedy]: {
    name: 'Greedy',
    description: 'May keep resources instead of stockpiling',
    icon: '💰',
    isPositive: false
  },
  [Trait.Neurotic]: {
    name: 'Neurotic',
    description: 'Needs decay faster, prone to breakdowns',
    icon: '😰',
    isPositive: false
  },
  [Trait.Tough]: {
    name: 'Tough',
    description: 'Hardy constitution, needs decay slower',
    icon: '💪',
    isPositive: true
  },
  [Trait.Clumsy]: {
    name: 'Clumsy',
    description: 'Occasionally drops things',
    icon: '🤕',
    isPositive: false
  },
  [Trait.Lucky]: {
    name: 'Lucky',
    description: 'Finds bonus resources',
    icon: '🍀',
    isPositive: true
  },
  [Trait.Curious]: {
    name: 'Curious',
    description: 'Loves exploring, rarely sits still',
    icon: '🔍',
    isPositive: true
  },
  [Trait.Homebody]: {
    name: 'Homebody',
    description: 'Prefers staying near home zones',
    icon: '🏠',
    isPositive: true
  },
  [Trait.Aggressive]: {
    name: 'Aggressive',
    description: 'Quick to fight, deals more damage',
    icon: '😤',
    isPositive: false
  },
  [Trait.Pacifist]: {
    name: 'Pacifist',
    description: 'Refuses to fight, calms others',
    icon: '☮️',
    isPositive: true
  },
  [Trait.Fertile]: {
    name: 'Fertile',
    description: 'Ready for romance twice as fast',
    icon: '🥚',
    isPositive: true
  },
  [Trait.Mentor]: {
    name: 'Mentor',
    description: 'Nearby piñatas work faster',
    icon: '📚',
    isPositive: true
  },
  [Trait.Pessimist]: {
    name: 'Pessimist',
    description: 'Good things feel less good, bad things feel worse',
    icon: '😞',
    isPositive: false
  },
  [Trait.Optimist]: {
    name: 'Optimist',
    description: 'Good things feel great, bad things roll off',
    icon: '😊',
    isPositive: true
  },
};

// Species trait weights (some traits more common for certain species)
const SPECIES_TRAIT_WEIGHTS: Partial<Record<PinataSpecies, Partial<Record<Trait, number>>>> = {
  [PinataSpecies.Sparrowmint]: {
    [Trait.Curious]: 2,
    [Trait.EarlyBird]: 2,
    [Trait.Cowardly]: 1.5,
  },
  [PinataSpecies.Moozipan]: {
    [Trait.Lazy]: 1.5,
    [Trait.Homebody]: 2,
    [Trait.Kind]: 1.5,
    [Trait.Pacifist]: 2,
  },
  [PinataSpecies.Buzzlegum]: {
    [Trait.Industrious]: 2,
    [Trait.SocialButterfly]: 1.5,
    [Trait.Neurotic]: 1.3,
  },
  [PinataSpecies.Rashberry]: {
    [Trait.Brave]: 2,
    [Trait.Aggressive]: 1.5,
    [Trait.Tough]: 1.5,
  },
  [PinataSpecies.Pretztail]: {
    [Trait.NightOwl]: 2,
    [Trait.Loner]: 2,
    [Trait.Brave]: 1.5,
    [Trait.Aggressive]: 1.5,
  },
};

/**
 * Generate random traits for a piñata
 */
export function generateTraits(species: PinataSpecies, count: number = 2): Trait[] {
  const allTraits = Object.values(Trait);
  const speciesWeights = SPECIES_TRAIT_WEIGHTS[species] ?? {};

  // Build weighted pool
  const weightedPool: { trait: Trait; weight: number }[] = allTraits.map(trait => ({
    trait,
    weight: speciesWeights[trait] ?? 1,
  }));

  const selected: Trait[] = [];

  while (selected.length < count && weightedPool.length > 0) {
    // Calculate total weight
    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);

    // Pick random based on weight
    let random = Math.random() * totalWeight;
    let chosenIndex = 0;

    for (let i = 0; i < weightedPool.length; i++) {
      random -= weightedPool[i].weight;
      if (random <= 0) {
        chosenIndex = i;
        break;
      }
    }

    const chosen = weightedPool[chosenIndex].trait;
    selected.push(chosen);

    // Remove chosen trait and any conflicting traits from pool
    const toRemove = new Set<Trait>([chosen]);
    for (const [a, b] of CONFLICTING_TRAITS) {
      if (a === chosen) toRemove.add(b);
      if (b === chosen) toRemove.add(a);
    }

    // Filter pool
    for (let i = weightedPool.length - 1; i >= 0; i--) {
      if (toRemove.has(weightedPool[i].trait)) {
        weightedPool.splice(i, 1);
      }
    }
  }

  return selected;
}

/**
 * Calculate combined effects from multiple traits
 */
export function getCombinedEffects(traits: Trait[]): TraitEffects {
  const combined: TraitEffects = {};

  for (const trait of traits) {
    const effects = TRAIT_EFFECTS[trait];
    for (const [key, value] of Object.entries(effects)) {
      const k = key as keyof TraitEffects;
      if (combined[k] === undefined) {
        combined[k] = value;
      } else {
        // Multiply multipliers, add bonuses
        if (k.endsWith('Mult') || k.endsWith('Multiplier')) {
          combined[k] = (combined[k] as number) * (value as number);
        } else {
          combined[k] = (combined[k] as number) + (value as number);
        }
      }
    }
  }

  return combined;
}

/**
 * Get a descriptive string of traits
 */
export function describeTraits(traits: Trait[]): string {
  return traits.map(t => TRAIT_INFO[t].icon + ' ' + TRAIT_INFO[t].name).join(', ');
}
