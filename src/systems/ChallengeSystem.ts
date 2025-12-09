import { EventBus, GameEvents } from '../utils/EventBus';
import { PinataSpecies } from '../entities/PinataTypes';
import { BuildingType } from './BuildingSystem';
import { Season } from './SeasonSystem';

/**
 * Challenges give players concrete goals and unlock rewards.
 * This provides telos (purpose) to the sandbox.
 */

export enum ChallengeCategory {
  Population = 'population',
  Species = 'species',
  Building = 'building',
  Survival = 'survival',
  Economy = 'economy',
  Social = 'social',
}

export enum ChallengeStatus {
  Locked = 'locked',       // Not yet available
  Available = 'available', // Can be worked on
  Completed = 'completed', // Finished!
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  category: ChallengeCategory;
  icon: string;
  status: ChallengeStatus;
  progress: number;        // Current progress
  target: number;          // Goal to reach
  reward: ChallengeReward;
  prerequisite?: string;   // ID of challenge that must be completed first
  hidden?: boolean;        // Don't show until available
}

export interface ChallengeReward {
  coins?: number;
  unlockBuilding?: BuildingType;
  unlockSpecies?: PinataSpecies; // Allow attracting this species
  title?: string;          // Rank/title to display
  bonusMultiplier?: number; // Permanent income multiplier
}

// Event names for challenge system
export const ChallengeEvents = {
  CHALLENGE_COMPLETED: 'challenge:completed',
  CHALLENGE_PROGRESS: 'challenge:progress',
  CHALLENGE_UNLOCKED: 'challenge:unlocked',
  GAME_WON: 'game:won',
  GAME_LOST: 'game:lost',
} as const;

