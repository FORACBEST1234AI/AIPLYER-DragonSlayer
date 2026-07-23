'use strict';

const { sleep, randomInt } = require('../utils/helpers');
const { isInWater } = require('../utils/swim_helper');
const { safeJump } = require('../utils/place_helper');

class AntiAFK {
  constructor(bot) {
    this.bot = bot;
    this.last = 0;
  }

  async fidget() {
    if (Date.now() - this.last < 4000) return;
    this.last = Date.now();

    // Don't fidget in water — could cause drowning
    if (isInWater(this.bot)) return;

    const r = Math.random();
    try {
      if (r < 0.25) {
        await this.bot.look(this.bot.entity.yaw + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, false);
      } else if (r < 0.45) {
        // Safe jump — only if there's headroom
        await safeJump(this.bot);
      } else if (r < 0.65) {
        this.bot.setControlState('sneak', true);
        await sleep(randomInt(200, 450));
        this.bot.setControlState('sneak', false);
      } else if (r < 0.82) {
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
