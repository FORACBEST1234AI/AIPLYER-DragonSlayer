'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, nearestOf, equipBest, equipShield, findItem, hostileNames } = require('../utils/helpers');
const { Vec3 } = require('vec3');

const HOSTILES = hostileNames();

class Combat {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  detectThreat() {
    if (!this.bot.entity) return null;
    const creeper = nearestOf(this.bot, e => e.name === 'creeper', 9);
    if (creeper) return creeper;
    const warden = nearestOf(this.bot, e => e.name === 'warden', 28);
    if (warden) return warden;
    const close = nearestOf(this.bot, e => HOSTILES.has(e.name), 6);
    if (close) return close;
    const ranged = nearestOf(this.bot, e => ['skeleton','stray','bogged','witch','blaze','ghast'].includes(e.name), 16);
    if (ranged && this.bot.health < 16) return ranged;
    return null;
  }

  async handleThreat(entity) {
    if (!entity?.isValid) return;
    if (entity.name === 'creeper') return this.handleCreeper(entity);
    if (entity.name === 'warden') return this.flee(entity, 40);
    if (entity.name === 'enderman') return this.handleEnderman(entity);

    await equipShield(this.bot);
    const sword = await equipBest(this.bot, 'sword');
    const axe = sword ? null : await equipBest(this.bot, 'axe');
    if (!sword && !axe && this.bot.health < 14) return this.flee(entity, 20);

    const bow = findItem(this.bot, ['bow']);
    if (bow && entity.position.distanceTo(this.bot.entity.position) > 6) {
      return this.rangedAttack(entity);
    }

    try {
      this.bot.pvp.attack(entity);
      const start = Date.now();
      while (entity.isValid && Date.now() - start < 15000) {
        if (this.bot.health < 6) { this.bot.pvp.stop(); break; }
        await sleep(250);
      }
      this.bot.pvp.stop();
      if (this.bot.health < 6) await this.flee(entity, 16);
    } catch (e) {
      this.logger.warn('pvp failed:', e.message);
    }
  }

  async handleCreeper(creeper) {
    const dist = creeper.position.distanceTo(this.bot.entity.position);
    if (dist > 4 && this.bot.health > 12) {
      const sword = await equipBest(this.bot, 'sword');
      if (sword) {
        try {
          this.bot.attack(creeper);
          await sleep(300);
        } catch {}
      }
    }

    if (await equipShield(this.bot)) {
      try {
        this.bot.activateItem();
        await this.flee(creeper, 8);
        this.bot.deactivateItem();
        return;
      } catch {}
    }

    const block = findItem(this.bot, ['cobblestone','dirt','stone','cobbled_deepslate','netherrack']);
    if (block && dist < 4) {
      try {
        await this.bot.equip(block, 'hand');
        const ref = this.bot.blockAt(this.bot.entity.position.floored().offset(1, -1, 0));
        if (ref) await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
      } catch {}
    }
    await this.flee(creeper, 12);
  }

  async handleEnderman(enderman) {
    await this.flee(enderman, 18);
    if (enderman.isValid && enderman.position.distanceTo(this.bot.entity.position) < 4) {
      await equipBest(this.bot, 'sword');
      try { this.bot.pvp.attack(enderman); } catch {}
    }
  }

  async rangedAttack(entity) {
    const bow = findItem(this.bot, ['bow']);
    if (!bow) return false;
    try {
      await this.bot.equip(bow, 'hand');
      for (let i = 0; i < 4 && entity.isValid; i++) {
        await this.bot.lookAt(entity.position.offset(0, entity.height * 0.8, 0), true);
        this.bot.activateItem();
        await sleep(1200);
        this.bot.deactivateItem();
        await sleep(500);
      }
      return true;
    } catch {
      return false;
    }
  }

  async flee(entity, dist = 15) {
    const away = this.bot.entity.position.minus(entity.position).normalize().scale(dist);
    const t = this.bot.entity.position.plus(away);
    try {
      this.bot.pathfinder.setGoal(new goals.GoalNear(t.x, t.y, t.z, 2), false);
      const start = Date.now();
      while (Date.now() - start < 6000 && entity.isValid && entity.position.distanceTo(this.bot.entity.position) < dist) {
        await sleep(250);
      }
      this.bot.pathfinder.stop();
    } catch {}
  }
}

module.exports = Combat;
