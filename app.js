const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.urlencoded({ extended: true }));

const rooms = new Map();

const {
  classDefinitions,
  isActionValidForClass,
} = require('./data/classes');

const {
  createRoomState,
  broadcastRoomState,
  getRouteResult,
  startStage,
  startRestPhase,
  getNextRouteOptions,
  isRouteOptionValid,
  getEnemyReward,
} = require('./server/gameLogic');
const { routeOptions } = require('./data/gameData');
const { getSavedProfile, initializeProfile, savePlayersToDisk } = require('./server/profileStore');
const { itemDefinitions } = require('./data/items');
const { shopOffers, getShopOffer } = require('./data/shop');

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function addItemToInventory(profile, itemId, quantity = 1) {
  if (!profile.inventory) {
    profile.inventory = [];
  }
  const available = Math.max(0, 24 - profile.inventory.length);
  if (available === 0) {
    return false;
  }
  for (let i = 0; i < quantity && profile.inventory.length < 24; i += 1) {
    profile.inventory.push(itemId);
  }
  return true;
}

function removeItemFromInventory(profile, itemId) {
  if (!profile.inventory) {
    return false;
  }
  const index = profile.inventory.indexOf(itemId);
  if (index === -1) {
    return false;
  }
  profile.inventory.splice(index, 1);
  return true;
}

function applyProfilePerks(profile) {
  profile.unlockedPerks = Array.isArray(profile.unlockedPerks) ? profile.unlockedPerks : [];
  if (profile.unlockedPerks.includes('extra_ability_slot')) {
    profile.abilitySlots = Math.max(5, profile.abilitySlots || 4);
  } else {
    profile.abilitySlots = profile.abilitySlots || 4;
  }
  if (profile.unlockedPerks.includes('starting_potion')) {
    addItemToInventory(profile, 'health_potion', 1);
  }
}

function claimRunLoot(room) {
  if (!room.runLoot || room.runLoot.length === 0) {
    return;
  }
  const lootToKeep = room.runLoot.slice(0, 3);
  room.users.forEach(user => {
    if (!user.alive) return;
    lootToKeep.forEach(itemId => {
      addItemToInventory(user.profile, itemId, 1);
    });
  });
  room.battleLog.push(`Players claimed ${lootToKeep.length} items from the successful run.`);
  room.runLoot = [];
}

