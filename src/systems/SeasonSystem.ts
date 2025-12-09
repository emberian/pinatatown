import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';

/**
 * Seasons create time pressure and variation.
 * Winter means scarce resources - did you stockpile enough?
 * Each season changes resource spawning, species visits, and visual atmosphere.
 */

export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

export const SeasonEvents = {
  SEASON_CHANGED: 'season:changed',
  SPRING_STARTED: 'season:spring',
  SUMMER_STARTED: 'season:summer',
  AUTUMN_STARTED: 'season:autumn',
  WINTER_STARTED: 'season:winter',
} as const;

export interface SeasonEffects {
  resourceSpawnRate: number;     // Multiplier on resource spawn frequency
  cropGrowthRate: number;        // Multiplier on crop growth speed
  hungerDecayRate: number;       // Multiplier on hunger decay (cold = hungrier)
  restDecayRate: number;         // Multiplier on rest decay
  visitorChance: number;         // Multiplier on new species visiting
  predatorAggression: number;    // Multiplier on predator behavior
  plantGrowthRate: number;       // Multiplier on garden plant growth
  dayLengthMult: number;         // Multiplier on day portion of day/night
  ambientColor: number;          // Tint color
  ambientAlpha: number;          // Tint intensity
}

export const SEASON_EFFECTS: Record<Season, SeasonEffects> = {
  [Season.Spring]: {
    resourceSpawnRate: 1.3,      // Berries sprouting!
    cropGrowthRate: 1.2,
    hungerDecayRate: 1.0,
    restDecayRate: 1.0,
    visitorChance: 1.5,          // Many visitors in spring
    predatorAggression: 0.8,     // Predators less desperate
    plantGrowthRate: 1.3,
    dayLengthMult: 1.0,
    ambientColor: 0x90EE90,      // Light green tint
    ambientAlpha: 0.05,
  },
  [Season.Summer]: {
    resourceSpawnRate: 1.5,      // Abundance!
    cropGrowthRate: 1.5,
    hungerDecayRate: 1.1,        // Hot makes you hungry
    restDecayRate: 1.2,          // Heat is tiring
    visitorChance: 1.2,
    predatorAggression: 0.7,     // Plenty of food
    plantGrowthRate: 1.5,
    dayLengthMult: 1.3,          // Long summer days
    ambientColor: 0xFFD700,      // Golden tint
    ambientAlpha: 0.08,
  },
  [Season.Autumn]: {
    resourceSpawnRate: 1.0,      // Harvest time
    cropGrowthRate: 0.8,
    hungerDecayRate: 1.1,
    restDecayRate: 1.0,
    visitorChance: 0.8,
    predatorAggression: 1.2,     // Getting hungrier
    plantGrowthRate: 0.7,
    dayLengthMult: 0.9,
    ambientColor: 0xCD853F,      // Orange/brown tint
    ambientAlpha: 0.1,
  },
  [Season.Winter]: {
    resourceSpawnRate: 0.2,      // Scarce!
    cropGrowthRate: 0.1,         // Almost nothing grows
    hungerDecayRate: 1.4,        // Cold makes you hungry
    restDecayRate: 1.3,          // Cold is exhausting
    visitorChance: 0.3,          // Few visitors brave the cold
    predatorAggression: 1.8,     // Desperate predators!
    plantGrowthRate: 0.0,        // Nothing grows
    dayLengthMult: 0.6,          // Short winter days
    ambientColor: 0xADD8E6,      // Cold blue tint
    ambientAlpha: 0.15,
  },
};

export interface SeasonInfo {
  name: string;
  description: string;
  icon: string;
  warnings: string[];
}

