# Piñata Town - Game Design Document

## Overview

**Genre**: Colony Simulation / Creature Collector
**Inspiration**: Dwarf Fortress meets Viva Piñata
**Tone**: Peaceful baseline with emergent drama
**Engine**: Phaser 3 + TypeScript

### Core Fantasy

You're the caretaker of a magical garden where living piñata creatures make their home. Attract new species by creating the right environment, keep them happy by meeting their needs, and watch stories unfold as they work, play, befriend, and occasionally have dramatic mental breakdowns.

---

## Core Game Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Attract Piñatas → Assign Jobs → Meet Needs → Expand → Repeat  │
│       ↑                                              │          │
│       └──────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Attract**: Create environments that draw specific species
2. **Manage**: Piñatas auto-assign to jobs based on species + needs
3. **Sustain**: Ensure food, rest, fun, and social needs are met
4. **Expand**: Grow your garden to attract rarer species
5. **Drama**: Handle mental breaks, predators, and emergent stories

---

## Piñata Species

### Species Table

| Species | Color | Speed | Attracted By | Special Ability | Preferred Job |
|---------|-------|-------|--------------|-----------------|---------------|
| **Sparrowmint** | Blue | Fast | 10 grass + 2 seeds | Quick gatherer | Gatherer |
| **Moozipan** | Pink | Slow | 20 grass + 5 flowers + water | Produces candy milk | Farmer/Producer |
| **Buzzlegum** | Yellow | Medium | 10 flowers | Produces honey | Farmer/Producer |
| **Rashberry** | Red | Medium | 5 berry bushes | Combat bonus | Guard |
| **Pretztail** | Orange | Fast | 5 resident piñatas | Hunting instinct | Hunter (PREDATOR) |

### Species Behaviors

**Sparrowmint** (Starter species)
- Fast movement, good at courier tasks
- Easily satisfied needs
- Friendly, socializes often

**Moozipan** (Cow piñata)
- Slow but steady worker
- Produces candy milk when happy (premium food)
- Needs flowers and water nearby to stay content

**Buzzlegum** (Bee piñata)
- Produces honey when working flower gardens
- Gets stressed without flowers
- Multiple Buzzlegums = pollination bonus for gardens

**Rashberry** (Spiky defender)
- Combat-capable, can fight predators
- Territorial, may clash with other Rashberries
- Protects other piñatas from Pretztail

**Pretztail** (Fox predator)
- HUNTS other piñatas!
- Fast and clever
- Useful for pest control but dangerous
- Rashberry guards can scare it off

---

## Needs System

### The Four Needs

Each piñata has four needs (0-100 scale):

| Need | Decay Rate | Critical At | Satisfied By |
|------|------------|-------------|--------------|
| **Hunger** | 1/sec | < 20 | Eating food |
| **Rest** | 0.8/sec | < 20 | Sleeping in Sleep Zone |
| **Fun** | 0.5/sec | < 20 | Playing in Recreation Zone |
| **Social** | 0.3/sec | < 20 | Being near other piñatas |

### Need Priorities

```
if (any need < 20%) → CRITICAL: Drop everything, address it
if (any need < 40%) → URGENT: Finish current task, then address
if (all needs > 60%) → CONTENT: Work normally
```

### Work Impact on Needs

| Activity | Hunger | Rest | Fun | Social |
|----------|--------|------|-----|--------|
| Working | -1.5x | -1.2x | -1.5x | — |
| Socializing | — | — | +0.5x | +2x |
| Playing | — | -0.5x | +2x | — |
| Sleeping | -0.5x | +3x | — | — |

---

## Mood System

### Mood States

```
Average Need > 70%  →  😊 HAPPY      (+20% work speed, +friendship gain)
Average Need > 40%  →  😐 CONTENT    (normal behavior)
Average Need > 25%  →  😰 STRESSED   (-20% work speed, may refuse tasks)
Any Need < 10%      →  💔 BREAKING   (mental break behavior)
```

### Mental Breaks

When a piñata hits BREAKING mood, they stop all tasks and do one of:
- **Wander Crying**: Aimlessly walk around, tears particle effect
- **Binge Eating**: Rush to stockpile, eat ALL the food
- **Tantrum**: Knock things over, scare other piñatas
- **Hide**: Find corner of map, refuse to move

**Recovery**: Slowly recovers over time, or faster if:
- Friend comforts them (social boost)
- All needs above 50%
- Gets favorite food

