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
  classAbilities,
  getAbilitiesForClass,
  isActionValidForClass,
} = require('./data/classes');

const { routeOptions, stageTemplates } = require('./data/gameData');
const { getSavedProfile, initializeProfile } = require('./server/profileStore');

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

// function getSavedProfile(name) {
//   const key = name.toLowerCase();
//   if (!savedPlayers[key]) {
//     savedPlayers[key] = {
//       name,
//       className: 'Warrior',
//       level: 1,
//       xp: 0,
//       currency: 100,
//       inventory: [],
//       equipment: { weapon: null, armor: null },
//       stats: { ...classDefinitions.Warrior },
//       maxHp: classDefinitions.Warrior.hp,
//       currentHp: classDefinitions.Warrior.hp,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//     };
//   }
//   return savedPlayers[key];
// }

// function initializeProfile(name, className) {
//   const profile = getSavedProfile(name);
//   profile.className = className;
//   const base = classDefinitions[className] || classDefinitions.Warrior;
//   profile.stats = { ...base };
//   profile.maxHp = base.hp;
//   profile.currentHp = Math.min(profile.currentHp || base.hp, profile.maxHp);
//   profile.updatedAt = new Date().toISOString();
//   savePlayersToDisk();
//   return profile;
// }

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createRoomState(room) {
  return {
    id: room.id,
    hostName: room.hostName,
    gameState: room.gameState,
    currentStage: room.currentStage,
    currentRoute: room.currentRoute,
    routeOptions: room.routeOptions,
    votes: room.votes,
    currentEnemy: room.currentEnemy,
    battleLog: room.battleLog.slice(-8),
    users: room.users.map(user => ({
      name: user.name,
      role: user.role,
      selectedClass: user.selectedClass,
      alive: user.alive,
      currentHp: user.profile.currentHp,
      maxHp: user.profile.maxHp,
      className: user.profile.className,
      level: user.profile.level,
      currency: user.profile.currency,
      inventory: user.profile.inventory,
      equipment: user.profile.equipment,
      cooldowns: user.cooldowns,
    })),
  };
}

function broadcastRoomState(room) {
  io.to(room.id).emit('room-state', createRoomState(room));
}

function createEnemyForStage(stageIndex, routeId) {
  const template = stageTemplates[Math.min(stageIndex, stageTemplates.length - 1)];
  const multiplier = 1 + stageIndex * 0.2;
  return {
    id: `${routeId}-${stageIndex}`,
    name: `${template.name} of the ${routeId}`,
    maxHp: Math.round(template.hp * multiplier),
    currentHp: Math.round(template.hp * multiplier),
    attack: Math.round(template.attack * multiplier),
    speed: template.speed,
    routeId,
  };
}

function getRouteResult(room) {
  const voteCounts = {};
  room.users.forEach(user => {
    if (room.votes[user.name]) {
      voteCounts[room.votes[user.name]] = (voteCounts[room.votes[user.name]] || 0) + 1;
    }
  });

  const sortedRoutes = Object.entries(voteCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  if (sortedRoutes.length === 0) {
    return routeOptions[0].id;
  }

  if (sortedRoutes.length === 1 || voteCounts[sortedRoutes[0]] > voteCounts[sortedRoutes[1]]) {
    return sortedRoutes[0];
  }

  const hostVote = room.votes[room.hostName];
  if (hostVote && sortedRoutes.includes(hostVote)) {
    return hostVote;
  }

  return sortedRoutes[0];
}

function startStage(room, routeId) {
  room.currentRoute = routeId;
  room.gameState = 'combat';
  room.currentStage += 1;
  room.currentEnemy = createEnemyForStage(room.currentStage, routeId);
  room.votes = {};
  room.routeOptions = routeOptions;
  room.battleLog.push(`The party moves into the ${routeId}.`);
  room.nextEnemyAction = Date.now() + 5000;
  room.users.forEach(user => {
    user.cooldowns = user.cooldowns || {};
  });
  broadcastRoomState(room);
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
    const reward = Math.round(50 + room.currentStage * 20);
    room.users.forEach(ally => {
      if (ally.alive) {
        ally.profile.currency += reward;
      }
    });
    room.gameState = 'voting';
    room.currentEnemy = null;
    room.votes = {};
    room.routeOptions = routeOptions;
    room.battleLog.push(`The party earns ${reward} coins and chooses the next path.`);
  }

  socket.emit('action-success', {
    message: 'Action processed successfully.',
    actionType,
    enemyHp: enemy.currentHp,
    gameState: room.gameState,
  });

  updateSavedProfiles(room);
  broadcastRoomState(room);
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

  updateSavedProfiles(room);
  broadcastRoomState(room);
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
    currentEnemy: null,
    routeOptions: routeOptions,
    votes: {},
    battleLog: ['Party assembled in the lobby.'],
    users: [],
  };

  rooms.set(id, room);
  res.cookie('partyRoomUser', name, { maxAge: 60000, path: '/' });
  res.redirect(`/room/${id}`);
});

app.post('/join-room', (req, res) => {
  const roomId = req.body.roomId?.trim().toUpperCase();
  const name = req.body.name?.trim();

  if (!roomId || !name) {
    return res.status(400).send('Name and room code are required to join.');
  }

  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).send('Party room not found.');
  }

  res.redirect(`/room/${roomId}?name=${encodeURIComponent(name)}`);
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

    broadcastRoomState(room);
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
    broadcastRoomState(room);
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
    });

    room.gameState = 'voting';
    room.currentStage = 0;
    room.currentEnemy = null;
    room.votes = {};
    room.routeOptions = routeOptions;
    room.battleLog.push('The adventure begins. Pick a route.');
    broadcastRoomState(room);
  });

  socket.on('vote-route', ({ roomId, routeId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState !== 'voting') {
      return;
    }

    const user = room.users.find(u => u.socketId === socket.id);
    if (!user || !routeOptions.some(route => route.id === routeId)) {
      return;
    }

    room.votes[user.name] = routeId;
    broadcastRoomState(room);

    const livePlayers = room.users.filter(u => u.alive).length;
    const voteCount = Object.keys(room.votes).length;
    if (voteCount >= livePlayers) {
      const chosenRoute = getRouteResult(room);
      room.battleLog.push(`Route chosen: ${chosenRoute}.`);
      startStage(room, chosenRoute);
    }
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
    broadcastRoomState(room);
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
