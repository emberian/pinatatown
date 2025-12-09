import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';

export enum TimeOfDay {
  Dawn = 'dawn',
  Day = 'day',
  Dusk = 'dusk',
  Night = 'night',
}

// Time events
export const TimeEvents = {
  TIME_CHANGED: 'time:changed',
  DAWN: 'time:dawn',
  DAY: 'time:day',
  DUSK: 'time:dusk',
  NIGHT: 'time:night',
} as const;

/**
 * Manages the day/night cycle
 */
export class TimeSystem {
  private scene: Phaser.Scene;

  // Time settings (in milliseconds)
  private readonly FULL_DAY_DURATION = 300000; // 5 minutes for full cycle
  private readonly DAY_START = 0.1; // 10% of cycle (dawn is 0-10%)
  private readonly DUSK_START = 0.6; // 60% of cycle
  private readonly NIGHT_START = 0.7; // 70% of cycle

  // Current time
  private timeProgress = 0.15; // Start in early morning
  private currentTimeOfDay: TimeOfDay = TimeOfDay.Day;

  // Visual overlay
  private overlay!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;

  // Sky colors for different times
  private readonly SKY_COLORS = {
    [TimeOfDay.Dawn]: { color: 0xffb347, alpha: 0.2 },   // Orange tint
    [TimeOfDay.Day]: { color: 0x000000, alpha: 0 },      // Clear
    [TimeOfDay.Dusk]: { color: 0xff6b6b, alpha: 0.25 },  // Red/pink tint
    [TimeOfDay.Night]: { color: 0x191970, alpha: 0.4 },  // Dark blue
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createOverlay();
    this.updateTimeOfDay();
  }

  private createOverlay(): void {
    // Full-screen color overlay
    this.overlay = this.scene.add.graphics();
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(500); // Above world, below UI

    // Time display
    this.timeText = this.scene.add.text(
      this.scene.cameras.main.width - 10,
      50,
      '',
      {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 },
      }
    );
    this.timeText.setOrigin(1, 0);
    this.timeText.setScrollFactor(0);
    this.timeText.setDepth(1000);

    this.updateOverlay();
  }

  update(delta: number): void {
    // Advance time
    this.timeProgress += delta / this.FULL_DAY_DURATION;
    if (this.timeProgress >= 1) {
      this.timeProgress -= 1;
    }

    // Check for time of day changes
    const previousTime = this.currentTimeOfDay;
    this.updateTimeOfDay();

    if (previousTime !== this.currentTimeOfDay) {
      this.onTimeChanged(previousTime, this.currentTimeOfDay);
    }

    // Update visuals
    this.updateOverlay();
    this.updateTimeText();
  }

  private updateTimeOfDay(): void {
    if (this.timeProgress < this.DAY_START) {
      this.currentTimeOfDay = TimeOfDay.Dawn;
    } else if (this.timeProgress < this.DUSK_START) {
      this.currentTimeOfDay = TimeOfDay.Day;
    } else if (this.timeProgress < this.NIGHT_START) {
      this.currentTimeOfDay = TimeOfDay.Dusk;
    } else {
      this.currentTimeOfDay = TimeOfDay.Night;
    }
  }

  private onTimeChanged(from: TimeOfDay, to: TimeOfDay): void {
    EventBus.emit(TimeEvents.TIME_CHANGED, from, to);

    switch (to) {
      case TimeOfDay.Dawn:
        EventBus.emit(TimeEvents.DAWN);
        console.log('🌅 Dawn breaks...');
        break;
      case TimeOfDay.Day:
        EventBus.emit(TimeEvents.DAY);
        console.log('☀️ Day time');
        break;
      case TimeOfDay.Dusk:
        EventBus.emit(TimeEvents.DUSK);
        console.log('🌆 Dusk falls...');
        break;
      case TimeOfDay.Night:
        EventBus.emit(TimeEvents.NIGHT);
        console.log('🌙 Night has come...');
        break;
    }
  }

  private updateOverlay(): void {
    this.overlay.clear();

    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Get current and next phase for smooth transitions
    const skyConfig = this.getSkyConfig();

    this.overlay.fillStyle(skyConfig.color, skyConfig.alpha);
    this.overlay.fillRect(0, 0, width, height);
  }

  private getSkyConfig(): { color: number; alpha: number } {
    // Smooth transitions between phases
    let progress: number;
    let fromConfig: { color: number; alpha: number };
    let toConfig: { color: number; alpha: number };

    if (this.timeProgress < this.DAY_START) {
      // Dawn to Day transition
      progress = this.timeProgress / this.DAY_START;
      fromConfig = this.SKY_COLORS[TimeOfDay.Dawn];
      toConfig = this.SKY_COLORS[TimeOfDay.Day];
    } else if (this.timeProgress < this.DUSK_START) {
      // Full day - no transition needed
      return this.SKY_COLORS[TimeOfDay.Day];
    } else if (this.timeProgress < this.NIGHT_START) {
      // Dusk transition
      progress = (this.timeProgress - this.DUSK_START) / (this.NIGHT_START - this.DUSK_START);
      fromConfig = this.SKY_COLORS[TimeOfDay.Dusk];
      toConfig = this.SKY_COLORS[TimeOfDay.Night];
    } else if (this.timeProgress < 0.95) {
      // Full night
      return this.SKY_COLORS[TimeOfDay.Night];
    } else {
      // Night to Dawn transition
      progress = (this.timeProgress - 0.95) / 0.05;
      fromConfig = this.SKY_COLORS[TimeOfDay.Night];
      toConfig = this.SKY_COLORS[TimeOfDay.Dawn];
    }

    // Interpolate alpha
    const alpha = fromConfig.alpha + (toConfig.alpha - fromConfig.alpha) * progress;

    // For color, use the "to" color once we're past halfway
    const color = progress > 0.5 ? toConfig.color : fromConfig.color;

    return { color, alpha };
  }

  private updateTimeText(): void {
    // Convert progress to 24-hour time
    const hours = Math.floor(this.timeProgress * 24);
    const minutes = Math.floor((this.timeProgress * 24 * 60) % 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const emoji = this.getTimeEmoji();
    this.timeText.setText(`${emoji} ${timeStr}`);
  }

  private getTimeEmoji(): string {
    switch (this.currentTimeOfDay) {
      case TimeOfDay.Dawn: return '🌅';
      case TimeOfDay.Day: return '☀️';
      case TimeOfDay.Dusk: return '🌆';
      case TimeOfDay.Night: return '🌙';
    }
  }

  // Public getters
  getTimeOfDay(): TimeOfDay {
    return this.currentTimeOfDay;
  }

  getTimeProgress(): number {
    return this.timeProgress;
  }

  isNight(): boolean {
    return this.currentTimeOfDay === TimeOfDay.Night;
  }

  isDawn(): boolean {
    return this.currentTimeOfDay === TimeOfDay.Dawn;
  }

  // Get multiplier for need decay based on time
  getRestDecayMultiplier(): number {
    // Rest decays faster at night (piñatas get sleepy)
    return this.isNight() ? 1.5 : 1.0;
  }

  // For testing/debugging - set time directly
  setTimeProgress(progress: number): void {
    this.timeProgress = Math.max(0, Math.min(1, progress));
    this.updateTimeOfDay();
    this.updateOverlay();
    this.updateTimeText();
  }
}
