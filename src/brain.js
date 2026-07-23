'use strict';

const { sleep } = require('./utils/helpers');
const Combat = require('./combat/combat');
const Survival = require('./survival/survival');
const Shelter = require('./skills/shelter');
const Progression = require('./skills/progression');
const DragonFight = require('./dragon/dragon_fight');
const ItemRecovery = require('./skills/item_recovery');
const AntiAFK = require('./skills/anti_afk');

class Brain {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
    this.running = false;
    this.busy = false;
    this.lastDamageCause = null;

    this.combat = new Combat(bot, memory, mcData, logger);
    this.survival = new Survival(bot, memory, mcData, logger);
    this.shelter = new Shelter(bot, memory, mcData, logger);
    this.progression = new Progression(bot, memory, mcData, logger);
    this.dragon = new DragonFight(bot, memory, mcData, logger);
    this.recovery = new ItemRecovery(bot, memory, mcData, logger);
    this.antiAfk = new AntiAFK(bot, memory, mcData, logger);
  }

  observeHealth() {
    if (this.bot.health < 8) this.logger.warn(`low hp: ${this.bot.health}`);
  }

  onDeath() {
    this.busy = false;
  }

  async start() {
    this.running = true;
    this.logger.info(`brain online | phase=${this.memory.state.currentPhase}`);
    while (this.running) {
      try {
        if (!this.busy) await this.tick();
      } catch (e) {
        this.logger.error('brain tick error:', e.message);
      }
      await sleep(400);
    }
  }

  async stop() {
    this.running = false;
    try { this.bot.pathfinder.stop(); } catch {}
    try { this.bot.pvp.stop(); } catch {}
  }

  async tick() {
    const threat = this.combat.detectThreat();
    if (threat) {
      this.busy = true;
      this.memory.recordTask(`threat:${threat.name}`);
      try { await this.combat.handleThreat(threat); } finally { this.busy = false; }
      return;
    }

    const need = this.survival.detectNeed();
    if (need) {
      this.busy = true;
      this.memory.recordTask(`survival:${need}`);
      try { await this.survival.act(need); } finally { this.busy = false; }
      return;
    }

    const drop = this.memory.freshDrops()[0];
    if (drop && this.bot.entity?.position?.distanceTo(drop.pos) < 300) {
      this.busy = true;
      try {
        const ok = await this.recovery.recover(drop);
        this.memory.reportSkill('item_recovery', ok);
        if (ok) this.memory.removeDrop(drop);
      } finally { this.busy = false; }
      await this.memory.save();
      return;
    }

    if (this.shelter.needsShelter()) {
      this.busy = true;
      try { this.memory.reportSkill('shelter', await this.shelter.buildOrEnterShelter()); }
      finally { this.busy = false; }
      await this.memory.save();
      return;
    }

    if (['end', 'dragon'].includes(this.memory.state.currentPhase)) {
      this.busy = true;
      try {
        const ok = await this.dragon.execute();
        this.memory.reportSkill('dragon_fight', ok);
        if (ok) {
          this.memory.state.totalDragonKills += 1;
          this.memory.state.currentPhase = 'farming';
        }
      } finally { this.busy = false; }
      await this.memory.save();
      return;
    }

    this.busy = true;
    try {
      const next = await this.progression.advance(this.memory.state.currentPhase);
      if (next && next !== this.memory.state.currentPhase) {
        this.logger.info(`phase ${this.memory.state.currentPhase} -> ${next}`);
        this.memory.state.currentPhase = next;
        await this.memory.save();
      }
    } finally { this.busy = false; }

    await this.antiAfk.fidget();
  }
}

module.exports = Brain;
