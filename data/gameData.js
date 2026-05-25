const routeOptions = [
  { id: 'forest', label: 'Enchanted Forest', description: 'A mossy route full of hidden dangers.' },
  { id: 'cave', label: 'Shadow Cave', description: 'Dim caverns where enemies lurk.' },
  { id: 'ruins', label: 'Ancient Ruins', description: 'Old stone halls full of traps and treasure.' },
];

const routeThemes = {
  forest: {
    label: 'Enchanted Forest',
    description: 'A mossy route full of hidden dangers.',
    normal: [
      { name: 'Forest Scout', hp: 110, attack: 10, speed: 7 },
      { name: 'Thorn Wolf', hp: 130, attack: 12, speed: 8 },
      { name: 'Spore Crawler', hp: 115, attack: 11, speed: 6 },
    ],
    miniBoss: [
      { name: 'Entangler Dryad', hp: 240, attack: 18, speed: 5 },
      { name: 'Tanglehide Bear', hp: 260, attack: 20, speed: 4 },
    ],
    boss: { name: 'Elder Treant', hp: 420, attack: 26, speed: 4 },
  },
  cave: {
    label: 'Shadow Cave',
    description: 'Dim caverns where enemies lurk.',
    normal: [
      { name: 'Cave Bat', hp: 100, attack: 9, speed: 9 },
      { name: 'Rock Stalker', hp: 140, attack: 13, speed: 5 },
      { name: 'Shadow Lurker', hp: 120, attack: 14, speed: 7 },
    ],
    miniBoss: [
      { name: 'Cave Serpent', hp: 250, attack: 20, speed: 6 },
      { name: 'Crystal Golem', hp: 270, attack: 22, speed: 4 },
    ],
    boss: { name: 'Obsidian Warden', hp: 430, attack: 28, speed: 5 },
  },
  ruins: {
    label: 'Ancient Ruins',
    description: 'Old stone halls full of traps and treasure.',
    normal: [
      { name: 'Stone Sentry', hp: 120, attack: 11, speed: 6 },
      { name: 'Ruins Shade', hp: 130, attack: 13, speed: 8 },
      { name: 'Relic Hunter', hp: 115, attack: 12, speed: 7 },
    ],
    miniBoss: [
      { name: 'Temple Guardian', hp: 260, attack: 21, speed: 5 },
      { name: 'Rune Wraith', hp: 245, attack: 23, speed: 6 },
    ],
    boss: { name: 'Ancient Colossus', hp: 440, attack: 29, speed: 4 },
  },
};

const branchStages = [3, 6];
const branchDefinitions = {
  safe: {
    suffix: 'safe',
    label: 'Safer Path',
    description: 'Choose an easier route with smaller rewards.',
    difficultyModifier: 0.85,
    rewardModifier: 0.85,
  },
  risky: {
    suffix: 'risky',
    label: 'Riskier Path',
    description: 'Face tougher foes for better loot.',
    difficultyModifier: 1.2,
    rewardModifier: 1.3,
  },
};

module.exports = {
  routeOptions,
  routeThemes,
  branchStages,
  branchDefinitions,
};
