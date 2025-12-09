import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT, COLORS } from '../utils/Constants';

/**
 * Boot scene - handles asset loading and procedural sprite generation
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  create(): void {
    // Generate procedural sprites
    this.generateTileSprites();
    this.generatePinataSprites();

    // Start the game scene
    this.scene.start('GameScene');
  }

  private generateTileSprites(): void {
    // Grass tile
    this.generateIsoDiamond('tile-grass', COLORS.grass, COLORS.grassDark);

    // Dirt tile
    this.generateIsoDiamond('tile-dirt', COLORS.dirt, 0xa8894d);

    // Water tile
    this.generateIsoDiamond('tile-water', COLORS.water, 0x4a8bc4);

    // Flowers tile (grass with colored dots)
    this.generateFlowerTile();
  }

  private generateIsoDiamond(key: string, topColor: number, sideColor: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Top face (diamond)
    graphics.fillStyle(topColor);
    graphics.beginPath();
    graphics.moveTo(TILE_WIDTH / 2, 0);
    graphics.lineTo(TILE_WIDTH, TILE_HEIGHT / 2);
    graphics.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    graphics.lineTo(0, TILE_HEIGHT / 2);
    graphics.closePath();
    graphics.fillPath();

    // Add subtle border
    graphics.lineStyle(1, sideColor, 0.5);
    graphics.strokePath();

    graphics.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
    graphics.destroy();
  }

  private generateFlowerTile(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Base grass
    graphics.fillStyle(COLORS.grass);
    graphics.beginPath();
    graphics.moveTo(TILE_WIDTH / 2, 0);
    graphics.lineTo(TILE_WIDTH, TILE_HEIGHT / 2);
    graphics.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
    graphics.lineTo(0, TILE_HEIGHT / 2);
    graphics.closePath();
    graphics.fillPath();

    // Add flower dots
    const flowerColors = [0xff69b4, 0xffff00, 0xff6347, 0x9370db];
    for (let i = 0; i < 5; i++) {
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      graphics.fillStyle(color);
      // Random position within diamond bounds
      const t = Math.random();
      const s = Math.random();
      const px = TILE_WIDTH / 2 + (t - 0.5) * TILE_WIDTH * 0.6;
      const py = TILE_HEIGHT / 2 + (s - 0.5) * TILE_HEIGHT * 0.6;
      graphics.fillCircle(px, py, 2);
    }

    graphics.generateTexture('tile-flowers', TILE_WIDTH, TILE_HEIGHT);
    graphics.destroy();
  }

  private generatePinataSprites(): void {
    // Generate each piñata species
    this.generatePinataSprite('pinata-sparrowmint', COLORS.sparrowmint, 'bird');
    this.generatePinataSprite('pinata-moozipan', COLORS.moozipan, 'cow');
    this.generatePinataSprite('pinata-buzzlegum', COLORS.buzzlegum, 'bee');
    this.generatePinataSprite('pinata-rashberry', COLORS.rashberry, 'spiky');
    this.generatePinataSprite('pinata-pretztail', COLORS.pretztail, 'fox');

    // Selection indicator
    this.generateSelectionIndicator();
  }

  private generatePinataSprite(
    key: string,
    color: number,
    type: 'bird' | 'cow' | 'bee' | 'spiky' | 'fox'
  ): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const width = 32;
    const height = 40;

    // Body (isometric diamond shape)
    graphics.fillStyle(color);
    graphics.beginPath();
    graphics.moveTo(width / 2, 8);
    graphics.lineTo(width - 4, height / 2);
    graphics.lineTo(width / 2, height - 8);
    graphics.lineTo(4, height / 2);
    graphics.closePath();
    graphics.fillPath();

    // Outline
    graphics.lineStyle(2, 0x000000, 0.3);
    graphics.strokePath();

    // Eyes
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(width / 2 - 5, height / 2 - 4, 4);
    graphics.fillCircle(width / 2 + 5, height / 2 - 4, 4);

    // Pupils
    graphics.fillStyle(0x000000);
    graphics.fillCircle(width / 2 - 4, height / 2 - 4, 2);
    graphics.fillCircle(width / 2 + 6, height / 2 - 4, 2);

    // Species-specific features
    switch (type) {
      case 'bird':
        // Wings
        graphics.fillStyle(color);
        graphics.fillTriangle(0, height / 2, 8, height / 2 - 6, 8, height / 2 + 6);
        graphics.fillTriangle(width, height / 2, width - 8, height / 2 - 6, width - 8, height / 2 + 6);
        break;
      case 'cow':
        // Spots
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(width / 2 + 6, height / 2 + 6, 3);
        graphics.fillCircle(width / 2 - 4, height / 2 + 8, 2);
        break;
      case 'bee':
        // Stripes
        graphics.fillStyle(0x000000);
        graphics.fillRect(8, height / 2, width - 16, 3);
        graphics.fillRect(8, height / 2 + 8, width - 16, 3);
        // Antenna
        graphics.lineStyle(2, 0x000000);
        graphics.lineBetween(width / 2 - 4, 8, width / 2 - 6, 2);
        graphics.lineBetween(width / 2 + 4, 8, width / 2 + 6, 2);
        break;
      case 'spiky':
        // Spikes around edge
        graphics.fillStyle(color);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const sx = width / 2 + Math.cos(angle) * 16;
          const sy = height / 2 + Math.sin(angle) * 12;
          graphics.fillTriangle(
            sx,
            sy,
            sx + Math.cos(angle) * 6,
            sy + Math.sin(angle) * 6,
            sx + Math.cos(angle + 0.3) * 4,
            sy + Math.sin(angle + 0.3) * 4
          );
        }
        break;
      case 'fox':
        // Pointy ears
        graphics.fillStyle(color);
        graphics.fillTriangle(width / 2 - 8, 8, width / 2 - 12, 0, width / 2 - 4, 4);
        graphics.fillTriangle(width / 2 + 8, 8, width / 2 + 12, 0, width / 2 + 4, 4);
        // Sly eye adjustment - narrower
        graphics.fillStyle(0xffffff);
        graphics.fillRect(width / 2 - 8, height / 2 - 5, 6, 3);
        graphics.fillRect(width / 2 + 2, height / 2 - 5, 6, 3);
        break;
    }

    // Legs
    graphics.fillStyle(0x000000, 0.5);
    graphics.fillRect(width / 2 - 6, height - 6, 4, 6);
    graphics.fillRect(width / 2 + 2, height - 6, 4, 6);

    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private generateSelectionIndicator(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Selection ring
    graphics.lineStyle(3, COLORS.selection, 0.8);
    graphics.strokeEllipse(32, 32, 48, 24);

    graphics.generateTexture('selection', 64, 64);
    graphics.destroy();
  }
}
