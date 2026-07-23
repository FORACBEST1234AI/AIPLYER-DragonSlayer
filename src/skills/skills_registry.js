'use strict';

const { goals } = require('mineflayer-pathfinder');
const { sleep, findItem, hasItem, itemCount, equipBest, equipShield, nearestOf } = require('../utils/helpers');
const { Vec3 } = require('vec3');

const skills = {};

// movement
skills.walkTo = async (bot, { x, y, z, range = 1 }) => bot.pathfinder.goto(new goals.GoalNear(x, y, z, range));
skills.walkXZ = async (bot, { x, z }) => bot.pathfinder.goto(new goals.GoalXZ(x, z));
skills.followEntity = async (bot, { entity, range = 2 }) => bot.pathfinder.goto(new goals.GoalFollow(entity, range));
skills.stopPathing = async (bot) => bot.pathfinder.stop();
skills.jump = async (bot) => { bot.setControlState('jump', true); await sleep(200); bot.setControlState('jump', false); };
skills.sneak = async (bot, { ms = 400 }) => { bot.setControlState('sneak', true); await sleep(ms); bot.setControlState('sneak', false); };
skills.lookAround = async (bot) => { for (let i = 0; i < 4; i++) { await bot.look(bot.entity.yaw + Math.PI / 2, 0, false); await sleep(200); } };
skills.stepBack = async (bot, { ms = 300 }) => { bot.setControlState('back', true); await sleep(ms); bot.setControlState('back', false); };
skills.strafeLeft = async (bot, { ms = 250 }) => { bot.setControlState('left', true); await sleep(ms); bot.setControlState('left', false); };
skills.strafeRight = async (bot, { ms = 250 }) => { bot.setControlState('right', true); await sleep(ms); bot.setControlState('right', false); };
skills.sprintForward = async (bot, { ms = 800 }) => { bot.setControlState('sprint', true); bot.setControlState('forward', true); await sleep(ms); bot.clearControlStates(); };
skills.pillarUp = async (bot, { blocks = 3 }) => { const it = findItem(bot, ['cobblestone','dirt','stone','netherrack','cobbled_deepslate']); if (!it) return false; await bot.equip(it, 'hand'); for (let i=0;i<blocks;i++){ bot.setControlState('jump', true); await sleep(350); const ref = bot.blockAt(bot.entity.position.offset(0,-1,0)); if (ref) await bot.placeBlock(ref, new Vec3(0,1,0)).catch(()=>{}); bot.setControlState('jump', false);} return true; };
skills.bridgeForward = async (bot, { blocks = 3 }) => { const it = findItem(bot, ['cobblestone','dirt','stone','netherrack']); if (!it) return false; await bot.equip(it,'hand'); for (let i=0;i<blocks;i++){ const ref = bot.blockAt(bot.entity.position.offset(1,-1,0)); if (ref) await bot.placeBlock(ref, new Vec3(0,1,0)).catch(()=>{}); await sleep(250);} return true; };

// inventory / equip
skills.equipBestSword = async (bot) => equipBest(bot, 'sword');
skills.equipBestPickaxe = async (bot) => equipBest(bot, 'pickaxe');
skills.equipBestAxe = async (bot) => equipBest(bot, 'axe');
skills.equipBestShovel = async (bot) => equipBest(bot, 'shovel');
skills.equipShield = async (bot) => equipShield(bot);
skills.equipArmor = async (bot) => { try { bot.armorManager.equipAll(); return true; } catch { return false; } };
skills.countCobble = async (bot) => itemCount(bot, 'cobblestone');
skills.countFood = async (bot) => ['bread','steak','cooked_beef','cooked_porkchop','cooked_mutton','cooked_chicken','baked_potato','carrot','apple','sweet_berries'].reduce((s,n)=>s+itemCount(bot,n),0);
skills.dropTrash = async (bot) => { for (const n of ['rotten_flesh','gravel','dirt','string']) { const it = findItem(bot,[n]); if (it) try { await bot.tossStack(it); } catch {} } return true; };
skills.tossItemByName = async (bot,{name}) => { const it=findItem(bot,[name]); if(!it) return false; try{ await bot.tossStack(it); return true; }catch{ return false; } };

