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
const combatPanel = document.getElementById('combatPanel');
const classOptions = document.getElementById('classOptions');
const startGameButton = document.getElementById('startGameButton');
const lobbyNotice = document.getElementById('lobbyNotice');
const routeOptions = document.getElementById('routeOptions');
const voteStatus = document.getElementById('voteStatus');
const enemyCard = document.getElementById('enemyCard');
const combatStatus = document.getElementById('combatStatus');
const actionGrid = document.getElementById('actionGrid');
const inventoryList = document.getElementById('inventoryList');
const battleLog = document.getElementById('battleLog');
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
  [lobbyPanel, votePanel, combatPanel].forEach(section => {
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

function renderRouteOptions(state) {
  if (!routeOptions) return;
  routeOptions.innerHTML = '';
  const votes = state.votes || {};

  (state.routeOptions || []).forEach(route => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-card secondary-button';
    button.innerHTML = `<strong>${route.label}</strong><span>${route.description}</span><span class="route-count">Votes: ${Object.values(votes).filter(v => v === route.id).length}</span>`;
    button.addEventListener('click', () => {
      socket.emit('vote-route', { roomId, routeId: route.id });
    });
    routeOptions.appendChild(button);
  });

  voteStatus.textContent = `Votes received: ${Object.keys(votes).length} / ${state.users.length}`;
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
    <div class="enemy-stats">Attack: ${enemy.attack} · Speed: ${enemy.speed}</div>
  `;
}

function renderCombatStatus(state) {
  if (!combatStatus) return;
  combatStatus.innerHTML = '';
  const header = document.createElement('div');
  header.innerHTML = `<strong>Stage:</strong> ${state.currentStage || 0} · <strong>Route:</strong> ${state.currentRoute || 'TBD'}`;
  combatStatus.appendChild(header);

  const stats = document.createElement('div');
  stats.className = 'combat-users';
  state.users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'combat-user';
    item.innerHTML = `<strong>${user.name}</strong> · ${user.className} · HP ${user.currentHp}/${user.maxHp} ${user.role === 'Host' ? '<span class="user-role">Host</span>' : ''}`;
    stats.appendChild(item);
  });
  combatStatus.appendChild(stats);
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

function renderInventory(users) {
  if (!inventoryList) return;
  inventoryList.innerHTML = '';
  const me = users.find(user => user.name === userName);
  if (!me) {
    inventoryList.innerHTML = '<li>No inventory available.</li>';
    return;
  }

  const items = me.inventory || [];
  if (items.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No items collected yet.';
    inventoryList.appendChild(item);
    return;
  }

  items.forEach(itemName => {
    const item = document.createElement('li');
    item.textContent = itemName;
    inventoryList.appendChild(item);
  });
}

function renderLog(entries) {
  if (!battleLog) return;
  battleLog.innerHTML = '';
  (entries || []).slice(-6).forEach(entry => {
    const item = document.createElement('li');
    item.textContent = entry;
    battleLog.appendChild(item);
  });
}

function updateLobby(state) {
  renderPlayers(state.users, true);
  renderClassOptions(state.users);
  showPanel(lobbyPanel);

  if (!startGameButton) return;
  const isHost = state.hostName === userName;
  startGameButton.classList.toggle('hidden', !isHost);
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
  renderRouteOptions(state);
  voteStatus.textContent = `Votes: ${Object.keys(state.votes).length} / ${state.users.length}`;
  showPanel(votePanel);
}

function updateCombat(state) {
  renderPlayers(state.users, true);
  renderEnemy(state.currentEnemy);
  renderCombatStatus(state);
  renderActions(state);
  renderInventory(state.users);
  renderLog(state.battleLog);
  showPanel(combatPanel);
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
  } else if (state.gameState === 'combat') {
    updateCombat(state);
    startCombatRefresh();
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

if (startGameButton) {
  startGameButton.addEventListener('click', () => {
    if (window.socket) {
      window.socket.emit('start-game', { roomId });
    }
  });
}
