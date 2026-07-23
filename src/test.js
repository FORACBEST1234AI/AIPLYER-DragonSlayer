'use strict';

const fs = require('fs');
let pass = 0;
let fail = 0;
function ok(name) { console.log(`PASS ${name}`); pass += 1; }
function bad(name, e) { console.error(`FAIL ${name}: ${e.message || e}`); fail += 1; }

(async () => {
  const modules = [
    './utils/config','./utils/logger','./utils/helpers','./utils/dns',
    './utils/place_helper','./utils/swim_helper','./utils/tool_check',
    './memory/memory','./combat/combat','./survival/survival',
    './skills/anti_afk','./skills/item_recovery','./skills/shelter','./skills/mining','./skills/food','./skills/crafting',
    './skills/nether','./skills/stronghold','./skills/progression','./skills/skills_registry',
    './dragon/dragon_fight','./brain'
  ];
  for (const m of modules) {
    try { require(m); ok(`load ${m}`); } catch (e) { bad(`load ${m}`, e); }
  }

  try {
    const config = require('./utils/config');
    if (config.runCycleSeconds !== 21360) throw new Error(`runCycleSeconds=${config.runCycleSeconds}`);
    if (!config.dnsServers.includes('1.1.1.1')) throw new Error('dns missing 1.1.1.1');
    ok('config values');
  } catch (e) { bad('config values', e); }

  try {
    const Memory = require('./memory/memory');
    const m = new Memory();
    m.filepath = '/tmp/aiplyer-memory-test.json';
    await m.load();
    m.learn('x','y');
    m.recordTask('task');
    m.recordCheckpoint('cp',{x:1,y:2,z:3});
    m.reportSkill('fight', true);
    m.recordDeath({ position: { x: 1, y: 64, z: 2 }, inventorySnapshot: [{ name: 'diamond', count: 1 }], time: new Date().toISOString() });
    if (m.freshDrops().length < 1) throw new Error('drop missing');
    await m.save();
    fs.unlinkSync('/tmp/aiplyer-memory-test.json');
    ok('memory lifecycle');
  } catch (e) { bad('memory lifecycle', e); }

  try {
    const { configureDns, preflightResolve } = require('./utils/dns');
    configureDns();
    await preflightResolve('localhost');
    ok('dns helpers');
  } catch (e) { bad('dns helpers', e); }

  try {
    const skills = require('./skills/skills_registry');
    const list = skills.list();
    if (list.length < 70) throw new Error(`only ${list.length} skills`);
    ok(`skills registry count ${list.length}`);
  } catch (e) { bad('skills registry', e); }

  try {
    const ph = require('./utils/place_helper');
    for (const fn of ['safePlaceAt','safeDig','safePillarUp','safeJump','isForwardWalkable']) {
      if (typeof ph[fn] !== 'function') throw new Error(`${fn} missing`);
    }
    ok('place_helper exports');
  } catch (e) { bad('place_helper exports', e); }

  try {
    const sh = require('./utils/swim_helper');
    for (const fn of ['isInWater','isHeadUnderwater','swimUp','swimToLand','waterSurvive']) {
      if (typeof sh[fn] !== 'function') throw new Error(`${fn} missing`);
    }
    ok('swim_helper exports');
  } catch (e) { bad('swim_helper exports', e); }

  try {
    const tc = require('./utils/tool_check');
    for (const fn of ['canMine','toolFor','inventoryAudit','highestPickaxeTier','highestAxeTier','highestSwordTier']) {
      if (typeof tc[fn] !== 'function') throw new Error(`${fn} missing`);
    }
    // Sanity: canMine on a fake bot with no tools
    const fakeBot = { inventory: { items: () => [] } };
    if (tc.canMine(fakeBot, 'stone') !== false) throw new Error('canMine stone with no tools should be false');
    if (tc.canMine(fakeBot, 'dirt') !== true) throw new Error('canMine dirt with no tools should be true');
    if (tc.canMine(fakeBot, 'bedrock') !== false) throw new Error('canMine bedrock should be false');
    if (tc.toolFor('stone') !== 'pickaxe') throw new Error('toolFor stone should be pickaxe');
    if (tc.toolFor('dirt') !== 'shovel') throw new Error('toolFor dirt should be shovel');
    if (tc.toolFor('oak_log') !== 'axe') throw new Error('toolFor oak_log should be axe');
    ok('tool_check exports + logic');
  } catch (e) { bad('tool_check', e); }

  try {
    const mcData = require('minecraft-data')('1.21.1');
    for (const n of ['crafting_table','furnace','obsidian','end_portal_frame','bedrock','water','lava']) {
      if (!mcData.blocksByName[n]) throw new Error(`missing block ${n}`);
    }
    for (const n of ['iron_pickaxe','diamond_pickaxe','bucket','shield','ender_eye','flint_and_steel','coal','stick']) {
      if (!mcData.itemsByName[n]) throw new Error(`missing item ${n}`);
    }
    ok('mcData sanity');
  } catch (e) { bad('mcData sanity', e); }

  try {
    require('mineflayer-pathfinder');
    require('mineflayer-pvp');
    require('mineflayer-auto-eat');
    require('mineflayer-armor-manager');
    require('mineflayer-collectblock');
    require('mineflayer-tool');
    ok('plugin requires');
  } catch (e) { bad('plugin requires', e); }

  console.log(`RESULT ${pass} passed ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
