const classDefinitions = {
  Warrior: { label: 'Warrior', hp: 130, str: 14, int: 4, dex: 7, def: 12, spd: 6 },
  Mage: { label: 'Mage', hp: 82, str: 5, int: 16, dex: 7, def: 5, spd: 8 },
  Rogue: { label: 'Rogue', hp: 92, str: 10, int: 6, dex: 15, def: 6, spd: 12 },
  Hunter: { label: 'Hunter', hp: 98, str: 11, int: 6, dex: 13, def: 7, spd: 10 },
  Cleric: { label: 'Cleric', hp: 105, str: 7, int: 14, dex: 6, def: 9, spd: 7 },
  Paladin: { label: 'Paladin', hp: 118, str: 12, int: 7, dex: 7, def: 13, spd: 6 },
  'Dark Knight': { label: 'Dark Knight', hp: 125, str: 13, int: 8, dex: 7, def: 12, spd: 5 },
  Necromancer: { label: 'Necromancer', hp: 88, str: 6, int: 17, dex: 7, def: 5, spd: 7 },
  Druid: { label: 'Druid', hp: 96, str: 8, int: 14, dex: 8, def: 8, spd: 8 },
};

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

function getAbilitiesForClass(className) {
  return classAbilities[className] || [];
}

function isActionValidForClass(className, actionType) {
  return getAbilitiesForClass(className).some(action => action.id === actionType);
}

module.exports = {
  classDefinitions,
  classAbilities,
  getAbilitiesForClass,
  isActionValidForClass,
};
