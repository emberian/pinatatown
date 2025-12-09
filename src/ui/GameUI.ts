import Phaser from 'phaser';
import { ZoneType, ZONE_CONFIGS } from '../world/Zone';
import { TerrainType } from '../utils/Constants';
import { BuildingType, BUILDING_DATA } from '../systems/BuildingSystem';

export enum UIMode {
  Normal = 'normal',
  ZoneDesignate = 'zone',
  Build = 'build',
  Terraform = 'terraform',
  Command = 'command',
  Feed = 'feed',
  Pet = 'pet',
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
  private toolbarContainer: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;

  private currentMode: UIMode = UIMode.Normal;
  private selectedZoneType: ZoneType | null = null;
  private selectedTerrainType: TerrainType | null = null;
  private selectedCommand: CommandType | null = null;
  private selectedBuildingType: BuildingType | null = null;

  // Score system
  private score = 0;
  private candyCoins = 50; // Starting currency

  // Callbacks
  private onModeChange?: (mode: UIMode, zoneType: ZoneType | null) => void;
  private onTerrainModeChange?: (mode: UIMode, terrainType: TerrainType | null) => void;
  private onCommandSelected?: (command: CommandType | null) => void;
  private onBuildingSelected?: (buildingType: BuildingType | null) => void;

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

    // Score display (top center)
    this.scoreText = scene.add.text(scene.cameras.main.width / 2, 10, '', {
      fontSize: '18px',
      color: '#FFD700',
      backgroundColor: '#000000cc',
      padding: { x: 15, y: 8 },
      fontStyle: 'bold',
    });
    this.scoreText.setOrigin(0.5, 0);
    this.container.add(this.scoreText);
    this.updateScoreDisplay();

