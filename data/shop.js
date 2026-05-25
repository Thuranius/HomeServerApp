const { itemDefinitions } = require('./items');

const shopOffers = [
  {
    id: 'health_potion_pack',
    label: 'Health Potion Pack',
    type: 'item',
    itemId: 'health_potion',
    quantity: 3,
    cost: 80,
    description: 'Buy 3 Health Potions to stock your consumables.',
  },
  {
    id: 'ether_vial_bundle',
    label: 'Ether Vial Bundle',
    type: 'item',
    itemId: 'ether_vial',
    quantity: 2,
    cost: 120,
    description: 'Restore cooldowns mid-run with two Ether Vials.',
  },
  {
    id: 'smoke_grenade_pack',
    label: 'Smoke Grenade Pack',
    type: 'item',
    itemId: 'smoke_grenade',
    quantity: 2,
    cost: 160,
    description: 'Carry smoke grenades to weaken enemy attack in combat.',
  },
  {
    id: 'forest_charm',
    label: itemDefinitions.forest_charm.label,
    type: 'item',
    itemId: 'forest_charm',
    quantity: 1,
    cost: 220,
    description: itemDefinitions.forest_charm.description,
  },
  {
    id: 'extra_ability_slot',
    label: 'Extra Ability Slot',
    type: 'perk',
    cost: 250,
    description: 'Unlock an extra ability slot for every class.',
    perkId: 'extra_ability_slot',
  },
  {
    id: 'battle_tactician',
    label: 'Battle Tactician',
    type: 'perk',
    cost: 240,
    description: 'Learn enemy weaknesses so future foes are a little easier to defeat.',
    perkId: 'battle_tactician',
  },
  {
    id: 'starting_potion',
    label: 'Starting Potion',
    type: 'perk',
    cost: 180,
    description: 'Start every run with a Health Potion in your consumable bar.',
    perkId: 'starting_potion',
  },
];

function getShopOffer(offerId) {
  return shopOffers.find(offer => offer.id === offerId);
}

module.exports = {
  shopOffers,
  getShopOffer,
};
