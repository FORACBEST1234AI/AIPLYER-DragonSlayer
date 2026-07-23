'use strict';

const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const autoEat = require('mineflayer-auto-eat').loader;
const armorManager = require('mineflayer-armor-manager');
const collectBlock = require('mineflayer-collectblock').plugin;
const toolPlugin = require('mineflayer-tool').plugin;

const config = require('./utils/config');
const logger = require('./utils/logger');
const Memory = require('./memory/memory');
const Brain = require('./brain');
const { configureDns, preflightResolve } = require('./utils/dns');

const RUN_CYCLE_MS = config.runCycleSeconds * 1000;
const START_TS = Date.now();
let reconnects = 0;
let bot = null;
let brain = null;
let memory = null;
let cycleTimer = null;
let reconnectTimer = null;

async function bootstrap() {
  configureDns();
  await preflightResolve(config.host);
  memory = new Memory();
  await memory.load();
  await createBot();
}

async function createBot() {
  logger.info('booting AIPLYER');
  memory.state.totalRuns += 1;
  memory.state.lastBootAt = new Date().toISOString();
  await memory.save();

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: 'offline',
    checkTimeoutInterval: 60_000,
    hideErrors: false,
    viewDistance: 'far',
    chatLengthLimit: 100
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.loadPlugin(autoEat);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(toolPlugin);

  bot.once('spawn', async () => {
    logger.info(`spawned at ${bot.entity.position.floored()}`);
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    movements.allowParkour = true;
    movements.allowSprinting = true;
    movements.canDig = true;
    movements.allowFreeMotion = true;
    movements.scafoldingBlocks = [
      mcData.blocksByName.dirt?.id,
      mcData.blocksByName.cobblestone?.id,
      mcData.blocksByName.netherrack?.id,
      mcData.blocksByName.cobbled_deepslate?.id
    ].filter(Boolean);
    bot.pathfinder.setMovements(movements);

    if (bot.autoEat?.setOpts) {
      bot.autoEat.setOpts({
        priority: 'foodPoints',
        startAt: 16,
        bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish']
      });
    }

    brain = new Brain(bot, memory, mcData, logger);
    await brain.start();

    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(async () => {
      logger.info('cycle complete, saving state and exiting');
      memory.state.lastExitReason = 'cycle_end';
      if (bot?.entity?.position) {
        memory.state.lastPosition = { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z };
      }
      await memory.save();
      try { await brain.stop(); } catch {}
      try { bot.quit('cycle_end'); } catch {}
      setTimeout(() => process.exit(0), 1200);
    }, RUN_CYCLE_MS);
  });

  bot.on('error', err => logger.error('bot error:', err.message || err));
  bot.on('kicked', reason => logger.warn('kicked:', String(reason).slice(0, 300)));
  bot.on('health', () => brain?.observeHealth?.());
  bot.on('death', async () => {
    logger.warn('bot died');
    memory.recordDeath({
      position: bot.entity?.position,
      cause: brain?.lastDamageCause || 'unknown',
      inventorySnapshot: bot.inventory.items().map(i => ({ name: i.name, count: i.count })),
      time: new Date().toISOString()
    });
    await memory.save();
    brain?.onDeath?.();
  });
  bot.on('end', async reason => {
    logger.warn('connection ended:', reason);
    await memory.save();
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (Date.now() - START_TS > RUN_CYCLE_MS - 20_000) {
    logger.info('near cycle end, not reconnecting');
    process.exit(0);
    return;
  }
  reconnects += 1;
  if (reconnects > config.maxReconnectsPerCycle) {
    logger.error('too many reconnects this cycle, exiting');
    process.exit(1);
    return;
  }
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await preflightResolve(config.host);
      await createBot();
    } catch (e) {
      logger.error('reconnect failed:', e.message);
      scheduleReconnect();
    }
  }, config.reconnectDelayMs);
}

process.on('SIGTERM', async () => {
  try { await memory?.save(); } catch {}
  process.exit(0);
});
process.on('uncaughtException', err => logger.error('uncaughtException:', err.message || err));
process.on('unhandledRejection', err => logger.error('unhandledRejection:', err?.message || err));

bootstrap().catch(err => {
  logger.error('fatal bootstrap error:', err.message || err);
  process.exit(1);
});
