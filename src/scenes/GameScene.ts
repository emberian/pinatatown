import Phaser from 'phaser';
import {
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_PAN_SPEED,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TerrainType,
} from '../utils/Constants';
import { IsoMap } from '../world/IsoMap';
import { getWorldCenter, screenToGridRounded, gridToScreen, GridPosition } from '../world/IsoUtils';
import { EventBus, GameEvents } from '../utils/EventBus';
import { Pinata, MoodState } from '../entities/Pinata';
import { PinataSpecies } from '../entities/PinataTypes';
import { Pathfinder } from '../world/Pathfinding';
import { ZoneManager, Zone, ZoneType } from '../world/Zone';
import { GameUI, UIMode, CommandType } from '../ui/GameUI';
import { ResourceManager, ResourceType } from '../entities/Resource';
import { AttractionSystem } from '../systems/AttractionSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { RelationshipSystem } from '../systems/RelationshipSystem';
import { RomanceSystem } from '../systems/RomanceSystem';
import { SourPinataSystem } from '../systems/SourPinataSystem';
import { RandomEventSystem } from '../systems/RandomEventSystem';
import { SeasonSystem } from '../systems/SeasonSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { NotificationSystem } from '../systems/NotificationSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { PerceptionSystem } from '../systems/PerceptionSystem';
import { ColonySystem, ColonyMood } from '../systems/ColonySystem';
import { ResourceNodeSystem } from '../systems/ResourceNodeSystem';
import { ThreatSystem, ThreatLevel } from '../systems/ThreatSystem';

/**
 * Main game scene - handles world rendering and camera controls
 */
export class GameScene extends Phaser.Scene {
  private isoMap!: IsoMap;
  private pathfinder!: Pathfinder;
  private zoneManager!: ZoneManager;
  private resourceManager!: ResourceManager;
  private attractionSystem!: AttractionSystem;
  private timeSystem!: TimeSystem;
  private relationshipSystem!: RelationshipSystem;
  private romanceSystem!: RomanceSystem;
  private sourPinataSystem!: SourPinataSystem;
  private randomEventSystem!: RandomEventSystem;
  private seasonSystem!: SeasonSystem;
  private farmingSystem!: FarmingSystem;
  private buildingSystem!: BuildingSystem;
  private notificationSystem!: NotificationSystem;
  private workSystem!: WorkSystem;
  private perceptionSystem!: PerceptionSystem;
  private colonySystem!: ColonySystem;
  private resourceNodeSystem!: ResourceNodeSystem;
  private threatSystem!: ThreatSystem;
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

  // Terraform mode
  private selectedTerrainType: TerrainType | null = null;

  // Command mode
  private selectedCommand: CommandType | null = null;

  // Resource spawning
  private resourceSpawnTimer = 0;
  private readonly RESOURCE_SPAWN_INTERVAL = 10000; // 10 seconds

  // Passive income from happy piñatas
  private incomeTimer = 0;
  private readonly INCOME_INTERVAL = 15000; // Every 15 seconds

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

    // Create resource manager
    this.resourceManager = new ResourceManager(this);

    // Connect resource manager to zone manager for stockpile visuals
    this.resourceManager.setZoneManager(this.zoneManager);

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

    this.gameUI.onTerrainModeChanged((_mode, terrainType) => {
      this.selectedTerrainType = terrainType;
    });

    this.gameUI.onCommandChange((command) => {
      this.selectedCommand = command;
    });

    this.gameUI.onBuildingChange((buildingType) => {
      this.buildingSystem.setSelectedBuildingType(buildingType);
    });

    // Create some starting zones for demo
    this.createStartingZones();

    // Spawn initial resources
    this.spawnInitialResources();

    // Spawn initial piñatas
    this.spawnInitialPinatas();

    // Create attraction system (after piñatas exist)
    this.attractionSystem = new AttractionSystem(
      this,
      this.isoMap,
      this.zoneManager,
      this.resourceManager,
      this.pathfinder,
      this.pinatas
    );

