import Phaser from 'phaser';
import { ZoneType, ZONE_CONFIGS } from '../world/Zone';

export enum UIMode {
  Normal = 'normal',
  ZoneDesignate = 'zone',
  Build = 'build',
}

/**
 * Game UI overlay for build menu, zone designation, etc.
 */
export class GameUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private modeText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;
  private menuContainer: Phaser.GameObjects.Container;

  private currentMode: UIMode = UIMode.Normal;
  private selectedZoneType: ZoneType | null = null;

  // Callbacks
  private onModeChange?: (mode: UIMode, zoneType: ZoneType | null) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1001);

    // Mode indicator (top right)
    this.modeText = scene.add.text(scene.cameras.main.width - 10, 10, '', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#333333dd',
      padding: { x: 10, y: 5 },
    });
    this.modeText.setOrigin(1, 0);
    this.container.add(this.modeText);

    // Help text (bottom center)
    this.helpText = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height - 40, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 },
    });
    this.helpText.setOrigin(0.5, 1);
    this.container.add(this.helpText);

    // Menu container (right side)
    this.menuContainer = scene.add.container(scene.cameras.main.width - 10, 100);
    this.container.add(this.menuContainer);

    // Setup keyboard shortcuts
    this.setupKeyboard();

    this.updateDisplay();
  }

  private setupKeyboard(): void {
    // Z key for zone mode
    this.scene.input.keyboard!.addKey('Z').on('down', () => {
      if (this.currentMode === UIMode.ZoneDesignate) {
        this.setMode(UIMode.Normal);
      } else {
        this.showZoneMenu();
      }
    });

    // ESC to cancel
    this.scene.input.keyboard!.addKey('ESC').on('down', () => {
      this.setMode(UIMode.Normal);
    });

    // Number keys for zone types
    this.scene.input.keyboard!.addKey('ONE').on('down', () => {
      if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Stockpile);
      }
    });
    this.scene.input.keyboard!.addKey('TWO').on('down', () => {
      if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Sleep);
      }
    });
    this.scene.input.keyboard!.addKey('THREE').on('down', () => {
      if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Recreation);
      }
    });
    this.scene.input.keyboard!.addKey('FOUR').on('down', () => {
      if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Garden);
      }
    });
  }

  private showZoneMenu(): void {
    this.menuContainer.removeAll(true);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x222222, 0.9);
    bg.fillRoundedRect(-160, 0, 150, 130, 8);
    this.menuContainer.add(bg);

    const title = this.scene.add.text(-150, 10, 'Zone Types:', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.menuContainer.add(title);

    const zoneTypes = [
      { type: ZoneType.Stockpile, key: '1' },
      { type: ZoneType.Sleep, key: '2' },
      { type: ZoneType.Recreation, key: '3' },
      { type: ZoneType.Garden, key: '4' },
    ];

    zoneTypes.forEach((zt, i) => {
      const config = ZONE_CONFIGS[zt.type];
      const text = this.scene.add.text(-150, 35 + i * 22, `[${zt.key}] ${config.name}`, {
        fontSize: '12px',
        color: '#' + config.color.toString(16).padStart(6, '0'),
      });
      this.menuContainer.add(text);
    });

    this.menuContainer.setVisible(true);
    this.helpText.setText('Press 1-4 to select zone type, ESC to cancel');
  }

  private selectZoneType(type: ZoneType): void {
    this.selectedZoneType = type;
    this.setMode(UIMode.ZoneDesignate);
    this.menuContainer.setVisible(false);
  }

  setMode(mode: UIMode): void {
    this.currentMode = mode;
    if (mode === UIMode.Normal) {
      this.selectedZoneType = null;
      this.menuContainer.setVisible(false);
    }
    this.updateDisplay();
    this.onModeChange?.(mode, this.selectedZoneType);
  }

  getMode(): UIMode {
    return this.currentMode;
  }

  getSelectedZoneType(): ZoneType | null {
    return this.selectedZoneType;
  }

  onModeChanged(callback: (mode: UIMode, zoneType: ZoneType | null) => void): void {
    this.onModeChange = callback;
  }

  private updateDisplay(): void {
    switch (this.currentMode) {
      case UIMode.Normal:
        this.modeText.setText('');
        this.helpText.setText('[Z] Zone Mode | [Space] Pause | Click piñatas to select');
        break;
      case UIMode.ZoneDesignate:
        const config = this.selectedZoneType ? ZONE_CONFIGS[this.selectedZoneType] : null;
        this.modeText.setText(`ZONE MODE: ${config?.name ?? 'Select type'}`);
        this.modeText.setBackgroundColor('#' + (config?.color ?? 0x333333).toString(16).padStart(6, '0') + 'dd');
        this.helpText.setText('Click and drag to designate zone | [ESC] Cancel | [Z] Exit');
        break;
      case UIMode.Build:
        this.modeText.setText('BUILD MODE');
        this.helpText.setText('Click to place building | [ESC] Cancel');
        break;
    }
  }
}