    // Help text (bottom of screen)
    this.helpText = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height - 10, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 15, y: 8 },
    });
    this.helpText.setOrigin(0.5, 1);
    this.container.add(this.helpText);

    // Menu container (right side)
    this.menuContainer = scene.add.container(scene.cameras.main.width - 10, 100);
    this.container.add(this.menuContainer);

    // Toolbar container (unused now but kept for compatibility)
    this.toolbarContainer = scene.add.container(0, 0);
    this.toolbarContainer.setVisible(false);

    // Setup keyboard shortcuts
    this.setupKeyboard();

    this.updateDisplay();
  }

  private updateScoreDisplay(): void {
    this.scoreText.setText(`🍬 ${this.candyCoins} coins | ⭐ ${this.score} pts`);
  }

  addScore(points: number): void {
    this.score += points;
    this.updateScoreDisplay();

    // Flash effect
    this.scene.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
    });
  }

  addCoins(amount: number): void {
    this.candyCoins += amount;
    this.updateScoreDisplay();
  }

  spendCoins(amount: number): boolean {
    if (this.candyCoins >= amount) {
      this.candyCoins -= amount;
      this.updateScoreDisplay();
      return true;
    }
    return false;
  }

  getCoins(): number {
    return this.candyCoins;
  }

  getScore(): number {
    return this.score;
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

    // B key for build mode
    this.scene.input.keyboard!.addKey('B').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.setMode(UIMode.Normal);
      } else {
        this.showBuildMenu();
      }
    });

    // F key for feed mode
    this.scene.input.keyboard!.addKey('F').on('down', () => {
      if (this.currentMode === UIMode.Feed) {
        this.setMode(UIMode.Normal);
      } else {
        this.setMode(UIMode.Feed);
      }
    });

    // P key for pet mode
    this.scene.input.keyboard!.addKey('P').on('down', () => {
      if (this.currentMode === UIMode.Pet) {
        this.setMode(UIMode.Normal);
      } else {
        this.setMode(UIMode.Pet);
      }
    });

    // ESC to cancel
    this.scene.input.keyboard!.addKey('ESC').on('down', () => {
      this.setMode(UIMode.Normal);
    });

    // Number keys for zone/terrain/command/building types
    const buildingKeys: BuildingType[] = [
      BuildingType.Fence, BuildingType.CandyHouse, BuildingType.Playground,
      BuildingType.Granary, BuildingType.WaterWell, BuildingType.Watchtower,
      BuildingType.Workshop, BuildingType.HoneyPot, BuildingType.Shrine,
    ];

    this.scene.input.keyboard!.addKey('ONE').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[0]);
      } else if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.MoveTo);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Grass);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Stockpile);
      }
    });
    this.scene.input.keyboard!.addKey('TWO').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[1]);
      } else if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.PickUp);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Dirt);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Sleep);
      }
    });
    this.scene.input.keyboard!.addKey('THREE').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[2]);
      } else if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.Guard);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Water);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Recreation);
      }
    });
    this.scene.input.keyboard!.addKey('FOUR').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[3]);
      } else if (this.currentMode === UIMode.Command) {
        this.selectCommand(CommandType.Stay);
      } else if (this.currentMode === UIMode.Terraform) {
        this.selectTerrainType(TerrainType.Flowers);
      } else if (this.currentMode === UIMode.ZoneDesignate || this.menuContainer.visible) {
        this.selectZoneType(ZoneType.Garden);
      }
    });
    this.scene.input.keyboard!.addKey('FIVE').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[4]);
      }
    });
    this.scene.input.keyboard!.addKey('SIX').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[5]);
      }
    });
    this.scene.input.keyboard!.addKey('SEVEN').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[6]);
      }
    });
    this.scene.input.keyboard!.addKey('EIGHT').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[7]);
      }
    });
    this.scene.input.keyboard!.addKey('NINE').on('down', () => {
      if (this.currentMode === UIMode.Build) {
        this.selectBuildingType(buildingKeys[8]);
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

  showBuildMenu(): void {
    this.menuContainer.removeAll(true);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x222222, 0.9);
    bg.fillRoundedRect(-200, 0, 190, 240, 8);
    this.menuContainer.add(bg);

    const title = this.scene.add.text(-190, 10, 'Buildings [B]:', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.menuContainer.add(title);

    // Show first 9 buildings with number keys
    const buildings = [
      { type: BuildingType.Fence, key: '1' },
      { type: BuildingType.CandyHouse, key: '2' },
      { type: BuildingType.Playground, key: '3' },
      { type: BuildingType.Granary, key: '4' },
      { type: BuildingType.WaterWell, key: '5' },
      { type: BuildingType.Watchtower, key: '6' },
      { type: BuildingType.Workshop, key: '7' },
      { type: BuildingType.HoneyPot, key: '8' },
      { type: BuildingType.Shrine, key: '9' },
    ];

    buildings.forEach((b, i) => {
      const data = BUILDING_DATA[b.type];
      const text = this.scene.add.text(-190, 35 + i * 22, `[${b.key}] ${data.icon} ${data.name}`, {
        fontSize: '11px',
        color: '#' + data.color.toString(16).padStart(6, '0'),
      });
      this.menuContainer.add(text);
    });

    this.menuContainer.setVisible(true);
    this.currentMode = UIMode.Build;
    this.helpText.setText('Press 1-9 to select building, click to place | [ESC] Cancel');
  }

  selectBuildingType(type: BuildingType): void {
    this.selectedBuildingType = type;
    this.setMode(UIMode.Build);
    this.menuContainer.setVisible(false);
    this.onBuildingSelected?.(type);
  }

  setMode(mode: UIMode): void {
    this.currentMode = mode;
    if (mode === UIMode.Normal) {
      this.selectedZoneType = null;
      this.selectedTerrainType = null;
      this.selectedCommand = null;
      this.selectedBuildingType = null;
      this.menuContainer.setVisible(false);
    }
    this.updateDisplay();
    this.onModeChange?.(mode, this.selectedZoneType);
    if (mode === UIMode.Normal) {
      this.onTerrainModeChange?.(mode, null);
      this.onCommandSelected?.(null);
      this.onBuildingSelected?.(null);
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

  getSelectedBuildingType(): BuildingType | null {
    return this.selectedBuildingType;
  }

  onBuildingChange(callback: (buildingType: BuildingType | null) => void): void {
    this.onBuildingSelected = callback;
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
        this.helpText.setText('[Z]one [B]uild [T]errain [C]ommand [F]eed [P]et | Click piñata to select | Scroll=Zoom RightDrag=Pan');
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
        const buildingData = this.selectedBuildingType ? BUILDING_DATA[this.selectedBuildingType] : null;
        this.modeText.setText(`BUILD: ${buildingData?.name ?? 'Select type'}`);
        this.modeText.setBackgroundColor('#' + (buildingData?.color ?? 0x333333).toString(16).padStart(6, '0') + 'dd');
        if (buildingData) {
          const costStr = buildingData.cost.map(c => `${c.amount} ${c.type}`).join(', ');
          this.helpText.setText(`${buildingData.icon} ${buildingData.description} | Cost: ${costStr} | [ESC] Cancel`);
        } else {
          this.helpText.setText('Press [B] for menu, 1-9 to select | [ESC] Cancel');
        }
        break;
      case UIMode.Feed:
        this.modeText.setText('🍬 FEED MODE');
        this.modeText.setBackgroundColor('#ff9900dd');
        this.helpText.setText('Click a piñata to feed it! (Costs 5 candy coins) | [ESC] Cancel | [F] Exit');
        break;
      case UIMode.Pet:
        this.modeText.setText('❤️ PET MODE');
        this.modeText.setBackgroundColor('#ff66aadd');
        this.helpText.setText('Click a piñata to pet it! (+happiness, +affection) | [ESC] Cancel | [P] Exit');
        break;
    }
  }
}
