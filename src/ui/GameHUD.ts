import Phaser from 'phaser';
import { StatusBar } from './StatusBar';
import { ColonyPanel } from './ColonyPanel';
import { SpeciesPanel, SpeciesStatus } from './SpeciesPanel';
import { ChallengePanel } from './ChallengePanel';
import { UIColors, UIFonts, Tooltip } from './UIComponents';
import { MoodState } from '../entities/Pinata';
import { ResourceType } from '../entities/Resource';
import { ThreatLevel } from '../systems/ThreatSystem';
import { Season } from '../systems/SeasonSystem';
import { Challenge } from '../systems/ChallengeSystem';

/**
 * Master HUD controller - manages all UI panels
 */
export class GameHUD {
  private scene: Phaser.Scene;

  // Panels
  private statusBar: StatusBar;
  private colonyPanel: ColonyPanel;
  private speciesPanel: SpeciesPanel;
  private challengePanel: ChallengePanel;
  private tooltip: Tooltip;

  // Panel visibility toggles
  private panelToggles: Map<string, boolean> = new Map([
    ['colony', true],
    ['species', true],
    ['challenges', true],
  ]);

  // Toggle buttons
  private toggleButtons: Phaser.GameObjects.Container[] = [];

  // Help text at bottom
  private helpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const screenWidth = scene.cameras.main.width;
    const screenHeight = scene.cameras.main.height;

    // Create status bar (top)
    this.statusBar = new StatusBar(scene, screenWidth);

    // Create colony panel (left side)
    this.colonyPanel = new ColonyPanel(scene, 8, 40);

    // Create species panel (bottom)
    this.speciesPanel = new SpeciesPanel(scene, 8, screenHeight - 208);

    // Create challenge panel (right side)
    this.challengePanel = new ChallengePanel(scene, screenWidth - 268, 40);

    // Create tooltip
    this.tooltip = new Tooltip(scene);

    // Create help text
    this.helpText = scene.add.text(screenWidth / 2, screenHeight - 20, '', UIFonts.small);
    this.helpText.setOrigin(0.5, 1);
    this.helpText.setScrollFactor(0);
    this.helpText.setDepth(1000);
    this.setHelpText('[Z]ones [B]uild [T]erraform [C]ommand | [F]eed [P]et | [Space] Pause | [Tab] Toggle panels');

    // Create toggle buttons
    this.createToggleButtons();

    // Tab key toggles all panels
    scene.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.toggleAllPanels();
    });
  }

  private createToggleButtons(): void {
    const screenWidth = this.scene.cameras.main.width;
    let xPos = screenWidth - 100;

    const buttons = [
      { key: 'colony', icon: '📊', label: 'Colony' },
      { key: 'species', icon: '🦋', label: 'Species' },
      { key: 'challenges', icon: '🎯', label: 'Goals' },
    ];

    for (const btn of buttons) {
      const container = this.scene.add.container(xPos, 8);

      const bg = this.scene.add.graphics();
      bg.fillStyle(UIColors.panelBorder, 0.5);
      bg.fillRoundedRect(0, 0, 28, 20, 3);

      const icon = this.scene.add.text(14, 10, btn.icon, { fontSize: '12px' });
      icon.setOrigin(0.5);

      container.add([bg, icon]);
      container.setScrollFactor(0);
      container.setDepth(1001);
      container.setSize(28, 20);
      container.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.togglePanel(btn.key))
        .on('pointerover', () => this.tooltip.show(xPos, 32, btn.label))
        .on('pointerout', () => this.tooltip.hide());

      this.toggleButtons.push(container);
      xPos -= 32;
    }
  }

  private togglePanel(key: string): void {
    const current = this.panelToggles.get(key) ?? true;
    this.panelToggles.set(key, !current);
    this.updatePanelVisibility();
  }

  private toggleAllPanels(): void {
    // If any panel is visible, hide all. Otherwise show all.
    const anyVisible = Array.from(this.panelToggles.values()).some(v => v);
    for (const key of this.panelToggles.keys()) {
      this.panelToggles.set(key, !anyVisible);
    }
    this.updatePanelVisibility();
  }

  private updatePanelVisibility(): void {
    this.colonyPanel.setVisible(this.panelToggles.get('colony') ?? true);
    this.speciesPanel.setVisible(this.panelToggles.get('species') ?? true);
    this.challengePanel.setVisible(this.panelToggles.get('challenges') ?? true);
  }

  setHelpText(text: string): void {
    this.helpText.setText(text);
  }

  update(data: {
    // Status bar data
    coins: number;
    score: number;
    resources: Map<ResourceType, number>;
    population: number;
    isPaused: boolean;
    isGameOver: boolean;
    isVictory: boolean;

    // Colony panel data
    moodCounts: Map<MoodState, number>;
    storageCap: number;
    foodSecurity: number;
    season: Season;
    seasonProgress: number;
    isNight: boolean;
    threatLevel: ThreatLevel;
    activePredators: number;
    title: string;
    challengePercent: number;

    // Species panel data
    speciesStatuses: SpeciesStatus[];

    // Challenge panel data
    challenges: Challenge[];
  }): void {
    // Update status bar
    this.statusBar.update({
      coins: data.coins,
      score: data.score,
      resources: data.resources,
      population: data.population,
      isPaused: data.isPaused,
      isGameOver: data.isGameOver,
      isVictory: data.isVictory,
    });

    // Update colony panel
    this.colonyPanel.update({
      population: data.population,
      moodCounts: data.moodCounts,
      resources: data.resources,
      storageCap: data.storageCap,
      foodSecurity: data.foodSecurity,
      season: data.season,
      seasonProgress: data.seasonProgress,
      isNight: data.isNight,
      threatLevel: data.threatLevel,
      activePredators: data.activePredators,
      title: data.title,
      challengePercent: data.challengePercent,
    });

    // Update species panel
    this.speciesPanel.update(data.speciesStatuses);

    // Update challenge panel
    this.challengePanel.update(data.challenges);
  }

  // Delegate coin methods to maintain compatibility
  getCoins(): number {
    // This would need to be tracked - for now return from statusBar
    return 0; // Will be managed by GameScene
  }

  resize(width: number, height: number): void {
    this.statusBar.resize(width);
    this.speciesPanel.setPosition(8, height - 208);
    this.challengePanel.setPosition(width - 268, 40);
    this.helpText.setPosition(width / 2, height - 20);

    // Reposition toggle buttons
    let xPos = width - 100;
    for (const btn of this.toggleButtons) {
      btn.setPosition(xPos, 8);
      xPos -= 32;
    }
  }

  destroy(): void {
    this.statusBar.destroy();
    this.colonyPanel.destroy();
    this.speciesPanel.destroy();
    this.challengePanel.destroy();
    this.tooltip.destroy();
    this.helpText.destroy();
    for (const btn of this.toggleButtons) {
      btn.destroy();
    }
  }
}
