import Phaser from 'phaser';
import { UIPanel, UIColors, UIFonts, ProgressBar } from './UIComponents';
import { PinataSpecies, SPECIES_DATA } from '../entities/PinataTypes';

export interface SpeciesStatus {
  species: PinataSpecies;
  count: number;           // Current count in garden
  isResident: boolean;     // Has decided to stay
  attractionProgress: number; // 0-100 visit progress
  requirementsMet: boolean;
  requirements: string[];  // Human-readable requirements
}

/**
 * Panel showing species attraction status and requirements
 */
export class SpeciesPanel extends UIPanel {
  private speciesRows: Map<PinataSpecies, {
    container: Phaser.GameObjects.Container;
    icon: Phaser.GameObjects.Text;
    name: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
    bar: ProgressBar;
    status: Phaser.GameObjects.Text;
    reqText: Phaser.GameObjects.Text;
  }> = new Map();

  private expandedSpecies: PinataSpecies | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 320, 200);
    this.createContent();
  }

  private createContent(): void {
    // Title
    const titleBg = this.scene.add.graphics();
    titleBg.fillStyle(UIColors.accent, 0.2);
    titleBg.fillRect(0, 0, this.panelWidth, 24);
    this.add(titleBg);

    const title = this.scene.add.text(this.padding, 4, '🦋 Species & Attraction', {
      ...UIFonts.title,
      fontStyle: 'bold',
    });
    this.add(title);

    let yPos = 32;

    // Create row for each species
    const allSpecies = [
      PinataSpecies.Sparrowmint,
      PinataSpecies.Moozipan,
      PinataSpecies.Buzzlegum,
      PinataSpecies.Rashberry,
      PinataSpecies.Pretztail,
    ];

    // Emoji mapping for species (since PinataSpeciesData doesn't have emoji)
    const speciesEmojis: Record<PinataSpecies, string> = {
      [PinataSpecies.Sparrowmint]: '🐦',
      [PinataSpecies.Moozipan]: '🐮',
      [PinataSpecies.Buzzlegum]: '🐝',
      [PinataSpecies.Rashberry]: '🦝',
      [PinataSpecies.Pretztail]: '🦊',
    };

    for (const species of allSpecies) {
      const speciesData = SPECIES_DATA[species];
      const container = this.scene.add.container(0, yPos);

      // Icon
      const icon = this.scene.add.text(this.padding, 0, speciesEmojis[species], { fontSize: '16px' });

      // Name
      const name = this.scene.add.text(this.padding + 24, 2, speciesData.name, UIFonts.value);

      // Count badge
      const count = this.scene.add.text(this.padding + 100, 2, '×0', UIFonts.small);
      count.setTint(UIColors.textDim);

      // Status indicator
      const status = this.scene.add.text(this.panelWidth - this.padding - 60, 2, '???', UIFonts.small);
      status.setOrigin(0, 0);

      // Progress bar
      const bar = new ProgressBar(this.scene, this.padding + 24, 18, 140, 6, UIColors.info);

      // Requirements text (initially hidden)
      const reqText = this.scene.add.text(this.padding + 24, 26, '', {
        ...UIFonts.small,
        wordWrap: { width: this.panelWidth - 50 },
      });
      reqText.setVisible(false);

      container.add([icon, name, count, status, bar, reqText]);
      this.add(container);

      this.speciesRows.set(species, { container, icon, name, count, bar, status, reqText });

      // Make row clickable to expand/collapse requirements
      const hitArea = this.scene.add.rectangle(this.panelWidth / 2, 10, this.panelWidth - 16, 30, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.toggleExpand(species));
      container.add(hitArea);

      yPos += 32;
    }

    // Adjust panel height
    this.resize(this.panelWidth, yPos + 8);
  }

  private toggleExpand(species: PinataSpecies): void {
    const row = this.speciesRows.get(species);
    if (!row) return;

    if (this.expandedSpecies === species) {
      // Collapse
      row.reqText.setVisible(false);
      this.expandedSpecies = null;
      this.repositionRows();
    } else {
      // Collapse previous
      if (this.expandedSpecies) {
        const prevRow = this.speciesRows.get(this.expandedSpecies);
        if (prevRow) prevRow.reqText.setVisible(false);
      }
      // Expand this one
      row.reqText.setVisible(true);
      this.expandedSpecies = species;
      this.repositionRows();
    }
  }

  private repositionRows(): void {
    let yPos = 32;
    for (const [species, row] of this.speciesRows) {
      row.container.y = yPos;
      yPos += 32;
      if (species === this.expandedSpecies) {
        yPos += row.reqText.height + 4;
      }
    }
    this.resize(this.panelWidth, yPos + 8);
  }

  update(statuses: SpeciesStatus[]): void {
    for (const status of statuses) {
      const row = this.speciesRows.get(status.species);
      if (!row) continue;

      // Update count
      row.count.setText(`×${status.count}`);
      if (status.count > 0) {
        row.count.setTint(UIColors.success);
      } else {
        row.count.setTint(UIColors.textDim);
      }

      // Update progress bar
      row.bar.setProgress(status.attractionProgress, 100);

      // Update status
      if (status.isResident || status.count > 0) {
        row.status.setText('✓ Resident');
        row.status.setTint(UIColors.success);
        row.bar.setColor(UIColors.success);
      } else if (status.attractionProgress >= 100) {
        row.status.setText('Visiting!');
        row.status.setTint(UIColors.accent);
        row.bar.setColor(UIColors.accent);
      } else if (status.requirementsMet) {
        row.status.setText('Attracting...');
        row.status.setTint(UIColors.info);
        row.bar.setColor(UIColors.info);
      } else {
        row.status.setText('Requirements');
        row.status.setTint(UIColors.textDim);
        row.bar.setColor(UIColors.panelBorder);
      }

      // Update requirements text
      if (status.requirements.length > 0) {
        row.reqText.setText('• ' + status.requirements.join('\n• '));
      } else {
        row.reqText.setText('Requirements met!');
      }

      // Dim non-prey species differently
      if (status.species === PinataSpecies.Pretztail) {
        row.icon.setAlpha(status.count > 0 ? 1 : 0.5);
        row.name.setAlpha(status.count > 0 ? 1 : 0.5);
        if (status.count === 0) {
          row.status.setText('Predator');
          row.status.setTint(UIColors.danger);
        }
      }
    }
  }
}
