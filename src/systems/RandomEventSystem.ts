import Phaser from 'phaser';
import { Pinata } from '../entities/Pinata';
import { EventBus, GameEvents } from '../utils/EventBus';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { IsoMap } from '../world/IsoMap';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../utils/Constants';

export enum RandomEventType {
  Storm = 'storm',
  BerryBoom = 'berryBoom',
  Thief = 'thief',
  SunnyDay = 'sunnyDay',
  Plague = 'plague',
  Blessing = 'blessing',
}

export interface RandomEvent {
  type: RandomEventType;
  name: string;
  description: string;
  duration: number;
  isPositive: boolean;
}

const EVENT_DEFINITIONS: Record<RandomEventType, Omit<RandomEvent, 'duration'>> = {
  [RandomEventType.Storm]: {
    type: RandomEventType.Storm,
    name: 'Storm',
    description: 'Dark clouds gather... All piñatas feel gloomy.',
    isPositive: false,
  },
  [RandomEventType.BerryBoom]: {
    type: RandomEventType.BerryBoom,
    name: 'Berry Boom',
    description: 'Wild berries are growing everywhere!',
    isPositive: true,
  },
  [RandomEventType.Thief]: {
    type: RandomEventType.Thief,
    name: 'Thief in the Night',
    description: 'Something stole from your stockpile!',
    isPositive: false,
  },
  [RandomEventType.SunnyDay]: {
    type: RandomEventType.SunnyDay,
    name: 'Perfect Day',
    description: 'What a beautiful day! Everyone feels great!',
    isPositive: true,
  },
  [RandomEventType.Plague]: {
    type: RandomEventType.Plague,
    name: 'Sickness',
    description: 'A strange illness is going around...',
    isPositive: false,
  },
  [RandomEventType.Blessing]: {
    type: RandomEventType.Blessing,
    name: 'Lucky Stars',
    description: 'The stars align! Production is boosted!',
    isPositive: true,
  },
};

/**
 * Manages random events that affect the garden
 */
export class RandomEventSystem {
  private scene: Phaser.Scene;
  private isoMap: IsoMap;
  private resourceManager: ResourceManager;
  private pinatas: Pinata[];

  private eventTimer = 0;
  private readonly EVENT_CHECK_INTERVAL = 30000; // Check every 30 seconds
  private readonly EVENT_CHANCE = 0.25; // 25% chance per check

  private activeEvent: RandomEvent | null = null;
  private activeEventTimer = 0;