// combat
skills.attackNearestHostile = async (bot) => { const e = nearestOf(bot, x => ['zombie','skeleton','creeper','spider'].includes(x.name), 12); if (!e) return false; try { bot.pvp.attack(e); return true; } catch { return false; } };
skills.attackEntity = async (bot, { entity }) => { try { bot.pvp.attack(entity); return true; } catch { return false; } };
skills.stopCombat = async (bot) => { try { bot.pvp.stop(); return true; } catch { return false; } };
skills.raiseShield = async (bot,{ms=700}) => { if(!(await equipShield(bot))) return false; bot.activateItem(); await sleep(ms); bot.deactivateItem(); return true; };
skills.shootBowAt = async (bot,{entity}) => { const bow=findItem(bot,['bow']); if(!bow || !hasItem(bot,'arrow')) return false; await bot.equip(bow,'hand'); await bot.lookAt(entity.position.offset(0,entity.height*0.8,0),true); bot.activateItem(); await sleep(1200); bot.deactivateItem(); return true; };
skills.throwPearl = async (bot) => { const p=findItem(bot,['ender_pearl']); if(!p) return false; await bot.equip(p,'hand'); bot.activateItem(); await sleep(250); bot.deactivateItem(); return true; };
skills.swing = async (bot) => { bot.swingArm('right'); return true; };

// blocks
skills.placeSupportBlock = async (bot) => { const it=findItem(bot,['cobblestone','dirt','stone','netherrack']); if(!it) return false; await bot.equip(it,'hand'); const ref=bot.blockAt(bot.entity.position.offset(1,-1,0)); if(!ref) return false; try{ await bot.placeBlock(ref,new Vec3(0,1,0)); return true; }catch{ return false; } };
skills.placeTorch = async (bot) => { const it=findItem(bot,['torch']); if(!it) return false; await bot.equip(it,'hand'); const ref=bot.blockAt(bot.entity.position.offset(1,-1,0)); if(!ref) return false; try{ await bot.placeBlock(ref,new Vec3(0,1,0)); return true; }catch{ return false; } };
skills.digBlockAhead = async (bot) => { const b=bot.blockAt(bot.entity.position.offset(1,0,0)); if(!b?.diggable) return false; try{ await bot.dig(b); return true; }catch{ return false; } };
skills.digBlockBelow = async (bot) => { const b=bot.blockAt(bot.entity.position.offset(0,-1,0)); if(!b?.diggable) return false; try{ await bot.dig(b); return true; }catch{ return false; } };
skills.mineNearestStone = async (bot) => { const b=bot.findBlock({matching:x=>['stone','deepslate','cobbled_deepslate','andesite','diorite','granite'].includes(x.name),maxDistance:24}); if(!b) return false; try{ await bot.collectBlock.collect(b); return true; }catch{ return false; } };
skills.mineNearestIron = async (bot) => { const b=bot.findBlock({matching:x=>['iron_ore','deepslate_iron_ore'].includes(x.name),maxDistance:32}); if(!b) return false; try{ await bot.collectBlock.collect(b); return true; }catch{ return false; } };
skills.mineNearestDiamond = async (bot) => { const b=bot.findBlock({matching:x=>['diamond_ore','deepslate_diamond_ore'].includes(x.name),maxDistance:48}); if(!b) return false; try{ await bot.collectBlock.collect(b); return true; }catch{ return false; } };

// food / heal
skills.eat = async (bot) => { try { if (bot.autoEat?.eat) { await bot.autoEat.eat(); return true; } } catch {} return false; };
skills.eatGapple = async (bot) => { const g=findItem(bot,['enchanted_golden_apple','golden_apple']); if(!g) return false; await bot.equip(g,'hand'); bot.activateItem(); await sleep(1700); bot.deactivateItem(); return true; };
skills.drinkMilk = async (bot) => { const m=findItem(bot,['milk_bucket']); if(!m) return false; await bot.equip(m,'hand'); bot.activateItem(); await sleep(1700); bot.deactivateItem(); return true; };
skills.eatBread = async (bot) => { const f=findItem(bot,['bread']); if(!f) return false; await bot.equip(f,'hand'); bot.activateItem(); await sleep(1700); bot.deactivateItem(); return true; };

