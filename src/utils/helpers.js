'use strict';

const { Vec3 } = require('vec3');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function distance(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2); }
function distanceXZ(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.z-b.z)**2); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function nearestOf(bot, matcher, maxDistance = 64) {
  let best = null;
  let bestD = Infinity;
  for (const e of Object.values(bot.entities || {})) {
    if (!e || !e.position) continue;
    if (!matcher(e)) continue;
    const d = bot.entity && bot.entity.position ? e.position.distanceTo(bot.entity.position) : Infinity;
    if (d < bestD && d <= maxDistance) { best = e; bestD = d; }
  }
  return best;
}

function itemCount(bot, name) {
  return (bot.inventory?.items?.() || []).filter(i => i.name === name).reduce((s, i) => s + i.count, 0);
}

function hasItem(bot, name, count = 1) { return itemCount(bot, name) >= count; }
function anyCount(bot, names) { return names.reduce((s, n) => s + itemCount(bot, n), 0); }

function findItem(bot, names) {
  for (const name of names) {
    const it = (bot.inventory?.items?.() || []).find(i => i.name === name);
    if (it) return it;
  }
  return null;
}

async function equipBest(bot, kind, destination = 'hand') {
  const tiers = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden'];
  for (const tier of tiers) {
    const item = findItem(bot, [`${tier}_${kind}`]);
    if (item) {
      try { await bot.equip(item, destination); return item; } catch {}
    }
  }
  return null;
}

async function equipShield(bot) {
  const shield = findItem(bot, ['shield']);
  if (!shield) return false;
  try { await bot.equip(shield, 'off-hand'); return true; } catch { return false; }
}

function hostileNames() {
  return new Set([
    'zombie','zombie_villager','husk','drowned','skeleton','stray','bogged','creeper','spider','cave_spider',
    'enderman','endermite','witch','pillager','vindicator','evoker','vex','ravager','phantom','slime',
    'magma_cube','blaze','ghast','piglin_brute','hoglin','zoglin','silverfish','shulker','guardian',
    'elder_guardian','warden','wither_skeleton'
  ]);
}

module.exports = {
  Vec3,
  sleep,
  distance,
  distanceXZ,
  randomInt,
  nearestOf,
  itemCount,
  anyCount,
  hasItem,
  findItem,
  equipBest,
  equipShield,
  hostileNames
};