function rollPlayerAction(room, user, actionType, socket) {
  const enemy = room.currentEnemy;
  if (!enemy || enemy.currentHp <= 0) {
    socket.emit('action-error', { message: 'No active enemy to attack.' });
    return;
  }
  const profile = user.profile;
  const base = profile.stats;
  const now = Date.now();
  user.cooldowns = user.cooldowns || {};
  const nextReady = user.cooldowns[actionType] || 0;
  if (now < nextReady) {
    socket.emit('action-error', { message: `Ability is on cooldown for ${Math.ceil((nextReady - now) / 1000)}s.` });
    return;
  }

  if (!isActionValidForClass(profile.className, actionType)) {
    socket.emit('action-error', { message: 'That action is not available to your class.' });
    return;
  }

  switch (actionType) {
    case 'slash': {
      const damage = Math.max(1, base.str + Math.round(base.dex * 0.5) - Math.round(enemy.attack * 0.1));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} slashes ${enemy.name} for ${damage} damage.`);
      user.cooldowns.slash = now + 5000;
      break;
    }
    case 'guard': {
      user.guardUntil = now + 9000;
      room.battleLog.push(`${user.name} braces for the next attack.`);
      user.cooldowns.guard = now + 12000;
      break;
    }
    case 'charge': {
      const damage = Math.max(1, base.str + Math.round(base.dex * 0.7));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      enemy.speed = Math.max(2, enemy.speed - 1);
      room.battleLog.push(`${user.name} charges ${enemy.name} for ${damage} damage.`);
      user.cooldowns.charge = now + 9000;
      break;
    }
    case 'fireball': {
      const damage = Math.max(1, base.int * 2 - Math.round(enemy.def * 0.2));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} hurls a fireball at ${enemy.name} for ${damage} damage.`);
      user.cooldowns.fireball = now + 7000;
      break;
    }
    case 'arcane_shield': {
      user.shield = Math.max(8, Math.round(base.int * 1.2));
      room.battleLog.push(`${user.name} forms an arcane shield.`);
      user.cooldowns.arcane_shield = now + 12000;
      break;
    }
    case 'frost_nova': {
      enemy.speed = Math.max(2, enemy.speed - 3);
      room.battleLog.push(`${user.name} freezes ${enemy.name}, slowing it down.`);
      user.cooldowns.frost_nova = now + 11000;
      break;
    }
    case 'backstab': {
      const damage = Math.max(1, base.str + Math.round(base.dex * 0.8));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} backstabs ${enemy.name} for ${damage} damage.`);
      user.cooldowns.backstab = now + 6000;
      break;
    }
    case 'smoke_bomb': {
      enemy.attack = Math.max(1, enemy.attack - 3);
      room.battleLog.push(`${user.name} throws a smoke bomb, reducing enemy attack.`);
      user.cooldowns.smoke_bomb = now + 12000;
      break;
    }
    case 'evasion': {
      user.evadeUntil = now + 9000;
      room.battleLog.push(`${user.name} prepares to evade the next strike.`);
      user.cooldowns.evasion = now + 12000;
      break;
    }
    case 'piercing_shot': {
      const damage = Math.max(1, base.dex + Math.round(base.str * 0.6));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} fires a piercing shot for ${damage} damage.`);
      user.cooldowns.piercing_shot = now + 7000;
      break;
    }
    case 'set_trap': {
      enemy.speed = Math.max(2, enemy.speed - 2);
      room.battleLog.push(`${user.name} sets a trap, slowing the enemy.`);
      user.cooldowns.set_trap = now + 12000;
      break;
    }
    case 'hail_of_arrows': {
      const damage = Math.max(1, base.dex + base.str - Math.round(enemy.def * 0.2));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} rains arrows on ${enemy.name} for ${damage} damage.`);
      user.cooldowns.hail_of_arrows = now + 9000;
      break;
    }
    case 'heal': {
      const aliveAllies = room.users.filter(u => u.alive);
      const target = aliveAllies.sort((a, b) => a.profile.currentHp - b.profile.currentHp)[0] || user;
      const healAmount = Math.max(10, base.int + Math.round(base.dex * 0.5));
      target.profile.currentHp = Math.min(target.profile.maxHp, target.profile.currentHp + healAmount);
      room.battleLog.push(`${user.name} heals ${target.name} for ${healAmount}.`);
      user.cooldowns.heal = now + 9000;
      break;
    }
    case 'bless': {
      room.users.forEach(ally => {
        if (ally.alive) {
          ally.blessedUntil = now + 10000;
        }
      });
      room.battleLog.push(`${user.name} blesses the party.`);
      user.cooldowns.bless = now + 12000;
      break;
    }
    case 'purify': {
      user.profile.currentHp = Math.min(user.profile.maxHp, user.profile.currentHp + Math.max(6, Math.round(base.int * 0.4)));
      room.battleLog.push(`${user.name} purifies their wounds.`);
      user.cooldowns.purify = now + 10000;
      break;
    }
    case 'smite': {
      const damage = Math.max(1, base.str + Math.round(base.int * 0.4));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} smites ${enemy.name} for ${damage} damage.`);
      user.cooldowns.smite = now + 8000;
      break;
    }
    case 'shield_wall': {
      room.users.forEach(ally => {
        if (ally.alive) {
          ally.shield = Math.max(6, Math.round(base.def * 0.8));
        }
      });
      room.battleLog.push(`${user.name} raises a shield wall for the party.`);
      user.cooldowns.shield_wall = now + 14000;
      break;
    }
    case 'lay_on_hands': {
      const target = room.users.find(u => u.alive && u.profile.currentHp < u.profile.maxHp) || user;
      const healAmount = Math.max(18, Math.round(base.int * 1.2));
      target.profile.currentHp = Math.min(target.profile.maxHp, target.profile.currentHp + healAmount);
      room.battleLog.push(`${user.name} lays hands on ${target.name} for ${healAmount} health.`);
      user.cooldowns.lay_on_hands = now + 15000;
      break;
    }
    case 'dark_slash': {
      const damage = Math.max(1, base.str + Math.round(base.int * 0.3));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      user.profile.currentHp = Math.min(user.profile.maxHp, user.profile.currentHp + Math.round(damage * 0.3));
      room.battleLog.push(`${user.name} strikes with dark energy for ${damage} damage and heals.`);
      user.cooldowns.dark_slash = now + 8000;
      break;
    }
    case 'blood_pact': {
      const sacrifice = Math.max(5, Math.round(user.profile.maxHp * 0.08));
      user.profile.currentHp = Math.max(1, user.profile.currentHp - sacrifice);
      const damage = Math.max(1, base.str + sacrifice);
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} makes a blood pact for ${damage} damage.`);
      user.cooldowns.blood_pact = now + 13000;
      break;
    }
    case 'shadow_veil': {
      user.shadowVeilUntil = now + 10000;
      room.battleLog.push(`${user.name} cloaks themselves in shadow.`);
      user.cooldowns.shadow_veil = now + 14000;
      break;
    }
    case 'bone_spear': {
      const damage = Math.max(1, base.int * 1.5 - Math.round(enemy.def * 0.2));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} fires a bone spear for ${damage} damage.`);
      user.cooldowns.bone_spear = now + 7000;
      break;
    }
    case 'raise_minion': {
      user.hasMinion = true;
      room.battleLog.push(`${user.name} raises a minion to aid the fight.`);
      user.cooldowns.raise_minion = now + 15000;
      break;
    }
    case 'soul_drain': {
      const damage = Math.max(1, base.int + Math.round(base.str * 0.4));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      user.profile.currentHp = Math.min(user.profile.maxHp, user.profile.currentHp + Math.round(damage * 0.4));
      room.battleLog.push(`${user.name} drains soul energy for ${damage} damage.`);
      user.cooldowns.soul_drain = now + 12000;
      break;
    }
    case 'thornlash': {
      const damage = Math.max(1, base.int + Math.round(base.dex * 0.5));
      enemy.currentHp = Math.max(0, enemy.currentHp - damage);
      room.battleLog.push(`${user.name} lashes ${enemy.name} with thorny vines for ${damage} damage.`);
      user.cooldowns.thornlash = now + 7000;
      break;
    }
    case 'wild_growth': {
      room.users.forEach(ally => {
        if (ally.alive) {
          ally.profile.currentHp = Math.min(ally.profile.maxHp, ally.profile.currentHp + Math.max(6, Math.round(base.int * 0.4)));
        }
      });
      room.battleLog.push(`${user.name} calls wild growth to heal the party.`);
      user.cooldowns.wild_growth = now + 14000;
      break;
    }
    case 'natures_grasp': {
      enemy.speed = Math.max(2, enemy.speed - 3);
      room.battleLog.push(`${user.name} binds ${enemy.name} with nature's grasp.`);
      user.cooldowns.natures_grasp = now + 11000;
      break;
    }
    default:
      return;
  }

  if (enemy.currentHp <= 0) {
    room.battleLog.push(`${enemy.name} has been defeated!`);
    const reward = getEnemyReward(room.currentStage, room.currentPath);
    room.users.forEach(ally => {
      if (ally.alive) {
        ally.profile.currency += reward;
      }
    });

    if (Math.random() < 0.35) {
      const itemIds = Object.keys(itemDefinitions);
      const droppedId = itemIds[Math.floor(Math.random() * itemIds.length)];
      room.runLoot = room.runLoot || [];
      room.runLoot.push(droppedId);
      room.battleLog.push(`Found item: ${itemDefinitions[droppedId].label}.`);
    }

    if (room.currentStage >= 10) {
      room.gameState = 'victory';
      room.currentEnemy = null;
      room.routeOptions = [];
      claimRunLoot(room);
      room.battleLog.push('The party has finished the run successfully! Keep all currency and up to three items.');
    } else {
      const nextOptions = getNextRouteOptions(room);
      room.currentEnemy = null;
      room.votes = {};
      if (nextOptions.length > 0) {
        room.gameState = 'voting';
        room.routeOptions = nextOptions;
        room.battleLog.push(`The party earns ${reward} coins and chooses the next path.`);
      } else {
        room.gameState = 'rest';
        room.routeOptions = [];
        room.battleLog.push(`The party earns ${reward} coins and takes a moment to rest before the next stage.`);
      }
    }
  }

  socket.emit('action-success', {
    message: 'Action processed successfully.',
    actionType,
    enemyHp: enemy.currentHp,
    gameState: room.gameState,
  });

  updateSavedProfiles(room);
  broadcastRoomState(io, room);
}

