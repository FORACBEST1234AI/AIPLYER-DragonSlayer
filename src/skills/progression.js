'use strict';

const { hasItem, itemCount } = require('../utils/helpers');
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

  async advance(phase) {
    if (phase === 'wood') return this.phaseWood();
    if (phase === 'stone') return this.phaseStone();
    if (phase === 'iron') return this.phaseIron();
    if (phase === 'nether') return this.nether.progress();
    if (phase === 'end') return this.stronghold.progress();
    return phase;
  }

  async phaseWood() {
    const logs = ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log'].reduce((s,n)=>s+itemCount(this.bot,n),0);
    if (logs < 12) {
      await this.mining.chopWood(12 - logs);
      return 'wood';
    }
    await this.crafting.ensureCraftingTable();
    await this.crafting.craftPlanks(16);
    await this.crafting.craftSticks(8);
    await this.crafting.craftTool('wooden_pickaxe');
    await this.crafting.craftTool('wooden_axe');
    await this.crafting.craftTool('wooden_sword');
    return hasItem(this.bot, 'wooden_pickaxe') ? 'stone' : 'wood';
  }

  async phaseStone() {
    if (itemCount(this.bot, 'cobblestone') < 20) {
      await this.mining.mineStone(20);
      return 'stone';
    }
    await this.crafting.craftFurnace();
    await this.crafting.craftTool('stone_pickaxe');
    await this.crafting.craftTool('stone_axe');
    await this.crafting.craftTool('stone_sword');
    if (!this.food.hasEnoughFood()) await this.food.gatherFood();
    return hasItem(this.bot, 'stone_pickaxe') ? 'iron' : 'stone';
  }

  async phaseIron() {
    const iron = itemCount(this.bot, 'raw_iron') + itemCount(this.bot, 'iron_ingot');
    if (iron < 10) {
      await this.mining.mineIron(10 - iron);
      return 'iron';
    }
    await this.crafting.craftTool('iron_pickaxe');
    await this.crafting.craftTool('iron_sword');
    await this.crafting.craftShield();
    await this.crafting.craftBucket();
    await this.crafting.craftArmor(['iron_helmet','iron_chestplate','iron_boots']);
    return hasItem(this.bot, 'iron_pickaxe') ? 'nether' : 'iron';
  }
}

module.exports = Progression;
