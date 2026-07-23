'use strict';

/**
 * TOOL CHECK — decides whether the bot has the right tool to mine a block.
 * Prevents the "bot digs with bare hands forever" bug.
 */

const { findItem } = require('./helpers');

// Block -> minimum required tool tier (0=hand, 1=wood, 2=stone, 3=iron, 4=diamond, 5=netherite)
const REQUIRED_TIER = {
  // No tool needed
  dirt: 0, grass_block: 0, sand: 0, gravel: 0, clay: 0, snow: 0, snow_block: 0,
  // Wood tier (any pickaxe)
  stone: 1, cobblestone: 1, granite: 1, diorite: 1, andesite: 1, tuff: 1,
  deepslate: 1, cobbled_deepslate: 1, coal_ore: 1, deepslate_coal_ore: 1,
  copper_ore: 1, deepslate_copper_ore: 1,
  // Stone tier
  iron_ore: 2, deepslate_iron_ore: 2, lapis_ore: 2, deepslate_lapis_ore: 2,
  // Iron tier
  diamond_ore: 3, deepslate_diamond_ore: 3, gold_ore: 3, deepslate_gold_ore: 3,
  emerald_ore: 3, deepslate_emerald_ore: 3, redstone_ore: 3, deepslate_redstone_ore: 3,
  // Diamond tier
  obsidian: 4, crying_obsidian: 4, ancient_debris: 4,
  // Netherite/none
  bedrock: 99, barrier: 99,
};

const TIER_NAME = ['hand', 'wooden', 'stone', 'iron', 'diamond', 'netherite'];
const AXE_BLOCKS = new Set(['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log','oak_planks','spruce_planks','birch_planks','jungle_planks','acacia_planks','dark_oak_planks','mangrove_planks','cherry_planks']);
const SHOVEL_BLOCKS = new Set(['dirt','grass_block','sand','gravel','clay','snow','snow_block','coarse_dirt','podzol']);

function highestPickaxeTier(bot) {
  for (let t = 5; t >= 1; t--) {
    if (findItem(bot, [`${TIER_NAME[t]}_pickaxe`])) return t;
  }
  return 0;
}

function highestAxeTier(bot) {
  for (let t = 5; t >= 1; t--) {
    if (findItem(bot, [`${TIER_NAME[t]}_axe`])) return t;
  }
  return 0;
}

function highestSwordTier(bot) {
  for (let t = 5; t >= 1; t--) {
    if (findItem(bot, [`${TIER_NAME[t]}_sword`])) return t;
  }
  return 0;
}

/**
 * Returns true if the bot CAN break this block (has required tool tier).
 */
function canMine(bot, blockName) {
  const required = REQUIRED_TIER[blockName];
  if (required === undefined) return true; // unknown -> allow
  if (required === 0) return true;
  if (required === 99) return false;
  // Wood/planks/leaves don't strictly require an axe, but blocks like stone REQUIRE a pickaxe
  if (AXE_BLOCKS.has(blockName)) return true; // wood can be broken by hand (slow) but yields drop
  return highestPickaxeTier(bot) >= required;
}

/**
 * Returns the recommended tool kind ('pickaxe', 'axe', 'shovel', 'sword', or 'hand') for a block.
 */
function toolFor(blockName) {
  if (REQUIRED_TIER[blockName] >= 1 && !AXE_BLOCKS.has(blockName) && !SHOVEL_BLOCKS.has(blockName)) return 'pickaxe';
  if (AXE_BLOCKS.has(blockName)) return 'axe';
  if (SHOVEL_BLOCKS.has(blockName)) return 'shovel';
  return 'hand';
}

/**
 * Returns human-readable reason why bot can't mine this block yet.
 */
function missingReason(bot, blockName) {
  const req = REQUIRED_TIER[blockName];
  if (req === undefined || req === 0) return null;
  if (req === 99) return `${blockName} is unbreakable`;
  const have = highestPickaxeTier(bot);
  if (have < req) return `need ${TIER_NAME[req]}_pickaxe (have ${TIER_NAME[have]})`;
  return null;
}

/**
 * Overall inventory audit — used before starting a phase.
 * Returns what the bot ALREADY has so we don't duplicate work.
 */
function inventoryAudit(bot) {
  return {
    logs: countAny(bot, ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log']),
    planks: countAny(bot, ['oak_planks','spruce_planks','birch_planks','jungle_planks','acacia_planks','dark_oak_planks','mangrove_planks','cherry_planks']),
    sticks: countAny(bot, ['stick']),
    cobble: countAny(bot, ['cobblestone','cobbled_deepslate']),
    coal: countAny(bot, ['coal','charcoal']),
    iron: countAny(bot, ['iron_ingot','raw_iron']),
    diamond: countAny(bot, ['diamond']),
    hasCraftingTable: !!findItem(bot, ['crafting_table']),
    hasFurnace: !!findItem(bot, ['furnace']),
    pickaxe: highestPickaxeTier(bot),
    axe: highestAxeTier(bot),
    sword: highestSwordTier(bot),
    hasShield: !!findItem(bot, ['shield']),
    hasBucket: !!findItem(bot, ['bucket','water_bucket','lava_bucket']),
    hasBow: !!findItem(bot, ['bow']),
    hasArrow: !!findItem(bot, ['arrow']),
    hasFlintSteel: !!findItem(bot, ['flint_and_steel']),
    hasBed: (bot.inventory?.items?.() || []).some(i => i.name?.endsWith('_bed')),
  };
}

function countAny(bot, names) {
  return names.reduce((s, n) => s + ((bot.inventory?.items?.() || []).filter(i => i.name === n).reduce((a, i) => a + i.count, 0)), 0);
}

module.exports = {
  REQUIRED_TIER,
  TIER_NAME,
  canMine,
  toolFor,
  missingReason,
  inventoryAudit,
  highestPickaxeTier,
  highestAxeTier,
  highestSwordTier,
};
