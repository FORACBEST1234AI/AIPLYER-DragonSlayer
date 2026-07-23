'use strict';

const { equipBest, sleep, findItem, hasItem } = require('../utils/helpers');
const { safeDig, safePlaceAt } = require('../utils/place_helper');
const { canMine, toolFor, highestPickaxeTier, highestAxeTier } = require('../utils/tool_check');
const { Vec3 } = require('vec3');

const LOGS = ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log'];
const STONES = ['stone','deepslate','cobbled_deepslate','andesite','diorite','granite','tuff'];

class Mining {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  /**
   * Ensure a specific tool tier is available before starting a heavy task.
   * Returns true if bot has at least the given tier of the given tool kind.
   */
  hasToolTier(kind, minTier) {
    if (kind === 'pickaxe') return highestPickaxeTier(this.bot) >= minTier;
    if (kind === 'axe')     return highestAxeTier(this.bot) >= minTier;
    return true;
  }

  async chopWood(count = 8) {
    let picked = 0;
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => LOGS.includes(b.name), maxDistance: 64 });
      if (!block) break;
      try {
        await equipBest(this.bot, 'axe'); // may be null (hand) — wood still yields drop
        await this.bot.collectBlock.collect(block);
        picked++;
      } catch (e) { this.logger.warn('chopWood:', e.message); break; }
    }
    return picked;
  }

  async mineStone(count = 16) {
    // CRITICAL: refuse to try mining stone without a pickaxe
    if (!this.hasToolTier('pickaxe', 1)) {
      this.logger.warn('mineStone: no pickaxe, aborting');
      return 0;
    }
    let picked = 0;
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => STONES.includes(b.name), maxDistance: 48 });
      if (!block) break;
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
        picked++;
      } catch (e) { this.logger.warn('mineStone:', e.message); break; }
    }
    return picked;
  }

  async mineIron(count = 8) {
    if (!this.hasToolTier('pickaxe', 2)) {
      this.logger.warn('mineIron: need at least stone pickaxe, aborting');
      return 0;
    }
    let picked = 0;
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => ['iron_ore','deepslate_iron_ore'].includes(b.name), maxDistance: 64 });
      if (!block) {
        // Only dig staircase if we have a pickaxe (double-check)
        await this.digStaircaseDown(6);
        continue;
      }
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
        picked++;
      } catch (e) { this.logger.warn('mineIron:', e.message); break; }
    }
    return picked;
  }

  async mineDiamond(count = 3) {
    if (!this.hasToolTier('pickaxe', 3)) {
      this.logger.warn('mineDiamond: need iron pickaxe, aborting');
      return 0;
    }
    let picked = 0;
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => ['diamond_ore','deepslate_diamond_ore'].includes(b.name), maxDistance: 72 });
      if (!block) {
        await this.digStaircaseDown(8);
        continue;
      }
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
        picked++;
      } catch (e) { this.logger.warn('mineDiamond:', e.message); break; }
    }
    return picked;
  }

  async mineCoal(count = 8) {
    if (!this.hasToolTier('pickaxe', 1)) {
      this.logger.warn('mineCoal: no pickaxe, aborting');
      return 0;
    }
    let picked = 0;
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => ['coal_ore','deepslate_coal_ore'].includes(b.name), maxDistance: 48 });
      if (!block) break;
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
        picked++;
      } catch (e) { break; }
    }
    return picked;
  }

  /**
   * SAFE staircase-down. CRITICAL FIX: refuses to dig if bot has no pickaxe,
   * so it never tries to hand-mine stone. Also checks each block's requirement
   * before attempting.
   */
  async digStaircaseDown(depth = 10) {
    if (!this.hasToolTier('pickaxe', 1)) {
      this.logger.warn('digStaircaseDown: no pickaxe, refusing to hand-dig');
      return 0;
    }
    await equipBest(this.bot, 'pickaxe');
    let steps = 0;
    for (let i = 0; i < depth; i++) {
      const pos = this.bot.entity.position.floored();
      const dig1 = this.bot.blockAt(pos.offset(1, 0, 0));   // head level
      const dig2 = this.bot.blockAt(pos.offset(1, -1, 0));  // step forward-down

      // Sanity check — refuse to dig blocks we can't mine
      if (dig2 && !canMine(this.bot, dig2.name)) {
        this.logger.warn(`digStaircaseDown: cannot mine ${dig2.name}, stopping`);
        break;
      }
      if (dig1 && !canMine(this.bot, dig1.name) && dig1.name !== 'air') {
        this.logger.warn(`digStaircaseDown: cannot mine ${dig1.name} above step, stopping`);
        break;
      }

      const okAbove = await safeDig(this.bot, dig1);
      const okStep = await safeDig(this.bot, dig2);
      if (!okStep) break;

      try {
        this.bot.setControlState('forward', true);
        await sleep(400);
        this.bot.setControlState('forward', false);
      } catch {}
      await sleep(150);
      steps++;
    }
    return steps;
  }

  /**
   * Branch mining at Y=-58 (best diamond level in 1.21).
   * Requires iron pickaxe. Digs 2x1 tunnels alternating.
   */
  async branchMine(length = 20) {
    if (!this.hasToolTier('pickaxe', 3)) {
      this.logger.warn('branchMine: need iron pickaxe');
      return 0;
    }
    await equipBest(this.bot, 'pickaxe');
    let mined = 0;
    for (let i = 0; i < length; i++) {
      const yaw = this.bot.entity.yaw;
      const dx = -Math.round(Math.sin(yaw));
      const dz = -Math.round(Math.cos(yaw));
      const feetTarget = this.bot.entity.position.floored().offset(dx, 0, dz);
      const headTarget = feetTarget.offset(0, 1, 0);
      const feet = this.bot.blockAt(feetTarget);
      const head = this.bot.blockAt(headTarget);
      if (feet && canMine(this.bot, feet.name)) await safeDig(this.bot, feet);
      if (head && canMine(this.bot, head.name)) await safeDig(this.bot, head);
      try {
        this.bot.setControlState('forward', true);
        await sleep(300);
        this.bot.setControlState('forward', false);
      } catch {}
      mined++;
    }
    return mined;
  }
}

module.exports = Mining;
