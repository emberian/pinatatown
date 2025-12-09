import Phaser from 'phaser';
import { UIPanel, UIColors, UIFonts, ProgressBar, SectionHeader } from './UIComponents';
import { MoodState } from '../entities/Pinata';
import { ResourceType } from '../entities/Resource';
import { ThreatLevel } from '../systems/ThreatSystem';
import { Season } from '../systems/SeasonSystem';

/**
 * Colony dashboard panel - shows population, mood, resources, and status
 */
export class ColonyPanel extends UIPanel {
  // Population section
  private populationText!: Phaser.GameObjects.Text;
  private moodBars!: Map<MoodState, { bar: ProgressBar; label: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }>;

  // Resources section
  private resourceDisplays!: Map<ResourceType, { icon: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text; bar: ProgressBar }>;
  private foodSecurityBar!: ProgressBar;
  private foodSecurityText!: Phaser.GameObjects.Text;

  // Status section
  private seasonIcon!: Phaser.GameObjects.Text;
  private seasonText!: Phaser.GameObjects.Text;
  private seasonBar!: ProgressBar;
  private threatIcon!: Phaser.GameObjects.Text;
  private threatText!: Phaser.GameObjects.Text;
  private dayNightIcon!: Phaser.GameObjects.Text;

  // Title section
  private titleText!: Phaser.GameObjects.Text;
  private challengeText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 180, 380);
    this.createContent();
  }

  private createContent(): void {
    let yPos = this.padding;

    // Title bar
    const titleBg = this.scene.add.graphics();
    titleBg.fillStyle(UIColors.accent, 0.2);
    titleBg.fillRect(0, 0, this.panelWidth, 24);
    this.add(titleBg);

    this.titleText = this.scene.add.text(this.padding, 4, '🏠 Newcomer', {
      ...UIFonts.title,
      fontStyle: 'bold',
    });
    this.add(this.titleText);

    this.challengeText = this.scene.add.text(this.panelWidth - this.padding, 6, '0%', UIFonts.small);
    this.challengeText.setOrigin(1, 0);
    this.add(this.challengeText);

    yPos = 32;

    // Population section
    const popHeader = new SectionHeader(this.scene, this.padding, yPos, 'POPULATION', this.panelWidth - this.padding * 2);
    this.add(popHeader);
    yPos += 18;

    this.populationText = this.scene.add.text(this.padding, yPos, '0 piñatas', UIFonts.value);
    this.add(this.populationText);
    yPos += 20;

    // Mood breakdown
    this.moodBars = new Map();
    const moodData: { mood: MoodState; icon: string; color: number }[] = [
      { mood: MoodState.Happy, icon: '😊', color: UIColors.moodHappy },
      { mood: MoodState.Content, icon: '😐', color: UIColors.moodContent },
      { mood: MoodState.Stressed, icon: '😰', color: UIColors.moodStressed },
      { mood: MoodState.Breaking, icon: '😱', color: UIColors.moodBreaking },
    ];

    for (const { mood, icon, color } of moodData) {
      const label = this.scene.add.text(this.padding, yPos, icon, { fontSize: '11px' });
      const bar = new ProgressBar(this.scene, this.padding + 20, yPos + 2, 100, 8, color);
      const count = this.scene.add.text(this.padding + 125, yPos, '0', UIFonts.small);

      this.add(label);
      this.add(bar);
      this.add(count);
      this.moodBars.set(mood, { bar, label, count });
      yPos += 14;
    }

    yPos += 8;

    // Resources section
    const resHeader = new SectionHeader(this.scene, this.padding, yPos, 'STOCKPILE', this.panelWidth - this.padding * 2);
    this.add(resHeader);
    yPos += 18;

    this.resourceDisplays = new Map();
    const resourceData: { type: ResourceType; icon: string; color: number }[] = [
      { type: ResourceType.Berry, icon: '🍓', color: UIColors.berry },
      { type: ResourceType.Seed, icon: '🌱', color: UIColors.seed },
      { type: ResourceType.Honey, icon: '🍯', color: UIColors.honey },
    ];

    for (const { type, icon, color } of resourceData) {
      const iconText = this.scene.add.text(this.padding, yPos, icon, { fontSize: '12px' });
      const bar = new ProgressBar(this.scene, this.padding + 22, yPos + 2, 90, 8, color);
      const count = this.scene.add.text(this.padding + 118, yPos, '0', UIFonts.small);

      this.add(iconText);
      this.add(bar);
      this.add(count);
      this.resourceDisplays.set(type, { icon: iconText, count, bar });
      yPos += 14;
    }

    yPos += 4;

    // Food security bar
    const secLabel = this.scene.add.text(this.padding, yPos, 'Food Security:', UIFonts.small);
    this.add(secLabel);
    yPos += 14;

    this.foodSecurityBar = new ProgressBar(this.scene, this.padding, yPos, this.panelWidth - this.padding * 2, 10, UIColors.success);
    this.add(this.foodSecurityBar);
    this.foodSecurityText = this.scene.add.text(this.panelWidth - this.padding, yPos - 2, '0%', UIFonts.small);
    this.foodSecurityText.setOrigin(1, 0);
    this.add(this.foodSecurityText);

    yPos += 20;

    // Status section
    const statusHeader = new SectionHeader(this.scene, this.padding, yPos, 'STATUS', this.panelWidth - this.padding * 2);
    this.add(statusHeader);
    yPos += 18;

    // Season
    this.seasonIcon = this.scene.add.text(this.padding, yPos, '🌸', { fontSize: '14px' });
    this.seasonText = this.scene.add.text(this.padding + 22, yPos + 2, 'Spring', UIFonts.value);
    this.add(this.seasonIcon);
    this.add(this.seasonText);
    yPos += 18;

    this.seasonBar = new ProgressBar(this.scene, this.padding, yPos, this.panelWidth - this.padding * 2, 6, UIColors.info);
    this.add(this.seasonBar);
    yPos += 14;

    // Day/Night
    this.dayNightIcon = this.scene.add.text(this.padding, yPos, '☀️ Day', UIFonts.value);
    this.add(this.dayNightIcon);
    yPos += 18;

    // Threat level
    this.threatIcon = this.scene.add.text(this.padding, yPos, '🛡️', { fontSize: '14px' });
    this.threatText = this.scene.add.text(this.padding + 22, yPos + 2, 'Safe', UIFonts.value);
    this.add(this.threatIcon);
    this.add(this.threatText);
  }

  update(data: {
    population: number;
    moodCounts: Map<MoodState, number>;
    resources: Map<ResourceType, number>;
    storageCap: number;
    foodSecurity: number;
    season: Season;
    seasonProgress: number;
    isNight: boolean;
    threatLevel: ThreatLevel;
    activePredators: number;
    title: string;
    challengePercent: number;
  }): void {
    // Title
    this.titleText.setText(`🏠 ${data.title}`);
    this.challengeText.setText(`${data.challengePercent}%`);

    // Population
    this.populationText.setText(`${data.population} piñatas`);

    // Mood bars
    const total = data.population || 1;
    for (const [mood, display] of this.moodBars) {
      const count = data.moodCounts.get(mood) ?? 0;
      display.bar.setProgress(count, total);
      display.count.setText(count.toString());
    }

    // Resources
    for (const [type, display] of this.resourceDisplays) {
      const count = data.resources.get(type) ?? 0;
      display.count.setText(count.toString());
      display.bar.setProgress(count, Math.max(50, data.storageCap / 3));
    }

    // Food security
    this.foodSecurityBar.setProgress(data.foodSecurity, 100);
    this.foodSecurityText.setText(`${Math.round(data.foodSecurity)}%`);

    // Color based on security level
    if (data.foodSecurity < 25) {
      this.foodSecurityBar.setColor(UIColors.danger);
    } else if (data.foodSecurity < 50) {
      this.foodSecurityBar.setColor(UIColors.warning);
    } else {
      this.foodSecurityBar.setColor(UIColors.success);
    }

    // Season
    const seasonIcons: Record<Season, string> = {
      [Season.Spring]: '🌸',
      [Season.Summer]: '☀️',
      [Season.Autumn]: '🍂',
      [Season.Winter]: '❄️',
    };
    this.seasonIcon.setText(seasonIcons[data.season]);
    this.seasonText.setText(data.season.charAt(0).toUpperCase() + data.season.slice(1));
    this.seasonBar.setProgress(data.seasonProgress, 100);

    // Day/Night
    this.dayNightIcon.setText(data.isNight ? '🌙 Night' : '☀️ Day');
    if (data.isNight) {
      this.dayNightIcon.setTint(0x8888ff);
    } else {
      this.dayNightIcon.clearTint();
    }

    // Threat
    const threatIcons: Record<ThreatLevel, string> = {
      [ThreatLevel.None]: '🛡️',
      [ThreatLevel.Low]: '⚠️',
      [ThreatLevel.Medium]: '⚠️',
      [ThreatLevel.High]: '🔥',
      [ThreatLevel.Siege]: '☠️',
    };
    const threatLabels: Record<ThreatLevel, string> = {
      [ThreatLevel.None]: 'Safe',
      [ThreatLevel.Low]: 'Low Threat',
      [ThreatLevel.Medium]: 'Medium',
      [ThreatLevel.High]: 'High!',
      [ThreatLevel.Siege]: 'SIEGE!',
    };
    this.threatIcon.setText(threatIcons[data.threatLevel]);
    let threatText = threatLabels[data.threatLevel];
    if (data.activePredators > 0) {
      threatText += ` (${data.activePredators})`;
    }
    this.threatText.setText(threatText);

    // Threat text color
    if (data.threatLevel === ThreatLevel.High || data.threatLevel === ThreatLevel.Siege) {
      this.threatText.setTint(UIColors.danger);
    } else if (data.threatLevel === ThreatLevel.Medium) {
      this.threatText.setTint(UIColors.warning);
    } else {
      this.threatText.clearTint();
    }
  }
}
