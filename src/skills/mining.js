'use strict';

const { equipBest } = require('../utils/helpers');

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
      if (!block) break;
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
      if (!block) break;
      try {
        await equipBest(this.bot, 'pickaxe');
        await this.bot.collectBlock.collect(block);
      } catch (e) { this.logger.warn('mineDiamond:', e.message); break; }
    }
    return true;
  }
}

module.exports = Mining;