    // Create time system (day/night cycle)
    this.timeSystem = new TimeSystem(this);

    // Create relationship system
    this.relationshipSystem = new RelationshipSystem(this.pinatas);

    // Create romance system (breeding)
    this.romanceSystem = new RomanceSystem(
      this,
      this.pinatas,
      this.relationshipSystem,
      this.pathfinder,
      this.zoneManager,
      this.resourceManager,
      this.timeSystem
    );

    // Create sour piñata system
    this.sourPinataSystem = new SourPinataSystem(
      this,
      this.isoMap,
      this.resourceManager,
      this.pathfinder,
      this.zoneManager,
      this.pinatas
    );

    // Create random event system
    this.randomEventSystem = new RandomEventSystem(
      this,
      this.isoMap,
      this.resourceManager,
      this.pinatas
    );

    // Create season system (affects resources, needs, visitors)
    this.seasonSystem = new SeasonSystem(this);

    // Create farming system (garden zones grow crops)
    this.farmingSystem = new FarmingSystem(
      this,
      this.zoneManager,
      this.resourceManager,
      this.isoMap
    );
    this.farmingSystem.setSeasonSystem(this.seasonSystem);

    // Create building system (structures with benefits)
    this.buildingSystem = new BuildingSystem(
      this,
      this.resourceManager,
      this.isoMap
    );

    // Create notification system (player feedback)
    this.notificationSystem = new NotificationSystem(this);

    // Create work system (job priorities and task assignment)
    this.workSystem = new WorkSystem(
      this.zoneManager,
      this.resourceManager
    );
    this.workSystem.setFarmingSystem(this.farmingSystem);
    this.workSystem.setBuildingSystem(this.buildingSystem);
    // Note: resourceNodeSystem set after it's created below

    // Create perception system (allows piñatas to notice events)
    this.perceptionSystem = new PerceptionSystem();
    this.perceptionSystem.setPinatas(this.pinatas);
    this.perceptionSystem.setRelationshipSystem(this.relationshipSystem);

    // Create colony system (tracks colony-wide state and pressure)
    this.colonySystem = new ColonySystem(this.resourceManager);
    this.colonySystem.setPinatas(this.pinatas);
    this.colonySystem.setSeasonSystem(this.seasonSystem);

    // Create resource node system (natural resources on the map)
    this.resourceNodeSystem = new ResourceNodeSystem(
      this,
      this.isoMap,
      this.resourceManager
    );
    this.resourceNodeSystem.setSeasonSystem(this.seasonSystem);
    this.resourceNodeSystem.generateNodes();

    // Connect work system to resource nodes
    this.workSystem.setResourceNodeSystem(this.resourceNodeSystem);

    // Create threat system (predator raids and night dangers)
    this.threatSystem = new ThreatSystem(this, this.isoMap, this.pathfinder);
    this.threatSystem.setPinatas(this.pinatas);
    this.threatSystem.setTimeSystem(this.timeSystem);
    this.threatSystem.setColonySystem(this.colonySystem);

    // Connect piñatas to all systems
    for (const pinata of this.pinatas) {
      pinata.setTimeSystem(this.timeSystem);
      pinata.setPinataList(this.pinatas);
      pinata.setRelationshipSystem(this.relationshipSystem);
      pinata.setSeasonSystem(this.seasonSystem);
      pinata.setBuildingSystem(this.buildingSystem);
      pinata.setFarmingSystem(this.farmingSystem);
      pinata.setPerceptionSystem(this.perceptionSystem);
      pinata.setIsoMap(this.isoMap);
    }

    // Welcome notifications
    this.notificationSystem.special('Welcome to Piñata Town!', '🎉');
    this.time.delayedCall(2500, () => {
      this.notificationSystem.info('[F]eed and [P]et piñatas to earn coins!', '💰');
    });

