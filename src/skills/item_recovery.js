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
    // Skip if items are trash
    const valuable = (drop.items || []).some(i =>
      !['dirt','cobblestone','rotten_flesh','string','gravel','sand'].includes(i.name)
    );
    if (!valuable) return true;
    try {
      // Timeout the recovery attempt so we don't wait forever
      await Promise.race([
        this.bot.pathfinder.goto(new goals.GoalNear(drop.pos.x, drop.pos.y, drop.pos.z, 2)),
        new Promise((_, rej) => setTimeout(() => rej(new Error('recovery timeout')), 60000)),
      ]);
      await sleep(1500);
      return true;
    } catch (e) {
      this.logger.warn('recovery failed:', e.message);
      return false;
    }
  }
}

module.exports = ItemRecovery;
