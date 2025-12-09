# Pinatatown

A colony-sim game where you manage a village of colorful pinata creatures. Built with Phaser 3 and TypeScript.

## Overview

Pinatatown is a colony management game inspired by Viva Pinata and Dwarf Fortress. You attract wild pinatas to your garden, keep them happy and fed, protect them from predators, and help your colony thrive through the seasons. Each pinata has unique traits that affect their behavior, creating emergent stories as your colony grows.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Controls

| Key | Action |
|-----|--------|
| **WASD / Arrow Keys** | Pan camera |
| **Mouse Wheel** | Zoom in/out |
| **Click Pinata** | Select and view details |
| **Z** | Zone mode (designate areas) |
| **B** | Build mode (place structures) |
| **T** | Terraform mode (modify terrain) |
| **C** | Command mode (direct pinatas) |
| **F** | Feed selected pinata |
| **P** | Pet selected pinata |
| **Space** | Pause/Resume game |
| **Tab** | Toggle UI panels |
| **ESC** | Cancel current action |

## Game Mechanics

### Pinata Needs

Every pinata has four core needs that decay over time:

- **Hunger** - Satisfied by eating from stockpiles. Critical need.
- **Rest** - Restored in Sleep zones or Candy Houses.
- **Fun** - Restored in Recreation zones or Playgrounds.
- **Social** - Restored by interacting with other pinatas.

When needs drop too low, pinatas become stressed. If a need becomes critical, they may have a **mental break** - wandering aimlessly, hiding, throwing tantrums, or (if they have the Pyromaniac trait) starting fires!

### Mood States

| Mood | Condition | Effect |
|------|-----------|--------|
| Happy | High average needs | +20% movement speed |
| Content | Moderate needs | Normal behavior |
| Stressed | Low needs | Reduced productivity |
| Breaking | Critical need | Mental break behavior |

### Traits

Each pinata is born with 2-3 personality traits that affect their behavior:

**Work Traits**
- Industrious - Works 40% faster
- Lazy - Works slowly, idles frequently

**Social Traits**
- Social Butterfly - Craves company, gains more from socializing
- Loner - Prefers solitude

**Courage Traits**
- Brave - Stands ground against threats
- Cowardly - Flees at first sign of danger

**Quirks**
- Pyromaniac - May start fires during mental breaks
- Kind - Helps others, feels good doing it
- Greedy - Hoards resources
- Lucky - Finds bonus resources
- Optimist / Pessimist - Affect mood sensitivity

### Relationships

Pinatas form relationships through interaction:
- **Stranger** -> **Acquaintance** -> **Friend** -> **Best Friend**
- Strong friendships provide mood boosts when nearby
- Negative interactions create **Rivals** who hurt each other's mood
- Same-species pinatas with high affection may **Romance** and produce offspring

## Species

| Species | Speed | Role | Special Ability | Attracted By |
|---------|-------|------|-----------------|--------------|
| **Sparrowmint** | Fast | Gatherer | Quick movement | Grass, Seeds |
| **Moozipan** | Slow | Farmer | Produces Candy Milk | Flowers, Water |
| **Buzzlegum** | Medium | Farmer | Produces Honey | Flowers |
| **Rashberry** | Medium | Guard | Combat bonus | Berries |
| **Pretztail** | Fast | Predator | Hunting | Other pinatas (danger!) |

### Attracting New Species

Each species has requirements before they'll visit:
1. **Environment** - Certain terrain types or plants
2. **Resources** - Food availability
3. **Population** - Some require existing residents

Once requirements are met, wild visitors may appear. Keep them happy and they'll decide to stay as permanent residents!

## Zones

Designate areas with the **Z** key:

| Zone | Purpose |
|------|---------|
| **Stockpile** | Storage for gathered resources. Pinatas deposit food here. |
| **Sleep** | Rest area. Pinatas recover rest faster here. |
| **Recreation** | Play area. Pinatas recover fun here. |
| **Garden** | Farming area. Plant and grow crops. |
| **Guard** | Patrol area. Guards watch for predators. |

