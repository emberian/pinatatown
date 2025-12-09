import { COLORS } from '../utils/Constants';
import { ResourceType } from './Resource';

export enum PinataSpecies {
  Sparrowmint = 'sparrowmint',
  Moozipan = 'moozipan',
  Buzzlegum = 'buzzlegum',
  Rashberry = 'rashberry',
  Pretztail = 'pretztail',
}

export interface PinataSpeciesData {
  species: PinataSpecies;
  name: string;
  color: number;
  textureKey: string;
  baseSpeed: number;
  preferredJob: string;
  specialAbility: string;
  attractedBy: string[];
  produces?: ResourceType; // What resource this species produces
  productionTime?: number; // Milliseconds between productions (when happy and fed)
}

export const SPECIES_DATA: Record<PinataSpecies, PinataSpeciesData> = {
  [PinataSpecies.Sparrowmint]: {
    species: PinataSpecies.Sparrowmint,
    name: 'Sparrowmint',
    color: COLORS.sparrowmint,
    textureKey: 'pinata-sparrowmint',
    baseSpeed: 120, // Fast!
    preferredJob: 'gather',
    specialAbility: 'Fast movement',
    attractedBy: ['grass', 'seeds'],
  },
  [PinataSpecies.Moozipan]: {
    species: PinataSpecies.Moozipan,
    name: 'Moozipan',
    color: COLORS.moozipan,
    textureKey: 'pinata-moozipan',
    baseSpeed: 70, // Slow and steady
    preferredJob: 'farm',
    specialAbility: 'Produces candy milk',
    attractedBy: ['flowers', 'water'],
    produces: ResourceType.CandyMilk,
    productionTime: 30000, // 30 seconds
  },
  [PinataSpecies.Buzzlegum]: {
    species: PinataSpecies.Buzzlegum,
    name: 'Buzzlegum',
    color: COLORS.buzzlegum,
    textureKey: 'pinata-buzzlegum',
    baseSpeed: 100,
    preferredJob: 'farm',
    specialAbility: 'Produces honey',
    attractedBy: ['flowers'],
    produces: ResourceType.Honey,
    productionTime: 25000, // 25 seconds
  },
  [PinataSpecies.Rashberry]: {
    species: PinataSpecies.Rashberry,
    name: 'Rashberry',
    color: COLORS.rashberry,
    textureKey: 'pinata-rashberry',
    baseSpeed: 90,
    preferredJob: 'guard',
    specialAbility: 'Combat bonus',
    attractedBy: ['berries'],
  },
  [PinataSpecies.Pretztail]: {
    species: PinataSpecies.Pretztail,
    name: 'Pretztail',
    color: COLORS.pretztail,
    textureKey: 'pinata-pretztail',
    baseSpeed: 110,
    preferredJob: 'hunter',
    specialAbility: 'Hunting',
    attractedBy: ['other-pinatas'],
  },
};
