'use strict';

const { hasItem, itemCount, findItem } = require('../utils/helpers');
const { inventoryAudit } = require('../utils/tool_check');
const Mining = require('./mining');
const Crafting = require('./crafting');

class Nether {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
    this.mining = new Mining(bot, memory, mcData, logger);
    this.crafting = new Crafting(bot, memory, mcData, logger);
  }

  async progress() {
    const audit = inventoryAudit(this.bot);

    // Already in nether?
    if (this.bot.game?.dimension === 'the_nether') {
      if (itemCount(this.bot, 'blaze_rod') < 6) {
        this.logger.info('nether: searching for blaze rods');
        return 'nether';
      }
      if (itemCount(this.bot, 'ender_pearl') < 12) {
        this.logger.info('nether: searching for pearls');
        return 'nether';
      }
      return 'end';
    }

    // Prerequisites for nether
    if (audit.pickaxe < 3) {
      this.logger.warn('nether: no iron pickaxe yet, going back to iron phase');
      return 'iron';
    }
    if (audit.diamond < 3 && !hasItem(this.bot, 'diamond_pickaxe')) {
      this.logger.info('nether: mining diamonds first');
      await this.mining.mineDiamond(3);
      return 'nether';
    }
    if (!hasItem(this.bot, 'diamond_pickaxe')) {
      await this.crafting.craftTool('diamond_pickaxe');
      await this.crafting.craftTool('diamond_sword');
    }

    // Obsidian check
    if (itemCount(this.bot, 'obsidian') < 10) {
      this.logger.info('nether: need obsidian for portal');
      return 'nether';
    }

    this.memory.learn('nether_ready', 'has diamond pick + obsidian');
    return 'nether';
  }
}

module.exports = Nether;
