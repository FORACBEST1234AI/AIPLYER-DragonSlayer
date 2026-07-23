'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, findItem, hasItem } = require('../utils/helpers');
const { Vec3 } = require('vec3');

class DragonFight {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  async execute() {
    if (this.bot.game?.dimension !== 'the_end') return false;
    await this.destroyCrystals();
    return this.attackDragon();
  }

  async destroyCrystals() {
    const bow = findItem(this.bot, ['bow']);
    if (!bow || !hasItem(this.bot, 'arrow')) return false;
    const crystals = Object.values(this.bot.entities).filter(e => e.name === 'end_crystal');
    for (const crystal of crystals.slice(0, 12)) {
      try {
        await this.bot.equip(bow, 'hand');
        await this.bot.lookAt(crystal.position, true);
        this.bot.activateItem();
        await sleep(1200);
        this.bot.deactivateItem();
        await sleep(400);
      } catch {}
    }
    return true;
  }

  async attackDragon() {
    const start = Date.now();
    while (Date.now() - start < 6 * 60 * 1000) {
      const dragon = Object.values(this.bot.entities).find(e => e.name === 'ender_dragon');
      if (!dragon) return true;
      const bed = (this.bot.inventory.items() || []).find(i => i.name.endsWith('_bed'));
      if (bed && Math.abs(dragon.velocity.x) < 0.05 && Math.abs(dragon.velocity.z) < 0.05) {
        try {
          await this.bot.equip(bed, 'hand');
          const ref = this.bot.blockAt(this.bot.entity.position.offset(1, -1, 0));
          if (ref) await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
          await sleep(200);
          const placed = this.bot.findBlock({ matching: b => b.name?.endsWith('_bed'), maxDistance: 3 });
          if (placed) await this.bot.activateBlock(placed);
        } catch {}
      } else {
        const bow = findItem(this.bot, ['bow']);
        if (bow && hasItem(this.bot, 'arrow')) {
          try {
            await this.bot.equip(bow, 'hand');
            await this.bot.lookAt(dragon.position.offset(0, 3, 0), true);
            this.bot.activateItem();
            await sleep(1400);
            this.bot.deactivateItem();
          } catch {}
        } else {
          try { this.bot.pathfinder.setGoal(new goals.GoalNear(dragon.position.x, dragon.position.y, dragon.position.z, 3), false); } catch {}
        }
      }
      await sleep(500);
    }
    return false;
  }
}

module.exports = DragonFight;