export const SEASON_INFO: Record<Season, SeasonInfo> = {
  [Season.Spring]: {
    name: 'Spring',
    description: 'New life blooms! Resources are plentiful and visitors abound.',
    icon: '🌸',
    warnings: [],
  },
  [Season.Summer]: {
    name: 'Summer',
    description: 'Long sunny days. Peak growing season but watch for overheating!',
    icon: '☀️',
    warnings: ['Rest decays faster in the heat'],
  },
  [Season.Autumn]: {
    name: 'Autumn',
    description: 'Harvest time! Stockpile resources before winter comes.',
    icon: '🍂',
    warnings: ['Winter is coming - stockpile food!', 'Predators are getting desperate'],
  },
  [Season.Winter]: {
    name: 'Winter',
    description: 'The cold months. Survival depends on your preparations.',
    icon: '❄️',
    warnings: ['Resources are scarce', 'Hunger and rest drain faster', 'Predators are desperate!'],
  },
};

export class SeasonSystem {
  private scene: Phaser.Scene;

  // Season timing (in ms)
  private readonly SEASON_DURATION = 180000; // 3 minutes per season (12 min year)
  private seasonProgress = 0;
  private currentSeason: Season = Season.Spring;
  private dayInSeason = 1;
  private readonly DAYS_PER_SEASON = 15;

  // Visual overlay
  private overlay: Phaser.GameObjects.Graphics;
  private seasonText: Phaser.GameObjects.Text;
  private warningText: Phaser.GameObjects.Text;

  // Cached effects
  private effects: SeasonEffects;

  // Year counter
  private year = 1;

  constructor(scene: Phaser.Scene, startSeason: Season = Season.Spring) {
    this.scene = scene;
    this.currentSeason = startSeason;
    this.effects = SEASON_EFFECTS[startSeason];

    this.overlay = scene.add.graphics();
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(499); // Just below time overlay

    // Position below the debug text area (which is at y=10)
    this.seasonText = scene.add.text(10, 130, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    });
    this.seasonText.setScrollFactor(0);
    this.seasonText.setDepth(1000);

    this.warningText = scene.add.text(
      scene.cameras.main.width / 2,
      scene.cameras.main.height - 80,
      '',
      {
        fontSize: '12px',
        color: '#ffcc00',
        backgroundColor: '#00000088',
        padding: { x: 10, y: 5 },
      }
    );
    this.warningText.setOrigin(0.5, 1);
    this.warningText.setScrollFactor(0);
    this.warningText.setDepth(1000);

