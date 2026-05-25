const list = document.getElementById('playerList');
const namePrompt = document.getElementById('namePrompt');
const namePromptForm = document.getElementById('namePromptForm');
const promptNameInput = document.getElementById('promptName');
const roomId = window.ROOM_ID;
let socket;
let storedName = window.localStorage.getItem('partyRoomUser');

function getCookieValue(name) {
  return document.cookie.split('; ').reduce((value, cookie) => {
    const [cookieName, cookieValue] = cookie.split('=');
    return cookieName === name ? decodeURIComponent(cookieValue) : value;
  }, '');
}

if (!storedName) {
  const cookieName = getCookieValue('partyRoomUser');
  if (cookieName) {
    storedName = cookieName;
    window.localStorage.setItem('partyRoomUser', cookieName);
    document.cookie = 'partyRoomUser=; Max-Age=0; path=/';
  }
}

let userName = storedName;
if (userName && namePrompt) {
  namePrompt.classList.add('hidden');
}

const lobbyPanel = document.getElementById('lobbyPanel');
const votePanel = document.getElementById('votePanel');
const restPanel = document.getElementById('restPanel');
const resultPanel = document.getElementById('resultPanel');
const shopPanel = document.getElementById('shopPanel');
const combatPanel = document.getElementById('combatPanel');
const classOptions = document.getElementById('classOptions');
const startGameButton = document.getElementById('startGameButton');
const openShopButton = document.getElementById('openShopButton');
const closeShopButton = document.getElementById('closeShopButton');
const lobbyNotice = document.getElementById('lobbyNotice');
const routeOptions = document.getElementById('routeOptions');
const restRouteOptions = document.getElementById('restRouteOptions');
const shopOffersContainer = document.getElementById('shopOffers');
const shopStatus = document.getElementById('shopStatus');
const voteStatus = document.getElementById('voteStatus');
const restStatus = document.getElementById('restStatus');
const continueButton = document.getElementById('continueButton');
const enemyCard = document.getElementById('enemyCard');
const combatDetails = document.getElementById('combatDetails');
const playerStatusPanel = document.getElementById('playerStatusPanel');
const actionGrid = document.getElementById('actionGrid');
const inventoryList = document.getElementById('inventoryList');
const restInventoryList = document.getElementById('restInventoryList');
const battleLog = document.getElementById('battleLog');
const restBattleLog = document.getElementById('restBattleLog');
const resultTitle = document.getElementById('resultTitle');
const resultSummary = document.getElementById('resultSummary');
const resultLog = document.getElementById('resultLog');
let latestRoomState;
let combatRefreshInterval;

const classes = [
  'Warrior',
  'Mage',
  'Rogue',
  'Hunter',
  'Cleric',
  'Paladin',
  'Dark Knight',
  'Necromancer',
  'Druid',
];

