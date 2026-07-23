'use strict';

/**
 * SAFE PLACE / DIG / PILLAR / JUMP helpers.
 * All of these guard against the common "bot gets stuck" patterns:
 *   - trying to place a block where a block already exists
 *   - trying to place a block into thin air with no reference face
 *   - jumping repeatedly in place because the ceiling blocks progress
 *   - pillaring on a spot that already has a block above
 *
 * Every helper has a hard retry cap + timeout so the bot NEVER
 * gets stuck in an infinite click loop.
 */

const { Vec3 } = require('vec3');
const { sleep } = require('./helpers');

const AIR_NAMES = new Set(['air', 'cave_air', 'void_air']);
const REPLACEABLE = new Set([
  'air', 'cave_air', 'void_air',
  'water', 'lava', 'bubble_column',
  'short_grass', 'tall_grass', 'fern', 'large_fern',
  'seagrass', 'tall_seagrass', 'kelp', 'kelp_plant',
  'snow', 'vine', 'glow_lichen', 'dead_bush',
  'oak_sapling', 'spruce_sapling', 'birch_sapling',
  'fire', 'soul_fire',
]);

function isAir(block) {
  return !block || AIR_NAMES.has(block.name);
}

function isReplaceable(block) {
  return !block || REPLACEABLE.has(block.name);
}

function isSolid(block) {
  if (!block) return false;
  if (AIR_NAMES.has(block.name)) return false;
  if (REPLACEABLE.has(block.name)) return false;
  return block.boundingBox === 'block';
}

/**
 * Find a valid reference block adjacent to `targetPos` that we can place
 * against so a new block appears at `targetPos`.
 * Returns { refBlock, faceVector } or null if impossible.
 */
function findPlacementReference(bot, targetPos) {
  const faces = [
    { off: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },
    { off: new Vec3(0, 1, 0),  face: new Vec3(0, -1, 0) },
    { off: new Vec3(1, 0, 0),  face: new Vec3(-1, 0, 0) },
    { off: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
    { off: new Vec3(0, 0, 1),  face: new Vec3(0, 0, -1) },
    { off: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },
  ];
  for (const { off, face } of faces) {
    const ref = bot.blockAt(targetPos.plus(off));
    if (ref && isSolid(ref)) return { refBlock: ref, faceVector: face };
  }
  return null;
}

/**
 * Safely place a block from `item` at the requested `targetPos`.
 * Returns true on success, false on failure. NEVER throws, never spins.
 */
async function safePlaceAt(bot, item, targetPos, opts = {}) {
  const maxTries = opts.maxTries || 2;
  if (!item) return false;

  // 1) Skip if the target already has a solid block
  const existing = bot.blockAt(targetPos);
  if (existing && !isReplaceable(existing)) {
    return true; // treat as "already there" — no wasted clicks
  }

  // 2) Find a reference face
  const ref = findPlacementReference(bot, targetPos);
  if (!ref) return false;

  // 3) Equip the item
  try {
    if (!bot.heldItem || bot.heldItem.name !== item.name) {
      await bot.equip(item, 'hand');
    }
  } catch { return false; }

  // 4) Attempt place with retry cap
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      await bot.placeBlock(ref.refBlock, ref.faceVector);
      await sleep(120);
      const after = bot.blockAt(targetPos);
      if (after && !isReplaceable(after)) return true;
    } catch (_) {
      // ignore; will retry or exit
    }
    await sleep(120);
  }
  return false;
}

/**
 * Safely dig a block. Skips air / unbreakable / bedrock. Timeout-protected.
 */
async function safeDig(bot, block, opts = {}) {
  if (!block) return false;
  if (isAir(block)) return true;
  if (!block.diggable) return false;
  if (block.name === 'bedrock' || block.name === 'barrier') return false;

  const timeoutMs = opts.timeoutMs || 12_000;
  try {
    await Promise.race([
      bot.dig(block),
      new Promise((_, rej) => setTimeout(() => rej(new Error('dig timeout')), timeoutMs)),
    ]);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Pillar up by N blocks, safely.
 *  - stops if a solid block is above (can't pillar into a ceiling)
 *  - equips block, jumps + places under feet, retries max 2 per level
 *  - hard cap on total time to prevent infinite jumping
 */
async function safePillarUp(bot, item, levels, opts = {}) {
  if (!item || levels <= 0) return 0;
  const maxTotalMs = opts.maxTotalMs || 10_000;
  const start = Date.now();
  let placed = 0;

  try {
    await bot.equip(item, 'hand');
  } catch { return 0; }

  for (let i = 0; i < levels; i++) {
    if (Date.now() - start > maxTotalMs) break;

    // check ceiling — if there's a block 2 above, we can't pillar further
    const above2 = bot.blockAt(bot.entity.position.offset(0, 2, 0));
    if (isSolid(above2)) break;

    // jump and place beneath feet
    const feetPos = bot.entity.position.floored();
    // look straight down so mineflayer picks the correct face
    try { await bot.look(bot.entity.yaw, Math.PI / 2, false); } catch (_) {}

    bot.setControlState('jump', true);
    await sleep(280);

    let success = false;
    for (let attempt = 0; attempt < 2 && !success; attempt++) {
      const ref = bot.blockAt(feetPos.offset(0, -1, 0));
      if (ref && isSolid(ref)) {
        try {
          await bot.placeBlock(ref, new Vec3(0, 1, 0));
          success = true;
        } catch (_) {
          await sleep(120);
        }
      } else {
        await sleep(100);
      }
    }

    bot.setControlState('jump', false);
    if (!success) break;
    placed++;
    await sleep(180);
  }
  return placed;
}

/**
 * Safe jump. Returns false immediately if the space is blocked.
 * NEVER jumps in place more than once — caller decides retries.
 */
async function safeJump(bot) {
  const head = bot.blockAt(bot.entity.position.offset(0, 2, 0));
  if (isSolid(head)) return false;
  bot.setControlState('jump', true);
  await sleep(200);
  bot.setControlState('jump', false);
  return true;
}

/**
 * Check if forward direction is walkable (not blocked by wall).
 */
function isForwardWalkable(bot) {
  const yaw = bot.entity.yaw;
  const dx = -Math.round(Math.sin(yaw));
  const dz = -Math.round(Math.cos(yaw));
  const front1 = bot.blockAt(bot.entity.position.offset(dx, 0, dz));
  const front2 = bot.blockAt(bot.entity.position.offset(dx, 1, dz));
  return !isSolid(front1) && !isSolid(front2);
}

module.exports = {
  isAir,
  isSolid,
  isReplaceable,
  findPlacementReference,
  safePlaceAt,
  safeDig,
  safePillarUp,
  safeJump,
  isForwardWalkable,
};