// All challenges in the game
const CHALLENGE_DEFINITIONS: Omit<Challenge, 'status' | 'progress'>[] = [
  // === POPULATION CHALLENGES ===
  {
    id: 'first_resident',
    name: 'First Friend',
    description: 'Have a visitor decide to stay',
    category: ChallengeCategory.Population,
    icon: '🏠',
    target: 1,
    reward: { coins: 25 },
  },
  {
    id: 'small_colony',
    name: 'Small Colony',
    description: 'Have 5 piñatas living in your garden',
    category: ChallengeCategory.Population,
    icon: '👥',
    target: 5,
    prerequisite: 'first_resident',
    reward: { coins: 50, unlockBuilding: BuildingType.CandyHouse },
  },
  {
    id: 'thriving_community',
    name: 'Thriving Community',
    description: 'Have 10 piñatas living in your garden',
    category: ChallengeCategory.Population,
    icon: '🎉',
    target: 10,
    prerequisite: 'small_colony',
    reward: { coins: 100, unlockBuilding: BuildingType.Shrine },
  },
  {
    id: 'bustling_town',
    name: 'Bustling Town',
    description: 'Have 15 piñatas living in your garden',
    category: ChallengeCategory.Population,
    icon: '🏙️',
    target: 15,
    prerequisite: 'thriving_community',
    reward: { coins: 200, title: 'Town Mayor' },
  },

  // === SPECIES CHALLENGES ===
  {
    id: 'first_birth',
    name: 'New Life',
    description: 'Have your first baby piñata born',
    category: ChallengeCategory.Species,
    icon: '👶',
    target: 1,
    reward: { coins: 30, unlockBuilding: BuildingType.Playground },
  },
  {
    id: 'diverse_garden',
    name: 'Diverse Garden',
    description: 'Have 3 different species in your garden',
    category: ChallengeCategory.Species,
    icon: '🌈',
    target: 3,
    reward: { coins: 75, unlockBuilding: BuildingType.HoneyPot },
  },
  {
    id: 'species_collector',
    name: 'Species Collector',
    description: 'Attract all 5 piñata species',
    category: ChallengeCategory.Species,
    icon: '🏆',
    target: 5,
    prerequisite: 'diverse_garden',
    reward: { coins: 250, title: 'Master Gardener' },
  },
  {
    id: 'baby_boom',
    name: 'Baby Boom',
    description: 'Have 10 babies born in your garden',
    category: ChallengeCategory.Species,
    icon: '🍼',
    target: 10,
    prerequisite: 'first_birth',
    reward: { coins: 100, bonusMultiplier: 0.1 },
  },

  // === BUILDING CHALLENGES ===
  {
    id: 'first_building',
    name: 'Construction Begins',
    description: 'Complete your first building',
    category: ChallengeCategory.Building,
    icon: '🔨',
    target: 1,
    reward: { coins: 20, unlockBuilding: BuildingType.Fence },
  },
  {
    id: 'fortified',
    name: 'Fortified',
    description: 'Build 10 fence segments',
    category: ChallengeCategory.Building,
    icon: '🏰',
    target: 10,
    prerequisite: 'first_building',
    reward: { coins: 50, unlockBuilding: BuildingType.Watchtower },
  },
  {
    id: 'master_builder',
    name: 'Master Builder',
    description: 'Complete 10 buildings total',
    category: ChallengeCategory.Building,
    icon: '🏗️',
    target: 10,
    prerequisite: 'first_building',
    reward: { coins: 150, unlockBuilding: BuildingType.Workshop },
  },

  // === SURVIVAL CHALLENGES ===
  {
    id: 'first_winter',
    name: 'Winter Survivor',
    description: 'Survive your first winter with no deaths',
    category: ChallengeCategory.Survival,
    icon: '❄️',
    target: 1,
    reward: { coins: 100, unlockBuilding: BuildingType.Granary },
  },
  {
    id: 'predator_slayer',
    name: 'Predator Slayer',
    description: 'Defeat 5 predators',
    category: ChallengeCategory.Survival,
    icon: '⚔️',
    target: 5,
    reward: { coins: 75 },
  },
  {
    id: 'raid_survivor',
    name: 'Raid Survivor',
    description: 'Survive 3 predator raids',
    category: ChallengeCategory.Survival,
    icon: '🛡️',
    target: 3,
    prerequisite: 'predator_slayer',
    reward: { coins: 100, title: 'Defender' },
  },
  {
    id: 'cure_sour',
    name: 'Redemption',
    description: 'Cure a sour piñata',
    category: ChallengeCategory.Survival,
    icon: '💚',
    target: 1,
    reward: { coins: 50 },
  },

  // === ECONOMY CHALLENGES ===
  {
    id: 'first_harvest',
    name: 'First Harvest',
    description: 'Harvest your first crop',
    category: ChallengeCategory.Economy,
    icon: '🌾',
    target: 1,
    reward: { coins: 15, unlockBuilding: BuildingType.WaterWell },
  },
  {
    id: 'farmer',
    name: 'Farmer',
    description: 'Harvest 20 crops',
    category: ChallengeCategory.Economy,
    icon: '👨‍🌾',
    target: 20,
    prerequisite: 'first_harvest',
    reward: { coins: 75, bonusMultiplier: 0.05 },
  },
  {
    id: 'resource_hoarder',
    name: 'Resource Hoarder',
    description: 'Have 50 resources in stockpile',
    category: ChallengeCategory.Economy,
    icon: '📦',
    target: 50,
    reward: { coins: 50 },
  },
  {
    id: 'wealthy',
    name: 'Wealthy',
    description: 'Accumulate 500 candy coins',
    category: ChallengeCategory.Economy,
    icon: '💰',
    target: 500,
    reward: { bonusMultiplier: 0.15, title: 'Tycoon' },
  },

  // === SOCIAL CHALLENGES ===
  {
    id: 'first_friendship',
    name: 'Best Friends',
    description: 'Have two piñatas become best friends',
    category: ChallengeCategory.Social,
    icon: '💕',
    target: 1,
    reward: { coins: 25 },
  },
  {
    id: 'first_romance',
    name: 'True Love',
    description: 'Have two piñatas become romantic partners',
    category: ChallengeCategory.Social,
    icon: '💞',
    target: 1,
    prerequisite: 'first_friendship',
    reward: { coins: 40 },
  },
  {
    id: 'happy_colony',
    name: 'Happy Colony',
    description: 'Have all piñatas happy at once (min 5)',
    category: ChallengeCategory.Social,
    icon: '😊',
    target: 1,
    reward: { coins: 100, title: 'Beloved' },
  },
];

export class ChallengeSystem {
  private challenges: Map<string, Challenge> = new Map();
  private completedCount = 0;
  private totalChallenges: number;
  private unlockedBuildings: Set<BuildingType> = new Set();
  private currentTitle = 'Newcomer';
  private bonusMultiplier = 1.0;

