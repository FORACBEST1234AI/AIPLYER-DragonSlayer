'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, nearestOf, equipBest, equipShield, findItem, hasItem, hostileNames } = require('../utils/helpers');
const { Vec3 } = require('vec3');
const { safePlaceAt } = require('../utils/place_helper');

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
    // Creeper — highest priority (explosion)
    const creeper = nearestOf(this.bot, e => e.name === 'creeper', 9);
    if (creeper) return creeper;
    // Warden — always flee
    const warden = nearestOf(this.bot, e => e.name === 'warden', 28);
    if (warden) return warden;
    // Any hostile in close range
    const close = nearestOf(this.bot, e => HOSTILES.has(e.name), 8);
    if (close) return close;
    // Ranged threats when hurt
    const ranged = nearestOf(this.bot, e => ['skeleton','stray','bogged','witch','blaze','ghast'].includes(e.name), 16);
    if (ranged && this.bot.health < 16) return ranged;
    // Zombies/husks/drowned proactively
    const zombie = nearestOf(this.bot, e => ['zombie','husk','drowned','zombie_villager'].includes(e.name), 12);
    if (zombie) return zombie;
    // Spiders
    const spider = nearestOf(this.bot, e => ['spider','cave_spider'].includes(e.name), 8);
    if (spider) return spider;
    return null;
  }

  async handleThreat(entity) {
    if (!entity?.isValid) return;
    if (entity.name === 'creeper')  return this.handleCreeper(entity);
    if (entity.name === 'warden')   return this.flee(entity, 40);
    if (entity.name === 'enderman') return this.handleEnderman(entity);

    // Pre-fight prep
    await equipShield(this.bot);
    const sword = await equipBest(this.bot, 'sword');
    const axe = sword ? null : await equipBest(this.bot, 'axe');

    // Unarmed AND low HP -> flee
    if (!sword && !axe && this.bot.health < 14) return this.flee(entity, 20);

    // Try to auto-equip any armor before fighting
    try { this.bot.armorManager.equipAll(); } catch {}

    const dist = entity.position.distanceTo(this.bot.entity.position);

    // Ranged attack when far & we have a bow
    const bow = findItem(this.bot, ['bow']);
    if (bow && dist > 6 && hasItemArrow(this.bot)) {
      return this.rangedAttack(entity);
    }

    // MELEE: aggressive approach + attack loop with stuck detection
    return this.meleeAttack(entity);
  }

  /**
   * Strong melee: sprint-hit combo, shield timing, retreat on low HP.
   */
  async meleeAttack(entity) {
    const bot = this.bot;
    const startPos = bot.entity.position.clone();
    let lastAttackAt = 0;
    let lastPosCheck = Date.now();
    let stuckCounter = 0;
    let attackCount = 0;
    const timeoutMs = 25_000;
    const startTime = Date.now();

    // Try native pvp plugin first
    try {
      bot.pvp.attack(entity);
    } catch (e) {
      this.logger.warn('pvp.attack failed, doing manual attack:', e.message);
    }

    while (entity.isValid && Date.now() - startTime < timeoutMs) {
      if (bot.health < 6) {
        bot.pvp.stop();
        await this.flee(entity, 16);
        return;
      }

      const dist = entity.position.distanceTo(bot.entity.position);

      // Sprint-hit: right before hitting, sprint jump for crit
      if (dist < 4 && Date.now() - lastAttackAt > 600) {
        try {
          // sprint-hit combo
          bot.setControlState('sprint', true);
          await bot.lookAt(entity.position.offset(0, entity.height * 0.9, 0), true);

          // Critical hit: jump-strike (fall while hitting = crit damage)
          if (attackCount % 3 === 0) {
            bot.setControlState('jump', true);
            await sleep(80);
            bot.setControlState('jump', false);
          }

          bot.attack(entity);
          lastAttackAt = Date.now();
          attackCount++;

          // Strafe randomly to avoid arrows/skeleton
          if (Math.random() < 0.3) {
            const side = Math.random() < 0.5 ? 'left' : 'right';
            bot.setControlState(side, true);
            await sleep(150);
            bot.setControlState(side, false);
          }
        } catch (e) { /* ignore */ }
      }

      // If entity is far, walk toward it
      if (dist > 4) {
        try {
          bot.pathfinder.setGoal(new goals.GoalFollow(entity, 2), true);
        } catch {}
      }

      // Stuck detection — 6s no progress + still far -> retreat
      if (Date.now() - lastPosCheck > 2000) {
        const moved = bot.entity.position.distanceTo(startPos) > 1.5;
        if (!moved && dist > 4) {
          stuckCounter += 1;
          if (stuckCounter >= 3) {
            this.logger.warn('combat: stuck for 6s, retreating');
            bot.pvp.stop();
            await this.flee(entity, 12);
            return;
          }
        } else {
          stuckCounter = 0;
          startPos.set(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z);
        }
        lastPosCheck = Date.now();
      }

      await sleep(180);
    }

    try { bot.pvp.stop(); } catch {}
    try { bot.setControlState('sprint', false); } catch {}
  }

  async handleCreeper(creeper) {
    const bot = this.bot;
    const dist = creeper.position.distanceTo(bot.entity.position);

    // Have sword AND far enough -> quick strike + immediate retreat
    const sword = await equipBest(bot, 'sword');
    if (sword && dist > 4.5 && bot.health > 12) {
      try {
        await bot.pathfinder.goto(new goals.GoalFollow(creeper, 2));
        await bot.lookAt(creeper.position.offset(0, 0.9, 0), true);
        bot.attack(creeper);
        // Immediately jump back
        bot.setControlState('back', true);
        bot.setControlState('sprint', true);
        await sleep(400);
        bot.setControlState('back', false);
        bot.setControlState('sprint', false);
        return this.flee(creeper, 10);
      } catch {}
    }

    // Shield block + backpedal
    if (await equipShield(bot)) {
      try {
        bot.activateItem();
        bot.setControlState('back', true);
        await sleep(1500);
        bot.setControlState('back', false);
        bot.deactivateItem();
        return;
      } catch {}
    }

    // Wall of block between us and creeper
    const block = findItem(bot, ['cobblestone','dirt','stone','cobbled_deepslate','netherrack']);
    if (block && dist < 4) {
      const dir = creeper.position.minus(bot.entity.position).normalize();
      const targetPos = bot.entity.position.floored().offset(Math.round(dir.x), 0, Math.round(dir.z));
      await safePlaceAt(bot, block, targetPos);
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
      const start = Date.now();
      while (entity.isValid && Date.now() - start < 15_000) {
        await this.bot.lookAt(entity.position.offset(0, entity.height * 0.8, 0), true);
        this.bot.activateItem();
        await sleep(1200);
        this.bot.deactivateItem();
        await sleep(400);
        const d = entity.position.distanceTo(this.bot.entity.position);
        if (d < 3) return this.meleeAttack(entity);
      }
      return true;
    } catch { return false; }
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

function hasItemArrow(bot) {
  return (bot.inventory?.items?.() || []).some(i => i.name === 'arrow' || i.name === 'tipped_arrow' || i.name === 'spectral_arrow');
}

module.exports = Combat;