function applyRunFailure(room) {
  const startCurrency = room.runStartCurrency || {};
  room.users.forEach(user => {
    const initial = Number.isFinite(startCurrency[user.name]) ? startCurrency[user.name] : 0;
    const earned = Math.max(0, user.profile.currency - initial);
    user.profile.currency = initial + Math.round(earned * 0.5);
  });
}

function updateSavedProfiles(room) {
  room.users.forEach(user => {
    const profile = getSavedProfile(user.name);
    profile.className = user.profile.className;
    profile.level = user.profile.level;
    profile.xp = user.profile.xp;
    profile.currency = user.profile.currency;
    profile.inventory = user.profile.inventory;
    profile.equipment = user.profile.equipment;
    profile.stats = user.profile.stats;
    profile.maxHp = user.profile.maxHp;
    profile.currentHp = user.profile.currentHp;
    profile.abilitySlots = user.profile.abilitySlots;
    profile.unlockedPerks = user.profile.unlockedPerks;
    profile.updatedAt = new Date().toISOString();
  });
  savePlayersToDisk();
}

function processEnemyAttack(room) {
  const enemy = room.currentEnemy;
  const alivePlayers = room.users.filter(user => user.alive);
  if (!enemy || enemy.currentHp <= 0 || alivePlayers.length === 0) {
    return;
  }

  const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  const damage = Math.max(1, enemy.attack - Math.round(target.profile.stats.def * 0.4));
  target.profile.currentHp = Math.max(0, target.profile.currentHp - damage);
  room.battleLog.push(`${enemy.name} strikes ${target.name} for ${damage}.`);
  if (target.profile.currentHp <= 0) {
    target.alive = false;
    room.battleLog.push(`${target.name} has fallen.`);
  }

  const remainingPlayers = room.users.filter(user => user.alive);
  if (remainingPlayers.length === 0) {
    room.gameState = 'run_failed';
    room.currentEnemy = null;
    room.routeOptions = [];
    room.battleLog.push('The party has been wiped out. The run ends and half of the earned currency is retained.');
    applyRunFailure(room);
  }

  updateSavedProfiles(room);
  broadcastRoomState(io, room);
}