## Buildings

Construct buildings with the **B** key (costs resources and Candy Coins):

| Building | Cost | Effect |
|----------|------|--------|
| **Candy House** | 15 Berry, 30 Coins | Rest recovers 50% faster nearby |
| **Watchtower** | 10 Berry + 5 Seed, 40 Coins | Guards spot threats from further away |
| **Granary** | 20 Berry + 10 Seed, 60 Coins | +50 stockpile capacity |
| **Playground** | 12 Berry, 25 Coins | Fun recovers 75% faster nearby |
| **Fence** | 3 Seed, 5 Coins | Blocks predator movement |
| **Water Well** | 8 Berry + 4 Seed, 20 Coins | Waters crops in 5-tile radius |
| **Shrine** | 25 Berry + 5 Honey, 100 Coins | Colony-wide mood boost |
| **Honey Pot** | 10 Berry + 3 Honey, 35 Coins | Attracts Buzzlegum faster |
| **Workshop** | 15 Berry + 8 Seed, 50 Coins | Work speed bonus nearby |

Buildings must be unlocked through challenges before they can be constructed.

## Farming

In Garden zones, plant crops to grow food:

| Crop | Growth Time | Yield | Season | Notes |
|------|-------------|-------|--------|-------|
| **Carrot** | 30s | 2-4 Berry | Spring | Fast, basic food |
| **Sunflower** | 45s | 3-6 Seed | Summer | Attracts Buzzlegum |
| **Clover** | 25s | 1-2 Berry | Spring | Attracts Moozipan |
| **Chili** | 50s | 2-5 Berry | Summer | Attracts Rashberry |
| **Pumpkin** | 90s | 5-10 Berry | Autumn | High yield, slow |
| **Turnip** | 60s | 2-4 Berry | Any | Grows in autumn! |

Crops grow faster in their preferred season and need water (from Water tiles or Wells).

## Seasons

The game cycles through four seasons (3 minutes each):

| Season | Effect |
|--------|--------|
| **Spring** | Resources plentiful, many visitors, fast crop growth |
| **Summer** | Peak abundance, long days, but heat increases rest decay |
| **Autumn** | Harvest time! Stock up before winter. Predators getting hungrier. |
| **Winter** | Resources scarce, crops don't grow, hunger/rest decay faster, desperate predators! |

**Survival depends on preparation.** A colony that didn't stockpile enough food in autumn will struggle through winter.

## Day/Night Cycle

Each day lasts 5 minutes with distinct phases:

- **Dawn** (10%) - New day begins
- **Day** (50%) - Normal activity
- **Dusk** (10%) - Evening approaches
- **Night** (30%) - Rest decays faster, Night Owls active, predators more dangerous

## Threats

### Predators

**Pretztails** are predatory pinatas that hunt your residents:
- Wild Pretztails spawn in raids based on your colony's prosperity
- They target non-guard pinatas
- **Guards** (Rashberries or assigned pinatas) will fight them off
- Build **Fences** to block their movement
- Build **Watchtowers** for early warning

### Threat Levels

| Level | Condition | Raids |
|-------|-----------|-------|
| None | Early game | No raids |
| Low | 3+ residents | 1 predator every 2-4 min |
| Medium | 5+ residents, buildings | 2 predators every 1.5-3 min |
| High | 10+ residents | 3 predators every 1-2 min |
| Siege | Large prosperous colony | 4 predators every 45s-1.5 min |

## Challenges & Progression

Complete challenges to earn Candy Coins and unlock new buildings:

**Population Challenges**
- First Friend - Have a visitor decide to stay
- Small Colony - Reach 5 residents
- Thriving Community - Reach 10 residents
- Bustling Town - Reach 15 residents

