'use strict';

const { sleep, findItem, nearestOf } = require('../utils/helpers');
const { Vec3 } = require('vec3');
const { safePlaceAt, isSolid } = require('../utils/place_helper');

class Shelter {
  constructor(bot, memory, mcData, logger) {
    this.bot = bot;
    this.memory = memory;
    this.mcData = mcData;
    this.logger = logger;
  }

  isNight() {
    const t = this.bot.time?.timeOfDay;
    return typeof t === 'number' && t > 12500 && t < 23500;
  }

  hasRoof() {
    for (let dy = 1; dy <= 4; dy++) {
      const b = this.bot.blockAt(this.bot.entity.position.offset(0, dy, 0));
      if (b && b.name !== 'air' && b.boundingBox === 'block') return true;
    }
    return false;
  }

  hostileNearby() {
    return !!nearestOf(this.bot, e => ['zombie','skeleton','creeper','spider','witch','enderman','phantom'].includes(e.name), 16);
  }

  needsShelter() {
    if (!this.bot.entity) return false;
    if (this.bot.game?.dimension === 'the_nether' || this.bot.game?.dimension === 'the_end') return false;
    return this.isNight() && (!this.hasRoof() || this.hostileNearby());
  }

  async buildOrEnterShelter() {
    // Try existing bed
    const bed = this.bot.findBlock({ matching: b => b.name?.endsWith('_bed'), maxDistance: 14 });
    if (bed) {
      try { await this.bot.sleep(bed); return true; } catch {}
    }
    // Place own bed
    const bedItem = (this.bot.inventory.items() || []).find(i => i.name.endsWith('_bed'));
    if (bedItem) {
      const ok = await this.placeBedAndSleep(bedItem);
      if (ok) return true;
    }
    return this.makeSimpleBox();
  }

  async placeBedAndSleep(item) {
    try {
      const targetPos = this.bot.entity.position.floored().offset(1, 0, 0);
      const placed = await safePlaceAt(this.bot, item, targetPos);
      if (!placed) return false;
      await sleep(400);
      const bed = this.bot.findBlock({ matching: b => b.name?.endsWith('_bed'), maxDistance: 3 });
      if (bed) {
        await this.bot.sleep(bed);
        return true;
      }
    } catch {}
    return false;
  }

  async makeSimpleBox() {
    const block = findItem(this.bot, ['cobblestone','dirt','stone','oak_planks','spruce_planks','birch_planks','cobbled_deepslate','netherrack']);
    if (!block) return false;
    try {
      const base = this.bot.entity.position.floored();
      // Place 4 walls around at foot level
      const wallPositions = [
        base.offset(1, 0, 0),
        base.offset(-1, 0, 0),
        base.offset(0, 0, 1),
        base.offset(0, 0, -1),
      ];
      for (const p of wallPositions) {
        await safePlaceAt(this.bot, block, p);
      }
      // Second wall row
      const wallPositions2 = wallPositions.map(p => p.offset(0, 1, 0));
      for (const p of wallPositions2) {
        await safePlaceAt(this.bot, block, p);
      }
      // Ceiling
      await safePlaceAt(this.bot, block, base.offset(0, 2, 0));
      this.memory.state.homeBase = { x: base.x, y: base.y, z: base.z };
      this.memory.learn('night_shelter', 'built emergency shelter');
      return true;
    } catch (e) {
      this.logger.warn('shelter failed:', e.message);
      return false;
    }
  }
}

module.exports = Shelter;