  // Track stats for challenge progress
  private stats = {
    residentsAttracted: 0,
    babiesBorn: 0,
    speciesSeen: new Set<PinataSpecies>(),
    buildingsCompleted: 0,
    fencesBuilt: 0,
    predatorsKilled: 0,
    raidsCompleted: 0,
    wintersSurvived: 0,
    cropsHarvested: 0,
    sourCured: 0,
    peakCoins: 0,
    peakStockpile: 0,
  };

  // Game state
  private isGameOver = false;
  private isVictory = false;
  private winterDeaths = 0;
  private currentSeason: Season = Season.Spring;

  constructor() {
    // Initialize challenges from definitions
    for (const def of CHALLENGE_DEFINITIONS) {
      const challenge: Challenge = {
        ...def,
        status: def.prerequisite ? ChallengeStatus.Locked : ChallengeStatus.Available,
        progress: 0,
      };
      this.challenges.set(def.id, challenge);
    }

    this.totalChallenges = CHALLENGE_DEFINITIONS.length;

    // Start with basic buildings unlocked
    this.unlockedBuildings.add(BuildingType.Fence);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Population events
    EventBus.on(GameEvents.SPECIES_ATTRACTED, () => {
      this.stats.residentsAttracted++;
      this.updateProgress('first_resident', this.stats.residentsAttracted);
    });

    EventBus.on(GameEvents.PINATA_BORN, () => {
      this.stats.babiesBorn++;
      this.updateProgress('first_birth', 1);
      this.updateProgress('baby_boom', this.stats.babiesBorn);
    });

    // Building events
    EventBus.on(GameEvents.BUILDING_COMPLETE, (...args: unknown[]) => {
      const building = args[0] as { type: BuildingType };
      this.stats.buildingsCompleted++;
      this.updateProgress('first_building', 1);
      this.updateProgress('master_builder', this.stats.buildingsCompleted);

      if (building.type === BuildingType.Fence) {
        this.stats.fencesBuilt++;
        this.updateProgress('fortified', this.stats.fencesBuilt);
      }
    });

    // Combat events
    EventBus.on('threat:predatorKilled', () => {
      this.stats.predatorsKilled++;
      this.updateProgress('predator_slayer', this.stats.predatorsKilled);
    });

    EventBus.on('threat:raidEnded', () => {
      this.stats.raidsCompleted++;
      this.updateProgress('raid_survivor', this.stats.raidsCompleted);
    });

    // Farming events
    EventBus.on('farming:harvested', () => {
      this.stats.cropsHarvested++;
      this.updateProgress('first_harvest', 1);
      this.updateProgress('farmer', this.stats.cropsHarvested);
    });

    // Sour cured
    EventBus.on(GameEvents.SOUR_PINATA_CURED, () => {
      this.stats.sourCured++;
      this.updateProgress('cure_sour', 1);
    });

    // Relationship events
    EventBus.on(GameEvents.RELATIONSHIP_CHANGED, (...args: unknown[]) => {
      const [, , type] = args as [number, number, string];
      if (type === 'bestFriend') {
        this.updateProgress('first_friendship', 1);
      }
    });

    EventBus.on('relationship:romance', () => {
      this.updateProgress('first_romance', 1);
    });

    // Death tracking
    EventBus.on(GameEvents.PINATA_DIED, () => {
      if (this.currentSeason === Season.Winter) {
        this.winterDeaths++;
      }
    });
  }