**Species Challenges**
- New Life - First baby born
- Diverse Garden - Have 3 different species
- Species Collector - Attract all 5 species

**Building Challenges**
- Construction Begins - Complete first building
- Village Center - Build 5 structures
- Grand Estate - Build 10 structures

**Survival Challenges**
- First Blood - Lose a pinata to a predator
- Defender - Successfully defend against a raid
- Winter Survivor - Survive your first winter
- Unbroken - Survive a year without losses

**Economy Challenges**
- First Savings - Accumulate 100 coins
- Sweet Industry - Produce 10 honey
- Master Stockpiler - Store 100 resources

### Victory & Game Over

- **Victory**: Complete all challenges and earn the title of "Grand Master Gardener"
- **Game Over**: All pinatas die (extinction)

## Technical Architecture

### Core Systems

```
src/
├── main.ts              # Entry point, Phaser config
├── scenes/
│   ├── BootScene.ts     # Asset loading
│   └── GameScene.ts     # Main game orchestration
├── entities/
│   ├── Pinata.ts        # Creature AI, needs, goals
│   ├── PinataTypes.ts   # Species definitions
│   └── Resource.ts      # Resource items, stockpile management
├── systems/
│   ├── GoalSystem.ts    # Priority-based AI goals
│   ├── TraitSystem.ts   # Personality traits
│   ├── RelationshipSystem.ts  # Social bonds
│   ├── AttractionSystem.ts    # Species attraction
│   ├── ChallengeSystem.ts     # Goals and rewards
│   ├── BuildingSystem.ts      # Construction
│   ├── FarmingSystem.ts       # Crop management
│   ├── TimeSystem.ts          # Day/night cycle
│   ├── SeasonSystem.ts        # Seasonal effects
│   ├── ThreatSystem.ts        # Predator raids
│   ├── ColonySystem.ts        # Colony-wide state
│   ├── WorkSystem.ts          # Task assignment
│   └── PerceptionSystem.ts    # Entity awareness
├── world/
│   ├── IsoMap.ts        # Isometric tile map
│   ├── IsoUtils.ts      # Coordinate conversion
│   ├── Pathfinding.ts   # A* pathfinding
│   └── Zone.ts          # Zone management
├── ui/
│   ├── GameHUD.ts       # Master HUD controller
│   ├── StatusBar.ts     # Top resource bar
│   ├── ColonyPanel.ts   # Colony dashboard
│   ├── SpeciesPanel.ts  # Species attraction status
│   ├── ChallengePanel.ts # Challenge progress
│   └── UIComponents.ts  # Reusable UI elements
└── utils/
    ├── Constants.ts     # Game constants
    └── EventBus.ts      # Event system
```

### AI System

Pinatas use a **goal-based AI** system:
1. **Perception** scans environment for threats, friends, resources
2. **Goal Generation** creates goals from needs and observations
3. **Goal Queue** prioritizes goals (modified by traits)
4. **Behavior Execution** acts on the highest-priority goal

Goals can be:
- **Internal** - From needs (hunger, rest, fun, social)
- **Reactive** - From perception (flee threat, help friend)
- **Assigned** - From work system (gather, farm, build)
- **Instinct** - Species-specific (hunting for Pretztails)

### Event System

Systems communicate via an EventBus:
```typescript
// Emitting
EventBus.emit(GameEvents.PINATA_DIED, pinata, attacker);

// Listening
EventBus.on(GameEvents.PINATA_DIED, (pinata, attacker) => {
  this.onPinataDeath(pinata, attacker);
});
```

Key events: `PINATA_CREATED`, `PINATA_DIED`, `PINATA_MOOD_CHANGED`, `RESOURCE_COLLECTED`, `BUILDING_COMPLETE`, `SEASON_CHANGED`, `CHALLENGE_COMPLETED`

## Development

```bash
# Run development server with hot reload
npm run dev

# Type check
npx tsc --noEmit

# Build production bundle
npm run build
```

## License

MIT
