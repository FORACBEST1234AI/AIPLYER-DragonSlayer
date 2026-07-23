'use strict';

const { sleep, randomInt } = require('../utils/helpers');

class AntiAFK {
  constructor(bot) {
    this.bot = bot;
    this.last = 0;
  }

  async fidget() {
    if (Date.now() - this.last < 4000) return;
    this.last = Date.now();
    const r = Math.random();
    try {
      if (r < 0.25) {
        await this.bot.look(this.bot.entity.yaw + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, false);
      } else if (r < 0.5) {
        this.bot.setControlState('jump', true);
        await sleep(180);
        this.bot.setControlState('jump', false);
      } else if (r < 0.7) {
        this.bot.setControlState('sneak', true);
        await sleep(randomInt(200, 450));
        this.bot.setControlState('sneak', false);
      } else if (r < 0.85) {
        this.bot.swingArm('right');
      } else {
        this.bot.setControlState('left', true);
        await sleep(150);
        this.bot.setControlState('left', false);
      }
    } catch {}
  }
}

module.exports = AntiAFK;
