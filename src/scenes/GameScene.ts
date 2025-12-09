import Phaser from 'phaser';
import {
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_PAN_SPEED,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../utils/Constants';
import { IsoMap } from '../world/IsoMap';
import { getWorldCenter, screenToGridRounded, gridToScreen, GridPosition } from '../world/IsoUtils';
import { EventBus, GameEvents } from '../utils/EventBus';
import { Pinata } from '../entities/Pinata';
import { PinataSpecies } from '../entities/PinataTypes';
import { Pathfinder } from '../world/Pathfinding';
import { ZoneManager, Zone } from '../world/Zone';
import { GameUI, UIMode } from '../ui/GameUI';

/**
 * Main game scene - handles world rendering and camera controls
 */
export class GameScene extends Phaser.Scene {
  private isoMap!: IsoMap;
  private pathfinder!: Pathfinder;
  private zoneManager!: ZoneManager;
  private gameUI!: GameUI;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private isPanning = false;
  private lastPointerPosition = { x: 0, y: 0 };
  private isPaused = false;

  // Entities
  private pinatas: Pinata[] = [];
  private selectedPinata: Pinata | null = null;

  // Zone designation
  private isDragging = false;
  private dragStart: GridPosition | null = null;
  private currentZone: Zone | null = null;
  private zonePreview!: Phaser.GameObjects.Graphics;

  // Debug/info display
  private debugText!: Phaser.GameObjects.Text;
  private hoverTileIndicator!: Phaser.GameObjects.Graphics;
  private infoPanel!: Phaser.GameObjects.Container;
  private infoPanelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Create the isometric map
    this.isoMap = new IsoMap(this);

    // Create pathfinder
    this.pathfinder = new Pathfinder((x, y) => this.isoMap.isWalkable(x, y));

    // Create zone manager
    this.zoneManager = new ZoneManager(this);

    // Center camera on world
    const worldCenter = getWorldCenter();
    this.cameras.main.centerOn(worldCenter.x, worldCenter.y);
    this.cameras.main.setZoom(1);

    // Setup graphics
    this.zonePreview = this.add.graphics();
    this.zonePreview.setDepth(998);

    // Setup input
    this.setupInput();

    // Setup debug display
    this.setupDebugDisplay();

    // Setup hover indicator
    this.setupHoverIndicator();

    // Setup info panel
    this.setupInfoPanel();

    // Setup event listeners
    this.setupEvents();

    // Setup UI
    this.gameUI = new GameUI(this);
    this.gameUI.onModeChanged((mode, zoneType) => {
      if (mode === UIMode.ZoneDesignate && zoneType) {
        this.currentZone = this.zoneManager.createZone(zoneType);
      } else if (mode === UIMode.Normal && this.currentZone) {
        if (this.currentZone.getTiles().length === 0) {
          this.zoneManager.removeZone(this.currentZone);
        }
        this.currentZone = null;
      }
    });

    // Spawn initial piñatas
    this.spawnInitialPinatas();

    console.log('Piñata Town loaded! [Z] Zone mode | [Space] Pause | Click piñatas to select');
  }

  private setupInput(): void {
    // Keyboard
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Pause key
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
      this.togglePause();
    });

    // Mouse wheel zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const camera = this.cameras.main;
      const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Phaser.Math.Clamp(
        camera.zoom + zoomDelta,
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
      );
      camera.setZoom(newZoom);
    });

    // Right-click drag to pan
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.isPanning = true;
        this.lastPointerPosition = { x: pointer.x, y: pointer.y };
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const dx = pointer.x - this.lastPointerPosition.x;
        const dy = pointer.y - this.lastPointerPosition.y;

        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;

        this.lastPointerPosition = { x: pointer.x, y: pointer.y };
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonReleased()) {
        this.isPanning = false;
      }
    });

    // Left-click handling
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.handleLeftClick(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.handleDrag(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonReleased() && this.isDragging) {
        this.endDrag();
      }
    });

    // Disable context menu
    this.input.mouse?.disableContextMenu();
  }

  private handleLeftClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridPos = screenToGridRounded(worldPoint.x, worldPoint.y);

    if (this.gameUI.getMode() === UIMode.ZoneDesignate && this.currentZone) {
      // Start zone drag
      this.isDragging = true;
      this.dragStart = gridPos;
      this.currentZone.addTile(gridPos);
    }
    // Normal mode clicks are handled by piñata interactive zones
  }

  private handleDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || !this.currentZone) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridPos = screenToGridRounded(worldPoint.x, worldPoint.y);

    // Add all tiles in rectangle from dragStart to current position
    const minX = Math.min(this.dragStart.x, gridPos.x);
    const maxX = Math.max(this.dragStart.x, gridPos.x);
    const minY = Math.min(this.dragStart.y, gridPos.y);
    const maxY = Math.max(this.dragStart.y, gridPos.y);

    // Clear and refill zone
    for (const tile of this.currentZone.getTiles()) {
      this.currentZone.removeTile(tile);
    }

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (this.isoMap.isWalkable(x, y)) {
          this.currentZone.addTile({ x, y });
        }
      }
    }
  }

  private endDrag(): void {
    this.isDragging = false;
    this.dragStart = null;
    // Zone stays, ready for more additions or exit zone mode
  }

  private setupDebugDisplay(): void {
    this.debugText = this.add.text(10, 10, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 },
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(1000);
  }

  private setupHoverIndicator(): void {
    this.hoverTileIndicator = this.add.graphics();
    this.hoverTileIndicator.setDepth(999);
  }

  private setupInfoPanel(): void {
    this.infoPanel = this.add.container(10, this.cameras.main.height - 10);
    this.infoPanel.setScrollFactor(0);
    this.infoPanel.setDepth(1000);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(0, -150, 250, 140, 8);
    this.infoPanel.add(bg);

    // Text
    this.infoPanelText = this.add.text(10, -140, '', {
      fontSize: '12px',
      color: '#ffffff',
      lineSpacing: 4,
    });
    this.infoPanel.add(this.infoPanelText);

    this.infoPanel.setVisible(false);
  }

  private setupEvents(): void {
    EventBus.on(GameEvents.GAME_PAUSED, () => {
      this.isPaused = true;
    });

    EventBus.on(GameEvents.GAME_RESUMED, () => {
      this.isPaused = false;
    });

    // Handle piñata selection
    EventBus.on(GameEvents.PINATA_SELECTED, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      if (this.gameUI.getMode() === UIMode.Normal) {
        this.selectPinata(pinata);
      }
    });
  }

  private spawnInitialPinatas(): void {
    const species = [
      PinataSpecies.Sparrowmint,
      PinataSpecies.Moozipan,
      PinataSpecies.Buzzlegum,
      PinataSpecies.Rashberry,
      PinataSpecies.Pretztail,
    ];

    // Spawn 5 piñatas of different species
    for (let i = 0; i < 5; i++) {
      let gridX: number, gridY: number;

      // Find a valid spawn position
      do {
        gridX = Math.floor(WORLD_WIDTH / 4 + Math.random() * WORLD_WIDTH / 2);
        gridY = Math.floor(WORLD_HEIGHT / 4 + Math.random() * WORLD_HEIGHT / 2);
      } while (!this.isoMap.isWalkable(gridX, gridY));

      const pinata = new Pinata(this, gridX, gridY, species[i], this.pathfinder);
      this.pinatas.push(pinata);
    }
  }

  private selectPinata(pinata: Pinata): void {
    // Deselect previous
    if (this.selectedPinata) {
      this.selectedPinata.deselect();
    }

    // Select new
    this.selectedPinata = pinata;
    pinata.select();
    this.infoPanel.setVisible(true);
  }

  deselectPinata(): void {
    if (this.selectedPinata) {
      this.selectedPinata.deselect();
      this.selectedPinata = null;
      this.infoPanel.setVisible(false);
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      EventBus.emit(GameEvents.GAME_PAUSED);
    } else {
      EventBus.emit(GameEvents.GAME_RESUMED);
    }
  }

  update(_time: number, delta: number): void {
    // Camera panning with keyboard
    this.handleCameraMovement();

    // Update piñatas (unless paused)
    if (!this.isPaused) {
      for (const pinata of this.pinatas) {
        pinata.update(delta);
      }
    }

    // Update hover indicator
    this.updateHoverIndicator();

    // Update debug text
    this.updateDebugText();

    // Update info panel
    this.updateInfoPanel();
  }

  private handleCameraMovement(): void {
    const camera = this.cameras.main;
    const speed = CAMERA_PAN_SPEED / camera.zoom;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      camera.scrollX -= speed;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      camera.scrollX += speed;
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      camera.scrollY -= speed;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      camera.scrollY += speed;
    }
  }

  private updateHoverIndicator(): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridPos = screenToGridRounded(worldPoint.x, worldPoint.y);

    this.hoverTileIndicator.clear();

    const tile = this.isoMap.getTile(gridPos.x, gridPos.y);
    if (tile) {
      const { x, y } = gridToScreen(gridPos.x, gridPos.y);

      // Different color in zone mode
      const color = this.gameUI.getMode() === UIMode.ZoneDesignate ? 0x00ff00 : 0xffffff;

      // Draw diamond outline
      this.hoverTileIndicator.lineStyle(2, color, 0.6);
      this.hoverTileIndicator.beginPath();
      this.hoverTileIndicator.moveTo(x, y - 16);
      this.hoverTileIndicator.lineTo(x + 32, y);
      this.hoverTileIndicator.lineTo(x, y + 16);
      this.hoverTileIndicator.lineTo(x - 32, y);
      this.hoverTileIndicator.closePath();
      this.hoverTileIndicator.strokePath();
    }
  }

  private updateDebugText(): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridPos = screenToGridRounded(worldPoint.x, worldPoint.y);
    const tile = this.isoMap.getTile(gridPos.x, gridPos.y);
    const zone = this.zoneManager.getZoneAt(gridPos);

    const lines = [
      `Tile: (${gridPos.x}, ${gridPos.y})`,
      `Terrain: ${tile?.terrain ?? 'none'}`,
      zone ? `Zone: ${zone.config.name}` : '',
      `Pinatas: ${this.pinatas.length}`,
      `Zones: ${this.zoneManager.getAllZones().length}`,
      this.isPaused ? '[PAUSED]' : '',
    ];

    this.debugText.setText(lines.filter(l => l).join('\n'));
  }

  private updateInfoPanel(): void {
    if (!this.selectedPinata) return;

    const p = this.selectedPinata;
    const needs = p.getNeeds();
    const pos = p.getGridPosition();

    const needBar = (value: number) => {
      const filled = Math.round(value / 10);
      return '[' + '='.repeat(filled) + '-'.repeat(10 - filled) + ']';
    };

    const lines = [
      `${p.nickname}`,
      `Species: ${p.speciesData.name}`,
      `Mood: ${p.getMood()}`,
      `State: ${p.getBehavior()}`,
      `Position: (${pos.x}, ${pos.y})`,
      ``,
      `Hunger: ${needBar(needs.hunger)} ${Math.round(needs.hunger)}`,
      `Rest:   ${needBar(needs.rest)} ${Math.round(needs.rest)}`,
      `Fun:    ${needBar(needs.fun)} ${Math.round(needs.fun)}`,
      `Social: ${needBar(needs.social)} ${Math.round(needs.social)}`,
    ];

    this.infoPanelText.setText(lines.join('\n'));
  }

  getMap(): IsoMap {
    return this.isoMap;
  }

  getPinatas(): Pinata[] {
    return this.pinatas;
  }

  getZoneManager(): ZoneManager {
    return this.zoneManager;
  }
}
