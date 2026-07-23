'use strict';

const { hasItem, itemCount, findItem } = require('../utils/helpers');
const { inventoryAudit } = require('../utils/tool_check');
const Mining = require('./mining');
const Crafting = require('./crafting');
const Food = require('./food');
const Nether = require('./nether');
const Stronghold = require('./stronghold');

class Progression {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
    this.mining = new Mining(bot, memory, mcData, logger);
    this.crafting = new Crafting(bot, memory, mcData, logger);
    this.food = new Food(bot, memory, mcData, logger);
    this.nether = new Nether(bot, memory, mcData, logger);
    this.stronghold = new Stronghold(bot, memory, mcData, logger);
  }

  /**
   * CRITICAL FIX: always audit inventory first.
   * If bot already has what a phase needs, skip that step instead of
   * blindly re-gathering.
   */
  async advance(phase) {
    const audit = inventoryAudit(this.bot);
    this.logger.info(`inventory: logs=${audit.logs} planks=${audit.planks} sticks=${audit.sticks} cobble=${audit.cobble} coal=${audit.coal} iron=${audit.iron} diamond=${audit.diamond} pick=T${audit.pickaxe} axe=T${audit.axe} sword=T${audit.sword}`);

    // Auto-promote phase based on what we already have (in case memory reset but inventory kept)
    const promoted = this.autoPromotePhase(phase, audit);
    if (promoted !== phase) {
      this.logger.info(`auto-promoted phase ${phase} -> ${promoted} based on inventory audit`);
      return promoted;
    }

    if (phase === 'wood')   return this.phaseWood(audit);
    if (phase === 'stone')  return this.phaseStone(audit);
    if (phase === 'iron')   return this.phaseIron(audit);
    if (phase === 'nether') return this.nether.progress();
    if (phase === 'end')    return this.stronghold.progress();
    return phase;
  }

  autoPromotePhase(phase, audit) {
    // If we already have iron gear -> jump to nether
    if (audit.pickaxe >= 3 && audit.iron >= 5) return 'nether';
    // If we have iron pickaxe -> iron phase or beyond
    if (audit.pickaxe >= 3 && phase === 'wood') return 'iron';
    if (audit.pickaxe >= 3 && phase === 'stone') return 'iron';
    // If we have stone pickaxe -> at least stone phase
    if (audit.pickaxe >= 2 && phase === 'wood') return 'stone';
    // If we have wooden pickaxe -> at least stone phase
    if (audit.pickaxe >= 1 && phase === 'wood') return 'stone';
    return phase;
  }

  async phaseWood(audit) {
    // Already have a pickaxe? Skip wood grind.
    if (audit.pickaxe >= 1) {
      this.logger.info('phaseWood: already have a pickaxe, skipping');
      return 'stone';
    }
    // Do we have enough planks/sticks already? Just craft what's missing.
    if (audit.planks >= 3 && audit.sticks >= 2 && audit.hasCraftingTable) {
      await this.crafting.craftTool('wooden_pickaxe');
      if (hasItem(this.bot, 'wooden_pickaxe')) return 'stone';
    }
    // If we already have logs, don't chop more
    if (audit.logs < 3 && audit.planks < 6) {
      const needed = Math.max(0, 4 - audit.logs);
      this.logger.info(`phaseWood: chopping ${needed} logs`);
      await this.mining.chopWood(needed);
    }
    await this.crafting.ensureCraftingTable();
    await this.crafting.craftPlanks(8);
    await this.crafting.craftSticks(4);
    await this.crafting.craftTool('wooden_pickaxe');
    await this.crafting.craftTool('wooden_axe');
    await this.crafting.craftTool('wooden_sword');
    return hasItem(this.bot, 'wooden_pickaxe') ? 'stone' : 'wood';
  }

  async phaseStone(audit) {
    // Already have stone pickaxe? Skip.
    if (audit.pickaxe >= 2) {
      this.logger.info('phaseStone: already have stone pickaxe or better');
      return 'iron';
    }
    // CRITICAL: if we don't have a wooden pickaxe, we can't mine stone.
    // Go back to wood phase instead of trying to hand-dig.
    if (audit.pickaxe < 1) {
      this.logger.warn('phaseStone: no pickaxe at all! going back to wood');
      return 'wood';
    }
    if (audit.cobble < 8) {
      const need = 12 - audit.cobble;
      this.logger.info(`phaseStone: mining ${need} cobble`);
      await this.mining.mineStone(need);
    }
    await this.crafting.craftFurnace();
    await this.crafting.craftTool('stone_pickaxe');
    await this.crafting.craftTool('stone_axe');
    await this.crafting.craftTool('stone_sword');
    if (!this.food.hasEnoughFood()) await this.food.gatherFood();
    return hasItem(this.bot, 'stone_pickaxe') ? 'iron' : 'stone';
  }

  async phaseIron(audit) {
    // Already have iron pickaxe? Skip.
    if (audit.pickaxe >= 3 && audit.hasShield && audit.hasBucket) {
      this.logger.info('phaseIron: already have iron kit');
      return 'nether';
    }
    // Need stone pickaxe minimum
    if (audit.pickaxe < 2) {
      this.logger.warn('phaseIron: no stone pickaxe, going back to stone');
      return 'stone';
    }
    if (audit.iron < 6) {
      const need = 8 - audit.iron;
      this.logger.info(`phaseIron: mining ${need} iron`);
      await this.mining.mineIron(need);
    }
    // Also grab coal along the way if we haven't
    if (audit.coal < 3) await this.mining.mineCoal(4);
    await this.crafting.craftTool('iron_pickaxe');
    await this.crafting.craftTool('iron_sword');
    await this.crafting.craftShield();
    await this.crafting.craftBucket();
    await this.crafting.craftArmor(['iron_helmet','iron_chestplate','iron_boots']);
    if (!this.food.hasEnoughFood()) await this.food.gatherFood();
    return hasItem(this.bot, 'iron_pickaxe') ? 'nether' : 'iron';
  }
}

module.exports = Progression;
