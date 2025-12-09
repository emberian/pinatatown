import Phaser from 'phaser';

/**
 * Reusable UI components for structured game state display
 */

// Color palette for consistent UI theming
export const UIColors = {
  panelBg: 0x1a1a2e,
  panelBgAlpha: 0.9,
  panelBorder: 0x4a4a6a,
  accent: 0xffd700,
  text: 0xffffff,
  textDim: 0xaaaaaa,
  success: 0x4ade80,
  warning: 0xfbbf24,
  danger: 0xef4444,
  info: 0x60a5fa,

  // Mood colors
  moodHappy: 0x4ade80,
  moodContent: 0xa3e635,
  moodStressed: 0xfbbf24,
  moodBreaking: 0xef4444,

  // Resource colors
  berry: 0xff6b9d,
  seed: 0x8b5a2b,
  honey: 0xffd700,
  fiber: 0x90ee90,
};

export const UIFonts = {
  title: { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' },
  label: { fontSize: '11px', fontFamily: 'monospace', color: '#cccccc' },
  value: { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' },
  small: { fontSize: '10px', fontFamily: 'monospace', color: '#aaaaaa' },
};

/**
 * Base panel class with common styling
 */
export class UIPanel extends Phaser.GameObjects.Container {
  protected bg: Phaser.GameObjects.Graphics;
  protected panelWidth: number;
  protected panelHeight: number;
  protected padding = 8;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, x, y);
    this.panelWidth = width;
    this.panelHeight = height;

    // Create background
    this.bg = scene.add.graphics();
    this.drawBackground();
    this.add(this.bg);

    // Make UI fixed on screen
    this.setScrollFactor(0);
    this.setDepth(1000);

    scene.add.existing(this);
  }

  protected drawBackground(): void {
    this.bg.clear();
    this.bg.fillStyle(UIColors.panelBg, UIColors.panelBgAlpha);
    this.bg.fillRoundedRect(0, 0, this.panelWidth, this.panelHeight, 6);
    this.bg.lineStyle(1, UIColors.panelBorder);
    this.bg.strokeRoundedRect(0, 0, this.panelWidth, this.panelHeight, 6);
  }

  resize(width: number, height: number): void {
    this.panelWidth = width;
    this.panelHeight = height;
    this.drawBackground();
  }
}

/**
 * Progress bar component
 */
export class ProgressBar extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private barWidth: number;
  private barHeight: number;
  private fillColor: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number = UIColors.accent
  ) {
    super(scene, x, y);
    this.barWidth = width;
    this.barHeight = height;
    this.fillColor = fillColor;

    this.bg = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.add(this.bg);
    this.add(this.fill);

    this.drawBg();
  }

  private drawBg(): void {
    this.bg.clear();
    this.bg.fillStyle(0x333344, 1);
    this.bg.fillRoundedRect(0, 0, this.barWidth, this.barHeight, 2);
  }

  setProgress(value: number, max: number = 100): void {
    const percent = Math.max(0, Math.min(1, value / max));
    this.fill.clear();
    if (percent > 0) {
      this.fill.fillStyle(this.fillColor, 1);
      this.fill.fillRoundedRect(0, 0, this.barWidth * percent, this.barHeight, 2);
    }
  }

  setColor(color: number): void {
    this.fillColor = color;
  }
}

/**
 * Icon + Value display (e.g., "🍓 15")
 */
export class IconValue extends Phaser.GameObjects.Container {
  private iconText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, icon: string, value: string | number) {
    super(scene, x, y);

    this.iconText = scene.add.text(0, 0, icon, { fontSize: '14px' });
    this.valueText = scene.add.text(18, 2, String(value), UIFonts.value);

    this.add(this.iconText);
    this.add(this.valueText);
  }

  setValue(value: string | number): void {
    this.valueText.setText(String(value));
  }

  setIcon(icon: string): void {
    this.iconText.setText(icon);
  }
}

/**
 * Labeled progress bar with icon
 */
export class LabeledBar extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private bar: ProgressBar;
  private valueText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    icon: string,
    width: number,
    color: number
  ) {
    super(scene, x, y);

    this.label = scene.add.text(0, 0, icon, { fontSize: '12px' });
    this.bar = new ProgressBar(scene, 18, 2, width - 50, 10, color);
    this.valueText = scene.add.text(width - 28, 0, '0', UIFonts.small);

    this.add(this.label);
    this.add(this.bar);
    this.add(this.valueText);
  }

  update(value: number, max: number = 100): void {
    this.bar.setProgress(value, max);
    this.valueText.setText(Math.round(value).toString());
  }
}

/**
 * Mini mood indicator (colored dot)
 */
export class MoodDot extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, x: number, y: number, color: number) {
    super(scene, { x, y });
    this.fillStyle(color, 1);
    this.fillCircle(0, 0, 4);
  }

  setMoodColor(color: number): void {
    this.clear();
    this.fillStyle(color, 1);
    this.fillCircle(0, 0, 4);
  }
}

/**
 * Section header with line
 */
export class SectionHeader extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, width: number) {
    super(scene, x, y);

    const label = scene.add.text(0, 0, text, UIFonts.label);
    const line = scene.add.graphics();
    line.lineStyle(1, UIColors.panelBorder);
    line.lineBetween(label.width + 8, 6, width - 8, 6);

    this.add(label);
    this.add(line);
  }
}

/**
 * Clickable button
 */
export class UIButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private btnWidth: number;
  private btnHeight: number;
  private isEnabled = true;
  private isHovered = false;
  private baseColor: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    width: number,
    height: number,
    color: number = UIColors.accent,
    callback?: () => void
  ) {
    super(scene, x, y);
    this.btnWidth = width;
    this.btnHeight = height;
    this.baseColor = color;

    this.bg = scene.add.graphics();
    this.label = scene.add.text(width / 2, height / 2, text, {
      ...UIFonts.label,
      color: '#000000',
    });
    this.label.setOrigin(0.5);

    this.add(this.bg);
    this.add(this.label);
    this.draw();

    // Make interactive
    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        this.isHovered = true;
        this.draw();
      })
      .on('pointerout', () => {
        this.isHovered = false;
        this.draw();
      })
      .on('pointerdown', () => {
        if (this.isEnabled && callback) callback();
      });
  }

  private draw(): void {
    this.bg.clear();
    const color = this.isEnabled
      ? this.isHovered
        ? Phaser.Display.Color.ValueToColor(this.baseColor).lighten(20).color
        : this.baseColor
      : 0x555555;
    this.bg.fillStyle(color, 1);
    this.bg.fillRoundedRect(0, 0, this.btnWidth, this.btnHeight, 4);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.label.setAlpha(enabled ? 1 : 0.5);
    this.draw();
  }

  setText(text: string): void {
    this.label.setText(text);
  }
}

/**
 * Tooltip popup
 */
export class Tooltip extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.bg = scene.add.graphics();
    this.text = scene.add.text(8, 6, '', UIFonts.small);

    this.add(this.bg);
    this.add(this.text);
    this.setVisible(false);
    this.setDepth(2000);
    this.setScrollFactor(0);

    scene.add.existing(this);
  }

  show(x: number, y: number, content: string): void {
    this.text.setText(content);
    const width = this.text.width + 16;
    const height = this.text.height + 12;

    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.9);
    this.bg.fillRoundedRect(0, 0, width, height, 4);

    this.setPosition(x, y);
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }
}
