'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, itemCount, equipBest } = require('../utils/helpers');

const FOODS = ['bread','steak','cooked_beef','cooked_porkchop','cooked_chicken','cooked_mutton','baked_potato','carrot','apple','sweet_berries'];

class Food {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  hasEnoughFood() {
    return FOODS.reduce((s, n) => s + itemCount(this.bot, n), 0) >= 8;
  }

  async gatherFood() {
    const mob = Object.values(this.bot.entities).find(e => ['cow','pig','sheep','chicken','rabbit'].includes(e.name) && e.position.distanceTo(this.bot.entity.position) < 28);
    if (mob) {
      try {
        await equipBest(this.bot, 'sword');
        await this.bot.pathfinder.goto(new goals.GoalFollow(mob, 1));
        for (let i = 0; i < 8 && mob.isValid; i++) {
          this.bot.attack(mob);
          await sleep(500);
        }
        return true;
      } catch {}
    }
    const crop = this.bot.findBlock({ matching: b => ['wheat','carrots','potatoes','beetroots','sweet_berry_bush'].includes(b.name), maxDistance: 24 });
    if (crop) {
      try { await this.bot.collectBlock.collect(crop); return true; } catch {}
    }
    return false;
  }
}

module.exports = Food;
