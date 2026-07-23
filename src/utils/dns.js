'use strict';

const dns = require('node:dns');
const { promises: dnsPromises } = require('node:dns');
const config = require('./config');
const logger = require('./logger');

function configureDns() {
  try {
    dns.setServers(config.dnsServers);
    logger.info(`DNS servers: ${config.dnsServers.join(', ')}`);
  } catch (e) {
    logger.warn('failed to set DNS servers:', e.message);
  }
}

async function preflightResolve(host) {
  try {
    const out = await dnsPromises.lookup(host);
    logger.info(`DNS resolved ${host} -> ${out.address}`);
    return out.address;
  } catch (e) {
    logger.warn(`DNS lookup failed for ${host}: ${e.message}`);
    return null;
  }
}

module.exports = { configureDns, preflightResolve };
