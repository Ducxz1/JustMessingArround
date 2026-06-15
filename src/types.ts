/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD_TRUNK = 4,
  LEAVES = 5,
  PLANKS = 6,
  CRAFTING_TABLE = 7,
  COAL_ORE = 8,
  IRON_ORE = 9,
  BEDROCK = 10,
  LAVA = 11,
  SAND = 12,
  CACTUS = 13,
  GLASS = 14,
  GOLD_ORE = 15,
}

export type ToolMaterial = 'wood' | 'stone' | 'iron' | 'none';

export interface ItemDef {
  id: string;
  name: string;
  isBlock: boolean;
  blockType?: BlockType;
  iconColor: string; // fallback color
  maxStack: number;
  isTool?: boolean;
  toolMaterial?: ToolMaterial;
  isFood?: boolean;
  healHunger?: number;
  healHealth?: number;
  attackDamage?: number;
  description?: string;
}

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface Recipe {
  output: { itemId: string; count: number };
  grid: (string | null)[]; // 2x2 or 3x3 depending on table
  width: number;
  height: number;
  requiresTable: boolean;
}

export interface Mob {
  id: string;
  type: 'zombie' | 'pig';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  isHurtTime: number; // time when hit (for flashing red)
  stateTimer: number; // for pathfinding / wandering
  targetX?: number;
  targetZ?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  // Blocks
  grass: { id: 'grass', name: 'Grass Block', isBlock: true, blockType: BlockType.GRASS, iconColor: '#5c9e31', maxStack: 64 },
  dirt: { id: 'dirt', name: 'Dirt Block', isBlock: true, blockType: BlockType.DIRT, iconColor: '#8a5c37', maxStack: 64 },
  stone: { id: 'stone', name: 'Stone Block', isBlock: true, blockType: BlockType.STONE, iconColor: '#828282', maxStack: 64 },
  wood_trunk: { id: 'wood_trunk', name: 'Oak Log', isBlock: true, blockType: BlockType.WOOD_TRUNK, iconColor: '#5a3d20', maxStack: 64 },
  leaves: { id: 'leaves', name: 'Oak Leaves', isBlock: true, blockType: BlockType.LEAVES, iconColor: '#2b5e28', maxStack: 64 },
  planks: { id: 'planks', name: 'Oak Planks', isBlock: true, blockType: BlockType.PLANKS, iconColor: '#c49c5d', maxStack: 64 },
  crafting_table: { id: 'crafting_table', name: 'Crafting Table', isBlock: true, blockType: BlockType.CRAFTING_TABLE, iconColor: '#a17243', maxStack: 64 },
  coal_ore: { id: 'coal_ore', name: 'Coal Ore', isBlock: true, blockType: BlockType.COAL_ORE, iconColor: '#444444', maxStack: 64 },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', isBlock: true, blockType: BlockType.IRON_ORE, iconColor: '#d6b896', maxStack: 64 },
  lava: { id: 'lava', name: 'Lava Block', isBlock: true, blockType: BlockType.LAVA, iconColor: '#ff5500', maxStack: 1 },
  sand: { id: 'sand', name: 'Sand Block', isBlock: true, blockType: BlockType.SAND, iconColor: '#e2ca9c', maxStack: 64 },
  cactus: { id: 'cactus', name: 'Cactus', isBlock: true, blockType: BlockType.CACTUS, iconColor: '#438031', maxStack: 64, description: 'Spiky desert plant.' },
  glass: { id: 'glass', name: 'Glass Block', isBlock: true, blockType: BlockType.GLASS, iconColor: '#e0f7fa', maxStack: 64, description: 'Totally transparent block.' },
  gold_ore: { id: 'gold_ore', name: 'Gold Ore', isBlock: true, blockType: BlockType.GOLD_ORE, iconColor: '#ebd044', maxStack: 64 },

  // Items
  stick: { id: 'stick', name: 'Stick', isBlock: false, iconColor: '#8a653d', maxStack: 64, description: 'Used to craft tools.' },
  coal: { id: 'coal', name: 'Coal', isBlock: false, iconColor: '#262626', maxStack: 64, description: 'Fuel/Crafting element.' },
  iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', isBlock: false, iconColor: '#e0e0e0', maxStack: 64, description: 'Hard shiny metal.' },
  gold_ingot: { id: 'gold_ingot', name: 'Gold Ingot', isBlock: false, iconColor: '#ffd700', maxStack: 64, description: 'Valuable gold bars.' },
  apple: { id: 'apple', name: 'Apple', isBlock: false, iconColor: '#ea1c1c', maxStack: 64, isFood: true, healHunger: 4, healHealth: 2, description: 'Restores health and hunger.' },
  porkchop_raw: { id: 'porkchop_raw', name: 'Raw Porkchop', isBlock: false, iconColor: '#ff9c9c', maxStack: 64, isFood: true, healHunger: 3, healHealth: 1, description: 'Eatable, drops from passive Pigs.' },
  porkchop_cooked: { id: 'porkchop_cooked', name: 'Cooked Porkchop', isBlock: false, iconColor: '#bf6543', maxStack: 64, isFood: true, healHunger: 8, healHealth: 6, description: 'Heals a massive amount of hunger and health.' },
  wheat: { id: 'wheat', name: 'Wheat', isBlock: false, iconColor: '#dbb653', maxStack: 64, description: 'Harvested grain.' },
  bread: { id: 'bread', name: 'Bread', isBlock: false, iconColor: '#cca262', maxStack: 64, isFood: true, healHunger: 5, healHealth: 3, description: 'Baked from wheat grains.' },
  golden_apple: { id: 'golden_apple', name: 'Golden Apple', isBlock: false, iconColor: '#ffd700', maxStack: 64, isFood: true, healHunger: 10, healHealth: 20, description: 'Restores ALL health and hunger.' },

