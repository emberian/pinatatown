import { Pinata, JobType, BehaviorState } from '../entities/Pinata';
import { ZoneManager, ZoneType } from '../world/Zone';
import { ResourceManager } from '../entities/Resource';
import { FarmingSystem } from './FarmingSystem';
import { BuildingSystem } from './BuildingSystem';
import { GridPosition } from '../world/IsoUtils';

/**
 * Work system manages job assignments and work priorities.
 * Gives players control over what their piñatas focus on.
 */

export enum WorkType {
  Gather = 'gather',           // Collect resources from ground
  Haul = 'haul',               // Move resources to stockpile
  Farm = 'farm',               // Tend crops (plant, water, harvest)
  Build = 'build',             // Construct buildings
  Guard = 'guard',             // Patrol and fight threats
  Clean = 'clean',             // Remove withered crops, debris (future)
}

export interface WorkTask {
  id: number;
  type: WorkType;
  priority: number;            // Higher = more important
  position: GridPosition;
  assignedTo: number | null;   // Pinata ID
  completed: boolean;
  data?: unknown;               // Task-specific data
}

export interface WorkPriorities {
  [WorkType.Gather]: number;
  [WorkType.Haul]: number;
  [WorkType.Farm]: number;
  [WorkType.Build]: number;
  [WorkType.Guard]: number;
  [WorkType.Clean]: number;
}

const DEFAULT_PRIORITIES: WorkPriorities = {
  [WorkType.Gather]: 5,
  [WorkType.Haul]: 4,
  [WorkType.Farm]: 6,
  [WorkType.Build]: 3,
  [WorkType.Guard]: 7,
  [WorkType.Clean]: 2,
};

let taskIdCounter = 0;

export class WorkSystem {
  private zoneManager: ZoneManager;
  private resourceManager: ResourceManager;
  private farmingSystem: FarmingSystem | null = null;
  private buildingSystem: BuildingSystem | null = null;

  private tasks: Map<number, WorkTask> = new Map();
  private priorities: WorkPriorities = { ...DEFAULT_PRIORITIES };

  // Track which piñatas are working on what
  private pinataAssignments: Map<number, number> = new Map(); // Pinata ID -> Task ID

  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 2000; // Generate tasks every 2 seconds

  constructor(
    zoneManager: ZoneManager,
    resourceManager: ResourceManager
  ) {
    this.zoneManager = zoneManager;
    this.resourceManager = resourceManager;
  }

  setFarmingSystem(farmingSystem: FarmingSystem): void {
    this.farmingSystem = farmingSystem;
  }

  setBuildingSystem(buildingSystem: BuildingSystem): void {
    this.buildingSystem = buildingSystem;
  }

  update(delta: number, pinatas: Pinata[]): void {
    this.updateTimer += delta;

    if (this.updateTimer >= this.UPDATE_INTERVAL) {
      this.updateTimer = 0;
      this.generateTasks();
      this.cleanupCompletedTasks();
    }

    // Try to assign idle workers to tasks
    for (const pinata of pinatas) {
      if (!pinata.getIsAlive()) continue;

      // Skip if already assigned
      if (this.pinataAssignments.has(pinata.id)) {
        continue;
      }

      // Skip if not idle
      const behavior = pinata.getBehavior();
      if (behavior !== BehaviorState.Idle && behavior !== BehaviorState.Wandering) {
        continue;
      }

      // Skip if needs are too low (they'll prioritize needs)
      const needs = pinata.getNeeds();
      if (needs.hunger < 30 || needs.rest < 25) {
        continue;
      }

      // Find best available task for this piñata
      const task = this.findBestTask(pinata);
      if (task) {
        this.assignTask(pinata, task);
      }
    }
  }

  private generateTasks(): void {
    // Generate gather tasks for available resources
    const resources = this.resourceManager.getAvailableResources();
    for (const resource of resources) {
      const pos = resource.getGridPosition();
      const existingTask = this.findTaskAt(pos, WorkType.Gather);
      if (!existingTask) {
        this.createTask(WorkType.Gather, pos, { resourceId: resource.id });
      }
    }

    // Generate farming tasks
    if (this.farmingSystem) {
      // Harvest mature crops
      for (const crop of this.farmingSystem.getMatureCrops()) {
        const existingTask = this.findTaskAt(crop.position, WorkType.Farm);
        if (!existingTask) {
          this.createTask(WorkType.Farm, crop.position, { action: 'harvest', cropId: crop.id });
        }
      }

      // Water crops that need it
      for (const crop of this.farmingSystem.getCropsNeedingWater()) {
        const existingTask = this.findTaskAt(crop.position, WorkType.Farm);
        if (!existingTask) {
          this.createTask(WorkType.Farm, crop.position, { action: 'water', cropId: crop.id });
        }
      }
    }

    // Generate building tasks
    if (this.buildingSystem) {
      for (const building of this.buildingSystem.getBlueprintsAndConstruction()) {
        const existingTask = this.findTaskAt(building.position, WorkType.Build);
        if (!existingTask) {
          this.createTask(WorkType.Build, building.position, { buildingId: building.id });
        }
      }
    }

    // Generate guard tasks for stockpile areas
    const stockpiles = this.zoneManager.getZonesByType(ZoneType.Stockpile);
    for (const zone of stockpiles) {
      const tile = zone.getRandomTile();
      if (tile) {
        // Only create one guard task per stockpile
        const guardTaskExists = Array.from(this.tasks.values()).some(
          t => t.type === WorkType.Guard &&
          Math.abs(t.position.x - tile.x) < 5 &&
          Math.abs(t.position.y - tile.y) < 5
        );
        if (!guardTaskExists) {
          this.createTask(WorkType.Guard, tile, { zoneId: zone.id });
        }
      }
    }
  }

