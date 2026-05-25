const fs = require('fs');
const path = require('path');
const { classDefinitions } = require('../data/classes');
const { getDefaultEquipmentSlots } = require('../data/items');

const SAVE_FILE = path.join(__dirname, '..', 'savedPlayers.json');
let savedPlayers = loadSavedPlayers();

function loadSavedPlayers() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const raw = fs.readFileSync(SAVE_FILE, 'utf8');
      return raw ? JSON.parse(raw) : {};
    }
  } catch (error) {
    console.error('Error loading saved players:', error);
  }
  return {};
}

function savePlayersToDisk() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(savedPlayers, null, 2));
  } catch (error) {
    console.error('Error saving players:', error);
  }
}

function normalizeProfile(profile) {
  profile.inventory = Array.isArray(profile.inventory) ? profile.inventory.slice(0, 24) : [];
  profile.equipment = profile.equipment && typeof profile.equipment === 'object'
    ? profile.equipment
    : getDefaultEquipmentSlots();
  profile.equipment.consumables = Array.isArray(profile.equipment.consumables)
    ? profile.equipment.consumables.slice(0, 3)
    : [null, null, null];
  profile.currency = Number.isFinite(profile.currency) ? profile.currency : 100;
  profile.level = Number.isFinite(profile.level) ? profile.level : 1;
  profile.xp = Number.isFinite(profile.xp) ? profile.xp : 0;
  profile.abilitySlots = Number.isFinite(profile.abilitySlots) ? profile.abilitySlots : 4;
  profile.unlockedPerks = Array.isArray(profile.unlockedPerks) ? profile.unlockedPerks : [];
  profile.createdAt = profile.createdAt || new Date().toISOString();
  profile.updatedAt = profile.updatedAt || new Date().toISOString();
  profile.className = profile.className || 'Warrior';
  const base = classDefinitions[profile.className] || classDefinitions.Warrior;
  profile.stats = profile.stats && typeof profile.stats === 'object'
    ? profile.stats
    : { ...base };
  profile.maxHp = Number.isFinite(profile.maxHp) ? profile.maxHp : base.hp;
  profile.currentHp = Number.isFinite(profile.currentHp)
    ? Math.min(profile.currentHp, profile.maxHp)
    : profile.maxHp;
  return profile;
}

function getSavedProfile(name) {
  const key = name.toLowerCase();
  if (!savedPlayers[key]) {
    savedPlayers[key] = {
      name,
      className: 'Warrior',
      level: 1,
      xp: 0,
      currency: 100,
      inventory: [],
      equipment: getDefaultEquipmentSlots(),
      stats: { ...classDefinitions.Warrior },
      maxHp: classDefinitions.Warrior.hp,
      currentHp: classDefinitions.Warrior.hp,
      abilitySlots: 4,
      unlockedPerks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  savedPlayers[key] = normalizeProfile(savedPlayers[key]);
  return savedPlayers[key];
}

function initializeProfile(name, className) {
  const profile = getSavedProfile(name);
  profile.className = className;
  const base = classDefinitions[className] || classDefinitions.Warrior;
  profile.stats = { ...base };
  profile.maxHp = base.hp;
  profile.currentHp = Math.min(profile.currentHp || base.hp, profile.maxHp);
  profile.equipment = getDefaultEquipmentSlots();
  profile.inventory = profile.inventory.slice(0, 24);
  profile.abilitySlots = 4;
  profile.unlockedPerks = Array.isArray(profile.unlockedPerks) ? profile.unlockedPerks : [];
  profile.updatedAt = new Date().toISOString();
  savePlayersToDisk();
  return profile;
}

module.exports = {
  getSavedProfile,
  initializeProfile,
  savePlayersToDisk,
};