---

## Zone System

### Zone Types

| Zone | Color | Purpose | Behavior |
|------|-------|---------|----------|
| **Stockpile** | Brown | Store resources | Gatherers drop items here; hungry piñatas take food |
| **Sleep** | Blue | Rest area | Piñatas sleep here when rest < 40% |
| **Recreation** | Pink | Fun area | Piñatas play here when fun < 40%; social bonus if multiple |
| **Garden** | Green | Grow plants | Farmers plant/harvest here; plants grow over time |
| **Gathering** | Orange | Mark for collection | Wild resources here get auto-gathered |

### Zone Capacity

- Capacity = number of tiles in zone
- Piñatas queue if zone full
- Creates drama: "There's only one bed!"

### Zone Priority

Piñatas prefer:
1. Nearest zone of correct type
2. Zone with open capacity
3. Zone with friends already there

---

## Resource System

### Resource Types

**Food Resources**
| Resource | Source | Hunger Restored | Notes |
|----------|--------|-----------------|-------|
| Berries | Wild bushes, Berry gardens | +25 | Common |
| Seeds | Harvesting plants | +10 | Can also be planted |
| Honey | Buzzlegum production | +40 | Premium, attracts |
| Candy Milk | Moozipan production | +40 | Premium |
| Vegetables | Garden harvest | +30 | Must be farmed |

**Material Resources** (Future)
- Paper: For building
- Sticks: For building
- Decorations: For attraction

### Resource Lifecycle

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   SPAWNS     │───►│   MARKED     │───►│   CARRIED    │───►│   STORED     │
│  (in world)  │    │ (gather zone)│    │ (by gatherer)│    │ (stockpile)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                            ┌──────────────┐
                                                            │   CONSUMED   │
                                                            │ (eaten/used) │
                                                            └──────────────┘