    this.updateDisplay();
    this.updateOverlay();
  }

  update(delta: number): void {
    this.seasonProgress += delta;

    // Update day within season
    const dayLength = this.SEASON_DURATION / this.DAYS_PER_SEASON;
    const newDay = Math.floor(this.seasonProgress / dayLength) + 1;
    if (newDay !== this.dayInSeason && newDay <= this.DAYS_PER_SEASON) {
      this.dayInSeason = newDay;
      this.updateDisplay();
    }

    // Check for season change
    if (this.seasonProgress >= this.SEASON_DURATION) {
      this.seasonProgress = 0;
      this.dayInSeason = 1;
      this.advanceSeason();
    }
  }

  private advanceSeason(): void {
    const seasons = [Season.Spring, Season.Summer, Season.Autumn, Season.Winter];
    const currentIndex = seasons.indexOf(this.currentSeason);
    const nextIndex = (currentIndex + 1) % seasons.length;

    const previousSeason = this.currentSeason;
    this.currentSeason = seasons[nextIndex];

    // New year!
    if (this.currentSeason === Season.Spring) {
      this.year++;
      this.showYearNotification();
    }

    this.effects = SEASON_EFFECTS[this.currentSeason];

    // Emit events
    EventBus.emit(SeasonEvents.SEASON_CHANGED, previousSeason, this.currentSeason);

    switch (this.currentSeason) {
      case Season.Spring:
        EventBus.emit(SeasonEvents.SPRING_STARTED);
        break;
      case Season.Summer:
        EventBus.emit(SeasonEvents.SUMMER_STARTED);
        break;
      case Season.Autumn:
        EventBus.emit(SeasonEvents.AUTUMN_STARTED);
        break;
      case Season.Winter:
        EventBus.emit(SeasonEvents.WINTER_STARTED);
        break;
    }

    this.showSeasonNotification();
    this.updateDisplay();
    this.updateOverlay();

    console.log(`Season changed to ${this.currentSeason}`);
  }

  private showSeasonNotification(): void {
    const info = SEASON_INFO[this.currentSeason];

    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 50,
      `${info.icon} ${info.name} ${info.icon}\n${info.description}`,
      {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 30, y: 20 },
        align: 'center',
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2001);

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 50,
      delay: 3000,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Show warnings if any
    if (info.warnings.length > 0) {
      const warningText = this.scene.add.text(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2 + 40,
        '⚠️ ' + info.warnings.join('\n⚠️ '),
        {
          fontSize: '16px',
          color: '#ffcc00',
          backgroundColor: '#000000cc',
          padding: { x: 20, y: 10 },
          align: 'center',
        }
      );
      warningText.setOrigin(0.5);
      warningText.setScrollFactor(0);
      warningText.setDepth(2001);

      this.scene.tweens.add({
        targets: warningText,
        alpha: 0,
        y: warningText.y - 30,
        delay: 4000,
        duration: 1500,
        ease: 'Power2',
        onComplete: () => warningText.destroy(),
      });
    }
  }

  private showYearNotification(): void {
    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `🎊 Year ${this.year} 🎊`,
      {
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: '#6b2fb3',
        padding: { x: 30, y: 15 },
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2002);

    this.scene.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      yoyo: true,
      duration: 300,
      repeat: 2,
    });

    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 50,
      delay: 3000,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private updateDisplay(): void {
    const info = SEASON_INFO[this.currentSeason];
    this.seasonText.setText(`${info.icon} ${info.name} - Day ${this.dayInSeason} | Year ${this.year}`);

    // Show rotating warnings during dangerous seasons
    const warnings = info.warnings;
    if (warnings.length > 0) {
      const warningIndex = Math.floor(Date.now() / 5000) % warnings.length;
      this.warningText.setText('⚠️ ' + warnings[warningIndex]);
      this.warningText.setVisible(true);
    } else {
      this.warningText.setVisible(false);
    }
  }

  private updateOverlay(): void {
    this.overlay.clear();

    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    this.overlay.fillStyle(this.effects.ambientColor, this.effects.ambientAlpha);
    this.overlay.fillRect(0, 0, width, height);
  }

  // Public getters
  getSeason(): Season {
    return this.currentSeason;
  }

  getEffects(): SeasonEffects {
    return { ...this.effects };
  }

  getYear(): number {
    return this.year;
  }

  getDayInSeason(): number {
    return this.dayInSeason;
  }

  getSeasonProgress(): number {
    return this.seasonProgress / this.SEASON_DURATION;
  }

  // Convenience methods for other systems
  getResourceSpawnMultiplier(): number {
    return this.effects.resourceSpawnRate;
  }

  getHungerDecayMultiplier(): number {
    return this.effects.hungerDecayRate;
  }

  getRestDecayMultiplier(): number {
    return this.effects.restDecayRate;
  }

  getCropGrowthMultiplier(): number {
    return this.effects.cropGrowthRate;
  }

  getVisitorChanceMultiplier(): number {
    return this.effects.visitorChance;
  }

  getPredatorAggressionMultiplier(): number {
    return this.effects.predatorAggression;
  }

  isWinter(): boolean {
    return this.currentSeason === Season.Winter;
  }

  // For debugging/testing
  setSeason(season: Season): void {
    this.currentSeason = season;
    this.effects = SEASON_EFFECTS[season];
    this.seasonProgress = 0;
    this.dayInSeason = 1;
    this.updateDisplay();
    this.updateOverlay();
  }
}
