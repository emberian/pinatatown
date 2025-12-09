import Phaser from 'phaser';
import { UIPanel, UIColors, UIFonts, ProgressBar } from './UIComponents';
import { Challenge, ChallengeStatus, ChallengeCategory } from '../systems/ChallengeSystem';

/**
 * Panel showing available challenges and progress
 */
export class ChallengePanel extends UIPanel {
  private challengeRows: Phaser.GameObjects.Container[] = [];
  private scrollOffset = 0;
  private maxVisible = 6;
  private contentContainer!: Phaser.GameObjects.Container;
  private scrollIndicator!: Phaser.GameObjects.Text;

  // Category filter
  private currentCategory: ChallengeCategory | null = null;
  private categoryButtons: Map<ChallengeCategory | null, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 260, 280);
    this.createContent();
  }

  private createContent(): void {
    // Title bar
    const titleBg = this.scene.add.graphics();
    titleBg.fillStyle(UIColors.accent, 0.2);
    titleBg.fillRect(0, 0, this.panelWidth, 24);
    this.add(titleBg);

    const title = this.scene.add.text(this.padding, 4, '🎯 Challenges', {
      ...UIFonts.title,
      fontStyle: 'bold',
    });
    this.add(title);

    // Category filter buttons
    let filterX = this.padding;
    const filterY = 28;
    const categories: (ChallengeCategory | null)[] = [
      null, // All
      ChallengeCategory.Population,
      ChallengeCategory.Species,
      ChallengeCategory.Building,
      ChallengeCategory.Survival,
      ChallengeCategory.Economy,
    ];

    const categoryIcons: Record<string, string> = {
      all: '📋',
      population: '👥',
      species: '🦋',
      building: '🏠',
      survival: '⚔️',
      economy: '💰',
      social: '💕',
    };

    for (const cat of categories) {
      const key = cat ?? 'all';
      const btn = this.scene.add.container(filterX, filterY);

      const bg = this.scene.add.graphics();
      bg.fillStyle(this.currentCategory === cat ? UIColors.accent : UIColors.panelBorder, 0.5);
      bg.fillRoundedRect(0, 0, 24, 18, 3);
      btn.add(bg);

      const icon = this.scene.add.text(12, 9, categoryIcons[key], { fontSize: '10px' });
      icon.setOrigin(0.5);
      btn.add(icon);

      // Make interactive
      btn.setSize(24, 18);
      btn.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setCategory(cat));

      this.add(btn);
      this.categoryButtons.set(cat, btn);
      filterX += 28;
    }

    // Content container for scrolling
    this.contentContainer = this.scene.add.container(0, 52);
    this.add(this.contentContainer);

    // Scroll indicator
    this.scrollIndicator = this.scene.add.text(
      this.panelWidth - this.padding,
      this.panelHeight - 16,
      '',
      UIFonts.small
    );
    this.scrollIndicator.setOrigin(1, 0);
    this.add(this.scrollIndicator);

    // Mouse wheel scrolling
    this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _dx: number, dy: number) => {
      if (this.isVisible()) {
        if (dy > 0) this.scroll(1);
        else if (dy < 0) this.scroll(-1);
      }
    });
  }

  private setCategory(category: ChallengeCategory | null): void {
    this.currentCategory = category;
    this.scrollOffset = 0;

    // Update button visuals
    for (const [cat, btn] of this.categoryButtons) {
      const bg = btn.getAt(0) as Phaser.GameObjects.Graphics;
      bg.clear();
      bg.fillStyle(this.currentCategory === cat ? UIColors.accent : UIColors.panelBorder, 0.5);
      bg.fillRoundedRect(0, 0, 24, 18, 3);
    }
  }

  private scroll(direction: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset + direction);
  }

  update(challenges: Challenge[]): void {
    // Clear existing rows
    this.contentContainer.removeAll(true);
    this.challengeRows = [];

    // Filter by category
    let filtered = challenges.filter(c => c.status !== ChallengeStatus.Locked);
    if (this.currentCategory) {
      filtered = filtered.filter(c => c.category === this.currentCategory);
    }

    // Sort: in-progress first, then completed
    filtered.sort((a, b) => {
      if (a.status === ChallengeStatus.Completed && b.status !== ChallengeStatus.Completed) return 1;
      if (a.status !== ChallengeStatus.Completed && b.status === ChallengeStatus.Completed) return -1;
      return 0;
    });

    // Clamp scroll offset
    const maxScroll = Math.max(0, filtered.length - this.maxVisible);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);

    // Create visible rows
    const visibleChallenges = filtered.slice(this.scrollOffset, this.scrollOffset + this.maxVisible);
    let yPos = 0;

    for (const challenge of visibleChallenges) {
      const row = this.createChallengeRow(challenge, yPos);
      this.contentContainer.add(row);
      this.challengeRows.push(row);
      yPos += 36;
    }

    // Update scroll indicator
    if (filtered.length > this.maxVisible) {
      this.scrollIndicator.setText(`▲▼ ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + this.maxVisible, filtered.length)}/${filtered.length}`);
    } else {
      this.scrollIndicator.setText(`${filtered.length} challenges`);
    }
  }

  private createChallengeRow(challenge: Challenge, y: number): Phaser.GameObjects.Container {
    const row = this.scene.add.container(this.padding, y);

    // Icon
    const icon = this.scene.add.text(0, 0, challenge.icon, { fontSize: '16px' });
    row.add(icon);

    // Name
    const name = this.scene.add.text(24, 0, challenge.name, UIFonts.value);
    if (challenge.status === ChallengeStatus.Completed) {
      name.setTint(UIColors.success);
    }
    row.add(name);

    // Status/Progress
    if (challenge.status === ChallengeStatus.Completed) {
      const checkmark = this.scene.add.text(this.panelWidth - this.padding * 2 - 20, 0, '✓', {
        ...UIFonts.value,
        color: '#4ade80',
      });
      row.add(checkmark);
    } else {
      // Progress bar
      const bar = new ProgressBar(
        this.scene,
        24,
        18,
        this.panelWidth - this.padding * 2 - 60,
        6,
        UIColors.info
      );
      bar.setProgress(challenge.progress, challenge.target);
      row.add(bar);

      // Progress text
      const progressText = this.scene.add.text(
        this.panelWidth - this.padding * 2 - 30,
        14,
        `${challenge.progress}/${challenge.target}`,
        UIFonts.small
      );
      row.add(progressText);
    }

    // Reward indicator
    if (challenge.reward.coins && challenge.status !== ChallengeStatus.Completed) {
      const reward = this.scene.add.text(
        this.panelWidth - this.padding * 2,
        0,
        `+${challenge.reward.coins}`,
        { ...UIFonts.small, color: '#ffd700' }
      );
      reward.setOrigin(1, 0);
      row.add(reward);
    }

    return row;
  }

  isVisible(): boolean {
    return this.visible && this.alpha > 0;
  }
}
