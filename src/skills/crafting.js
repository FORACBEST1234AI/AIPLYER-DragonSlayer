'use strict';

const { findItem, hasItem, itemCount } = require('../utils/helpers');
const { Vec3 } = require('vec3');
const { safePlaceAt } = require('../utils/place_helper');

class Crafting {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  async ensureCraftingTable() {
    if (hasItem(this.bot, 'crafting_table')) return true;
    await this.craftPlanks(4);
    const id = this.mcData.itemsByName.crafting_table.id;
    const recipe = this.bot.recipesFor(id, null, 1, null)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, 1, null); return true; } catch { return false; }
  }

  async placeTable() {
    let table = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 8 });
    if (table) return table;
    const item = findItem(this.bot, ['crafting_table']);
    if (!item) await this.ensureCraftingTable();
    const it = findItem(this.bot, ['crafting_table']);
    if (!it) return null;
    // Try nearby positions using safePlaceAt
    const base = this.bot.entity.position.floored();
    const spots = [
      base.offset(1, 0, 0), base.offset(-1, 0, 0),
      base.offset(0, 0, 1), base.offset(0, 0, -1),
      base.offset(2, 0, 0), base.offset(0, 0, 2),
    ];
    for (const spot of spots) {
      const placed = await safePlaceAt(this.bot, it, spot);
      if (placed) {
        const tb = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 4 });
        if (tb) return tb;
      }
    }
    return null;
  }

  async craftPlanks(minCount = 4) {
    const current = ['oak_planks','spruce_planks','birch_planks','jungle_planks','acacia_planks','dark_oak_planks','mangrove_planks','cherry_planks'].reduce((s,n)=>s+itemCount(this.bot,n),0);
    if (current >= minCount) return true;
    const logNames = ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log'];
    for (const log of logNames) {
      if (!hasItem(this.bot, log)) continue;
      const plank = log.replace('_log', '_planks');
      const id = this.mcData.itemsByName[plank]?.id;
      const recipe = id ? this.bot.recipesFor(id, null, 1, null)[0] : null;
      if (!recipe) continue;
      try { await this.bot.craft(recipe, Math.ceil(minCount / 4), null); return true; } catch {}
    }
    return false;
  }

  async craftSticks(minCount = 4) {
    if (itemCount(this.bot, 'stick') >= minCount) return true;
    await this.craftPlanks(4);
    const id = this.mcData.itemsByName.stick.id;
    const recipe = this.bot.recipesFor(id, null, 1, null)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, Math.ceil(minCount / 4), null); return true; } catch { return false; }
  }

  async craftTool(name) {
    if (hasItem(this.bot, name)) return true;
    const table = await this.placeTable();
    const id = this.mcData.itemsByName[name]?.id;
    if (!id) return false;
    const recipe = this.bot.recipesFor(id, null, 1, table)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, 1, table); return true; } catch (e) { this.logger.warn(`craft ${name}: ${e.message}`); return false; }
  }

  async craftFurnace() {
    if (hasItem(this.bot, 'furnace')) return true;
    const table = await this.placeTable();
    const id = this.mcData.itemsByName.furnace.id;
    const recipe = this.bot.recipesFor(id, null, 1, table)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, 1, table); return true; } catch { return false; }
  }

  async craftShield() { return this.craftTool('shield'); }
  async craftBucket() { return this.craftTool('bucket'); }

  async craftArmor(list) {
    const table = await this.placeTable();
    for (const name of list) {
      if (hasItem(this.bot, name)) continue;
      const id = this.mcData.itemsByName[name]?.id;
      const recipe = id ? this.bot.recipesFor(id, null, 1, table)[0] : null;
      if (!recipe) continue;
      try { await this.bot.craft(recipe, 1, table); } catch {}
    }
    try { this.bot.armorManager.equipAll(); } catch {}
    return true;
  }

  async smeltAll() { return false; }
}

module.exports = Crafting;
