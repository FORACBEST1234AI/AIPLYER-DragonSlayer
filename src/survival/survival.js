'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, findItem, hasItem } = require('../utils/helpers');
const { Vec3 } = require('vec3');
const { isInWater, isHeadUnderwater, waterSurvive, swimUp } = require('../utils/swim_helper');
const { safePlaceAt } = require('../utils/place_helper');

class Survival {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  detectNeed() {
    if (!this.bot.entity) return null;

    // Head underwater with low oxygen -> immediate drowning
    if (isHeadUnderwater(this.bot) && (this.bot.oxygenLevel ?? 20) <= 8) return 'drowning';

    // Just in water at all -> swim to land (proactive)
    if (isInWater(this.bot)) return 'in_water';

    if (this.bot.entity?.onFire) return 'on_fire';
    const below = this.bot.blockAt(this.bot.entity.position.offset(0, -0.5, 0));
    if (below?.name === 'lava') return 'in_lava';
    if (this.bot.food <= 6) return 'hungry';
    if (this.bot.health < 6) return 'critical_hp';
    return null;
  }

  async act(need) {
    switch (need) {
      case 'drowning':  return this.escapeDrowning();
      case 'in_water':  return this.getOutOfWater();
      case 'on_fire':   return this.escapeFire();
      case 'in_lava':   return this.escapeLava();
      case 'hungry':    return this.handleHunger();
      case 'critical_hp': return this.retreatAndHeal();
      default: return false;
    }
  }

  async escapeDrowning() {
    this.logger.warn('drowning! swimming up');
    // First priority: get head above water
    await swimUp(this.bot, 6000);
    // Then swim to land
    if (isInWater(this.bot)) await waterSurvive(this.bot, 12000);
    return !isInWater(this.bot);
  }

  async getOutOfWater() {
    this.logger.info('in water, swimming to land');
    return waterSurvive(this.bot, 12000);
  }

  async escapeFire() {
    const waterId = this.mcData.blocksByName.water?.id;
    const water = waterId ? this.bot.findBlock({ matching: waterId, maxDistance: 20 }) : null;
    if (water) {
      try {
        await this.bot.pathfinder.goto(new goals.GoalNear(water.position.x, water.position.y, water.position.z, 1));
        return true;
      } catch {}
    }
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('forward', true);
    await sleep(2500);
    this.bot.clearControlStates();
    return true;
  }

  async escapeLava() {
    this.bot.setControlState('jump', true);
    const block = findItem(this.bot, ['cobblestone','stone','dirt','netherrack','cobbled_deepslate']);
    if (block) {
      const pos = this.bot.entity.position.floored().offset(0, -1, 0);
      await safePlaceAt(this.bot, block, pos);
    }
    await sleep(700);
    this.bot.setControlState('jump', false);
    return true;
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
    return true;
  }
}

module.exports = Survival;