const classAbilities = {
  Warrior: [
    { id: 'slash', label: 'Slash', description: 'A heavy blade strike.' },
    { id: 'guard', label: 'Guard', description: 'Brace up to reduce the next hit.' },
    { id: 'charge', label: 'Charge', description: 'Rush forward and smash the enemy.' },
  ],
  Mage: [
    { id: 'fireball', label: 'Fireball', description: 'Hurl a burning orb of magic.' },
    { id: 'arcane_shield', label: 'Arcane Shield', description: 'Create a magical barrier.' },
    { id: 'frost_nova', label: 'Frost Nova', description: 'Freeze the enemy in place.' },
  ],
  Rogue: [
    { id: 'backstab', label: 'Backstab', description: 'Strike from the shadows for extra damage.' },
    { id: 'smoke_bomb', label: 'Smoke Bomb', description: 'Blind the enemy and evade attacks.' },
    { id: 'evasion', label: 'Evasion', description: 'Prepare to avoid the next blow.' },
  ],
  Hunter: [
    { id: 'piercing_shot', label: 'Piercing Shot', description: 'Fire an arrow through armor.' },
    { id: 'set_trap', label: 'Set Trap', description: 'Slow the enemy when it moves.' },
    { id: 'hail_of_arrows', label: 'Hail of Arrows', description: 'Rain arrows down on the foe.' },
  ],
  Cleric: [
    { id: 'heal', label: 'Heal', description: 'Restore health to an ally.' },
    { id: 'bless', label: 'Bless', description: 'Empower your party for a moment.' },
    { id: 'purify', label: 'Purify', description: 'Cleanse wounds and soothe pain.' },
  ],
  Paladin: [
    { id: 'smite', label: 'Smite', description: 'Strike the enemy with righteous force.' },
    { id: 'shield_wall', label: 'Shield Wall', description: 'Reduce incoming damage for the party.' },
    { id: 'lay_on_hands', label: 'Lay on Hands', description: 'Heal a wounded ally in a flash.' },
  ],
  'Dark Knight': [
    { id: 'dark_slash', label: 'Dark Slash', description: 'Tear into the enemy with shadow energy.' },
    { id: 'blood_pact', label: 'Blood Pact', description: 'Sacrifice health to deal extra damage.' },
    { id: 'shadow_veil', label: 'Shadow Veil', description: 'Shroud yourself in darkness.' },
  ],
  Necromancer: [
    { id: 'bone_spear', label: 'Bone Spear', description: 'Launch a spear of bone at the foe.' },
    { id: 'raise_minion', label: 'Raise Minion', description: 'Summon a fiendish ally.' },
    { id: 'soul_drain', label: 'Soul Drain', description: 'Steal health from the enemy.' },
  ],
  Druid: [
    { id: 'thornlash', label: 'Thornlash', description: 'Whip the enemy with thorny vines.' },
    { id: 'wild_growth', label: 'Wild Growth', description: 'Heal allies with nature.' },
    { id: 'natures_grasp', label: 'Nature’s Grasp', description: 'Slow the enemy with roots.' },
  ],
};

const actionCooldowns = {
  slash: 5000,
  guard: 12000,
  charge: 9000,
  fireball: 7000,
  arcane_shield: 12000,
  frost_nova: 11000,
  backstab: 6000,
  smoke_bomb: 12000,
  evasion: 12000,
  piercing_shot: 7000,
  set_trap: 12000,
  hail_of_arrows: 9000,
  heal: 9000,
  bless: 12000,
  purify: 10000,
  smite: 8000,
  shield_wall: 14000,
  lay_on_hands: 15000,
  dark_slash: 8000,
  blood_pact: 13000,
  shadow_veil: 14000,
  bone_spear: 7000,
  raise_minion: 15000,
  soul_drain: 12000,
  thornlash: 7000,
  wild_growth: 14000,
  natures_grasp: 11000,
};

function getActionsForClass(className) {
  return classAbilities[className] || [];
}

function showPanel(panel) {
  [lobbyPanel, votePanel, restPanel, resultPanel, combatPanel].forEach(section => {
    if (!section) return;
    section.classList.toggle('hidden', section !== panel);
  });
}

