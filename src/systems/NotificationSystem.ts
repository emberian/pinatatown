import Phaser from 'phaser';
import { EventBus, GameEvents } from '../utils/EventBus';
import { SeasonEvents } from './SeasonSystem';
import { FarmingEvents } from './FarmingSystem';

/**
 * Notification system provides feedback to the player about what's happening.
 * Shows floating notifications and maintains an event log.
 */

export enum NotificationType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Danger = 'danger',
  Special = 'special',
}

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  icon: string;
  timestamp: number;
  worldPosition?: { x: number; y: number }; // Optional world position to show indicator
}

const TYPE_COLORS: Record<NotificationType, { bg: string; text: string }> = {
  [NotificationType.Info]: { bg: '#333333', text: '#ffffff' },
  [NotificationType.Success]: { bg: '#228B22', text: '#ffffff' },
  [NotificationType.Warning]: { bg: '#CC7000', text: '#ffffff' },
  [NotificationType.Danger]: { bg: '#8B0000', text: '#ffffff' },
  [NotificationType.Special]: { bg: '#6B2FB3', text: '#ffffff' },
};

let notificationIdCounter = 0;

export class NotificationSystem {
  private scene: Phaser.Scene;
  private notifications: Notification[] = [];
  private maxLogSize = 50;

  // UI elements
  private notificationContainer: Phaser.GameObjects.Container;
  private logContainer: Phaser.GameObjects.Container;
  private logBackground: Phaser.GameObjects.Graphics;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private logVisible = false;

  // Position for floating notifications
  private nextNotificationY = 150;
  private readonly NOTIFICATION_SPACING = 45;
  private readonly NOTIFICATION_DURATION = 4000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Container for floating notifications (top right)
    this.notificationContainer = scene.add.container(
      scene.cameras.main.width - 20,
      100
    );
    this.notificationContainer.setScrollFactor(0);
    this.notificationContainer.setDepth(1500);

    // Container for log panel (toggleable)
    this.logContainer = scene.add.container(10, scene.cameras.main.height - 200);
    this.logContainer.setScrollFactor(0);
    this.logContainer.setDepth(1500);
    this.logContainer.setVisible(false);

    this.logBackground = scene.add.graphics();
    this.logBackground.fillStyle(0x000000, 0.85);
    this.logBackground.fillRoundedRect(0, 0, 350, 190, 8);
    this.logContainer.add(this.logBackground);

    const logTitle = scene.add.text(10, 5, '📜 Event Log [L to toggle]', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.logContainer.add(logTitle);

    // Setup event listeners
    this.setupEventListeners();

    // Toggle log with L key
    scene.input.keyboard!.addKey('L').on('down', () => {
      this.toggleLog();
    });

    // Show log by default
    this.logVisible = true;
    this.logContainer.setVisible(true);
  }

  private setupEventListeners(): void {
    // Piñata events
    EventBus.on(GameEvents.PINATA_BORN, (...args: unknown[]) => {
      const [baby] = args as [{ nickname: string }, { nickname: string }, { nickname: string }];
      this.notify(
        NotificationType.Special,
        `${baby.nickname} was born!`,
        '👶'
      );
    });

    EventBus.on(GameEvents.PINATA_DIED, (...args: unknown[]) => {
      const [pinata, attacker] = args as [{ nickname: string }, { nickname: string }];
      this.notify(
        NotificationType.Danger,
        `${pinata.nickname} was caught by ${attacker.nickname}!`,
        '💀'
      );
    });

    EventBus.on(GameEvents.PINATA_MOOD_CHANGED, (...args: unknown[]) => {
      const [pinata, mood] = args as [{ nickname: string }, string];
      if (mood === 'breaking') {
        this.notify(
          NotificationType.Warning,
          `${pinata.nickname} is having a mental break!`,
          '😢'
        );
      }
    });

    EventBus.on(GameEvents.PINATA_DEFENDED, (...args: unknown[]) => {
      const [defender, attacker] = args as [{ nickname: string }, { nickname: string }];
      this.notify(
        NotificationType.Success,
        `${defender.nickname} drove off ${attacker.nickname}!`,
        '🛡️'
      );
    });

    EventBus.on(GameEvents.SPECIES_ATTRACTED, (...args: unknown[]) => {
      const [, pinata] = args as [string, { nickname: string }];
      this.notify(
        NotificationType.Special,
        `${pinata.nickname} decided to stay!`,
        '🎉'
      );
    });

    EventBus.on(GameEvents.SOUR_PINATA_SPAWNED, (...args: unknown[]) => {
      const [pinata] = args as [{ nickname: string; speciesData: { name: string } }];
      this.notify(
        NotificationType.Danger,
        `A sour ${pinata.speciesData.name} appeared!`,
        '😈'
      );
    });

    EventBus.on(GameEvents.SOUR_PINATA_CURED, (...args: unknown[]) => {
      const [pinata] = args as [{ nickname: string }];
      this.notify(
        NotificationType.Success,
        `${pinata.nickname} was cured!`,
        '💚'
      );
    });

    // Season events
    EventBus.on(SeasonEvents.SEASON_CHANGED, (...args: unknown[]) => {
      const [, newSeason] = args as [string, string];
      const icons: Record<string, string> = {
        spring: '🌸',
        summer: '☀️',
        autumn: '🍂',
        winter: '❄️',
      };
      this.notify(
        NotificationType.Info,
        `${newSeason.charAt(0).toUpperCase() + newSeason.slice(1)} has arrived`,
        icons[newSeason] ?? '📅'
      );
    });

    // Farming events
    EventBus.on(FarmingEvents.CROP_READY, (...args: unknown[]) => {
      const [crop] = args as [{ type: string }];
      this.notify(
        NotificationType.Success,
        `${crop.type} is ready to harvest!`,
        '🌾'
      );
    });

    EventBus.on(FarmingEvents.CROP_WITHERED, () => {
      this.notify(
        NotificationType.Warning,
        'A crop has withered!',
        '🥀'
      );
    });

    // Building events
    EventBus.on(GameEvents.BUILDING_COMPLETE, (...args: unknown[]) => {
      const [building] = args as [{ data: { name: string; icon: string } }];
      this.notify(
        NotificationType.Success,
        `${building.data.name} completed!`,
        building.data.icon
      );
    });

    // Random events
    EventBus.on(GameEvents.RANDOM_EVENT_STARTED, (...args: unknown[]) => {
      const [event] = args as [{ name: string; isPositive: boolean }];
      this.notify(
        event.isPositive ? NotificationType.Special : NotificationType.Warning,
        `Event: ${event.name}`,
        event.isPositive ? '✨' : '⚠️'
      );
    });

    // Resource events
    EventBus.on(GameEvents.RESOURCE_COLLECTED, (...args: unknown[]) => {
      const [pinata, resource] = args as [{ nickname: string }, { resourceType: string }];
      this.addToLog(
        NotificationType.Info,
        `${pinata.nickname} stored ${resource.resourceType}`,
        '📦'
      );
    });
  }