```

### Resource Spawning

- Berry bushes spawn berries every 30 seconds
- Gardens grow plants over time (60 second growth cycle)
- Honey/Milk produced by working piñatas every 45 seconds

---

## Job System

### Job Types

| Job | Task Description | Best Species |
|-----|------------------|--------------|
| **Idle** | Wander, socialize, meet needs | All |
| **Gatherer** | Collect resources → stockpile | Sparrowmint |
| **Farmer** | Plant seeds, water, harvest | Moozipan, Buzzlegum |
| **Producer** | Make honey/milk (stationary) | Buzzlegum, Moozipan |
| **Guard** | Patrol, fight predators | Rashberry |
| **Hunter** | Hunt prey (predator only) | Pretztail |

### Auto-Assignment Logic

```typescript
function autoAssignJob(pinata: Pinata): Job {
  // 1. Check colony needs
  if (stockpile.food < 5 && pinata.canGather) return Job.Gatherer;
  if (gardens.needTending && pinata.canFarm) return Job.Farmer;
  if (predatorNearby && pinata.canGuard) return Job.Guard;

  // 2. Fall back to species preference
  return pinata.species.preferredJob;

  // 3. Or idle
  return Job.Idle;
}
```

### Job Task Queues

Each job has a repeating task loop:

**Gatherer Loop**:
```
1. Find nearest resource in gathering zone
2. Path to resource
3. Pick up resource (1 second)
4. Find nearest stockpile
5. Drop resource (0.5 seconds)
6. Repeat
```

**Farmer Loop**:
```
1. Find garden that needs work
2. If empty plot → plant seed (if seeds in stockpile)
3. If growing plant → water it (speeds growth)
4. If mature plant → harvest it
5. Carry harvest to stockpile
6. Repeat
```

### Work Interruption

Jobs can be interrupted by:
- Critical need (< 20% of any need)
- Predator attack (flee or fight)
- Mental break
- Night time (unless nocturnal)

---

## Day/Night Cycle

### Time Progression

- Full day/night cycle: 5 minutes real time
- Day: 3 minutes
- Night: 2 minutes

### Time Effects

| Phase | Duration | Effects |
|-------|----------|---------|
| **Dawn** | 30 sec | Piñatas wake up, productivity bonus |
| **Day** | 2.5 min | Normal activity |
| **Dusk** | 30 sec | Piñatas head to sleep zones |
| **Night** | 2 min | Rest need decays 2x; most piñatas sleep |

### Nocturnal Species

- Pretztail is nocturnal: Hunts at night, sleeps during day
- Creates interesting dynamics: Guards needed at night!

### Visual Changes

- Sky color shifts (blue → orange → dark blue → black)
- Stars appear at night
- Piñatas glow slightly in darkness

---

## Attraction System

### How Attraction Works

Every 30 seconds, the game checks attraction requirements:

```typescript
function checkAttractions() {
  for (const species of ALL_SPECIES) {
    if (isAttracted(species) && !atPopulationCap(species)) {
      spawnPinata(species);
      showFanfare();
    }
  }
}
```

### Attraction Requirements

| Species | Requirements | Population Cap |
|---------|--------------|----------------|
| Sparrowmint | 10 grass tiles, 2 seeds stored | 5 |
| Moozipan | 20 grass, 5 flowers, 1 water tile | 3 |
| Buzzlegum | 10 flower tiles | 4 |
| Rashberry | 5 berry bushes (growing) | 3 |
| Pretztail | 5 resident piñatas | 1 |

### Spawning Sequence

1. Requirements check passes
2. Piñata spawns at random map edge
3. Camera pans to new piñata
4. Fanfare animation + sound
5. "A wild [Species] appeared!" notification
6. New piñata wanders toward garden

### Leaving Conditions

Piñatas may LEAVE if:
- Their attraction requirements no longer met for 2+ minutes
- Average mood < 25% for extended period
- Warning given before leaving!

---

## Combat & Predators

### The Pretztail Threat

**Hunting Behavior**:
1. Pretztail identifies target (smallest/weakest piñata)
2. Stalks toward target
3. Pounce attack (if within 2 tiles)
4. Target takes damage / flees
5. If caught, target is "eaten" (removed from game!)

**Hunting Frequency**: Once per night, or when very hungry

### Defense Mechanics

**Fleeing**:
- All piñatas flee from Pretztail when spotted
- Speed determines escape chance
- Sparrowmint (fast) usually escapes
- Moozipan (slow) is vulnerable

**Fighting (Rashberry)**:
- Rashberry can fight back
- Combat: compare combat stats
- Winner stays, loser flees
- Rashberry's spikes deal damage to Pretztail

**Guard Patrol**:
- Rashberry on Guard job patrols area
- Pretztail avoids guarded areas
- Strategic guard placement protects colony

### Combat Stats

| Species | Health | Attack | Defense | Flee Speed |
|---------|--------|--------|---------|------------|
| Sparrowmint | 50 | 5 | 5 | Fast |
| Moozipan | 80 | 10 | 10 | Slow |
| Buzzlegum | 40 | 5 | 5 | Medium |
| Rashberry | 100 | 30 | 20 | Medium |
| Pretztail | 80 | 25 | 15 | Fast |

---

## Relationships

### Friendship System

Piñatas build relationships over time:

```
Strangers (0) → Acquaintances (25) → Friends (50) → Best Friends (75) → Soulmates (100)
```

**Building Friendship**:
- Being in same zone: +1/minute
- Working together: +2/minute
- Socializing: +5/interaction
- Giving gift: +10

**Relationship Effects**:
- Friends seek each other out
- Best friends comfort each other during mental breaks
- Soulmates can produce offspring (new piñata!)

### Rivalries

Negative relationships form from:
- Competition over resources
- Fighting over sleep spots
- Predator attacks (survivors hate Pretztail)

Rivals:
- Avoid each other
- Stress when forced together
- May trigger tantrums

---

## Progression & Challenge

### Early Game (0-5 minutes)

**Goal**: Establish basic colony
- Start with 2 Sparrowmints
- Designate Stockpile, Sleep, Recreation zones
- Gather initial berries
- Keep piñatas fed and rested

**Challenge**: Learning basics, limited resources

### Mid Game (5-15 minutes)

**Goal**: Attract new species
- Plant flower garden → attract Buzzlegum
- Add water feature → attract Moozipan
- Plant berry bushes → attract Rashberry
- Manage 6-8 piñatas with different needs

**Challenge**: Balancing different species needs, resource production

### Late Game (15+ minutes)

**Goal**: Survive the predator
- Population hits 5 → Pretztail appears!
- Assign Rashberry as guard
- Protect vulnerable piñatas at night
- Maintain stable ecosystem

**Challenge**: Predator management, cascading crises, mental breaks

### Victory Condition

"Garden Mastery": Have at least one of each species, all at Happy mood, for 2 consecutive minutes.

---

## UI Design

### Main HUD

```
┌─────────────────────────────────────────────────────────────────┐
│ [Tile: (12,8)]                              [ZONE MODE: Garden] │
│ [Terrain: Grass]                                                │
│ [Zone: Recreation]                                              │
│ [Piñatas: 5]  [Zones: 3]                                       │
│                                                                 │
│                                                                 │
│                        GAME WORLD                               │
│                                                                 │
│                                                                 │
│                                                                 │
│ ┌─────────────────────┐                                         │
│ │ Sir Sprinkles       │    [Z] Zone | [Space] Pause | Click     │
│ │ Sparrowmint         │                                         │
│ │ Mood: Happy 😊      │                                         │
│ │ Job: Gatherer       │                                         │
│ │                     │                                         │
│ │ Hunger [=======---] │                                         │
│ │ Rest   [========--] │                                         │
│ │ Fun    [======----] │                                         │
│ │ Social [==========-]│                                         │
│ └─────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Notifications

