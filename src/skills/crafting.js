'use strict';

const { findItem, hasItem, itemCount, sleep } = require('../utils/helpers');
const { Vec3 } = require('vec3');
const { safePlaceAt } = require('../utils/place_helper');

class Crafting {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  // ---- INVENTORY-AWARE HELPERS ----

  totalPlanks() {
    return ['oak_planks','spruce_planks','birch_planks','jungle_planks','acacia_planks','dark_oak_planks','mangrove_planks','cherry_planks']
      .reduce((s, n) => s + itemCount(this.bot, n), 0);
  }

  totalLogs() {
    return ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log']
      .reduce((s, n) => s + itemCount(this.bot, n), 0);
  }

  hasAnyPlank() { return this.totalPlanks() > 0; }
  hasAnyLog() { return this.totalLogs() > 0; }

  // ---- CRAFTING TABLE ----

  async ensureCraftingTable() {
    if (hasItem(this.bot, 'crafting_table')) return true;
    // Try to find one nearby first
    const found = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 12 });
    if (found) return true;

    // Need planks to craft
    if (this.totalPlanks() < 4) {
      if (this.hasAnyLog()) await this.craftPlanks(4);
      else {
        this.logger.warn('ensureCraftingTable: no planks and no logs');
        return false;
      }
    }
    const id = this.mcData.itemsByName.crafting_table.id;
    const recipe = this.bot.recipesFor(id, null, 1, null)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, 1, null); return true; }
    catch (e) { this.logger.warn(`ensureCraftingTable: ${e.message}`); return false; }
  }

  async placeTable() {
    let table = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 12 });
    if (table) return table;
    const okEnsure = await this.ensureCraftingTable();
    if (!okEnsure) return null;
    const it = findItem(this.bot, ['crafting_table']);
    if (!it) return null;

    const base = this.bot.entity.position.floored();
    const spots = [
      base.offset(1, 0, 0), base.offset(-1, 0, 0),
      base.offset(0, 0, 1), base.offset(0, 0, -1),
      base.offset(2, 0, 0), base.offset(0, 0, 2),
      base.offset(-2, 0, 0), base.offset(0, 0, -2),
    ];
    for (const spot of spots) {
      const placed = await safePlaceAt(this.bot, it, spot);
      if (placed) {
        const tb = this.bot.findBlock({ matching: this.mcData.blocksByName.crafting_table.id, maxDistance: 5 });
        if (tb) return tb;
      }
    }
    this.logger.warn('placeTable: could not place anywhere');
    return null;
  }

  // ---- PRIMARY CRAFTS ----

  async craftPlanks(minCount = 4) {
    if (this.totalPlanks() >= minCount) return true;
    const logNames = ['oak_log','spruce_log','birch_log','jungle_log','acacia_log','dark_oak_log','mangrove_log','cherry_log'];
    for (const log of logNames) {
      if (!hasItem(this.bot, log)) continue;
      const plank = log.replace('_log', '_planks');
      const id = this.mcData.itemsByName[plank]?.id;
      if (!id) continue;
      const recipe = this.bot.recipesFor(id, null, 1, null)[0];
      if (!recipe) continue;
      const need = Math.max(1, Math.ceil((minCount - this.totalPlanks()) / 4));
      try { await this.bot.craft(recipe, need, null); }
      catch (e) { this.logger.warn(`craftPlanks ${log}: ${e.message}`); }
      if (this.totalPlanks() >= minCount) return true;
    }
    return this.totalPlanks() >= minCount;
  }

  async craftSticks(minCount = 4) {
    if (itemCount(this.bot, 'stick') >= minCount) return true;
    if (this.totalPlanks() < 2) await this.craftPlanks(4);
    const id = this.mcData.itemsByName.stick.id;
    const recipe = this.bot.recipesFor(id, null, 1, null)[0];
    if (!recipe) return false;
    const need = Math.max(1, Math.ceil((minCount - itemCount(this.bot, 'stick')) / 4));
    try { await this.bot.craft(recipe, need, null); }
    catch (e) { this.logger.warn(`craftSticks: ${e.message}`); }
    return itemCount(this.bot, 'stick') >= minCount;
  }

  async craftTool(name) {
    if (hasItem(this.bot, name)) return true;
    const table = await this.placeTable();
    const id = this.mcData.itemsByName[name]?.id;
    if (!id) return false;

    // Pre-flight: sticks + material
    if (/_(pickaxe|axe|sword|shovel|hoe)$/.test(name)) {
      await this.craftSticks(2);
      if (name.startsWith('wooden_')) await this.craftPlanks(3);
    }

    const recipe = this.bot.recipesFor(id, null, 1, table)[0];
    if (!recipe) {
      this.logger.warn(`craftTool ${name}: no recipe (missing materials?)`);
      return false;
    }
    try { await this.bot.craft(recipe, 1, table); return hasItem(this.bot, name); }
    catch (e) { this.logger.warn(`craftTool ${name}: ${e.message}`); return false; }
  }

  async craftFurnace() {
    if (hasItem(this.bot, 'furnace')) return true;
    const table = await this.placeTable();
    if (itemCount(this.bot, 'cobblestone') < 8) {
      this.logger.warn('craftFurnace: need 8 cobble');
      return false;
    }
    const id = this.mcData.itemsByName.furnace.id;
    const recipe = this.bot.recipesFor(id, null, 1, table)[0];
    if (!recipe) return false;
    try { await this.bot.craft(recipe, 1, table); return true; } catch { return false; }
  }

  async craftShield() {
    if (hasItem(this.bot, 'shield')) return true;
    await this.craftPlanks(6);
    return this.craftTool('shield');
  }

  async craftBucket() {
    if (hasItem(this.bot, 'bucket') || hasItem(this.bot, 'water_bucket')) return true;
    if (itemCount(this.bot, 'iron_ingot') < 3) {
      this.logger.warn('craftBucket: need 3 iron ingots');
      return false;
    }
    return this.craftTool('bucket');
  }

  async craftArmor(list) {
    const table = await this.placeTable();
    for (const name of list) {
      if (hasItem(this.bot, name)) continue;
      const id = this.mcData.itemsByName[name]?.id;
      const recipe = id ? this.bot.recipesFor(id, null, 1, table)[0] : null;
      if (!recipe) continue;
      try { await this.bot.craft(recipe, 1, table); } catch (e) { this.logger.warn(`craftArmor ${name}: ${e.message}`); }
    }
    try { this.bot.armorManager.equipAll(); } catch {}
    return true;
  }

  // ---- SMELTING (fixed and working) ----

  async placeFurnace() {
    let furnace = this.bot.findBlock({ matching: this.mcData.blocksByName.furnace.id, maxDistance: 10 });
    if (furnace) return furnace;
    if (!hasItem(this.bot, 'furnace')) {
      const ok = await this.craftFurnace();
      if (!ok) return null;
    }
    const it = findItem(this.bot, ['furnace']);
    if (!it) return null;
    const base = this.bot.entity.position.floored();
    const spots = [base.offset(1,0,0), base.offset(-1,0,0), base.offset(0,0,1), base.offset(0,0,-1)];
    for (const spot of spots) {
      const placed = await safePlaceAt(this.bot, it, spot);
      if (placed) {
        furnace = this.bot.findBlock({ matching: this.mcData.blocksByName.furnace.id, maxDistance: 5 });
        if (furnace) return furnace;
      }
    }
    return null;
  }

  async smelt(rawName, outputName, count = 4) {
    const raw = findItem(this.bot, [rawName]);
    if (!raw) return false;
    const furnaceBlock = await this.placeFurnace();
    if (!furnaceBlock) return false;
    const fuel = findItem(this.bot, ['coal','charcoal','oak_planks','spruce_planks','birch_planks','oak_log']);
    if (!fuel) { this.logger.warn(`smelt ${rawName}: no fuel`); return false; }
    try {
      const furnace = await this.bot.openFurnace(furnaceBlock);
      await furnace.putFuel(fuel.type, null, Math.min(fuel.count, Math.ceil(count / 4)));
      await furnace.putInput(raw.type, null, Math.min(raw.count, count));
      let waited = 0;
      while (waited < 60 && !furnace.outputItem()) {
        await sleep(500);
        waited++;
      }
      try { await furnace.takeOutput(); } catch {}
      await furnace.close();
      this.logger.info(`smelted ${rawName} -> ${outputName}`);
      return true;
    } catch (e) {
      this.logger.warn(`smelt ${rawName}: ${e.message}`);
      return false;
    }
  }
}

module.exports = Crafting;