function renderPlayers(users, showClasses = false) {
  if (!list) return;
  list.innerHTML = '';

  if (!users || users.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No players in the room yet.';
    list.appendChild(item);
    return;
  }

  users.forEach(user => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${user.name}</strong> ${user.role === 'Host' ? '<span class="user-role">Host</span>' : ''}`;
    if (showClasses && user.selectedClass) {
      const detail = document.createElement('div');
      detail.className = 'user-detail';
      detail.textContent = `${user.selectedClass} (${user.alive ? 'Ready' : 'Down'})`;
      item.appendChild(detail);
    }
    list.appendChild(item);
  });
}

function renderClassOptions(users) {
  if (!classOptions) return;
  classOptions.innerHTML = '';

  classes.forEach(className => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'class-card';
    card.textContent = className;
    card.addEventListener('click', () => {
      socket.emit('select-class', { roomId, className });
    });
    classOptions.appendChild(card);
  });
}

function renderRouteOptions(state, container, statusNode) {
  if (!container) return;
  container.innerHTML = '';
  const votes = state.votes || {};

  (state.routeOptions || []).forEach(route => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-card secondary-button';
    button.innerHTML = `<strong>${route.label}</strong><span>${route.description}</span><span class="route-count">Votes: ${Object.values(votes).filter(v => v === route.id).length}</span>`;
    button.addEventListener('click', () => {
      socket.emit('vote-route', { roomId, routeId: route.id });
    });
    container.appendChild(button);
  });

  if (statusNode) {
    statusNode.textContent = `Votes received: ${Object.keys(votes).length} / ${state.users.length}`;
  }
}

function renderShopOffers(state) {
  if (!shopOffersContainer) return;
  shopOffersContainer.innerHTML = '';
  const offers = state.shopOffers || [];

  offers.forEach(offer => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-card secondary-button';
    button.innerHTML = `<strong>${offer.label}</strong><span>${offer.description}</span><span class="route-count">Cost: ${offer.cost}</span>`;
    button.addEventListener('click', () => {
      socket.emit('buy-shop-item', { roomId, offerId: offer.id });
    });
    shopOffersContainer.appendChild(button);
  });
}

function renderEnemy(enemy) {
  if (!enemyCard) return;
  if (!enemy) {
    enemyCard.innerHTML = '<p>No enemy present yet.</p>';
    return;
  }

  enemyCard.innerHTML = `
    <div class="enemy-header">
      <strong>${enemy.name}</strong>
      <span>HP: ${enemy.currentHp} / ${enemy.maxHp}</span>
    </div>
    <div class="enemy-bar"><div class="enemy-health" style="width: ${Math.max(0, (enemy.currentHp / enemy.maxHp) * 100)}%"></div></div>
    <div class="enemy-stats">
      <span>Attack: ${enemy.attack}</span>
      <span>Defense: ${enemy.def || 'N/A'}</span>
      <span>Speed: ${enemy.speed}</span>
      <span>Path: ${enemy.pathTag || 'Normal'}</span>
    </div>
  `;
}

function renderCombatStatus(state) {
  if (!combatDetails) return;
  combatDetails.innerHTML = '';

  const infoGrid = document.createElement('div');
  infoGrid.className = 'combat-info-grid';

  const stageCard = document.createElement('div');
  stageCard.className = 'status-card';
  stageCard.innerHTML = `
    <strong>Stage</strong>
    <span>${state.currentStage || 0}</span>
  `;
  infoGrid.appendChild(stageCard);

  const routeCard = document.createElement('div');
  routeCard.className = 'status-card';
  routeCard.innerHTML = `
    <strong>Route</strong>
    <span>${state.currentRoute || 'TBD'}</span>
  `;
  infoGrid.appendChild(routeCard);

  const pathCard = document.createElement('div');
  pathCard.className = 'status-card';
  pathCard.innerHTML = `
    <strong>Path</strong>
    <span>${state.currentPath || 'Normal'}</span>
  `;
  infoGrid.appendChild(pathCard);

  const aliveCount = state.users.filter(user => user.alive).length;
  const partyCard = document.createElement('div');
  partyCard.className = 'status-card';
  partyCard.innerHTML = `
    <strong>Active Players</strong>
    <span>${aliveCount} / ${state.users.length}</span>
  `;
  infoGrid.appendChild(partyCard);

  combatDetails.appendChild(infoGrid);

  const playerSummary = document.createElement('div');
  playerSummary.className = 'player-summary';
  playerSummary.innerHTML = `
    <h3>Party Status</h3>
    ${state.users.map(user => `
      <div class="player-line ${user.alive ? '' : 'downed'}">
        <strong>${user.name}</strong> <small>${user.className}</small>
        <div>HP: ${user.currentHp}/${user.maxHp}</div>
        <div>Currency: ${user.currency}</div>
      </div>
    `).join('')}
  `;
  combatDetails.appendChild(playerSummary);
}

function renderPlayerStatus(state) {
  if (!playerStatusPanel) return;
  playerStatusPanel.innerHTML = '';
  const me = state.users.find(user => user.name === userName);
  if (!me) {
    playerStatusPanel.innerHTML = '<p>Player status unavailable.</p>';
    return;
  }

  const playerInfo = document.createElement('div');
  playerInfo.className = 'player-info-panel';
  playerInfo.innerHTML = `
    <h3>Your Status</h3>
    <div class="status-line"><strong>Class</strong><span>${me.className}</span></div>
    <div class="status-line"><strong>HP</strong><span>${me.currentHp}/${me.maxHp}</span></div>
    <div class="status-line"><strong>Currency</strong><span>${me.currency}</span></div>
    <div class="status-line"><strong>Ability Slots</strong><span>${me.abilitySlots || 0}</span></div>
    <div class="status-line"><strong>Perks</strong><span>${(me.unlockedPerks || []).join(', ') || 'None'}</span></div>
    <h4>Cooldowns</h4>
    <div class="cooldowns-list">
      ${(Object.entries(me.cooldowns || {}) || []).map(([ability, readyAt]) => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((readyAt - now) / 1000));
        return `<div class="cooldown-item"><strong>${ability}</strong>: ${remaining > 0 ? `${remaining}s` : 'Ready'}</div>`;
      }).join('')}
    </div>
  `;

  playerStatusPanel.appendChild(playerInfo);
}

function sendPlayerAction(actionId) {
  if (!socket) {
    console.warn('Unable to send action: socket not connected', actionId);
    return;
  }

  if (!roomId) {
    console.warn('Unable to send action: missing roomId', actionId);
    return;
  }

  console.log('sending player-action', { roomId, actionType: actionId, userName });
  socket.emit('player-action', { roomId, actionType: actionId });
}

function renderActions(state) {
  if (!actionGrid) return;
  actionGrid.innerHTML = '';

  const me = state.users.find(user => user.name === userName);
  if (!me) {
    actionGrid.innerHTML = '<p>Unable to locate your party profile.</p>';
    return;
  }

  const availableActions = getActionsForClass(me.className);
  if (availableActions.length === 0) {
    actionGrid.innerHTML = '<p>No actions available for your class.</p>';
    return;
  }

  availableActions.forEach(action => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-button action-button';
    const readyAt = me.cooldowns?.[action.id] || 0;
    const now = Date.now();
    const disabled = now < readyAt;
    const cooldownMs = actionCooldowns[action.id] || 0;
    const remainingSeconds = disabled ? Math.ceil((readyAt - now) / 1000) : 0;
    const progressPercent = disabled && cooldownMs ? Math.max(0, Math.min(100, ((cooldownMs - (readyAt - now)) / cooldownMs) * 100)) : 100;
    button.disabled = disabled;
    button.innerHTML = `
      <span>${action.label}</span>
      <small>${action.description}</small>
      <div class="cooldown-footer">
        <div class="progress-container">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <small class="${disabled ? 'cooldown-label' : 'ready-label'}">
          ${disabled ? `Cooldown: ${remainingSeconds}s` : 'Ready'}
        </small>
      </div>
    `;
    button.addEventListener('click', () => {
      sendPlayerAction(action.id);
    });
    actionGrid.appendChild(button);
  });
}

function refreshCombatUI() {
  if (!latestRoomState || latestRoomState.gameState !== 'combat') return;
  renderActions(latestRoomState);
}

function startCombatRefresh() {
  stopCombatRefresh();
  combatRefreshInterval = setInterval(refreshCombatUI, 1000);
}

function stopCombatRefresh() {
  if (combatRefreshInterval) {
    clearInterval(combatRefreshInterval);
    combatRefreshInterval = null;
  }
}

const itemCatalog = {
  health_potion: { label: 'Health Potion', description: 'Restore 40 HP in combat.', consumable: true },
  ether_vial: { label: 'Ether Vial', description: 'Restore one ability cooldown by 50%.', consumable: true },
  smoke_grenade: { label: 'Smoke Grenade', description: 'Reduce enemy attack for the current fight.', consumable: true },
};

function sendUseItem(itemId) {
  socket.emit('use-item', { roomId, itemId });
}

function renderInventory(state, container) {
  const target = container || inventoryList;
  if (!target || !state) return;
  target.innerHTML = '';
  const me = state.users.find(user => user.name === userName);
  if (!me) {
    target.innerHTML = '<li>No inventory available.</li>';
    return;
  }

  const items = me.inventory || [];
  if (items.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No items collected yet.';
    target.appendChild(item);
    return;
  }

  items.forEach(itemId => {
    const itemData = itemCatalog[itemId] || { label: itemId, consumable: false, description: '' };
    const item = document.createElement('li');
    item.innerHTML = `<span class="item-label">${itemData.label}</span>${itemData.description ? `<small class="item-desc">${itemData.description}</small>` : ''}`;
    if (state.gameState === 'combat' && itemData.consumable) {
      const useButton = document.createElement('button');
      useButton.textContent = 'Use';
      useButton.type = 'button';
      useButton.className = 'small-button';
      useButton.addEventListener('click', () => sendUseItem(itemId));
      item.appendChild(useButton);
    }
    target.appendChild(item);
  });
}

function renderLog(entries, container) {
  const target = container || battleLog;
  if (!target) return;
  target.innerHTML = '';
  (entries || []).slice(-6).forEach(entry => {
    const item = document.createElement('li');
    item.textContent = entry;
    target.appendChild(item);
  });
}

function updateLobby(state) {
  renderPlayers(state.users, true);
  renderClassOptions(state.users);
  showPanel(lobbyPanel);

  if (!startGameButton) return;
  const isHost = state.hostName === userName;
  startGameButton.classList.toggle('hidden', !isHost);
  if (openShopButton) {
    openShopButton.classList.remove('hidden');
  }
  if (isHost) {
    startGameButton.disabled = state.users.some(user => !user.selectedClass);
    lobbyNotice.textContent = state.users.some(user => !user.selectedClass)
      ? 'Waiting for everyone to pick a class.'
      : 'All players have chosen a class. Start the adventure when ready.';
  } else {
    lobbyNotice.textContent = `Waiting for ${state.hostName || 'the host'} to start the adventure.`;
  }
}

function updateVote(state) {
  renderPlayers(state.users, true);
  renderRouteOptions(state, routeOptions, voteStatus);
  showPanel(votePanel);
}

function updateRest(state) {
  renderPlayers(state.users, true);
  renderCombatStatus(state);
  renderInventory(state, restInventoryList);
  renderLog(state.battleLog, restBattleLog);

  const hasChoices = state.routeOptions && state.routeOptions.length > 0;
  renderRouteOptions(state, restRouteOptions, hasChoices ? restStatus : null);
  restStatus.textContent = hasChoices
    ? 'Choose a path to continue your run.'
    : 'The party is resting before the next stage.';

  continueButton.classList.toggle('hidden', hasChoices);
  showPanel(restPanel);
}

function updateCombat(state) {
  renderPlayers(state.users, true);
  renderPlayerStatus(state);
  renderEnemy(state.currentEnemy);
  renderCombatStatus(state);
  renderInventory(state, inventoryList);
  renderActions(state);
  renderLog(state.battleLog, battleLog);
  showPanel(combatPanel);
}

function updateResults(state) {
  if (!resultTitle || !resultSummary || !resultLog) return;
  resultTitle.textContent = state.gameState === 'victory' ? 'Run Complete' : 'Run Failed';
  resultSummary.textContent = state.gameState === 'victory'
    ? 'Congratulations! The party completed the run.'
    : 'The party was defeated. Some earned currency has been retained.';
  renderLog(state.battleLog, resultLog);
  showPanel(resultPanel);
}

function updateShop(state) {
  renderPlayers(state.users, true);
  renderShopOffers(state);
  if (shopStatus) {
    shopStatus.textContent = 'Choose an item or perk to buy from the shop.';
  }
  showPanel(shopPanel);
}

function renderRoomState(state) {
  if (!state) {
    return;
  }

  latestRoomState = state;

  if (state.gameState === 'lobby') {
    stopCombatRefresh();
    updateLobby(state);
  } else if (state.gameState === 'voting') {
    stopCombatRefresh();
    updateVote(state);
  } else if (state.gameState === 'rest') {
    stopCombatRefresh();
    updateRest(state);
  } else if (state.gameState === 'shop') {
    stopCombatRefresh();
    updateShop(state);
  } else if (state.gameState === 'combat') {
    updateCombat(state);
    startCombatRefresh();
  } else if (state.gameState === 'victory' || state.gameState === 'run_failed') {
    stopCombatRefresh();
    updateResults(state);
  } else {
    stopCombatRefresh();
    updateLobby(state);
  }
}

function showNamePrompt() {
  console.log('showNamePrompt is being shown')
  if (!namePrompt) return;
  namePrompt.classList.remove('hidden');
  if (storedName) {
    promptNameInput.value = storedName;
  }
  promptNameInput?.focus();
}

function connectSocket(name) {
  if (namePrompt) {
    namePrompt.classList.add('hidden');
  }
  socket = io();
  window.socket = socket;

  socket.on('connect', () => {
    console.log('socket connected', socket.id);
  });

  socket.on('connect_error', error => {
    console.error('Socket connect error:', error);
  });

  socket.on('room-state', state => {
    console.log('room-state update', {
      gameState: state.gameState,
      stage: state.currentStage,
      enemyHp: state.currentEnemy?.currentHp,
      myCooldowns: state.users.find(u => u.name === userName)?.cooldowns,
    });
    renderRoomState(state);
  });

  socket.on('action-error', ({ message }) => {
    console.warn('Action error:', message);
    const actionStatus = document.getElementById('actionStatus');
    if (actionStatus) {
      actionStatus.textContent = message;
    }
  });

  socket.on('action-success', ({ message, enemyHp, gameState }) => {
    console.log('Action success:', { message, enemyHp, gameState });
    const actionStatus = document.getElementById('actionStatus');
    if (actionStatus) {
      actionStatus.textContent = message;
    }
  });

  socket.on('shop-error', ({ message }) => {
    console.warn('Shop error:', message);
    if (shopStatus) {
      shopStatus.textContent = message;
    }
  });

  socket.on('shop-success', ({ message }) => {
    console.log('Shop success:', message);
    if (shopStatus) {
      shopStatus.textContent = message;
    }
  });

  socket.emit('enter-room', { roomId, userName: name });
}

function joinRoomWithName(name) {
  const trimmedName = name?.trim();
  if (!trimmedName || !roomId) return;
  window.localStorage.setItem('partyRoomUser', trimmedName);
  userName = trimmedName;
  if (namePrompt) {
    namePrompt.classList.add('hidden');
  }
  connectSocket(trimmedName);
}

if (userName && namePrompt) {
  namePrompt.classList.add('hidden');
}

if (!userName) {
  showNamePrompt();
} else if (roomId) {
  connectSocket(userName);
}

if (namePromptForm) {
  namePromptForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = promptNameInput.value.trim();
    if (name) {
      joinRoomWithName(name);
    }
  });
}

if (continueButton) {
  continueButton.addEventListener('click', () => {
    if (window.socket) {
      window.socket.emit('continue-run', { roomId });
    }
  });
}

if (openShopButton) {
  openShopButton.addEventListener('click', () => {
    if (window.socket) {
      window.socket.emit('open-shop', { roomId });
    }
  });
}

if (closeShopButton) {
  closeShopButton.addEventListener('click', () => {
    if (window.socket) {
      window.socket.emit('close-shop', { roomId });
    }
  });
}

if (startGameButton) {
  startGameButton.addEventListener('click', () => {
    if (window.socket) {
      window.socket.emit('start-game', { roomId });
    }
  });
}