// world interaction
skills.openNearestChest = async (bot) => { const c=bot.findBlock({matching:b=>b.name==='chest'||b.name==='trapped_chest',maxDistance:12}); if(!c) return false; try{ const chest=await bot.openContainer(c); await chest.close(); return true; }catch{ return false; } };
skills.sleepNearestBed = async (bot) => { const b=bot.findBlock({matching:x=>x.name?.endsWith('_bed'),maxDistance:12}); if(!b) return false; try{ await bot.sleep(b); return true; }catch{ return false; } };
skills.wakeUp = async (bot) => { try { await bot.wake(); return true; } catch { return false; } };
skills.chat = async (bot,{text}) => { bot.chat(String(text).slice(0,100)); return true; };
skills.lookAtNearestPlayer = async (bot) => { const p=nearestOf(bot,e=>e.type==='player'&&e.username!==bot.username,20); if(!p) return false; await bot.lookAt(p.position.offset(0,1.6,0),true); return true; };
skills.lookAtNearestHostile = async (bot) => { const p=nearestOf(bot,e=>['zombie','skeleton','creeper','spider'].includes(e.name),20); if(!p) return false; await bot.lookAt(p.position.offset(0,1.2,0),true); return true; };

// farming / environment
skills.harvestCrop = async (bot) => { const c=bot.findBlock({matching:b=>['wheat','carrots','potatoes','beetroots'].includes(b.name),maxDistance:20}); if(!c) return false; try{ await bot.collectBlock.collect(c); return true; }catch{ return false; } };
skills.plantSeed = async (bot) => { const seed=findItem(bot,['wheat_seeds','carrot','potato','beetroot_seeds']); if(!seed) return false; const farm=bot.findBlock({matching:b=>b.name==='farmland',maxDistance:8}); if(!farm) return false; await bot.equip(seed,'hand'); try{ await bot.placeBlock(farm,new Vec3(0,1,0)); return true; }catch{ return false; } };
skills.collectWater = async (bot) => { const bucket=findItem(bot,['bucket']); const water=bot.findBlock({matching:b=>b.name==='water',maxDistance:8}); if(!bucket || !water) return false; await bot.equip(bucket,'hand'); try{ await bot.activateBlock(water); return true; }catch{ return false; } };
skills.waterClutch = async (bot) => { const wb=findItem(bot,['water_bucket']); if(!wb) return false; await bot.equip(wb,'hand'); await bot.lookAt(bot.entity.position.offset(0,-1,0),true); bot.activateItem(); return true; };
skills.lightPortal = async (bot) => { const fs=findItem(bot,['flint_and_steel']); if(!fs) return false; await bot.equip(fs,'hand'); const air=bot.blockAt(bot.entity.position.offset(1,0,0)); if(!air) return false; try{ await bot.activateBlock(air); return true; }catch{ return false; } };

// reports
skills.reportHealth = async (bot) => ({ health: bot.health, food: bot.food, oxygen: bot.oxygenLevel });
skills.reportPosition = async (bot) => bot.entity.position.floored();
skills.reportInventory = async (bot) => bot.inventory.items().map(i => ({ name: i.name, count: i.count }));
skills.reportDimension = async (bot) => bot.game?.dimension || 'unknown';
skills.reportXP = async (bot) => bot.experience?.level || 0;

// misc utility
skills.rememberHome = async (bot, { memory }) => { memory.state.homeBase = { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z }; return true; };
skills.rememberCheckpoint = async (bot, { memory, name = 'checkpoint' }) => { memory.recordCheckpoint(name, { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z }); return true; };
skills.clearControls = async (bot) => { bot.clearControlStates(); return true; };
skills.quitGracefully = async (bot) => { try { bot.quit('skill_request'); return true; } catch { return false; } };
skills.idleWave = async (bot) => { bot.swingArm('right'); await sleep(150); bot.swingArm('right'); return true; };
skills.turn180 = async (bot) => { await bot.look(bot.entity.yaw + Math.PI, 0, false); return true; };

module.exports = skills;
module.exports.list = () => Object.keys(skills).filter(k => k !== 'list');