  /**
   * Called each frame to check state-based challenges
   */
  update(
    population: number,
    species: Set<PinataSpecies>,
    coins: number,
    stockpile: number,
    allHappy: boolean,
    season: Season
  ): void {
    if (this.isGameOver) return;

    // Track season changes for winter survival
    if (season !== this.currentSeason) {
      // Season changed
      if (this.currentSeason === Season.Winter && season === Season.Spring) {
        // Winter just ended!
        if (this.winterDeaths === 0 && population > 0) {
          this.stats.wintersSurvived++;
          this.updateProgress('first_winter', 1);
        }
        this.winterDeaths = 0;
      }
      this.currentSeason = season;
    }

    // Update population challenges
    this.updateProgress('small_colony', population);
    this.updateProgress('thriving_community', population);
    this.updateProgress('bustling_town', population);

    // Update species diversity
    this.stats.speciesSeen = species;
    this.updateProgress('diverse_garden', species.size);
    this.updateProgress('species_collector', species.size);

    // Track peak values
    this.stats.peakCoins = Math.max(this.stats.peakCoins, coins);
    this.stats.peakStockpile = Math.max(this.stats.peakStockpile, stockpile);
    this.updateProgress('wealthy', coins);
    this.updateProgress('resource_hoarder', stockpile);

    // Happy colony (all happy with at least 5)
    if (allHappy && population >= 5) {
      this.updateProgress('happy_colony', 1);
    }

    // Check for game over (extinction)
    if (population === 0 && this.stats.residentsAttracted > 0) {
      this.triggerGameOver();
    }

    // Check for victory (all challenges complete)
    if (this.completedCount >= this.totalChallenges && !this.isVictory) {
      this.triggerVictory();
    }
  }

  private updateProgress(challengeId: string, value: number): void {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return;
    if (challenge.status !== ChallengeStatus.Available) return;

    const oldProgress = challenge.progress;
    challenge.progress = Math.min(challenge.target, value);

    if (challenge.progress !== oldProgress) {
      EventBus.emit(ChallengeEvents.CHALLENGE_PROGRESS, challenge);
    }

    // Check completion
    if (challenge.progress >= challenge.target) {
      this.completeChallenge(challenge);
    }
  }

  private completeChallenge(challenge: Challenge): void {
    if (challenge.status === ChallengeStatus.Completed) return;

    challenge.status = ChallengeStatus.Completed;
    this.completedCount++;

    // Apply rewards
    const reward = challenge.reward;
    if (reward.unlockBuilding) {
      this.unlockedBuildings.add(reward.unlockBuilding);
    }
    if (reward.title) {
      this.currentTitle = reward.title;
    }
    if (reward.bonusMultiplier) {
      this.bonusMultiplier += reward.bonusMultiplier;
    }

    console.log(`Challenge completed: ${challenge.name}!`);
    EventBus.emit(ChallengeEvents.CHALLENGE_COMPLETED, challenge);

    // Unlock dependent challenges
    for (const [, c] of this.challenges) {
      if (c.prerequisite === challenge.id && c.status === ChallengeStatus.Locked) {
        c.status = ChallengeStatus.Available;
        EventBus.emit(ChallengeEvents.CHALLENGE_UNLOCKED, c);
      }
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    console.log('GAME OVER - All piñatas have perished!');
    EventBus.emit(ChallengeEvents.GAME_LOST, {
      challengesCompleted: this.completedCount,
      totalChallenges: this.totalChallenges,
      title: this.currentTitle,
    });
  }

  private triggerVictory(): void {
    this.isVictory = true;
    console.log('VICTORY - All challenges completed!');
    EventBus.emit(ChallengeEvents.GAME_WON, {
      title: this.currentTitle,
      bonusMultiplier: this.bonusMultiplier,
    });
  }

  // Public getters
  getChallenges(): Challenge[] {
    return Array.from(this.challenges.values());
  }

  getAvailableChallenges(): Challenge[] {
    return this.getChallenges().filter(c => c.status === ChallengeStatus.Available);
  }

  getCompletedChallenges(): Challenge[] {
    return this.getChallenges().filter(c => c.status === ChallengeStatus.Completed);
  }

  isUnlocked(buildingType: BuildingType): boolean {
    return this.unlockedBuildings.has(buildingType);
  }

  getUnlockedBuildings(): BuildingType[] {
    return Array.from(this.unlockedBuildings);
  }

  getCurrentTitle(): string {
    return this.currentTitle;
  }

  getBonusMultiplier(): number {
    return this.bonusMultiplier;
  }

  getCompletionPercent(): number {
    return Math.round((this.completedCount / this.totalChallenges) * 100);
  }

  getIsGameOver(): boolean {
    return this.isGameOver;
  }

  getIsVictory(): boolean {
    return this.isVictory;
  }

  // Get reward coins for a challenge (to be collected by UI)
  getRewardCoins(challengeId: string): number {
    const challenge = this.challenges.get(challengeId);
    return challenge?.reward.coins ?? 0;
  }
}
