type EventCallback = (...args: unknown[]) => void;

class EventBusClass {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  once(event: string, callback: EventCallback): void {
    const wrapper = (...args: unknown[]) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusClass();

// Event type definitions for type safety
export const GameEvents = {
  PINATA_SELECTED: 'pinata:selected',
  PINATA_HUNGRY: 'pinata:hungry',
  PINATA_TIRED: 'pinata:tired',
  PINATA_MOOD_CHANGED: 'pinata:moodChanged',
  PINATA_ATE: 'pinata:ate',
  PINATA_SLEPT: 'pinata:slept',
  PINATA_PLAYED: 'pinata:played',
  PINATA_DIED: 'pinata:died',
  PINATA_DEFENDED: 'pinata:defended',
  PINATA_SOCIALIZED: 'pinata:socialized',
  PINATA_HELPED: 'pinata:helped',
  PINATA_ROMANCE_STARTED: 'pinata:romanceStarted',
  PINATA_BORN: 'pinata:born',
  SOUR_PINATA_SPAWNED: 'pinata:sourSpawned',
  SOUR_PINATA_CURED: 'pinata:sourCured',
  RELATIONSHIP_CHANGED: 'relationship:changed',
  RESOURCE_SPAWNED: 'resource:spawned',
  RESOURCE_COLLECTED: 'resource:collected',
  BUILDING_PLACED: 'building:placed',
  BUILDING_COMPLETE: 'building:complete',
  SPECIES_ATTRACTED: 'species:attracted',
  ZONE_DESIGNATED: 'zone:designated',
  RANDOM_EVENT_STARTED: 'event:started',
  RANDOM_EVENT_ENDED: 'event:ended',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
} as const;