Pop-up notifications for:
- New species attracted
- Piñata mental break
- Predator spotted
- Resource depleted
- Piñata eaten (!)

### Speed Controls

- [1] Normal speed
- [2] Fast (2x)
- [3] Very fast (4x)
- [Space] Pause

---

## Technical Implementation

### Entity-Component Architecture

```typescript
// Core entity
class Pinata extends Phaser.GameObjects.Container {
  // Components
  needs: NeedsComponent;
  mood: MoodComponent;
  job: JobComponent;
  pathfinding: PathfindingComponent;
  relationships: RelationshipsComponent;
  combat: CombatComponent;
}
```

### System Update Order

Each frame:
1. TimeSystem (day/night progression)
2. NeedsSystem (decay needs)
3. MoodSystem (calculate mood from needs)
4. JobSystem (assign/execute jobs)
5. AttractionSystem (check for new spawns)
6. CombatSystem (predator AI)
7. RelationshipSystem (friendship changes)

### Event-Driven Communication

```typescript
EventBus.emit('pinata:hungry', pinata);
EventBus.emit('pinata:mentalBreak', pinata);
EventBus.emit('predator:spotted', pretztail);
EventBus.emit('species:attracted', species);
EventBus.emit('pinata:eaten', victim, predator);
```

---

## Art Style

### Aesthetic

"Geometric Charm" - Simple shapes with personality through animation

### Piñata Design

- Diamond body (isometric projection)
- Simple dot eyes
- Species differentiation through:
  - Color
  - Shape variations
  - Small accessories (wings, spots, stripes)

### Animation

- Idle: Gentle bobbing
- Walking: Bouncy movement
- Happy: Extra springy
- Stressed: Shaking
- Working: Tool/action icon above head
- Sleeping: Zzz particles

### Effects

- Selection: Glowing ring
- Mental break: Pulsing red
- Predator nearby: Warning indicator
- New attraction: Confetti burst

---

## Sound Design (Future)

### Ambient

- Daytime: Birds, peaceful
- Nighttime: Crickets, mysterious

### SFX

- Click/select: Soft pop
- Zone designate: Whoosh
- Resource pickup: Pling
- Eating: Munch munch
- Mental break: Sad horn
- New attraction: Fanfare!
- Predator: Ominous music sting

---

## Implementation Priority

### Phase 1: Resource & Zone Usage ⬅️ CURRENT
- [ ] Resource entity class
- [ ] Resource spawning (berry bushes)
- [ ] Piñatas eat from stockpile
- [ ] Piñatas sleep in sleep zones
- [ ] Piñatas play in recreation zones

### Phase 2: Jobs
- [ ] Job system architecture
- [ ] Gatherer job (resource → stockpile)
- [ ] Auto-assignment based on needs

### Phase 3: Gardens & Farming
- [ ] Plant growth system
- [ ] Farmer job
- [ ] Producer job (honey/milk)

### Phase 4: Attraction
- [ ] Attraction requirement checking
- [ ] New piñata spawning
- [ ] Spawn fanfare

### Phase 5: Day/Night
- [ ] Time system
- [ ] Visual changes
- [ ] Behavioral changes

### Phase 6: Predator
- [ ] Pretztail hunting AI
- [ ] Flee behavior
- [ ] Combat system
- [ ] Guard job

### Phase 7: Relationships & Polish
- [ ] Friendship tracking
- [ ] Mental break behaviors
- [ ] Notifications
- [ ] Victory condition
