'use strict';

/**
 * SWIM / WATER SURVIVAL helpers.
 * Handles:
 *   - detecting if in water
 *   - detecting if head is underwater (drowning risk)
 *   - swimming up to surface
 *   - swimming toward nearest land
 *   - climbing out of water
 */

const { sleep } = require('./helpers');

const WATER = new Set(['water', 'bubble_column', 'kelp', 'kelp_plant', 'seagrass', 'tall_seagrass']);

function blockName(bot, offX, offY, offZ) {
  const b = bot.blockAt(bot.entity.position.offset(offX, offY, offZ));
  return b ? b.name : null;
}

function isInWater(bot) {
  return WATER.has(blockName(bot, 0, 0, 0)) || WATER.has(blockName(bot, 0, 0.5, 0));
}

function isHeadUnderwater(bot) {
  return WATER.has(blockName(bot, 0, 1, 0)) || WATER.has(blockName(bot, 0, 1.5, 0));
}

function isSubmerged(bot) {
  return isInWater(bot) && isHeadUnderwater(bot);
}

/**
 * Swim straight up to the surface.
 * Returns true when out of water or when max time hit.
 */
async function swimUp(bot, maxMs = 6000) {
  const start = Date.now();
  bot.setControlState('jump', true);
  try {
    while (Date.now() - start < maxMs) {
      if (!isHeadUnderwater(bot)) break;
      // little forward nudge helps prevent getting caught under overhang
      bot.setControlState('forward', true);
      await sleep(200);
      bot.setControlState('forward', false);
      await sleep(120);
    }
  } finally {
    bot.setControlState('jump', false);
    bot.setControlState('forward', false);
  }
  return !isHeadUnderwater(bot);
}

/**
 * Sprint-swim toward shore. Turns bot toward nearest non-water direction
 * and swims forward while holding jump (surface swim).
 */
async function swimToLand(bot, maxMs = 12000) {
  const start = Date.now();
  // Find nearest non-water block at bot's Y
  const bestYaw = findLandYaw(bot);
  if (bestYaw !== null) {
    try { await bot.look(bestYaw, 0, false); } catch (_) {}
  }
  bot.setControlState('sprint', true);
  bot.setControlState('forward', true);
  bot.setControlState('jump', true);
  try {
    while (Date.now() - start < maxMs) {
      if (!isInWater(bot)) break;
      await sleep(250);
    }
  } finally {
    bot.setControlState('sprint', false);
    bot.setControlState('forward', false);
    bot.setControlState('jump', false);
  }
  return !isInWater(bot);
}

/**
 * Find a yaw pointing toward a non-water block within ~10 blocks.
 * Returns null if the bot is fully surrounded by water.
 */
function findLandYaw(bot) {
  const pos = bot.entity.position.floored();
  let bestDist = Infinity;
  let bestYaw = null;
  for (let a = 0; a < 12; a++) {
    const yaw = (a / 12) * Math.PI * 2;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    for (let d = 2; d <= 10; d++) {
      const b = bot.blockAt(pos.offset(Math.round(dx * d), 0, Math.round(dz * d)));
      if (b && b.boundingBox === 'block' && !WATER.has(b.name)) {
        if (d < bestDist) { bestDist = d; bestYaw = yaw; }
        break;
      }
    }
  }
  return bestYaw;
}

/**
 * Full water survival routine — called by Survival when drowning risk detected.
 * Priority: get head out of water, then swim to land.
 */
async function waterSurvive(bot, maxMs = 15000) {
  if (!isInWater(bot)) return true;
  if (isHeadUnderwater(bot)) {
    await swimUp(bot, Math.min(6000, maxMs));
  }
  if (isInWater(bot)) {
    await swimToLand(bot, maxMs);
  }
  return !isInWater(bot);
}

module.exports = {
  isInWater,
  isHeadUnderwater,
  isSubmerged,
  swimUp,
  swimToLand,
  waterSurvive,
};