    console.log('Piñata Town loaded!');
    console.log('Controls: [Z]ones [B]uild [T]erraform [C]ommand [F]eed [P]et | [L] Log | [Space] Pause');
    console.log('Scroll wheel to zoom, right-click drag to pan.');
    console.log('Seasons cycle every 3 minutes. Prepare for winter!');
  }

  private createStartingZones(): void {
    // Create a stockpile zone near center
    const stockpile = this.zoneManager.createZone(ZoneType.Stockpile);
    for (let x = 14; x <= 17; x++) {
      for (let y = 14; y <= 16; y++) {
        if (this.isoMap.isWalkable(x, y)) {
          stockpile.addTile({ x, y });
        }
      }
    }

    // Create a sleep zone
    const sleepZone = this.zoneManager.createZone(ZoneType.Sleep);
    for (let x = 10; x <= 12; x++) {
      for (let y = 10; y <= 12; y++) {
        if (this.isoMap.isWalkable(x, y)) {
          sleepZone.addTile({ x, y });
        }
      }
    }

    // Create a recreation zone
    const recreationZone = this.zoneManager.createZone(ZoneType.Recreation);
    for (let x = 18; x <= 21; x++) {
      for (let y = 10; y <= 12; y++) {
        if (this.isoMap.isWalkable(x, y)) {
          recreationZone.addTile({ x, y });
        }
      }
    }

    // Create a garden zone for farming
    const gardenZone = this.zoneManager.createZone(ZoneType.Garden);
    for (let x = 10; x <= 13; x++) {
      for (let y = 18; y <= 21; y++) {
        if (this.isoMap.isWalkable(x, y)) {
          gardenZone.addTile({ x, y });
        }
      }
    }
  }

  private spawnInitialResources(): void {
    // Add some berries to the stockpile to start
    for (let i = 0; i < 10; i++) {
      // Spawn near stockpile and immediately add to stockpile count
      const resource = this.resourceManager.spawnResource(15, 15, ResourceType.Berry);
      this.resourceManager.addToStockpile(resource);
    }

    // Add seeds for farming
    for (let i = 0; i < 8; i++) {
      const seedResource = this.resourceManager.spawnResource(15, 16, ResourceType.Seed);
      this.resourceManager.addToStockpile(seedResource);
    }

    // Also spawn some berries in the world
    for (let i = 0; i < 5; i++) {
      let x: number, y: number;
      do {
        x = Math.floor(Math.random() * WORLD_WIDTH);
        y = Math.floor(Math.random() * WORLD_HEIGHT);
      } while (!this.isoMap.isWalkable(x, y));

      this.resourceManager.spawnResource(x, y, ResourceType.Berry);
    }
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

    // Mouse wheel zoom - prevent browser scroll
    this.game.canvas.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      const camera = this.cameras.main;
      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Phaser.Math.Clamp(
        camera.zoom + zoomDelta,
        CAMERA_ZOOM_MIN,
        CAMERA_ZOOM_MAX
      );
      camera.setZoom(newZoom);
    }, { passive: false });

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
    } else if (this.gameUI.getMode() === UIMode.Terraform && this.selectedTerrainType) {
      // Start terraform drag
      this.isDragging = true;
      this.dragStart = gridPos;
      this.isoMap.setTerrain(gridPos.x, gridPos.y, this.selectedTerrainType);
    } else if (this.gameUI.getMode() === UIMode.Command && this.selectedCommand && this.selectedPinata) {
      // Execute command on selected piñata
      this.executeCommand(gridPos);
    } else if (this.gameUI.getMode() === UIMode.Build) {
      // Place building blueprint
      const buildingType = this.buildingSystem.getSelectedBuildingType();
      if (buildingType) {
        const building = this.buildingSystem.placeBlueprint(gridPos, buildingType);
        if (building) {
          this.notificationSystem.info(`${building.data.name} blueprint placed`, building.data.icon);
        } else if (!this.buildingSystem.canPlace(gridPos, buildingType)) {
          this.notificationSystem.warning('Cannot place building here');
        } else if (!this.buildingSystem.canAfford(buildingType)) {
          this.notificationSystem.warning('Not enough resources!');
        }
      }
    }
    // Normal mode clicks are handled by piñata interactive zones
  }

  private handleDrag(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const gridPos = screenToGridRounded(worldPoint.x, worldPoint.y);

    if (this.gameUI.getMode() === UIMode.Terraform && this.selectedTerrainType) {
      // Paint terrain as we drag
      this.isoMap.setTerrain(gridPos.x, gridPos.y, this.selectedTerrainType);
      return;
    }

    if (!this.dragStart || !this.currentZone) return;

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

  private executeCommand(gridPos: GridPosition): void {
    if (!this.selectedPinata || !this.selectedCommand) return;

    switch (this.selectedCommand) {
      case CommandType.MoveTo:
        this.selectedPinata.commandMoveTo(gridPos.x, gridPos.y);
        break;

      case CommandType.PickUp:
        // Find nearest resource to clicked position
        const resource = this.resourceManager.findNearestResource(gridPos);
        if (resource) {
          this.selectedPinata.commandPickUp(resource);
        }
        break;

      case CommandType.Guard:
        this.selectedPinata.commandGuard(gridPos.x, gridPos.y);
        break;

      case CommandType.Stay:
        this.selectedPinata.commandStay();
        break;
    }

    // Return to normal mode after command
    this.gameUI.setMode(UIMode.Normal);
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
    bg.fillRoundedRect(0, -180, 250, 170, 8);
    this.infoPanel.add(bg);

    // Text
    this.infoPanelText = this.add.text(10, -170, '', {
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

    // Handle piñata selection and interactions
    EventBus.on(GameEvents.PINATA_SELECTED, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      const mode = this.gameUI.getMode();

      if (mode === UIMode.Normal) {
        this.selectPinata(pinata);
      } else if (mode === UIMode.Feed) {
        this.feedPinata(pinata);
      } else if (mode === UIMode.Pet) {
        this.petPinata(pinata);
      }
    });

    // Connect newly created piñatas to all systems
    EventBus.on(GameEvents.PINATA_CREATED, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      pinata.setTimeSystem(this.timeSystem);
      pinata.setRelationshipSystem(this.relationshipSystem);
      pinata.setSeasonSystem(this.seasonSystem);
      pinata.setBuildingSystem(this.buildingSystem);
      pinata.setFarmingSystem(this.farmingSystem);
      pinata.setPerceptionSystem(this.perceptionSystem);
      pinata.setIsoMap(this.isoMap);
      pinata.setPinataList(this.pinatas);
    });

    // Reward systems - earn coins and score!
    EventBus.on(GameEvents.PINATA_BORN, () => {
      this.gameUI.addCoins(20);
      this.gameUI.addScore(50);
      this.notificationSystem.special('New baby! +20 coins, +50 points', '👶');
    });

    EventBus.on(GameEvents.SOUR_PINATA_CURED, () => {
      this.gameUI.addCoins(30);
      this.gameUI.addScore(100);
      this.notificationSystem.special('Sour cured! +30 coins, +100 points', '💚');
    });

    EventBus.on(GameEvents.SPECIES_ATTRACTED, () => {
      this.gameUI.addCoins(15);
      this.gameUI.addScore(75);
      this.notificationSystem.special('New resident! +15 coins, +75 points', '🏠');
    });

    EventBus.on(GameEvents.RESOURCE_COLLECTED, () => {
      this.gameUI.addCoins(1);
      this.gameUI.addScore(2);
    });

    EventBus.on(GameEvents.BUILDING_COMPLETE, () => {
      this.gameUI.addCoins(10);
      this.gameUI.addScore(30);
    });

    // Colony events
    EventBus.on(GameEvents.COLONY_STARVATION, (...args: unknown[]) => {
      const pinata = args[0] as Pinata;
      this.notificationSystem.warning(`${pinata.nickname} is starving!`, '💀');
    });

    // Resource node harvesting
    EventBus.on(GameEvents.RESOURCE_HARVESTED, () => {
      this.gameUI.addScore(3);
    });

    // Threat system events
    EventBus.on('threat:raidStarting', (...args: unknown[]) => {
      const { count } = args[0] as { count: number };
      this.notificationSystem.warning(`Predator raid incoming! ${count} predator(s) spotted!`, '🐺');
    });

    EventBus.on('threat:predatorSpawned', (...args: unknown[]) => {
      const predator = args[0] as Pinata;
      // Wire up the new predator to systems
      predator.setZoneManager(this.zoneManager);
      predator.setResourceManager(this.resourceManager);
    });

    EventBus.on('threat:predatorKilled', () => {
      this.gameUI.addCoins(25);
      this.gameUI.addScore(50);
      this.notificationSystem.success('Predator defeated!', '⚔️');
    });

    // Relationship drama events
    EventBus.on('relationship:romance', (...args: unknown[]) => {
      const [pinataA, pinataB] = args as [Pinata, Pinata];
      this.notificationSystem.special(`${pinataA.nickname} ❤️ ${pinataB.nickname}`, '💕');
    });

    EventBus.on('relationship:jealousy', (...args: unknown[]) => {
      const [jealous, interloper] = args as [Pinata, Pinata, Pinata];
      this.notificationSystem.warning(`${jealous.nickname} is jealous of ${interloper.nickname}!`, '😤');
    });
  }

  private spawnInitialPinatas(): void {
    // Start with just 3 Sparrowmints (the starter species)
    const species = [
      PinataSpecies.Sparrowmint,
      PinataSpecies.Sparrowmint,
      PinataSpecies.Moozipan,
    ];

    for (let i = 0; i < species.length; i++) {
      let gridX: number, gridY: number;

      // Find a valid spawn position
      do {
        gridX = Math.floor(WORLD_WIDTH / 4 + Math.random() * WORLD_WIDTH / 2);
        gridY = Math.floor(WORLD_HEIGHT / 4 + Math.random() * WORLD_HEIGHT / 2);
      } while (!this.isoMap.isWalkable(gridX, gridY));

      const pinata = new Pinata(this, gridX, gridY, species[i], this.pathfinder);
      // Connect piñata to zone and resource managers
      pinata.setZoneManager(this.zoneManager);
      pinata.setResourceManager(this.resourceManager);
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

  private feedPinata(pinata: Pinata): void {
    const FEED_COST = 5;
    const FEED_AMOUNT = 30;

    if (!this.gameUI.spendCoins(FEED_COST)) {
      this.notificationSystem.warning('Not enough candy coins!');
      return;
    }

    // Feed the piñata
    pinata.feed(FEED_AMOUNT);
    this.gameUI.addScore(10);

    // Show tasty effect
    this.createFeedEffect(pinata);

    this.notificationSystem.success(`Fed ${pinata.nickname}!`, '🍬');
  }

  private petPinata(pinata: Pinata): void {
    const PET_HAPPINESS = 20;
    const PET_SOCIAL = 15;

    // Petting is free!
    pinata.play(PET_HAPPINESS);
    pinata.boostSocial(PET_SOCIAL);
    this.gameUI.addScore(5);

    // Show love effect
    this.createPetEffect(pinata);

    this.notificationSystem.info(`${pinata.nickname} loves you!`, '❤️');
  }

  private createFeedEffect(pinata: Pinata): void {
    // Candy burst particles
    const emojis = ['🍬', '🍭', '🍫', '✨'];
    for (let i = 0; i < 6; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const text = this.add.text(
        pinata.x + (Math.random() - 0.5) * 40,
        pinata.y - 20,
        emoji,
        { fontSize: '16px' }
      );
      text.setOrigin(0.5);
      text.setDepth(2000);

      this.tweens.add({
        targets: text,
        x: text.x + (Math.random() - 0.5) * 60,
        y: text.y - 40 - Math.random() * 30,
        alpha: 0,
        scale: 0.5,
        duration: 800 + Math.random() * 400,
        ease: 'Power2',
        onComplete: () => text.destroy(),
      });
    }

    // Bounce the piñata
    this.tweens.add({
      targets: pinata,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 100,
      yoyo: true,
      repeat: 1,
    });
  }

  private createPetEffect(pinata: Pinata): void {
    // Hearts floating up
    for (let i = 0; i < 5; i++) {
      const heart = this.add.text(
        pinata.x + (Math.random() - 0.5) * 30,
        pinata.y - 30,
        '❤️',
        { fontSize: `${12 + Math.random() * 10}px` }
      );
      heart.setOrigin(0.5);
      heart.setDepth(2000);

      this.tweens.add({
        targets: heart,
        y: heart.y - 50 - Math.random() * 30,
        alpha: 0,
        duration: 1000 + Math.random() * 500,
        delay: i * 100,
        ease: 'Power2',
        onComplete: () => heart.destroy(),
      });
    }

    // Wiggle the piñata happily
    this.tweens.add({
      targets: pinata,
      angle: { from: -5, to: 5 },
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => { pinata.angle = 0; },
    });
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

      // Update attraction system (checks for new species to attract)
      this.attractionSystem.update(delta);

      // Update time system (day/night cycle)
      this.timeSystem.update(delta);

      // Update relationship system
      this.relationshipSystem.update(delta);

      // Update romance system (breeding)
      this.romanceSystem.update(delta);

      // Update sour piñata system
      this.sourPinataSystem.update(delta);

      // Update random event system
      this.randomEventSystem.update(delta);

      // Update season system
      this.seasonSystem.update(delta);

      // Update farming system
      this.farmingSystem.update(delta);

      // Update work system (assigns tasks to idle piñatas)
      this.workSystem.update(delta, this.pinatas);

      // Update perception system
      this.perceptionSystem.update(delta);

      // Update colony system (tracks colony health and pressure)
      this.colonySystem.update(delta);

      // Update resource nodes (natural resource growth)
      this.resourceNodeSystem.update(delta);

      // Update threat system (predator raids)
      this.threatSystem.update(delta);

      // Periodically spawn new resources (affected by season)
      this.resourceSpawnTimer += delta;
      const spawnInterval = this.RESOURCE_SPAWN_INTERVAL / this.seasonSystem.getResourceSpawnMultiplier();
      if (this.resourceSpawnTimer >= spawnInterval) {
        this.resourceSpawnTimer = 0;
        this.spawnRandomResource();
      }

      // Passive income from happy piñatas
      this.incomeTimer += delta;
      if (this.incomeTimer >= this.INCOME_INTERVAL) {
        this.incomeTimer = 0;
        this.generatePassiveIncome();
      }
    }

    // Update hover indicator
    this.updateHoverIndicator();

    // Update debug text
    this.updateDebugText();

    // Update info panel
    this.updateInfoPanel();
  }

  private generatePassiveIncome(): void {
    // Count happy piñatas
    let happyCount = 0;
    let totalHappiness = 0;

    for (const pinata of this.pinatas) {
      if (!pinata.getIsAlive()) continue;
      const mood = pinata.getMood();
      if (mood === MoodState.Happy) {
        happyCount++;
        totalHappiness += 3;
      } else if (mood === MoodState.Content) {
        totalHappiness += 1;
      }
    }

    if (totalHappiness > 0) {
      const coins = Math.floor(totalHappiness);
      const score = Math.floor(totalHappiness * 2);
      this.gameUI.addCoins(coins);
      this.gameUI.addScore(score);

      // Only show notification if significant
      if (happyCount >= 2) {
        this.notificationSystem.info(`Happy garden! +${coins} coins`, '😊');
      }
    }
  }

  private spawnRandomResource(): void {
    // Spawn a berry at a random walkable location
    let x: number, y: number;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * WORLD_WIDTH);
      y = Math.floor(Math.random() * WORLD_HEIGHT);
      attempts++;
    } while (!this.isoMap.isWalkable(x, y) && attempts < 50);

    if (attempts < 50) {
      this.resourceManager.spawnResource(x, y, ResourceType.Berry);
    }
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

      // Different color based on mode
      let color = 0xffffff;
      if (this.gameUI.getMode() === UIMode.ZoneDesignate) {
        color = 0x00ff00;
      } else if (this.gameUI.getMode() === UIMode.Build) {
        const buildingType = this.buildingSystem.getSelectedBuildingType();
        if (buildingType) {
          const canPlace = this.buildingSystem.canPlace(gridPos, buildingType);
          const canAfford = this.buildingSystem.canAfford(buildingType);
          color = canPlace && canAfford ? 0x00ff00 : 0xff0000;
        }
      }

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
    const colonyState = this.colonySystem.getColonyState();

    // Colony mood emoji
    const moodEmoji: Record<ColonyMood, string> = {
      [ColonyMood.Thriving]: '🌟',
      [ColonyMood.Stable]: '😊',
      [ColonyMood.Worried]: '😟',
      [ColonyMood.Desperate]: '😰',
      [ColonyMood.Mourning]: '😢',
      [ColonyMood.UnderAttack]: '⚔️',
    };

    const threatLevel = this.threatSystem.getThreatLevel();
    const threatEmoji: Record<ThreatLevel, string> = {
      [ThreatLevel.None]: '🕊️',
      [ThreatLevel.Low]: '⚠️',
      [ThreatLevel.Medium]: '⚠️⚠️',
      [ThreatLevel.High]: '🔥',
      [ThreatLevel.Siege]: '☠️',
    };

    const lines = [
      `Tile: (${gridPos.x}, ${gridPos.y})`,
      `Terrain: ${tile?.terrain ?? 'none'}`,
      zone ? `Zone: ${zone.config.name}` : '',
      ``,
      `Colony ${moodEmoji[colonyState.mood]} ${colonyState.mood}`,
      `Population: ${this.colonySystem.getPopulation()}`,
      `Food: ${this.resourceManager.getTotalFood()} (${Math.round(colonyState.foodSecurity)}% secure)`,
      threatLevel !== ThreatLevel.None
        ? `Threat: ${threatEmoji[threatLevel]} ${threatLevel}`
        : '',
      this.threatSystem.getActivePredatorCount() > 0
        ? `Predators: ${this.threatSystem.getActivePredatorCount()}`
        : '',
      this.colonySystem.isWinterComing()
        ? `Winter prep: ${Math.round(colonyState.winterPrepScore)}%`
        : '',
      colonyState.fearLevel > 10
        ? `Fear: ${Math.round(colonyState.fearLevel)}%`
        : '',
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

    // Get current goal info
    const currentGoal = p.getCurrentGoal();
    const goalInfo = currentGoal
      ? `${currentGoal.type} (${currentGoal.source})`
      : 'none';

    const lines = [
      `${p.nickname}`,
      `Species: ${p.speciesData.name}`,
      `Traits: ${p.describeTraits()}`,
      `Mood: ${p.getMood()} | Job: ${p.getJob()}`,
      `Goal: ${goalInfo}`,
      `Position: (${pos.x}, ${pos.y})`,
      ``,
      `Hunger: ${needBar(needs.hunger)} ${Math.round(needs.hunger)}`,
      `Rest:   ${needBar(needs.rest)} ${Math.round(needs.rest)}`,
      `Fun:    ${needBar(needs.fun)} ${Math.round(needs.fun)}`,
      `Social: ${needBar(needs.social)} ${Math.round(needs.social)}`,
    ];

    // Add production info for producers
    const progress = p.getProductionProgress();
    if (progress !== null) {
      lines.push(``);
      lines.push(`Production: ${needBar(progress)} ${Math.round(progress)}%`);
    }

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

  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }
}