setInterval(() => {
  const now = Date.now();
  rooms.forEach(room => {
    if (room.gameState !== 'combat' || !room.currentEnemy) {
      return;
    }
    if (!room.nextEnemyAction || now >= room.nextEnemyAction) {
      room.nextEnemyAction = now + 5000;
      processEnemyAttack(room);
    }
  });
}, 1000);

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/create-room', (req, res) => {
  const name = req.body.name?.trim();
  if (!name) {
    return res.status(400).send('Name is required to create a room.');
  }

  let id = createRoomId();
  while (rooms.has(id)) {
    id = createRoomId();
  }

  const room = {
    id,
    name: `Party Room ${id}`,
    createdAt: new Date(),
    creatorName: name,
    hostName: name,
    hostId: null,
    gameState: 'lobby',
    currentStage: 0,
    currentRoute: null,
    currentPath: 'normal',
    currentEnemy: null,
    routeOptions: routeOptions,
    votes: {},
    battleLog: ['Party assembled in the lobby.'],
    users: [],
    runStartCurrency: {},
    runLoot: [],
    shopOffers: shopOffers,
  };

  rooms.set(id, room);
  res.cookie('partyRoomUser', name, { maxAge: 60000, path: '/' });
  res.redirect(`/room/${id}`);
});

app.get('/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (!room) {
    return res.status(404).send('Party room not found.');
  }

  const protocol = req.protocol;
  const host = req.get('host');
  room.url = `${protocol}://${host}/room/${room.id}`;
  res.render('room', { room });
});