  private eventOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    isoMap: IsoMap,
    resourceManager: ResourceManager,
    pinatas: Pinata[]
  ) {
    this.scene = scene;
    this.isoMap = isoMap;
    this.resourceManager = resourceManager;
    this.pinatas = pinatas;
  }

  update(delta: number): void {
    // Update active event
    if (this.activeEvent) {
      this.activeEventTimer += delta;

      // Apply ongoing effects
      this.applyEventEffects(delta);

      if (this.activeEventTimer >= this.activeEvent.duration) {
        this.endEvent();
      }
    }

    // Check for new events
    this.eventTimer += delta;
    if (this.eventTimer >= this.EVENT_CHECK_INTERVAL && !this.activeEvent) {
      this.eventTimer = 0;

      if (Math.random() < this.EVENT_CHANCE) {
        this.triggerRandomEvent();
      }
    }
  }

  private triggerRandomEvent(): void {
    // Pick random event type
    const eventTypes = Object.values(RandomEventType);
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const definition = EVENT_DEFINITIONS[type];
    const event: RandomEvent = {
      ...definition,
      duration: 15000 + Math.random() * 15000, // 15-30 seconds
    };

    this.activeEvent = event;
    this.activeEventTimer = 0;

    // Execute immediate effects
    this.executeEventStart(event);

    // Show notification
    this.showEventNotification(event);

    console.log(`Random event: ${event.name} - ${event.description}`);
    EventBus.emit(GameEvents.RANDOM_EVENT_STARTED, event);
  }

  private executeEventStart(event: RandomEvent): void {
    switch (event.type) {
      case RandomEventType.BerryBoom:
        // Spawn lots of berries
        for (let i = 0; i < 10; i++) {
          let x: number, y: number;
          let attempts = 0;
          do {
            x = Math.floor(Math.random() * WORLD_WIDTH);
            y = Math.floor(Math.random() * WORLD_HEIGHT);
            attempts++;
          } while (!this.isoMap.isWalkable(x, y) && attempts < 50);

          if (attempts < 50) {
            this.resourceManager.spawnResource(x, y, ResourceType.Berry);
          }
        }
        break;

      case RandomEventType.Thief:
        // Steal some resources
        const stealCount = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < stealCount; i++) {
          this.resourceManager.takeFromStockpile(ResourceType.Berry) ||
            this.resourceManager.takeFromStockpile(ResourceType.Seed);
        }
        break;

      case RandomEventType.Storm:
        // Create visual overlay
        this.createStormOverlay();
        break;

      case RandomEventType.SunnyDay:
        // Immediate mood boost
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            pinata.play(15);
            pinata.restoreRest(10);
          }
        }
        break;

      case RandomEventType.Blessing:
        // Feed everyone a bit
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            pinata.feed(20);
          }
        }
        break;

      default:
        break;
    }
  }

  private applyEventEffects(delta: number): void {
    if (!this.activeEvent) return;

    switch (this.activeEvent.type) {
      case RandomEventType.Storm:
        // Ongoing mood drain
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            pinata.play(-0.5 * (delta / 1000));
          }
        }
        break;

      case RandomEventType.SunnyDay:
        // Ongoing mood boost (slower)
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            pinata.play(0.3 * (delta / 1000));
          }
        }
        break;

      case RandomEventType.Plague:
        // Ongoing tiredness
        for (const pinata of this.pinatas) {
          if (pinata.getIsAlive()) {
            pinata.restoreRest(-0.3 * (delta / 1000));
          }
        }
        break;

      default:
        break;
    }
  }

  private createStormOverlay(): void {
    this.eventOverlay = this.scene.add.graphics();
    this.eventOverlay.fillStyle(0x333366, 0.3);
    this.eventOverlay.fillRect(
      -this.scene.cameras.main.width,
      -this.scene.cameras.main.height,
      this.scene.cameras.main.width * 3,
      this.scene.cameras.main.height * 3
    );
    this.eventOverlay.setDepth(500);
  }

  private endEvent(): void {
    if (!this.activeEvent) return;

    // Clean up visual effects
    if (this.eventOverlay) {
      this.eventOverlay.destroy();
      this.eventOverlay = null;
    }

    // Show end notification
    const endText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      150,
      `${this.activeEvent.name} has ended.`,
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 15, y: 8 },
      }
    );
    endText.setOrigin(0.5);
    endText.setScrollFactor(0);
    endText.setDepth(2000);

    this.scene.tweens.add({
      targets: endText,
      y: 100,
      alpha: 0,
      duration: 2000,
      onComplete: () => endText.destroy(),
    });

    console.log(`Event ended: ${this.activeEvent.name}`);
    EventBus.emit(GameEvents.RANDOM_EVENT_ENDED, this.activeEvent);

    this.activeEvent = null;
    this.activeEventTimer = 0;
  }

  private showEventNotification(event: RandomEvent): void {
    const bgColor = event.isPositive ? '#228b22' : '#8b0000';

    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `${event.isPositive ? '✨' : '⚠️'} ${event.name}\n${event.description}`,
      {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: bgColor,
        padding: { x: 20, y: 15 },
        align: 'center',
      }
    );
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(2000);

    this.scene.tweens.add({
      targets: text,
      y: 50,
      alpha: 0,
      delay: 3000,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  getActiveEvent(): RandomEvent | null {
    return this.activeEvent;
  }

  getEventTimeRemaining(): number {
    if (!this.activeEvent) return 0;
    return Math.max(0, this.activeEvent.duration - this.activeEventTimer);
  }

  isEventActive(): boolean {
    return this.activeEvent !== null;
  }
}