  private createTask(type: WorkType, position: GridPosition, data?: unknown): WorkTask {
    const task: WorkTask = {
      id: taskIdCounter++,
      type,
      priority: this.priorities[type],
      position: { ...position },
      assignedTo: null,
      completed: false,
      data,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  private findTaskAt(position: GridPosition, type: WorkType): WorkTask | null {
    for (const task of this.tasks.values()) {
      if (task.type === type &&
          task.position.x === position.x &&
          task.position.y === position.y) {
        return task;
      }
    }
    return null;
  }

  private findBestTask(pinata: Pinata): WorkTask | null {
    const pos = pinata.getGridPosition();
    const job = pinata.getJob();

    let bestTask: WorkTask | null = null;
    let bestScore = -Infinity;

    for (const task of this.tasks.values()) {
      if (task.completed || task.assignedTo !== null) {
        continue;
      }

      // Calculate task score
      let score = task.priority * 10;

      // Distance penalty
      const dist = Math.abs(task.position.x - pos.x) + Math.abs(task.position.y - pos.y);
      score -= dist;

      // Job affinity bonus
      if (this.jobMatchesWork(job, task.type)) {
        score += 20;
      }

      // Species affinity (Sparrowmints are good gatherers, etc.)
      score += this.getSpeciesWorkBonus(pinata, task.type);

      if (score > bestScore) {
        bestScore = score;
        bestTask = task;
      }
    }

    return bestTask;
  }

  private jobMatchesWork(job: JobType, workType: WorkType): boolean {
    switch (job) {
      case JobType.Gatherer:
        return workType === WorkType.Gather || workType === WorkType.Haul;
      case JobType.Farmer:
        return workType === WorkType.Farm;
      case JobType.Guard:
        return workType === WorkType.Guard;
      default:
        return false;
    }
  }

  private getSpeciesWorkBonus(pinata: Pinata, workType: WorkType): number {
    const species = pinata.species;

    // Species-specific bonuses
    const bonuses: Record<string, Partial<Record<WorkType, number>>> = {
      sparrowmint: { [WorkType.Gather]: 10, [WorkType.Haul]: 5 },
      moozipan: { [WorkType.Farm]: 10 },
      buzzlegum: { [WorkType.Farm]: 8, [WorkType.Gather]: 5 },
      rashberry: { [WorkType.Guard]: 15 },
    };

    return bonuses[species]?.[workType] ?? 0;
  }

  private assignTask(pinata: Pinata, task: WorkTask): void {
    task.assignedTo = pinata.id;
    this.pinataAssignments.set(pinata.id, task.id);

    // Tell piñata about the task and send them to work
    pinata.assignWorkTask(task.type, task.position, task.data);
    pinata.goToWork(task.position.x, task.position.y);

    console.log(`Assigned ${pinata.nickname} to ${task.type} at (${task.position.x}, ${task.position.y})`);
  }

  completeTask(taskId: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completed = true;
      if (task.assignedTo !== null) {
        this.pinataAssignments.delete(task.assignedTo);
      }
    }
  }

  unassignPinata(pinataId: number): void {
    const taskId = this.pinataAssignments.get(pinataId);
    if (taskId !== undefined) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.assignedTo = null;
      }
      this.pinataAssignments.delete(pinataId);
    }
  }

  private cleanupCompletedTasks(): void {
    for (const [id, task] of this.tasks) {
      if (task.completed) {
        this.tasks.delete(id);
      }
    }
  }

  // Priority management
  setPriority(workType: WorkType, priority: number): void {
    this.priorities[workType] = Math.max(1, Math.min(10, priority));
  }

  getPriority(workType: WorkType): number {
    return this.priorities[workType];
  }

  getPriorities(): WorkPriorities {
    return { ...this.priorities };
  }

  // Get tasks for UI display
  getAllTasks(): WorkTask[] {
    return Array.from(this.tasks.values());
  }

  getPendingTasks(): WorkTask[] {
    return this.getAllTasks().filter(t => !t.completed && t.assignedTo === null);
  }

  getAssignedTasks(): WorkTask[] {
    return this.getAllTasks().filter(t => !t.completed && t.assignedTo !== null);
  }

  getTasksOfType(type: WorkType): WorkTask[] {
    return this.getAllTasks().filter(t => t.type === type);
  }

  // Get task assigned to a piñata
  getAssignedTask(pinataId: number): WorkTask | null {
    const taskId = this.pinataAssignments.get(pinataId);
    if (taskId === undefined) return null;
    return this.tasks.get(taskId) ?? null;
  }
}
