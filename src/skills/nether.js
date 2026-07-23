'use strict';

const { hasItem, itemCount } = require('../utils/helpers');
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

    if (!hasItem(this.bot, 'diamond_pickaxe')) {
      if (itemCount(this.bot, 'diamond') < 3) {
        await this.mining.mineDiamond(3);
        return 'nether';
      }
      await this.crafting.craftTool('diamond_pickaxe');
      await this.crafting.craftTool('diamond_sword');
      return 'nether';
    }

    this.memory.learn('nether_ready', 'prepared for nether progression');
    return 'nether';
  }
}

module.exports = Nether;
