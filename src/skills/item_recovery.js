'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep } = require('../utils/helpers');

class ItemRecovery {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  async recover(drop) {
    if (!drop || !drop.pos) return false;
    if (drop.expiresAt <= Date.now()) return false;
    const valuable = (drop.items || []).some(i => !['dirt','cobblestone','rotten_flesh','string','gravel'].includes(i.name));
    if (!valuable) return true;
    try {
      await this.bot.pathfinder.goto(new goals.GoalNear(drop.pos.x, drop.pos.y, drop.pos.z, 2));
      await sleep(1500);
      return true;
    } catch (e) {
      this.logger.warn('recovery failed:', e.message);
      return false;
    }
  }
}

module.exports = ItemRecovery;