  notify(
    type: NotificationType,
    message: string,
    icon: string,
    worldPosition?: { x: number; y: number }
  ): void {
    const notification: Notification = {
      id: notificationIdCounter++,
      type,
      message,
      icon,
      timestamp: Date.now(),
      worldPosition,
    };

    this.notifications.push(notification);
    if (this.notifications.length > this.maxLogSize) {
      this.notifications.shift();
    }

    this.showFloatingNotification(notification);
    this.updateLog();
  }

  // Add to log without floating notification
  private addToLog(type: NotificationType, message: string, icon: string): void {
    const notification: Notification = {
      id: notificationIdCounter++,
      type,
      message,
      icon,
      timestamp: Date.now(),
    };

    this.notifications.push(notification);
    if (this.notifications.length > this.maxLogSize) {
      this.notifications.shift();
    }

    this.updateLog();
  }

  private showFloatingNotification(notification: Notification): void {
    const colors = TYPE_COLORS[notification.type];

    const container = this.scene.add.container(0, this.nextNotificationY);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(parseInt(colors.bg.slice(1), 16), 0.9);
    bg.fillRoundedRect(-280, 0, 280, 35, 6);
    container.add(bg);

    // Icon
    const iconText = this.scene.add.text(-265, 8, notification.icon, {
      fontSize: '16px',
    });
    container.add(iconText);

    // Message
    const msgText = this.scene.add.text(-240, 8, notification.message, {
      fontSize: '13px',
      color: colors.text,
      wordWrap: { width: 220 },
    });
    container.add(msgText);

    this.notificationContainer.add(container);

    // Animate in
    container.setAlpha(0);
    container.x = 50;

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      x: 0,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Animate out after duration
    this.scene.time.delayedCall(this.NOTIFICATION_DURATION, () => {
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        x: 50,
        duration: 300,
        onComplete: () => {
          container.destroy();
          this.repositionNotifications();
        },
      });
    });

    // Update next position
    this.nextNotificationY += this.NOTIFICATION_SPACING;

    // Reset position if too many
    if (this.nextNotificationY > 400) {
      this.nextNotificationY = 150;
    }
  }

  private repositionNotifications(): void {
    // Reposition remaining notifications
    let y = 150;
    this.notificationContainer.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Container) {
        this.scene.tweens.add({
          targets: child,
          y,
          duration: 200,
          ease: 'Power2',
        });
        y += this.NOTIFICATION_SPACING;
      }
    });
    this.nextNotificationY = y;
  }

  private updateLog(): void {
    // Clear existing log texts
    this.logTexts.forEach(t => t.destroy());
    this.logTexts = [];

    // Show last 8 notifications
    const recent = this.notifications.slice(-8).reverse();

    recent.forEach((notification, index) => {
      const colors = TYPE_COLORS[notification.type];
      const time = new Date(notification.timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

      const text = this.scene.add.text(
        10,
        28 + index * 20,
        `${notification.icon} [${timeStr}] ${notification.message}`,
        {
          fontSize: '11px',
          color: colors.text,
          wordWrap: { width: 330 },
        }
      );
      this.logContainer.add(text);
      this.logTexts.push(text);
    });
  }

  toggleLog(): void {
    this.logVisible = !this.logVisible;
    this.logContainer.setVisible(this.logVisible);
  }

  getRecentNotifications(count: number = 10): Notification[] {
    return this.notifications.slice(-count);
  }

  // Quick notification helpers
  info(message: string, icon: string = 'ℹ️'): void {
    this.notify(NotificationType.Info, message, icon);
  }

  success(message: string, icon: string = '✅'): void {
    this.notify(NotificationType.Success, message, icon);
  }

  warning(message: string, icon: string = '⚠️'): void {
    this.notify(NotificationType.Warning, message, icon);
  }

  danger(message: string, icon: string = '🚨'): void {
    this.notify(NotificationType.Danger, message, icon);
  }

  special(message: string, icon: string = '✨'): void {
    this.notify(NotificationType.Special, message, icon);
  }
}
