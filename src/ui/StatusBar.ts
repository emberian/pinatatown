import Phaser from 'phaser';
import { UIColors, UIFonts } from './UIComponents';
import { ResourceType } from '../entities/Resource';

/**
 * Top status bar showing coins, resources, and key stats
 */
export class StatusBar extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private barWidth: number;
  private barHeight = 32;

  // Display elements
  private coinIcon!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private scoreIcon!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  private resourceDisplays: Map<ResourceType, {
    icon: Phaser.GameObjects.Text;
    text: Phaser.GameObjects.Text;
  }> = new Map();

  private populationIcon!: Phaser.GameObjects.Text;
  private populationText!: Phaser.GameObjects.Text;

  private pauseIndicator!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, width: number) {
    super(scene, 0, 0);
    this.barWidth = width;

    // Background
    this.bg = scene.add.graphics();
    this.bg.fillStyle(UIColors.panelBg, 0.95);
    this.bg.fillRect(0, 0, this.barWidth, this.barHeight);
    this.bg.lineStyle(1, UIColors.panelBorder);
    this.bg.lineBetween(0, this.barHeight, this.barWidth, this.barHeight);
    this.add(this.bg);

    this.createContent();

    // Fixed on screen
    this.setScrollFactor(0);
    this.setDepth(1000);

    scene.add.existing(this);
  }

  private createContent(): void {
    let xPos = 12;

    // Coins
    this.coinIcon = this.scene.add.text(xPos, 8, '🍬', { fontSize: '14px' });
    this.add(this.coinIcon);
    xPos += 20;

    this.coinText = this.scene.add.text(xPos, 10, '50', {
      ...UIFonts.value,
      fontStyle: 'bold',
    });
    this.add(this.coinText);
    xPos += 50;

    // Divider
    this.addDivider(xPos);
    xPos += 12;

    // Score
    this.scoreIcon = this.scene.add.text(xPos, 8, '⭐', { fontSize: '14px' });
    this.add(this.scoreIcon);
    xPos += 20;

    this.scoreText = this.scene.add.text(xPos, 10, '0', UIFonts.value);
    this.add(this.scoreText);
    xPos += 60;

    // Divider
    this.addDivider(xPos);
    xPos += 12;

    // Resources
    const resourceData: { type: ResourceType; icon: string }[] = [
      { type: ResourceType.Berry, icon: '🍓' },
      { type: ResourceType.Seed, icon: '🌱' },
      { type: ResourceType.Honey, icon: '🍯' },
    ];

    for (const { type, icon } of resourceData) {
      const iconText = this.scene.add.text(xPos, 8, icon, { fontSize: '14px' });
      this.add(iconText);
      xPos += 18;

      const text = this.scene.add.text(xPos, 10, '0', UIFonts.value);
      this.add(text);
      xPos += 35;

      this.resourceDisplays.set(type, { icon: iconText, text });
    }

    // Divider
    this.addDivider(xPos);
    xPos += 12;

    // Population
    this.populationIcon = this.scene.add.text(xPos, 8, '👥', { fontSize: '14px' });
    this.add(this.populationIcon);
    xPos += 20;

    this.populationText = this.scene.add.text(xPos, 10, '0', UIFonts.value);
    this.add(this.populationText);

    // Pause indicator (right side)
    this.pauseIndicator = this.scene.add.text(this.barWidth - 12, 8, '', {
      ...UIFonts.value,
      color: '#fbbf24',
    });
    this.pauseIndicator.setOrigin(1, 0);
    this.add(this.pauseIndicator);
  }

  private addDivider(x: number): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, UIColors.panelBorder);
    divider.lineBetween(x, 6, x, this.barHeight - 6);
    this.add(divider);
  }

  update(data: {
    coins: number;
    score: number;
    resources: Map<ResourceType, number>;
    population: number;
    isPaused: boolean;
    isGameOver: boolean;
    isVictory: boolean;
  }): void {
    this.coinText.setText(data.coins.toString());
    this.scoreText.setText(data.score.toString());

    for (const [type, display] of this.resourceDisplays) {
      const count = data.resources.get(type) ?? 0;
      display.text.setText(count.toString());
    }

    this.populationText.setText(data.population.toString());

    // Status indicator
    if (data.isGameOver) {
      this.pauseIndicator.setText('💀 GAME OVER');
      this.pauseIndicator.setTint(UIColors.danger);
    } else if (data.isVictory) {
      this.pauseIndicator.setText('🏆 VICTORY!');
      this.pauseIndicator.setTint(UIColors.accent);
    } else if (data.isPaused) {
      this.pauseIndicator.setText('⏸️ PAUSED');
      this.pauseIndicator.clearTint();
    } else {
      this.pauseIndicator.setText('');
    }

    // Highlight low resources
    for (const [type, display] of this.resourceDisplays) {
      const count = data.resources.get(type) ?? 0;
      if (count === 0) {
        display.text.setTint(UIColors.danger);
      } else if (count < 5) {
        display.text.setTint(UIColors.warning);
      } else {
        display.text.clearTint();
      }
    }
  }

  resize(width: number): void {
    this.barWidth = width;
    this.bg.clear();
    this.bg.fillStyle(UIColors.panelBg, 0.95);
    this.bg.fillRect(0, 0, this.barWidth, this.barHeight);
    this.bg.lineStyle(1, UIColors.panelBorder);
    this.bg.lineBetween(0, this.barHeight, this.barWidth, this.barHeight);

    this.pauseIndicator.x = this.barWidth - 12;
  }
}
