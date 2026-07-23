'use strict';

const fs = require('fs').promises;
const path = require('path');
const config = require('../utils/config');

const DEFAULT_STATE = {
  version: 2,
  createdAt: null,
  totalRuns: 0,
  totalDeaths: 0,
  totalDragonKills: 0,
  lastBootAt: null,
  lastExitReason: null,
  lastPosition: null,
  homeBase: null,
  netherPortal: null,
  strongholdPortal: null,
  currentPhase: 'wood',
  deaths: [],
  itemDrops: [],
  learnedFacts: [],
  skillStats: {},
  checkpoints: [],
  goalsCompleted: [],
  previousTasks: []
};

class Memory {
  constructor() {
    this.filepath = config.memoryPath;
    this.state = { ...DEFAULT_STATE };
  }

  async load() {
    try {
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      const raw = await fs.readFile(this.filepath, 'utf8');
      this.state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      this.state = { ...DEFAULT_STATE, createdAt: new Date().toISOString() };
      await this.save();
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.filepath), { recursive: true });
    await fs.writeFile(this.filepath, JSON.stringify(this.state, null, 2));
  }

  learn(tag, note) {
    const existing = this.state.learnedFacts.find(x => x.tag === tag);
    if (existing) {
      existing.note = note;
      existing.weight = (existing.weight || 1) + 1;
    } else {
      this.state.learnedFacts.unshift({ tag, note, weight: 1, at: new Date().toISOString() });
    }
    this.state.learnedFacts = this.state.learnedFacts.slice(0, 150);
  }

  recordTask(name) {
    this.state.previousTasks.unshift({ name, at: new Date().toISOString() });
    this.state.previousTasks = this.state.previousTasks.slice(0, 100);
  }

  recordCheckpoint(name, pos) {
    this.state.checkpoints.unshift({ name, pos, at: new Date().toISOString() });
    this.state.checkpoints = this.state.checkpoints.slice(0, 50);
  }

  reportSkill(name, success) {
    const cur = this.state.skillStats[name] || { success: 0, fail: 0 };
    if (success) cur.success += 1; else cur.fail += 1;
    this.state.skillStats[name] = cur;
  }

  skillScore(name) {
    const cur = this.state.skillStats[name] || { success: 0, fail: 0 };
    const total = cur.success + cur.fail;
    return total === 0 ? 0.5 : cur.success / total;
  }

  recordDeath(info) {
    this.state.totalDeaths += 1;
    this.state.deaths.unshift(info);
    this.state.deaths = this.state.deaths.slice(0, 30);
    if (info.position && Array.isArray(info.inventorySnapshot) && info.inventorySnapshot.length) {
      this.state.itemDrops.unshift({
        pos: { x: Math.floor(info.position.x), y: Math.floor(info.position.y), z: Math.floor(info.position.z) },
        items: info.inventorySnapshot,
        expiresAt: Date.now() + 5 * 60 * 1000,
        at: info.time || new Date().toISOString()
      });
      this.state.itemDrops = this.state.itemDrops.slice(0, 12);
    }
  }

  freshDrops() {
    const now = Date.now();
    return this.state.itemDrops.filter(x => x.expiresAt > now);
  }

  removeDrop(drop) {
    this.state.itemDrops = this.state.itemDrops.filter(x => x !== drop);
  }
}

module.exports = Memory;
