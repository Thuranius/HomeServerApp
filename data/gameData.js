const routeOptions = [
  { id: 'forest', label: 'Enchanted Forest', description: 'A mossy route full of hidden dangers.' },
  { id: 'cave', label: 'Shadow Cave', description: 'Dim caverns where enemies lurk.' },
  { id: 'ruins', label: 'Ancient Ruins', description: 'Old stone halls full of traps and treasure.' },
];

const stageTemplates = [
  { name: 'Goblin Scout', hp: 120, attack: 10, speed: 6 },
  { name: 'Stone Golem', hp: 180, attack: 14, speed: 4 },
  { name: 'Wraith', hp: 150, attack: 18, speed: 8 },
  { name: 'Forest Troll', hp: 210, attack: 16, speed: 5 },
  { name: 'Ancient Dragon', hp: 280, attack: 22, speed: 7 },
];

module.exports = {
  routeOptions,
  stageTemplates,
};
