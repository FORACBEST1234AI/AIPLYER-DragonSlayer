'use strict';

const { equipBest, sleep } = require('../utils/helpers');
const { safeDig, safePlaceAt } = require('../utils/place_helper');
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

  async chopWood(count = 8) {
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => LOGS.includes(b.name), maxDistance: 48 });
      if (!block) break;
      try {
        await equipBest(this.bot, 'axe');
        await this.bot.collectBlock.collect(block);
      } catch (e) { this.logger.warn('chopWood:', e.message); break; }
    }
    return true;
  }

  async mineStone(count = 16) {
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => STONES.includes(b.name), maxDistance: 48 });
      if (!block) break;
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
      } catch (e) { this.logger.warn('mineStone:', e.message); break; }
    }
    return true;
  }

  async mineIron(count = 8) {
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => ['iron_ore','deepslate_iron_ore'].includes(b.name), maxDistance: 64 });
      if (!block) {
        // No iron visible — dig a small staircase down
        await this.digStaircaseDown(6);
        continue;
      }
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
      } catch (e) { this.logger.warn('mineIron:', e.message); break; }
    }
    return true;
  }

  async mineDiamond(count = 3) {
    for (let i = 0; i < count; i++) {
      const block = this.bot.findBlock({ matching: b => ['diamond_ore','deepslate_diamond_ore'].includes(b.name), maxDistance: 72 });
      if (!block) {
        await this.digStaircaseDown(8);
        continue;
      }
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
      } catch (e) { this.logger.warn('mineDiamond:', e.message); break; }
    }
    return true;
  }

  /**
   * Safe staircase-down that uses safeDig (won't spin on bedrock / air) and
   * places torches every 6 blocks for lighting if available.
   */
  async digStaircaseDown(depth = 10) {
    await equipBest(this.bot, 'pickaxe');
    for (let i = 0; i < depth; i++) {
      const pos = this.bot.entity.position.floored();
      const dig1 = this.bot.blockAt(pos.offset(1, 0, 0));
      const dig2 = this.bot.blockAt(pos.offset(1, -1, 0));
      const okAbove = await safeDig(this.bot, dig1);
      const okStep = await safeDig(this.bot, dig2);
      if (!okStep) break;
      // Step forward + down
      try {
        this.bot.setControlState('forward', true);
        await sleep(400);
        this.bot.setControlState('forward', false);
      } catch {}
      await sleep(150);
    }
    return true;
  }
}

module.exports = Mining;
