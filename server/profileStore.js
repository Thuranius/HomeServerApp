const fs = require('fs');
const path = require('path');
const { classDefinitions } = require('../data/classes');

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
      equipment: { weapon: null, armor: null },
      stats: { ...classDefinitions.Warrior },
      maxHp: classDefinitions.Warrior.hp,
      currentHp: classDefinitions.Warrior.hp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return savedPlayers[key];
}

function initializeProfile(name, className) {
  const profile = getSavedProfile(name);
  profile.className = className;
  const base = classDefinitions[className] || classDefinitions.Warrior;
  profile.stats = { ...base };
  profile.maxHp = base.hp;
  profile.currentHp = Math.min(profile.currentHp || base.hp, profile.maxHp);
  profile.updatedAt = new Date().toISOString();
  savePlayersToDisk();
  return profile;
}

module.exports = {
  getSavedProfile,
  initializeProfile,
  savePlayersToDisk,
};
