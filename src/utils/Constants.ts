// Game dimensions
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Isometric tile dimensions (2:1 ratio)
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// World size in tiles
export const WORLD_WIDTH = 32;
export const WORLD_HEIGHT = 32;

// Camera settings
export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 2;
export const CAMERA_PAN_SPEED = 10;

// Creature settings
export const NEED_MAX = 100;
export const NEED_DECAY_RATE = 0.1; // per second
export const MOVEMENT_SPEED = 100; // pixels per second

// Mood thresholds
export const MOOD_HAPPY_THRESHOLD = 75;
export const MOOD_STRESSED_THRESHOLD = 40;
export const MOOD_BREAKING_THRESHOLD = 15;

// Colors (hex)
export const COLORS = {
  grass: 0x7ec850,
  grassDark: 0x5da830,
  dirt: 0xc4a36e,
  water: 0x5b9bd5,

  // Piñata species colors
  sparrowmint: 0x6cb4ee,
  moozipan: 0xffb6c1,
  buzzlegum: 0xffd700,
  rashberry: 0xff6b6b,
  pretztail: 0xff8c42,

  // UI colors
  selection: 0x00ff00,
  highlight: 0xffff00,
  danger: 0xff0000,
};

// Terrain types
export enum TerrainType {
  Grass = 'grass',
  Dirt = 'dirt',
  Water = 'water',
  Flowers = 'flowers',
}

// Terrain effects - how terrain affects piñata behavior
export interface TerrainEffect {
  speedModifier: number;  // 1.0 = normal speed, <1 = slower, >1 = faster
  moodBonus: number;      // Added to mood calculation while on this terrain
}

export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  [TerrainType.Grass]: { speedModifier: 1.0, moodBonus: 0 },
  [TerrainType.Dirt]: { speedModifier: 0.85, moodBonus: -0.3 },  // Slower, slightly unpleasant
  [TerrainType.Water]: { speedModifier: 0, moodBonus: 0 },       // Impassable
  [TerrainType.Flowers]: { speedModifier: 1.0, moodBonus: 1.0 }, // Happy place!
};
