const itemDefinitions = {
  health_potion: {
    id: 'health_potion',
    label: 'Health Potion',
    type: 'consumable',
    description: 'Restore 40 HP in combat.',
    effect: { type: 'heal', amount: 40 },
    rarity: 'common',
    stackable: true,
  },
  ether_vial: {
    id: 'ether_vial',
    label: 'Ether Vial',
    type: 'consumable',
    description: 'Restore one ability cooldown by 50%.',
    effect: { type: 'cooldown_reduction', amount: 0.5 },
    rarity: 'uncommon',
    stackable: true,
  },
  smoke_grenade: {
    id: 'smoke_grenade',
    label: 'Smoke Grenade',
    type: 'consumable',
    description: 'Lower the enemy attack power for the current combat.',
    effect: { type: 'enemy_attack_down', amount: 0.25 },
    rarity: 'uncommon',
    stackable: true,
  },
  forest_charm: {
    id: 'forest_charm',
    label: 'Forest Charm',
    type: 'equipment',
    slot: 'utility',
    description: 'Passive boost: +2 dex and Fireball gains a slow effect.',
    bonuses: { dex: 2 },
    abilityModifiers: [{ ability: 'fireball', modifier: 'slow', value: 0.15 }],
    rarity: 'rare',
  },
  iron_plate: {
    id: 'iron_plate',
    label: 'Iron Plate',
    type: 'equipment',
    slot: 'body',
    description: 'Heavy armor that increases defense.',
    bonuses: { def: 4 },
    rarity: 'common',
  },
  swift_boots: {
    id: 'swift_boots',
    label: 'Swift Boots',
    type: 'equipment',
    slot: 'feet',
    description: 'Passive boost: +3 speed.',
    bonuses: { spd: 3 },
    rarity: 'uncommon',
  },
};

const MAX_INVENTORY_SIZE = 24;

function getDefaultEquipmentSlots() {
  return {
    head: null,
    body: null,
    feet: null,
    hands: null,
    utility: null,
    consumables: [null, null, null],
  };
}

module.exports = {
  itemDefinitions,
  MAX_INVENTORY_SIZE,
  getDefaultEquipmentSlots,
};
