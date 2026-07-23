'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, findItem, hasItem } = require('../utils/helpers');
const { Vec3 } = require('vec3');

class Survival {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  detectNeed() {
    if (this.bot.oxygenLevel !== undefined && this.bot.oxygenLevel <= 5) return 'drowning';
    if (this.bot.entity?.onFire) return 'on_fire';
    const below = this.bot.entity ? this.bot.blockAt(this.bot.entity.position.offset(0, -0.5, 0)) : null;
    if (below?.name === 'lava') return 'in_lava';
    if (this.bot.food <= 6) return 'hungry';
    if (this.bot.health < 6) return 'critical_hp';
    return null;
  }

  async act(need) {
    if (need === 'drowning') return this.escapeWater();
    if (need === 'on_fire') return this.escapeFire();
    if (need === 'in_lava') return this.escapeLava();
    if (need === 'hungry') return this.handleHunger();
    if (need === 'critical_hp') return this.retreatAndHeal();
  }

  async escapeWater() {
    this.bot.setControlState('jump', true);
    this.bot.setControlState('forward', true);
    await sleep(2000);
    this.bot.clearControlStates();
  }

  async escapeFire() {
    const waterId = this.mcData.blocksByName.water?.id;
    const water = waterId ? this.bot.findBlock({ matching: waterId, maxDistance: 20 }) : null;
    if (water) {
      try { await this.bot.pathfinder.goto(new goals.GoalNear(water.position.x, water.position.y, water.position.z, 1)); return; } catch {}
    }
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('forward', true);
    await sleep(2500);
    this.bot.clearControlStates();
  }

  async escapeLava() {
    this.bot.setControlState('jump', true);
    const block = findItem(this.bot, ['cobblestone','stone','dirt','netherrack','cobbled_deepslate']);
    if (block) {
      try {
        await this.bot.equip(block, 'hand');
        const ref = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
        if (ref) await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
      } catch {}
    }
    await sleep(700);
    this.bot.setControlState('jump', false);
  }

  async handleHunger() {
    if (this.bot.autoEat?.eat) {
      try { await this.bot.autoEat.eat(); return true; } catch {}
    }
    const food = findItem(this.bot, ['bread','steak','cooked_beef','cooked_porkchop','cooked_mutton','cooked_chicken','baked_potato','carrot','apple','sweet_berries']);
    if (food) {
      try {
        await this.bot.equip(food, 'hand');
        this.bot.activateItem();
        await sleep(1700);
        this.bot.deactivateItem();
        return true;
      } catch {}
    }
    return false;
  }

  async retreatAndHeal() {
    const gapple = findItem(this.bot, ['enchanted_golden_apple','golden_apple']);
    if (gapple) {
      try {
        await this.bot.equip(gapple, 'hand');
        this.bot.activateItem();
        await sleep(1700);
        this.bot.deactivateItem();
      } catch {}
    }
    this.bot.setControlState('back', true);
    await sleep(500);
    this.bot.setControlState('back', false);
    let tries = 0;
    while (this.bot.health < 16 && tries < 20) {
      await sleep(500);
      tries += 1;
    }
  }
}

module.exports = Survival;