io.on('connection', socket => {
  socket.on('enter-room', ({ roomId, userName }) => {
    const room = rooms.get(roomId);
    if (!room || !userName) {
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userName = userName;

    room.hostName = room.hostName || room.creatorName || userName;
    room.hostId = room.hostId || socket.id;

    room.users = room.users || [];
    let user = room.users.find(u => u.name === userName);
    if (user) {
      user.socketId = socket.id;
      user.alive = user.alive !== false;
    } else {
      const isHost = !room.hostId || room.hostId === socket.id;
      user = {
        socketId: socket.id,
        name: userName,
        role: isHost ? 'Host' : 'Guest',
        selectedClass: null,
        profile: getSavedProfile(userName),
        cooldowns: {},
        alive: true,
      };
      room.users.push(user);
    }

    if (!room.hostName) {
      room.hostName = userName;
    }

    if (!room.hostId || room.hostName === userName) {
      room.hostId = socket.id;
      user.role = 'Host';
    }

    broadcastRoomState(io, room);
  });

  socket.on('select-class', ({ roomId, className }) => {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    const user = room.users.find(u => u.socketId === socket.id);
    if (!user || !classDefinitions[className]) {
      return;
    }

    user.selectedClass = className;
    user.profile = initializeProfile(user.name, className);
    broadcastRoomState(io, room);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || socket.id !== room.hostId) {
      return;
    }

    const unpicked = room.users.filter(user => !user.selectedClass);
    if (unpicked.length > 0) {
      room.battleLog.push('Host started the game, even though some players have not picked a class.');
    }

    room.users.forEach(user => {
      if (!user.selectedClass) {
        user.selectedClass = 'Warrior';
        user.profile = initializeProfile(user.name, 'Warrior');
      }
      user.cooldowns = {};
      user.alive = true;
      applyProfilePerks(user.profile);
    });

    room.gameState = 'voting';
    room.currentStage = 0;
    room.currentRoute = null;
    room.currentPath = 'normal';
    room.currentEnemy = null;
    room.votes = {};
    room.routeOptions = routeOptions;
    room.runStartCurrency = room.users.reduce((map, user) => {
      map[user.name] = user.profile.currency || 0;
      return map;
    }, {});
    room.runLoot = [];
    room.battleLog.push('The adventure begins. Pick a route.');
    broadcastRoomState(io, room);
  });

  socket.on('vote-route', ({ roomId, routeId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'voting') {
      return;
    }

    const user = room.users.find(u => u.socketId === socket.id);
    if (!user || !isRouteOptionValid(room, routeId)) {
      return;
    }

    room.votes[user.name] = routeId;
    broadcastRoomState(io, room);

    const livePlayers = room.users.filter(u => u.alive).length;
    const voteCount = Object.keys(room.votes).length;
    if (voteCount >= livePlayers) {
      const chosenRoute = getRouteResult(room);
      room.battleLog.push(`Route chosen: ${chosenRoute}.`);
      startStage(io, room, chosenRoute);
    }
  });

  socket.on('continue-run', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'rest') {
      return;
    }

    if (room.routeOptions && room.routeOptions.length > 0) {
      return;
    }

    if (room.currentStage >= 10) {
      room.gameState = 'victory';
      room.battleLog.push('The party has finished the run successfully.');
      broadcastRoomState(io, room);
      return;
    }

    startStage(io, room);
  });

  socket.on('open-shop', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !['lobby', 'victory', 'run_failed'].includes(room.gameState)) {
      return;
    }
    room.gameState = 'shop';
    room.shopOffers = shopOffers;
    room.battleLog.push('The shop is now open for the party.');
    broadcastRoomState(io, room);
  });

  socket.on('close-shop', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'shop') {
      return;
    }
    room.gameState = 'lobby';
    room.battleLog.push('The shop has closed.');
    broadcastRoomState(io, room);
  });

  socket.on('buy-shop-item', ({ roomId, offerId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'shop') {
      socket.emit('shop-error', { message: 'Shop is not currently open.' });
      return;
    }

    const user = room.users.find(u => u.socketId === socket.id);
    if (!user) {
      socket.emit('shop-error', { message: 'Player not found.' });
      return;
    }

    const offer = getShopOffer(offerId);
    if (!offer) {
      socket.emit('shop-error', { message: 'Offer not found.' });
      return;
    }

    if (user.profile.currency < offer.cost) {
      socket.emit('shop-error', { message: 'Not enough currency to buy that item.' });
      return;
    }

    if (offer.type === 'item') {
      const success = addItemToInventory(user.profile, offer.itemId, offer.quantity);
      if (!success) {
        socket.emit('shop-error', { message: 'Inventory is full.' });
        return;
      }
    }

    if (offer.type === 'perk') {
      user.profile.unlockedPerks = user.profile.unlockedPerks || [];
      if (user.profile.unlockedPerks.includes(offer.perkId)) {
        socket.emit('shop-error', { message: 'You already own this perk.' });
        return;
      }
      user.profile.unlockedPerks.push(offer.perkId);
    }

    user.profile.currency -= offer.cost;
    if (offer.type === 'perk') {
      applyProfilePerks(user.profile);
    }
    room.battleLog.push(`${user.name} purchased ${offer.label} from the shop.`);
    socket.emit('shop-success', { message: `Purchased ${offer.label}.` });
    updateSavedProfiles(room);
    broadcastRoomState(io, room);
  });

  socket.on('use-item', ({ roomId, itemId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'combat') {
      socket.emit('action-error', { message: 'You can only use items during combat.' });
      return;
    }
    const user = room.users.find(u => u.socketId === socket.id);
    if (!user || !user.alive) {
      socket.emit('action-error', { message: 'Player not found or not able to act.' });
      return;
    }
    const item = itemDefinitions[itemId];
    if (!item) {
      socket.emit('action-error', { message: 'Item not found.' });
      return;
    }
    if (!removeItemFromInventory(user.profile, itemId)) {
      socket.emit('action-error', { message: 'Item not available in inventory.' });
      return;
    }
    user.cooldowns = user.cooldowns || {};
    const effect = item.effect || {};
    const now = Date.now();

    if (effect.type === 'heal') {
      user.profile.currentHp = Math.min(user.profile.currentHp + effect.amount, user.profile.maxHp);
      room.battleLog.push(`${user.name} used a ${item.label} and recovered ${effect.amount} HP.`);
    } else if (effect.type === 'cooldown_reduction') {
      Object.keys(user.cooldowns).forEach(action => {
        if (user.cooldowns[action] > now) {
          user.cooldowns[action] = now + Math.max(0, Math.round((user.cooldowns[action] - now) * (1 - effect.amount)));
        }
      });
      room.battleLog.push(`${user.name} used a ${item.label} and reduced cooldowns.`);
    } else if (effect.type === 'enemy_attack_down' && room.currentEnemy) {
      room.currentEnemy.attack = Math.max(1, Math.round(room.currentEnemy.attack * (1 - effect.amount)));
      room.battleLog.push(`${user.name} used a ${item.label} to weaken ${room.currentEnemy.name}.`);
    } else {
      room.battleLog.push(`${user.name} used ${item.label}.`);
    }

    updateSavedProfiles(room);
    broadcastRoomState(io, room);
    socket.emit('action-success', { message: 'Item used successfully.' });
  });

  socket.on('player-action', ({ roomId, actionType }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('action-error', { message: 'Room not found.' });
      return;
    }
    if (room.gameState !== 'combat') {
      socket.emit('action-error', { message: 'You can only act during combat.' });
      return;
    }

    const user = room.users.find(u => u.socketId === socket.id);
    if (!user) {
      socket.emit('action-error', { message: 'Player not found in room.' });
      return;
    }
    if (!user.alive) {
      socket.emit('action-error', { message: 'You are down and cannot act.' });
      return;
    }

    user.cooldowns = user.cooldowns || {};
    const nextReady = user.cooldowns[actionType] || 0;
    if (Date.now() < nextReady) {
      socket.emit('action-error', { message: `Ability is on cooldown for ${Math.ceil((nextReady - Date.now()) / 1000)}s.` });
      return;
    }

    if (!isActionValidForClass(user.profile.className, actionType)) {
      socket.emit('action-error', { message: 'That action is not available to your class.' });
      return;
    }

    try {
      rollPlayerAction(room, user, actionType, socket);
    } catch (error) {
      console.error('Error processing player-action:', error);
      socket.emit('action-error', { message: 'Server error while processing action.' });
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const userName = socket.data.userName;
    if (!roomId || !userName) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room || !room.users) {
      return;
    }

    const userIndex = room.users.findIndex(u => u.socketId === socket.id);
    if (userIndex !== -1) {
      const [removed] = room.users.splice(userIndex, 1);
      if (room.hostId === removed.socketId) {
        const nextUser = room.users[0];
        if (nextUser) {
          room.hostId = nextUser.socketId;
          room.hostName = nextUser.name;
          nextUser.role = 'Host';
          room.battleLog.push(`${nextUser.name} is now the party host.`);
        } else {
          room.hostId = null;
          room.hostName = null;
        }
      }
    }

    updateSavedProfiles(room);
    broadcastRoomState(io, room);
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