  // Tools
  wood_sword: { id: 'wood_sword', name: 'Wooden Sword', isBlock: false, iconColor: '#bfa37a', maxStack: 1, isTool: true, attackDamage: 4, description: 'Deal +3 damage (+4 total).' },
  stone_sword: { id: 'stone_sword', name: 'Stone Sword', isBlock: false, iconColor: '#a6a6a6', maxStack: 1, isTool: true, attackDamage: 5, description: 'Deal +4 damage (+5 total).' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', isBlock: false, iconColor: '#e3e3e3', maxStack: 1, isTool: true, attackDamage: 6, description: 'Deal +5 damage (+6 total).' },
  gold_sword: { id: 'gold_sword', name: 'Golden Sword', isBlock: false, iconColor: '#ffd700', maxStack: 1, isTool: true, attackDamage: 4, description: 'Shiny sword (+4 damage).' },

  wood_pickaxe: { id: 'wood_pickaxe', name: 'Wooden Pickaxe', isBlock: false, iconColor: '#a3845c', maxStack: 1, isTool: true, toolMaterial: 'wood', attackDamage: 2, description: 'Speeds up mining stone/ore.' },
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Stone Pickaxe', isBlock: false, iconColor: '#8a8a8a', maxStack: 1, isTool: true, toolMaterial: 'stone', attackDamage: 3, description: 'Mines stone quickly and extracts Iron.' },
  iron_pickaxe: { id: 'iron_pickaxe', name: 'Iron Pickaxe', isBlock: false, iconColor: '#cccccc', maxStack: 1, isTool: true, toolMaterial: 'iron', attackDamage: 4, description: 'Mines anything extremely quickly.' },
  gold_pickaxe: { id: 'gold_pickaxe', name: 'Golden Pickaxe', isBlock: false, iconColor: '#ffd700', maxStack: 1, isTool: true, toolMaterial: 'iron', attackDamage: 3, description: 'Mines anything fast like iron.' },

  // New Axes
  wood_axe: { id: 'wood_axe', name: 'Wooden Axe', isBlock: false, iconColor: '#a3845c', maxStack: 1, isTool: true, attackDamage: 3, description: 'Chops wood blocks faster.' },
  stone_axe: { id: 'stone_axe', name: 'Stone Axe', isBlock: false, iconColor: '#8a8a8a', maxStack: 1, isTool: true, attackDamage: 4, description: 'Chops wood blocks very fast.' },
  iron_axe: { id: 'iron_axe', name: 'Iron Axe', isBlock: false, iconColor: '#cccccc', maxStack: 1, isTool: true, attackDamage: 5, description: 'Chops wood blocks extremely fast.' },
};

export const CRAFTING_RECIPES: Recipe[] = [
  // 1 wood -> 4 planks
  {
    output: { itemId: 'planks', count: 4 },
    grid: ['wood_trunk'],
    width: 1,
    height: 1,
    requiresTable: false,
  },
  // 2 planks -> 4 sticks (vertical)
  {
    output: { itemId: 'stick', count: 4 },
    grid: [
      'planks',
      'planks'
    ],
    width: 1,
    height: 2,
    requiresTable: false,
  },
  // 4 planks -> 1 crafting table (2x2)
  {
    output: { itemId: 'crafting_table', count: 1 },
    grid: [
      'planks', 'planks',
      'planks', 'planks'
    ],
    width: 2,
    height: 2,
    requiresTable: false,
  },
  // Cook porkchop (crafting raw porkchop + coal -> cooked porkchop)
  {
    output: { itemId: 'porkchop_cooked', count: 1 },
    grid: [
      'porkchop_raw',
      'coal'
    ],
    width: 1,
    height: 2,
    requiresTable: false,
  },
  // Smelt Iron (Iron Ore + Coal -> Iron Ingot)
  {
    output: { itemId: 'iron_ingot', count: 1 },
    grid: [
      'iron_ore',
      'coal'
    ],
    width: 1,
    height: 2,
    requiresTable: false,
  },
  // Smelt Sand (Sand + Coal -> Glass)
  {
    output: { itemId: 'glass', count: 1 },
    grid: [
      'sand',
      'coal'
    ],
    width: 1,
    height: 2,
    requiresTable: false,
  },
  // Smelt Gold (Gold Ore + Coal -> Gold Ingot)
  {
    output: { itemId: 'gold_ingot', count: 1 },
    grid: [
      'gold_ore',
      'coal'
    ],
    width: 1,
    height: 2,
    requiresTable: false,
  },
  // Golden Apple (Surround apple with 8 gold ingots)
  {
    output: { itemId: 'golden_apple', count: 1 },
    grid: [
      'gold_ingot', 'gold_ingot', 'gold_ingot',
      'gold_ingot', 'apple',      'gold_ingot',
      'gold_ingot', 'gold_ingot', 'gold_ingot'
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Wheat to Bread (3 wheat horizontally)
  {
    output: { itemId: 'bread', count: 1 },
    grid: [
      'wheat', 'wheat', 'wheat',
      null,    null,    null,
      null,    null,    null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },

  // 3x3 and 2x3 Recipes (Require Crafting Table)
  // Wooden Pickaxe
  {
    output: { itemId: 'wood_pickaxe', count: 1 },
    grid: [
      'planks', 'planks', 'planks',
      null,     'stick',  null,
      null,     'stick',  null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Stone Pickaxe
  {
    output: { itemId: 'stone_pickaxe', count: 1 },
    grid: [
      'stone', 'stone', 'stone',
      null,    'stick', null,
      null,    'stick', null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Iron Pickaxe
  {
    output: { itemId: 'iron_pickaxe', count: 1 },
    grid: [
      'iron_ingot', 'iron_ingot', 'iron_ingot',
      null,         'stick',      null,
      null,         'stick',      null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Golden Pickaxe
  {
    output: { itemId: 'gold_pickaxe', count: 1 },
    grid: [
      'gold_ingot', 'gold_ingot', 'gold_ingot',
      null,         'stick',      null,
      null,         'stick',      null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },

  // Wooden Axe
  {
    output: { itemId: 'wood_axe', count: 1 },
    grid: [
      'planks', 'planks', null,
      'planks', 'stick',  null,
      null,     'stick',  null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Stone Axe
  {
    output: { itemId: 'stone_axe', count: 1 },
    grid: [
      'stone',  'stone',  null,
      'stone',  'stick',  null,
      null,     'stick',  null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },
  // Iron Axe
  {
    output: { itemId: 'iron_axe', count: 1 },
    grid: [
      'iron_ingot', 'iron_ingot', null,
      'iron_ingot', 'stick',      null,
      null,         'stick',      null
    ],
    width: 3,
    height: 3,
    requiresTable: true,
  },

  // Wooden Sword
  {
    output: { itemId: 'wood_sword', count: 1 },
    grid: [
      'planks',
      'planks',
      'stick'
    ],
    width: 1,
    height: 3,
    requiresTable: true,
  },
  // Stone Sword
  {
    output: { itemId: 'stone_sword', count: 1 },
    grid: [
      'stone',
      'stone',
      'stick'
    ],
    width: 1,
    height: 3,
    requiresTable: true,
  },
  // Iron Sword
  {
    output: { itemId: 'iron_sword', count: 1 },
    grid: [
      'iron_ingot',
      'iron_ingot',
      'stick'
    ],
    width: 1,
    height: 3,
    requiresTable: true,
  },
  // Golden Sword
  {
    output: { itemId: 'gold_sword', count: 1 },
    grid: [
      'gold_ingot',
      'gold_ingot',
      'stick'
    ],
    width: 1,
    height: 3,
    requiresTable: true,
  },
];

export interface SavedWorld {
  id: string;
  name: string;
  seedOffsetX: number;
  seedOffsetZ: number;
  modifiedBlocks: Record<string, BlockType>;
  playerPosition?: { x: number; y: number; z: number };
  playerRotation?: { yaw: number; pitch: number };
  inventory?: (InventoryItem | null)[];
  health?: number;
  hunger?: number;
  dayTime?: number;
  score?: number;
  lastPlayed: number;
}

export interface GameSettings {
  fov: number; // 50 to 100, default 75
  sensitivity: number; // 0.2 to 3.0, default 1.0
  volume: number; // 0 to 100, default 70
  graphics: 'fancy' | 'fast' | 'potato'; // default 'fancy'
  showClouds: boolean; // default true
  viewDistance: number; // 1 to 3 chunks, default 2
}

export const DEFAULT_SETTINGS: GameSettings = {
  fov: 75,
  sensitivity: 1.0,
  volume: 75,
  graphics: 'fancy',
  showClouds: true,
  viewDistance: 2,
};

