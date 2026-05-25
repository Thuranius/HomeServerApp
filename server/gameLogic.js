const { routeOptions, routeThemes, branchStages, branchDefinitions } = require('../data/gameData');

function createRoomState(room) {
  const state = {
    id: room.id,
    hostName: room.hostName,
    gameState: room.gameState,
    currentStage: room.currentStage,
    currentRoute: room.currentRoute,
    currentPath: room.currentPath,
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
      abilitySlots: user.profile.abilitySlots,
      unlockedPerks: user.profile.unlockedPerks,
      cooldowns: user.cooldowns,
    })),
  };

  if (room.gameState === 'shop') {
    state.shopOffers = room.shopOffers || [];
  }

  return state;
}

function broadcastRoomState(io, room) {
  io.to(room.id).emit('room-state', createRoomState(room));
}

function parseRouteChoice(routeChoiceId) {
  if (!routeChoiceId) {
    return { routeId: null, branchTag: null };
  }

  const parts = routeChoiceId.split('-');
  const routeId = parts[0];
  const branchTag = parts.length > 1 ? parts[1] : null;

  if (!routeThemes[routeId]) {
    return { routeId: null, branchTag: null };
  }

  if (branchTag && !branchDefinitions[branchTag]) {
    return { routeId: null, branchTag: null };
  }

  return { routeId, branchTag };
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

function getBranchOptionsForRoute(routeId) {
  if (!routeThemes[routeId]) {
    return [];
  }

  return Object.values(branchDefinitions).map(branch => ({
    id: `${routeId}-${branch.suffix}`,
    label: branch.label,
    description: branch.description,
  }));
}

function getNextRouteOptions(room) {
  if (room.currentStage === 0) {
    return routeOptions;
  }

  if (branchStages.includes(room.currentStage)) {
    return getBranchOptionsForRoute(room.currentRoute);
  }

  return [];
}

function isRouteOptionValid(room, routeId) {
  const available = getNextRouteOptions(room);
  return available.some(route => route.id === routeId);
}

function getPartyPerkModifiers(room) {
  const perkSet = new Set((room.users || []).flatMap(user => user.profile.unlockedPerks || []));
  return {
    enemyDifficultyModifier: perkSet.has('battle_tactician') ? 0.9 : 1,
  };
}

function getEnemyTemplate(routeId, stageIndex) {
  const route = routeThemes[routeId] || routeThemes.forest;
  if (stageIndex === 10) {
    return route.boss;
  }
  if (branchStages.includes(stageIndex)) {
    return route.miniBoss[stageIndex % route.miniBoss.length];
  }

  const normalChoices = route.normal;
  return normalChoices[(stageIndex - 1) % normalChoices.length];
}

function createEnemyForStage(stageIndex, routeId, pathTag = 'normal', room = null) {
  const template = getEnemyTemplate(routeId, stageIndex);
  const branch = branchDefinitions[pathTag] || { difficultyModifier: 1 };
  const multiplier = Math.max(0.8, 1 + stageIndex * 0.14) * branch.difficultyModifier;
  const partyModifiers = getPartyPerkModifiers(room);
  const effectiveMultiplier = Math.max(0.8, multiplier * partyModifiers.enemyDifficultyModifier);

  const baseDefense = template.def || Math.max(1, Math.round(template.attack * 0.35));
  return {
    id: `${routeId}-${pathTag}-${stageIndex}`,
    name: `${template.name} (${routeId}${pathTag !== 'normal' ? ` - ${pathTag}` : ''})`,
    maxHp: Math.round(template.hp * effectiveMultiplier),
    currentHp: Math.round(template.hp * effectiveMultiplier),
    attack: Math.max(1, Math.round(template.attack * effectiveMultiplier)),
    def: Math.max(1, Math.round(baseDefense * effectiveMultiplier)),
    speed: template.speed,
    routeId,
    pathTag,
  };
}

function getEnemyReward(stageIndex, pathTag = 'normal') {
  const baseReward = 50 + stageIndex * 15;
  const branch = branchDefinitions[pathTag] || { rewardModifier: 1 };
  return Math.round(baseReward * branch.rewardModifier);
}

function startStage(io, room, routeChoiceId) {
  const { routeId, branchTag } = parseRouteChoice(routeChoiceId || room.currentRoute);
  if (!routeId) {
    return false;
  }

  room.currentRoute = routeId;
  room.currentPath = branchTag || room.currentPath || 'normal';
  room.gameState = 'combat';
  room.currentStage += 1;
  room.currentEnemy = createEnemyForStage(room.currentStage, routeId, room.currentPath, room);
  room.votes = {};
  room.routeOptions = [];
  room.battleLog.push(`The party advances into stage ${room.currentStage} of the ${routeThemes[routeId].label}.`);
  room.nextEnemyAction = Date.now() + 5000;
  room.users.forEach(user => {
    user.cooldowns = user.cooldowns || {};
  });
  broadcastRoomState(io, room);
  return true;
}

function startRestPhase(io, room) {
  room.gameState = 'rest';
  room.currentEnemy = null;
  room.routeOptions = getNextRouteOptions(room);
  room.battleLog.push('The party takes a short rest before the next stage.');
  broadcastRoomState(io, room);
}

module.exports = {
  createRoomState,
  broadcastRoomState,
  getRouteResult,
  startStage,
  startRestPhase,
  getNextRouteOptions,
  isRouteOptionValid,
  getEnemyReward,
};
