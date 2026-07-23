'use strict';

module.exports = {
  host: process.env.MC_SERVER_HOST || 'AITEST12.aternos.me',
  port: parseInt(process.env.MC_SERVER_PORT || '15820', 10),
  username: process.env.MC_USERNAME || 'AIPLYER',
  version: process.env.MC_VERSION || '1.21.1',
  runCycleSeconds: parseInt(process.env.RUN_CYCLE_SECONDS || '21360', 10),
  memoryPath: process.env.MEMORY_PATH || 'data/memory.json',
  dnsServers: (process.env.DNS_SERVERS || '1.1.1.1,1.0.0.1,8.8.8.8,8.8.4.4').split(',').map(s => s.trim()).filter(Boolean),
  reconnectDelayMs: parseInt(process.env.RECONNECT_DELAY_MS || '15000', 10),
  maxReconnectsPerCycle: parseInt(process.env.MAX_RECONNECTS_PER_CYCLE || '50', 10)
};
