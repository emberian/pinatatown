import Phaser from 'phaser';
import { ZoneType, ZONE_CONFIGS } from '../world/Zone';
import { TerrainType } from '../utils/Constants';

export enum UIMode {
  Normal = 'normal',
  ZoneDesignate = 'zone',
  Build = 'build',
  Terraform = 'terraform',
  Command = 'command',
}

export enum CommandType {
  MoveTo = 'moveTo',
  PickUp = 'pickUp',
  Guard = 'guard',
  Stay = 'stay',
  Follow = 'follow',
}

// Terrain display configs
export const TERRAIN_CONFIGS: Record<TerrainType, { name: string; color: number }> = {
  [TerrainType.Grass]: { name: 'Grass', color: 0x4a7c23 },
  [TerrainType.Dirt]: { name: 'Dirt', color: 0x8b6914 },
  [TerrainType.Water]: { name: 'Water', color: 0x2389da },
  [TerrainType.Flowers]: { name: 'Flowers', color: 0xff69b4 },
};

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
  private selectedTerrainType: TerrainType | null = null;
  private selectedCommand: CommandType | null = null;

  // Callbacks
  private onModeChange?: (mode: UIMode, zoneType: ZoneType | null) => void;
  private onTerrainModeChange?: (mode: UIMode, terrainType: TerrainType | null) => void;
  private onCommandSelected?: (command: CommandType | null) => void;

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

    // T key for terraform mode
    this.scene.input.keyboard!.addKey('T').on('down', () => {
      if (this.currentMode === UIMode.Terraform) {
        this.setMode(UIMode.Normal);
      } else {
        this.showTerraformMenu();
      }
    });

    // C key for command mode (when a piñata is selected)
    this.scene.input.keyboard!.addKey('C').on('down', () => {
      if (this.currentMode === UIMode.Command) {
        this.setMode(UIMode.Normal);
      } else {
        this.showCommandMenu();
      }
    });

    // ESC to cancel
    this.scene.input.keyboard!.addKey('ESC').on('down', () => {
      this.setMode(UIMode.Normal);
    });

    // Number keys for zone/terrain/command types
    this.scene.input.keyboard!.addKey('ONE').on('down', () => {
      if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.MoveTo);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Grass);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Stockpile);
      }
    });
    this.scene.input.keyboard!.addKey('TWO').on('down', () => {
      if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.PickUp);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Dirt);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Sleep);
      }
    });
    this.scene.input.keyboard!.addKey('THREE').on('down', () => {
      if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.Guard);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Water);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Recreation);
      }
    });
    this.scene.input.keyboard!.addKey('FOUR').on('down', () => {
      if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.Stay);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Flowers);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
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

  private showTerraformMenu(): void {
    this.menuContainer.removeAll(true);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x222222, 0.9);
    bg.fillRoundedRect(-160, 0, 150, 130, 8);
    this.menuContainer.add(bg);

    const title = this.scene.add.text(-150, 10, 'Terrain Types:', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.menuContainer.add(title);

    const terrainTypes = [
      { type: TerrainType.Grass, key: '1' },
      { type: TerrainType.Dirt, key: '2' },
      { type: TerrainType.Water, key: '3' },
      { type: TerrainType.Flowers, key: '4' },
    ];

    terrainTypes.forEach((tt, i) => {
      const config = TERRAIN_CONFIGS[tt.type];
      const text = this.scene.add.text(-150, 35 + i * 22, `[${tt.key}] ${config.name}`, {
        fontSize: '12px',
        color: '#' + config.color.toString(16).padStart(6, '0'),
      });
      this.menuContainer.add(text);
    });

    this.menuContainer.setVisible(true);
    this.currentMode = UIMode.Terraform;
    this.helpText.setText('Press 1-4 to select terrain type, ESC to cancel');
  }

  private selectTerrainType(type: TerrainType): void {
    this.selectedTerrainType = type;
    this.setMode(UIMode.Terraform);
    this.menuContainer.setVisible(false);
    this.onTerrainModeChange?.(UIMode.Terraform, type);
  }

  showCommandMenu(): void {
    this.menuContainer.removeAll(true);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x222222, 0.9);
    bg.fillRoundedRect(-160, 0, 150, 130, 8);
    this.menuContainer.add(bg);

    const title = this.scene.add.text(-150, 10, 'Commands:', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.menuContainer.add(title);

    const commands = [
      { type: CommandType.MoveTo, key: '1', name: 'Move To', color: 0x4488ff },
      { type: CommandType.PickUp, key: '2', name: 'Pick Up', color: 0xffaa00 },
      { type: CommandType.Guard, key: '3', name: 'Guard Area', color: 0xff4444 },
      { type: CommandType.Stay, key: '4', name: 'Stay Here', color: 0x44ff44 },
    ];

    commands.forEach((cmd, i) => {
      const text = this.scene.add.text(-150, 35 + i * 22, `[${cmd.key}] ${cmd.name}`, {
        fontSize: '12px',
        color: '#' + cmd.color.toString(16).padStart(6, '0'),
      });
      this.menuContainer.add(text);
    });

    this.menuContainer.setVisible(true);
    this.currentMode = UIMode.Command;
    this.helpText.setText('Press 1-4 to select command, ESC to cancel');
  }

  private selectCommand(type: CommandType): void {
    this.selectedCommand = type;
    this.menuContainer.setVisible(false);
    this.updateDisplay();
    this.onCommandSelected?.(type);
  }

  setMode(mode: UIMode): void {
    this.currentMode = mode;
    if (mode === UIMode.Normal) {
      this.selectedZoneType = null;
      this.selectedTerrainType = null;
      this.selectedCommand = null;
      this.menuContainer.setVisible(false);
    }
    this.updateDisplay();
    this.onModeChange?.(mode, this.selectedZoneType);
    if (mode === UIMode.Normal) {
      this.onTerrainModeChange?.(mode, null);
      this.onCommandSelected?.(null);
    }
  }

  getMode(): UIMode {
    return this.currentMode;
  }

  getSelectedZoneType(): ZoneType | null {
    return this.selectedZoneType;
  }

  getSelectedTerrainType(): TerrainType | null {
    return this.selectedTerrainType;
  }

  onModeChanged(callback: (mode: UIMode, zoneType: ZoneType | null) => void): void {
    this.onModeChange = callback;
  }

  onTerrainModeChanged(callback: (mode: UIMode, terrainType: TerrainType | null) => void): void {
    this.onTerrainModeChange = callback;
  }

  getSelectedCommand(): CommandType | null {
    return this.selectedCommand;
  }

  onCommandChange(callback: (command: CommandType | null) => void): void {
    this.onCommandSelected = callback;
  }

  private updateDisplay(): void {
    const commandNames: Record<CommandType, string> = {
      [CommandType.MoveTo]: 'Move To',
      [CommandType.PickUp]: 'Pick Up',
      [CommandType.Guard]: 'Guard',
      [CommandType.Stay]: 'Stay',
      [CommandType.Follow]: 'Follow',
    };

    switch (this.currentMode) {
      case UIMode.Normal:
        this.modeText.setText('');
        this.helpText.setText('[Z] Zones | [T] Terraform | [C] Commands | Click piñatas');
        break;
      case UIMode.ZoneDesignate:
        const zoneConfig = this.selectedZoneType ? ZONE_CONFIGS[this.selectedZoneType] : null;
        this.modeText.setText(`ZONE MODE: ${zoneConfig?.name ?? 'Select type'}`);
        this.modeText.setBackgroundColor('#' + (zoneConfig?.color ?? 0x333333).toString(16).padStart(6, '0') + 'dd');
        this.helpText.setText('Click and drag to designate zone | [ESC] Cancel | [Z] Exit');
        break;
      case UIMode.Terraform:
        const terrainConfig = this.selectedTerrainType ? TERRAIN_CONFIGS[this.selectedTerrainType] : null;
        this.modeText.setText(`TERRAFORM: ${terrainConfig?.name ?? 'Select type'}`);
        this.modeText.setBackgroundColor('#' + (terrainConfig?.color ?? 0x333333).toString(16).padStart(6, '0') + 'dd');
        this.helpText.setText('Click and drag to paint terrain | [ESC] Cancel | [T] Exit');
        break;
      case UIMode.Command:
        const cmdName = this.selectedCommand ? commandNames[this.selectedCommand] : 'Select';
        this.modeText.setText(`COMMAND: ${cmdName}`);
        this.modeText.setBackgroundColor('#4488ffdd');
        this.helpText.setText('Click target location/object | [ESC] Cancel | [C] Exit');
        break;
      case UIMode.Build:
        this.modeText.setText('BUILD MODE');
        this.helpText.setText('Click to place building | [ESC] Cancel');
        break;
    }
  }
}
