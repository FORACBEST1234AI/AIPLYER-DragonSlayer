'use strict';

const { itemCount } = require('../utils/helpers');

class Stronghold {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  async progress() {
    if (this.bot.game?.dimension === 'the_end') return 'dragon';
    if (itemCount(this.bot, 'ender_eye') >= 10) {
      this.memory.learn('stronghold_hunt', 'eyes available, stronghold search can begin');
    }
    return 'end';
  }
}

module.exports = Stronghold;
