
import { NPC } from '../../../shared/models/npc';
import { includes, capitalize, sample, get, set, random, compact, startCase } from 'lodash';
import { toRoman } from 'roman-numerals';
import { Logger } from '../../logger';
import { AllNormalGearSlots} from '../../../shared/interfaces/character';
import { Item } from '../../../shared/models/item';
import { Revive } from '../../effects/cures/Revive';
import { LearnAlchemy } from '../../quests/antania/Rylt/LearnAlchemy';
import { SkillHelper } from '../../helpers/character/skill-helper';
import { SpellforgingHelper } from '../../helpers/tradeskill/spellforging-helper';
import { MetalworkingHelper } from '../../helpers/tradeskill/metalworking-helper';
import { ValidMaterialItems } from '../../../shared/helpers/material-storage-layout';
import { GemDust } from '../../effects/buffs/GemDust';
import { SkillClassNames } from '../../../shared/interfaces/character';

export const TannerResponses = (npc: NPC) => {
  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      return `Greetings, ${player.name}, and welcome to my Tannery. Bring me your kills, and I will TAN them for you!`;
    });

  npc.parser.addCommand('tan')
    .set('syntax', ['tan'])
    .set('logic', (args, { player }) => {

      const ground = npc.$$room.state.getGroundItems(npc.x, npc.y);
      if(!ground.Corpse || !ground.Corpse.length) return 'There are no corpses here!';

      ground.Corpse.forEach(corpse => {
        if(corpse.isPlayerCorpse) {
          player.sendClientMessageFromNPC(npc, `You cannot tan players! What do I look like, a cannibal?`);
          return;
        }


        if(!includes(corpse.playersHeardDeath, player.username)) {
          player.sendClientMessageFromNPC(npc, `You didn't have a hand in killing the ${corpse.desc.split('the corpse of a ')[1]}!`);
          return;
        }

        if(!corpse.tansFor) {
          player.sendClientMessageFromNPC(npc, `I can't make anything out of ${corpse.desc}!`);
          return;
        }

        const corpseNPC = npc.$$room.state.findNPC(corpse.npcUUID);
        if(corpseNPC) corpseNPC.restore();
        else          npc.$$room.removeItemFromGround(corpse);

        player.$$room.npcLoader.loadItem(corpse.tansFor)
          .then(item => {
            item.setOwner(player);
            npc.$$room.addItemToGround(npc, item);
          });
      });

      return `Here you go, ${player.name}! I've tanned some corpses for you.`;
    });
};

export const PeddlerResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(!npc.peddleItem || !npc.peddleCost) {
        Logger.error(new Error(`Peddler at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid peddleItem/peddleCost`));
        return;
      }

      if(npc.distFrom(player) > 2) return 'Please move closer.';

      let bonusDesc = '';
      if(npc.peddleDesc) bonusDesc = npc.peddleDesc + ' ';
      return `Hello, ${player.name}! I can sell you a fancy ${npc.peddleItem} for ${npc.peddleCost.toLocaleString()} gold. ${bonusDesc}Just tell me you want to BUY it!`;
    });

  npc.parser.addCommand('buy')
    .set('syntax', ['buy'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      if(player.rightHand) return 'Please empty your right hand!';

      if(player.currentGold < npc.peddleCost) return `I can't offer this for free. You need ${npc.peddleCost.toLocaleString()} gold for a ${npc.peddleItem}.`;

      player.spendGold(npc.peddleCost, `Service:Peddler:${npc.rightHand.name}`);

      const item = new Item(npc.rightHand, { doRegenerate: true });

      player.setRightHand(item);

      return `Thank you, ${player.name}!`;
    });
};

export const SmithResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(!npc.costPerThousand || !npc.repairsUpToCondition) {
        Logger.error(new Error(`Smith at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid costPerThousand/repairsUpToCondition`));
        return;
      }

      if(npc.distFrom(player) > 2) return 'Please move closer.';

      return `Hello, ${player.name}! 
      I am a Smith. I can repair your weapons and armor - just hold them in your right hand and say REPAIR! 
      Or, you can tell me REPAIRALL and I will repair what you're holding and what you're wearing.
      You can also METALWORK here, I can COLLECT your ore, I can ASSESS your progress, and I can FORGE your items!`;
    });

  npc.parser.addCommand('repair')
    .set('syntax', ['repair'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      if(!player.rightHand) return 'You need to hold an item in your right hand!';

      const maxCondition = player.$$room.subscriptionHelper.calcMaxSmithRepair(player, npc.repairsUpToCondition || 20000);

      const missingCondition = maxCondition - player.rightHand.condition;
      if(missingCondition < 0) return 'That item is already beyond my capabilities!';
      // const condDiffMod = maxCondition * conditionDiffPercent;

      let cost = 0;

      const STANDARD_TIER = 20000;

      // the first 20k (0-20000) is pretty reasonable
      if(player.rightHand.condition < STANDARD_TIER) {
        const diffLostLowTierPercent = (STANDARD_TIER - player.rightHand.condition) / STANDARD_TIER;
        const baseLowTierCost = diffLostLowTierPercent * player.rightHand.value;
        cost += baseLowTierCost;
      }

      const cpt = npc.costPerThousand || 1;
      const diffLostHighTierPercent = (maxCondition - player.rightHand.condition) / (maxCondition);
      const baseHighTierCost = diffLostHighTierPercent * player.rightHand.value;
      cost += baseHighTierCost * cpt;

      cost = Math.floor(cost);

      if(cost <= 0 && missingCondition > 0) cost = 1;

      if(cost === 0) return 'That item is not in need of repair!';
      if(player.currentGold < cost) return `You need ${cost.toLocaleString()} gold to repair that item.`;

      player.spendGold(cost, `Service:Repair`);

      player.rightHand.condition = maxCondition;
      return `Thank you, ${player.name}! I've repaired your item for ${cost.toLocaleString()} gold.`;
    });

  npc.parser.addCommand('repairall')
    .set('syntax', ['repairall'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      const maxCondition = player.$$room.subscriptionHelper.calcMaxSmithRepair(player, npc.repairsUpToCondition || 20000);
      const cpt = npc.costPerThousand || 1;

      let totalCosts = 0;

      AllNormalGearSlots.forEach(slot => {
        const item: Item = get(player, slot);
        if(!item || item.condition > maxCondition) return;

        const cost = Math.floor((maxCondition - item.condition) / 1000 * cpt);
        if(cost === 0 || cost > player.currentGold) return;

        totalCosts += cost;

        player.spendGold(cost, `Service:RepairAll`);
        item.condition = maxCondition;
      });

      if(totalCosts === 0) {
        return `You are not wearing any items in need of repair.`;
      }

      return `Thank you, ${player.name}! I've done what I can. You've spent ${totalCosts.toLocaleString()} gold.`;
    });

  npc.parser.addCommand('metalwork')
    .set('syntax', ['metalwork'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(!MetalworkingHelper.canMetalwork(player)) return 'Only Warriors can engage in Metalworking!';
      npc.$$room.showMetalworkingWindow(player, npc);
      return 'Welcome back, Warrior.';
    });

  npc.parser.addCommand('assess')
    .set('syntax', ['assess'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const assessCost = 50;
      if(player.currentGold < assessCost) return `I require ${assessCost.toLocaleString()} gold for my assessment.`;

      player.spendGold(assessCost, `Service:Assess`);

      const percentWay = SkillHelper.assess(player, SkillClassNames.Metalworking);
      return `You are ${percentWay}% on your way towards the next level of ${SkillClassNames.Metalworking.toUpperCase()} proficiency.`;
    });

  npc.parser.addCommand('collect')
    .set('syntax', ['collect'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(!MetalworkingHelper.canMetalwork(player)) return 'Only Warriors can engage in Metalworking!';

      const indexes = player.$$room.npcLoader.getItemsFromPlayerSackByName(player, ' Ore ', true);
      if(indexes.length === 0) return 'You don\'t have any ore!';

      const allOre = player.$$room.npcLoader.takeItemsFromPlayerSack(player, indexes);

      const [copper, silver, gold] = [
        allOre.reduce((prev, item) => prev + (includes(item.name, 'Copper') ? item.ounces : 0), 0),
        allOre.reduce((prev, item) => prev + (includes(item.name, 'Silver') ? item.ounces : 0), 0),
        allOre.reduce((prev, item) => prev + (includes(item.name, 'Gold') ? item.ounces : 0), 0)
      ];

      player.tradeSkillContainers.metalworking.gainOre('copper', copper);
      player.tradeSkillContainers.metalworking.gainOre('silver', silver);
      player.tradeSkillContainers.metalworking.gainOre('gold', gold);

      const copperString = copper > 0 ? `${copper} copper ore` : '';
      const silverString = silver > 0 ? `${silver} silver ore` : '';
      const goldString   = gold   > 0 ? `${gold} gold ore` : '';

      const resultString = compact([copperString, silverString, goldString]).join(', ');

      return `Thanks, ${player.name}! You've gained ${resultString}!`;
    });

  npc.parser.addCommand('forge')
    .set('syntax', ['forge'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const left = player.leftHand;
      const right = player.rightHand;

      if(!left
      || !right
      || !includes(right.name, 'Mold')
      || !includes(left.name, 'Ingot')) return 'You need to hold an armor or weapon mold in your right hand, and an ingot in your left!';

      MetalworkingHelper.forgeItem(player);

      return 'Your forge was successful!';
    });
};

export const AutoRevives = (npc: NPC) => {
  let ticks = 0;
  let nextTick = 5;

  npc.$$ai.tick.add(() => {
    ticks++;

    if(npc.isDead()) return;

    if(ticks >= nextTick) {
      nextTick = 5;
      ticks = 0;

      const targets = npc.$$room.state.getAllPlayersInRange(npc, 0).filter(checkTarget => checkTarget.isDead());
      const target = targets[0];

      if(!target) return;

      const resSpell = new Revive({});
      resSpell.cast(npc, target);

      const msgObject = { name: npc.name, message: `Welcome back to life, ${target.name}!`, subClass: 'chatter' };
      npc.sendClientMessageToRadius(msgObject, 8);
    }
  });
};

export const RandomlyShouts = (npc: NPC, responses: string[] = [], opts: any = { combatOnly: false }) => {
  let ticks = 0;
  let nextTick = random(50, 60);

  npc.$$ai.tick.add(() => {
    ticks++;

    if(npc.isDead()) return;

    if(opts.combatOnly && npc.combatTicks <= 0) return;

    if(ticks >= nextTick) {
      nextTick = random(50, 60);
      ticks = 0;

      let response = sample(responses);

      if(responses.length > 1 && response === npc.$$lastResponse) {
        do {
          response = sample(responses);
        } while(response === npc.$$lastResponse);
      }

      npc.$$lastResponse = response;

      const msgObject = { name: npc.name, message: response, subClass: 'chatter' };
      npc.sendClientMessageToRadius(msgObject, 8);
    }
  });
};

export const CrierResponses = (npc: NPC) => {
  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      return `Hello, ${player.name}! I am the Crier, and my voice is the voice of the people!`;
    });
};

export const RecallerResponses = (npc: NPC) => {
  npc.parser.addCommand('recall')
    .set('syntax', ['recall'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      player.respawnPoint = { map: npc.$$room.state.mapName, x: npc.x, y: npc.y };
      return `I will recall you here when you die, ${player.name}. Safe travels.`;
    });
};

export const AlchemistResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(!npc.alchCost || !npc.alchOz) {
        Logger.error(new Error(`Alchemist at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid alchCost/alchOz!`));
        return;
      }

      let lastLine = 'You can also tell me ALCHEMY to practice on your own and I can ASSESS your progress!';

      const isQuestComplete = player.hasPermanentCompletionFor('LearnAlchemy');

      if(player.hasQuest(LearnAlchemy) && !isQuestComplete) {

        if(player.$$room.npcLoader.checkPlayerHeldItemEitherHand(player, 'Antanian Fungus Bread')) {
          LearnAlchemy.updateProgress(player);
        }

        if(LearnAlchemy.isComplete(player)) {
          LearnAlchemy.completeFor(player);

          return 'Congratulations! You\'re now a budding alchemist. Go forth and find some new recipes!';
        }

        return LearnAlchemy.incompleteText(player);

      } else if(!isQuestComplete) {
        lastLine = 'If you would like, you can LEARN how to do Alchemy from me!';

      }

      const maxOz = player.$$room.subscriptionHelper.calcPotionMaxSize(player, npc.alchOz);

      if(npc.distFrom(player) > 2) return 'Please move closer.';
      return `Hello, ${player.name}! 
      You can tell me COMBINE while holding a bottle in your right hand to 
      mix together that with other bottles of the same type in your sack. 
      I can combine up to ${maxOz}oz into one bottle. It will cost ${npc.alchCost} gold per ounce to do this.
      ${lastLine}`;
    });

  npc.parser.addCommand('combine')
    .set('syntax', ['combine'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      const maxOz = player.$$room.subscriptionHelper.calcPotionMaxSize(player, npc.alchOz);

      const item = player.rightHand;
      if(!item || item.itemClass !== 'Bottle') return 'You are not holding a bottle.';
      if(item.ounces >= maxOz) return 'That bottle is already too full for me.';

      let itemsRemoved = 0;

      const indexes = [];

      player.sack.items.forEach((checkItem, i) => {
        if(!checkItem.effect) return;
        if(checkItem.effect.name !== item.effect.name) return;
        if(checkItem.effect.potency !== item.effect.potency) return;
        if(checkItem.ounces + item.ounces > maxOz) return;
        if(item.ounces === 0) return;

        const cost = checkItem.ounces * npc.alchCost;
        if(npc.alchCost > cost) return;

        player.spendGold(cost, `Service:Combine`);
        indexes.push(i);
        item.ounces += checkItem.ounces;
        itemsRemoved++;
      });

      player.$$room.npcLoader.takeItemsFromPlayerSack(player, indexes);

      if(itemsRemoved === 0) return 'I was not able to combine any bottles.';

      item.setOwner(player);

      return `I've taken ${itemsRemoved} bottles from your sack and combined them with the item in your hand. Enjoy!`;
    });

  npc.parser.addCommand('alchemy')
    .set('syntax', ['alchemy'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      npc.$$room.showAlchemyWindow(player, npc);
      return 'Welcome back, Alchemist.';
    });

  npc.parser.addCommand('learn')
    .set('syntax', ['learn'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      if(player.hasPermanentCompletionFor('LearnAlchemy')) return 'I have already taught you the way of the bottle!';

      player.startQuest(LearnAlchemy);

      return `Great! I love teaching new alchemists. To start, go get a bottle of water and bread. 
      Come back, and tell me you want to practice ALCHEMY. Then, just mix the two items together!`;
    });

  npc.parser.addCommand('assess')
    .set('syntax', ['assess'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const assessCost = 50;
      if(player.currentGold < assessCost) return `I require ${assessCost.toLocaleString()} gold for my assessment.`;

      player.spendGold(assessCost, `Service:Assess`);

      const percentWay = SkillHelper.assess(player, SkillClassNames.Alchemy);
      return `You are ${percentWay}% on your way towards the next level of ${SkillClassNames.Alchemy.toUpperCase()} proficiency.`;
    });
};

export const BankResponses = (npc: NPC) => {
  if(!npc.bankId || !npc.branchId) {
    Logger.error(new Error(`Banker at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid bank/branch id`));
    return;
  }

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';
      player.$$room.openBank(player, npc);
      return `Greetings ${player.name}! Welcome to the ${npc.bankId} National Bank, ${npc.branchId} branch. You can WITHDRAW or DEPOSIT your coins here!`;
    });

  npc.parser.addCommand('deposit')
    .set('syntax', ['deposit <string:amount>'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      const amount = +args.amount;
      const region = npc.bankId;
      const res = player.$$room.depositBankMoney(player, region, amount);
      if(res === false) return 'That amount of gold is not valid.';
      if(res === 0) return 'What, do you think you\'re funny? Get out of line, there are other people to service!';
      return `Thank you, you have deposited ${res.toLocaleString()} gold into the ${region} National Bank. Your new balance is ${player.$$banks[region].toLocaleString()} gold.`;
    });

  npc.parser.addCommand('withdraw')
    .set('syntax', ['withdraw <string:amount>'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      const amount = +args.amount;
      const region = npc.bankId;
      const res = player.$$room.withdrawBankMoney(player, region, amount);
      if(res === false) return 'That amount of gold is not valid.';
      if(res === 0) return 'Hey, do I look like a charity to you? Get lost!';
      return `Thank you, you have withdrawn ${res.toLocaleString()} gold into the ${region} National Bank. Your new balance is ${player.$$banks[region].toLocaleString()} gold.`;
    });
};

export const VendorResponses = (npc: NPC, { classRestriction = '', filter = (items, player) => items } = {}) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.vendorItems.length === 0) {
        Logger.error(new Error(`Vendor at ${npc.x}, ${npc.y} - ${npc.map} does not have any vendorItems!`));
        return;
      }

      if(npc.allegiance !== 'None') {
        if(player.isHostileTo(npc.allegiance)) return 'I have nothing to say to your kind.';
      }

      if(classRestriction && player.baseClass !== classRestriction) {
        return 'I have nothing to say to you.';
      }

      if(npc.distFrom(player) > 2) return 'Please move closer.';

      let showItems = npc.vendorItems;
      if(filter) {
        showItems = filter(showItems, player);
      }

      npc.$$room.showShopWindow(player, npc, showItems);
      return `Greetings ${player.name}! Please view my wares.`;
    });

  npc.parser.addCommand('appraise')
    .set('syntax', ['appraise'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';

      if(npc.allegiance !== 'None') {
        if(player.isHostileTo(npc.allegiance)) return 'I have nothing to say to your kind.';
      }

      if(!player.rightHand) return 'I cannot give you as value for your hand.';

      const value = player.rightHand.value;
      if(value === 0) return 'That item is worthless.';

      return `That item is worth about ${value.toLocaleString()} coins, but I'd only buy it for ${player.sellValue(player.rightHand).toLocaleString()} coins.`;
    });

  npc.parser.addCommand('sell')
    .set('syntax', ['sell <string:itemtype*>'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';
      if(npc.$$vendorCurrency) return 'Sorry, I don\'t buy stuff here. You gotta find a normal merchant for that.';

      const itemtype = args['itemtype*'].toLowerCase();

      if(npc.allegiance !== 'None') {
        if(player.isHostileTo(npc.allegiance)) return 'I have nothing to say to your kind.';
      }

      // sell all items matching item type (player.sellItem)

      let sellValue = 0;

      const allItems = player.sack.allItems.filter((item, i) => {
        if(item.itemClass.toLowerCase() !== itemtype) return false;

        const itemValue = player.sellValue(item);
        if(itemValue <= 0) return false;

        sellValue += itemValue;

        return true;
      });

      if(allItems.length === 0) return 'You are not carrying any items of that type!';

      allItems.forEach(item => {
        player.sellItem(item);
        player.sack.takeItem(item);
      });

      return `You sold me ${allItems.length} items for a grand total of ${sellValue.toLocaleString()} gold. Thank you!`;
    });

};

export const EncrusterResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      return `Hail, ${player.name}! I am the Encruster, and I can put magical gems into your weapons and armor. 
      You can only set one gem at a time, and subsequent encrusts will replace the old gem.
      It will cost a fair price - the value of the gem, some insurance for the item, and then a little bit for me.
      If you would like to do this, hold the item in your right hand, the gem in your left, and tell me ENCRUST.
      Beware - encrusting an item will bind it to you!`;
    });

  npc.parser.addCommand('encrust')
    .set('syntax', ['encrust'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      if(!player.rightHand) return 'You must hold an item in your right hand!';
      if(player.rightHand.itemClass === 'Rock') return 'Hey! I put rocks in items, not other rocks.';
      if(ValidMaterialItems[player.rightHand.name]) return 'Sorry, but I can\'t encrust that item.';
      if(player.rightHand.itemClass === 'Corpse') return 'That would be disrespectful.';
      if(!player.rightHand.isOwnedBy(player)) return 'That item does not belong to you!';
      if(!player.leftHand || player.leftHand.itemClass !== 'Gem') return 'You must hold a gem in your left hand!';
      if(!player.leftHand.isOwnedBy(player)) return 'That gem does not belong to you!';
      if(!player.leftHand.canUseInCombat(player)) return 'You cannot use that gem!';

      const cost = player.leftHand.value + player.rightHand.value + 500;

      if(player.currentGold < cost) return `I require ${cost.toLocaleString()} gold for this transaction.`;

      const prevEncrust = player.rightHand.encrust;

      const nextEncrust = {
        desc: player.leftHand.desc,
        stats: player.leftHand.stats,
        sprite: player.leftHand.sprite,
        value: player.leftHand.value,
        maxEncrusts: player.leftHand.maxEncrusts || 0
      };

      const prevValue = get(prevEncrust, 'value', 0);
      player.rightHand.value -= prevValue;
      player.rightHand.value += nextEncrust.value;

      const levelRequirementForGem = get(player.leftHand, 'requirements.level', 0);
      const itemLevelRequirement = get(player.rightHand, 'requirements.level', 0);

      let newLevelText = '';
      const newMaxLevel = Math.max(levelRequirementForGem, itemLevelRequirement);
      if(newMaxLevel !== 0) {
        set(player.rightHand, 'requirements.level', newMaxLevel);

        if(newMaxLevel === levelRequirementForGem) newLevelText = `Your item now requires level ${levelRequirementForGem} to use.`;
      }

      player.spendGold(cost, `Service:Encrust`);
      player.setLeftHand(null);
      player.rightHand.setOwner(player);

      player.rightHand.encrust = nextEncrust;
      const replaceText = prevEncrust ? ` This has replaced your ${prevEncrust.desc}. ` : '';
      player.recalculateStats();

      const maxEncrustText = nextEncrust.maxEncrusts > 0 ? ` This gem seems fairly unique, and you can only use ${nextEncrust.maxEncrusts} at a time! ` : '';

      return `I have set your ${player.rightHand.itemClass.toLowerCase()} with ${nextEncrust.desc}.${maxEncrustText}${replaceText}${newLevelText}`;
    });
};

export const BaseClassTrainerResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(!npc.maxSkillTrain || !npc.trainSkills || !npc.classTrain || !npc.maxLevelUpLevel) {
        Logger.error(new Error(`Trainer at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid maxSkillTrain/trainSkills/classTrain/maxLevelUpLevel`));
        return;
      }

      if(npc.distFrom(player) > 0) return 'Please move closer.';
      npc.$$room.showTrainerWindow(player, npc);

      const healerText = npc.classTrain === 'Healer' ? 'I can also RECALL you to this location when you die!' : '';

      return `Hail, ${player.name}! 
      If you want to try to level up, TRAIN with me. 
      Alternatively, I can let you know how your combat skills are progressing if you want to ASSESS them! 
      You can also JOIN the ${npc.classTrain} profession if you haven't chosen one already!
      If you're a subscriber, I can also RESET your skill tree! ${healerText}`;
    });

  npc.parser.addCommand('assess')
    .set('syntax', ['assess <string:skill*>'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const skill = args['skill*'].toLowerCase();

      if(!includes(npc.trainSkills, capitalize(skill))) return 'I cannot teach you anything about this.';

      const skillLevel = player.calcBaseSkillLevel(skill);

      const maxAssessSkill = npc.maxSkillTrain;

      const assessCost = maxAssessSkill * 10;
      if(player.currentGold < assessCost) return `I require ${assessCost.toLocaleString()} gold for my assessment.`;

      player.spendGold(assessCost, `Service:Assess`);

      if(skillLevel >= maxAssessSkill) return 'You are too advanced for my teachings.';

      const percentWay = SkillHelper.assess(player, skill);
      return `You are ${percentWay}% on your way towards the next level of ${skill.toUpperCase()} proficiency.`;
    });

  npc.parser.addCommand('train')
    .set('syntax', ['train'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(player.baseClass !== npc.classTrain && player.baseClass !== 'Undecided') return 'I have nothing to teach you.';
      if(player.gainingAP) return 'You are currently not training this way.';

      const level = player.level;

      const trainCost = npc.maxLevelUpLevel * 10;
      if(player.currentGold < trainCost) return `I require ${trainCost} gold for my training.`;

      if(level >= npc.maxLevelUpLevel) return 'You are too advanced for my teachings.';

      player.tryLevelUp(npc.maxLevelUpLevel);
      const newLevel = player.level;

      if(newLevel === level) return 'You are not experienced enough to train with me.';

      player.spendGold(trainCost, `Service:Train`);

      const gainedTP = player.skillTree.calculateNewTPFromLevels(player);
      player.$$room.updateSkillTree(player);

      const extraText = player.baseClass === npc.classTrain ? 'Visit your Trait Tree to spend TP!' : '';
      return `You have gained ${newLevel - level} experience level and ${gainedTP} TP. ${extraText}`;
    });

  npc.parser.addCommand('ancient')
    .set('syntax', ['ancient'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(player.baseClass !== npc.classTrain && player.baseClass !== 'Undecided') return 'I have nothing to teach you.';
      if(!player.gainingAP) return 'You are currently not training this way.';

      if(player.axp < 100) return 'You do not have enough ancient experience to learn from me.';

      player.axp -= 100;
      player.$$skillTree.gainAncientPoints(1);

      const trainCost = npc.maxLevelUpLevel * 500;
      if(player.currentGold < trainCost) return `I require ${trainCost} gold for my training.`;

      player.spendGold(trainCost, `Service:Ancient`);

      return `You have gained 1 AP!`;
    });

  npc.parser.addCommand('join')
    .set('syntax', ['join'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(player.baseClass !== 'Undecided') return 'You have already joined a profession.';

      player.sendClientMessageFromNPC(npc, `Welcome to the ${npc.classTrain} profession, ${player.name}!`);

      player.changeBaseClass(npc.classTrain);

      return `Good luck on your journeys!`;
    });

  npc.parser.addCommand('learn')
    .set('syntax', ['learn'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(player.baseClass !== npc.classTrain) return 'I have nothing to teach you.';

      const learnCost = npc.maxSkillTrain * 100;
      if(player.currentGold < learnCost) return `I require ${learnCost} gold for my teaching.`;

      const gainedTP = player.skillTree.calculateNewTPFromSkills(player);
      player.$$room.updateSkillTree(player);

      if(gainedTP === 0) return 'I cannot currently teach you anything new.';

      player.spendGold(learnCost, `Service:Learn`);

      return `You have gained ${gainedTP} TP! Visit your Trait Tree to spend TP!`;
    });

  npc.parser.addCommand('reset')
    .set('syntax', ['reset'])
    .set('logic', (args, { player }) => {
      if(!player.$$room.subscriptionHelper.isSubscribed(player)) return 'You are not a subscriber!';

      player.skillTree.reset(player);
      player.skillTree.calculateNewTPFromSkills(player);
      player.skillTree.calculateNewTPFromLevels(player);
      player.$$room.updateSkillTree(player);

      return 'Done! Enjoy your reset skill tree. You may need to LEARN from me again to get all of your points back!';
    });
};

export const ReviverResponses = (npc: NPC) => {

  npc.parser.addCommand('revive')
    .set('syntax', ['revive'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const targets = npc.$$room.state.getAllPlayersInRange(npc, 0).filter(checkTarget => checkTarget.isDead());
      const target = targets[0];

      if(!target) return 'There is no one in need of revival here!';

      const resSpell = new Revive({});
      resSpell.cast(npc, target);
      return `Done!`;
    });
};

export const DiplomatResponses = (npc: NPC) => {
  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      const factions = ['Pirates', 'Townsfolk', 'Royalty', 'Adventurers', 'Wilderness', 'Underground'];

      const factionStrings = factions.map(faction => {
        return `The ${faction} regards you as ${player.allegianceAlignmentString(faction)}. (${player.allegianceReputation[faction] || 0})`;
      });

      return [`Greetings, ${player.name}! I can sense your social standings with the various factions of the land:`].concat(factionStrings).join('|||');
    });
};

export const SpellforgingResponses = (npc: NPC) => {
  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      return `Greetings, fellow conjurer. I am a master enchanter who can help you learn to SPELLFORGE and ASSESS your progress.
      I can also EXAMINE the traits on your gear and SMASH a gem to give you a magical aura based on it's properties.`;
    });

  npc.parser.addCommand('spellforge')
    .set('syntax', ['spellforge'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(!SpellforgingHelper.canSpellforge(player)) return 'You are not skilled enough to Spellforge.';
      npc.$$room.showSpellforgingWindow(player, npc);
      return 'Welcome back, Mage.';
    });

  npc.parser.addCommand('assess')
    .set('syntax', ['assess'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';
      if(!SpellforgingHelper.canSpellforge(player)) return 'You are not able to Spellforge.';

      const assessCost = 50;
      if(player.currentGold < assessCost) return `I require ${assessCost.toLocaleString()} gold for my assessment.`;

      player.spendGold(assessCost, `Service:Assess`);

      const percentWay = SkillHelper.assess(player, SkillClassNames.Spellforging);
      return `You are ${percentWay}% on your way towards the next level of ${SkillClassNames.Spellforging.toUpperCase()} proficiency.`;
    });

  npc.parser.addCommand('examine')
    .set('syntax', ['examine'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const slots = [
        { name: 'Right Hand',     path: 'rightHand' },
        { name: 'Left Hand',      path: 'leftHand' },
        { name: 'Ear',            path: 'gear.Ear' },
        { name: 'Head',           path: 'gear.Head' },
        { name: 'Neck',           path: 'gear.Neck' },
        { name: 'Waist',          path: 'gear.Waist' },
        { name: 'Wrists',         path: 'gear.Wrists' },
        { name: 'Left Ring',      path: 'gear.Ring1' },
        { name: 'Right Ring',     path: 'gear.Ring2' },
        { name: 'Hands',          path: 'gear.Hands' },
        { name: 'Feet',           path: 'gear.Feet' },
        { name: 'Armor',          path: 'gear.Armor' },
        { name: 'Inner Robe',     path: 'gear.Robe1' },
        { name: 'Outer Robe',     path: 'gear.Robe2' }
      ];

      const allTraits = {};

      player.sendClientMessageFromNPC(npc, `${player.name}, here are your active traits:`);

      slots.forEach(({ name, path }) => {
        const item = get(player, path);
        if(!item) return;

        const trait = get(item, 'trait.name');

        if(!trait) return;
        allTraits[trait] = allTraits[trait] || 0;

        let level = get(item, 'trait.level', 0);

        if((name === 'Feet' || name === 'Hands') && player.getTraitLevel('MirroredEnchantments')) {
          level *= 2;
        }

        allTraits[trait] += level;
      });

      slots.forEach(({ name, path }) => {
        const item = get(player, path);
        const trait = get(item, 'trait.name');
        let level = get(item, 'trait.level', 0);

        if((name === 'Feet' || name === 'Hands') && player.getTraitLevel('MirroredEnchantments')) {
          level *= 2;
        }

        const traitLevelString = trait ? `${startCase(trait)} ${toRoman(level)}` : '(none)';
        const traitTotalString = trait ? ` (Total: ${allTraits[trait]})` : '';

        player.sendClientMessage(`${name} - ${traitLevelString}${traitTotalString}`);
      });

      return 'Happy adventuring!';

    });

  npc.parser.addCommand('smash')
    .set('syntax', ['smash'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Please move closer.';

      const item = player.rightHand;
      if(!item || item.itemClass !== 'Gem') return 'You are not holding a gem.';
      if(!item.isOwnedBy(player)) return 'That is not yours to smash!';

      if(Object.keys(item.stats).length === 0) return 'That gem will provide no value to you.';

      player.setRightHand(null);

      const dust = new GemDust({ stats: item.stats, gemDesc: item.desc });
      dust.cast(player, player);

      return 'Your gem has been smashed into dust.';
    });
};

const calcRequiredGoldForNextHPMP = (player, maxForTier: number, normalizer: number, costsAtTier: { min: number, max: number }) => {

  const normal = normalizer;

  const curHp = player.getBaseStat('hp');

  // every cha past 7 is +1% discount
  const discountPercent = Math.min(50, player.getTotalStat('cha') - 7);
  const percentThere = Math.max(0.01, (curHp - normal) / (maxForTier - normal));

  const { min, max } = costsAtTier;

  const totalCost = min + ((max - min) * percentThere);
  const totalDiscount = (totalCost * discountPercent / 100);

  return player.$$room.subscriptionHelper.modifyDocPrice(player, Math.max(min, Math.round(totalCost - totalDiscount)));
};

export const HPDocResponses = (npc: NPC) => {

  if(!npc.hpTier) {
    Logger.error(new Error(`HPDoc at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid hpTier`));
    return;
  }

  const hpTiers = {
    Mage:       [100, 375, 600, 2400],
    Thief:      [100, 425, 700, 2800],
    Healer:     [100, 400, 650, 2600],
    Warrior:    [100, 450, 800, 3000],
    Undecided:  [100, 600, 550, 2200]
  };

  const levelTiers = [0, 13, 25, 50];

  const hpNormalizers = [100, 200, 300, 1500];

  const hpCosts = [
    { min: 100,     max: 500 },
    { min: 5000,    max: 15000 },
    { min: 100000,  max: 1000000 },
    { min: 1000000, max: 10000000 }
  ];

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Closer move.';

      return `${player.name}, greet! Am exiled scientist of Rys descent. Taught forbidden arts of increase life force. Interest? Hold gold, say TEACH.`;
    });

  npc.parser.addCommand('teach')
    .set('syntax', ['teach'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Closer move.';

      const levelTier = levelTiers[npc.hpTier];
      if(player.level < levelTier) return 'Not experience enough for teach!';

      const playerBaseHp = player.getBaseStat('hp');
      const maxHpForTier = hpTiers[player.baseClass][npc.hpTier];

      if(playerBaseHp > maxHpForTier) return 'Too powerful! No help!';
      if(!player.$$room.npcLoader.checkPlayerHeldItem(player, 'Gold Coin', 'right')) return 'No gold! No help!';

      let cost = calcRequiredGoldForNextHPMP(player, maxHpForTier, hpNormalizers[npc.hpTier], hpCosts[npc.hpTier]);
      let totalHPGained = 0;
      let totalAvailable = player.rightHand.value;
      let totalCost = 0;

      if(cost > totalAvailable) return `Need ${cost.toLocaleString()} gold for life force!`;

      while(cost > 0 && cost <= totalAvailable) {
        totalAvailable -= cost;
        totalCost += cost;
        totalHPGained++;
        player.gainBaseStat('hp', 1);

        if(player.getBaseStat('hp') >= maxHpForTier) {
          cost = -1;
        } else {
          cost = calcRequiredGoldForNextHPMP(player, maxHpForTier, hpNormalizers[npc.hpTier], hpCosts[npc.hpTier]);
        }
      }

      if(totalAvailable === 0) {
        totalAvailable = 1;
        totalCost -= 1;
      }

      player.rightHand.value = totalAvailable;

      return `Gained ${totalHPGained} life forces! Cost ${totalCost.toLocaleString()} gold!`;
    });
};

export const MPDocResponses = (npc: NPC) => {

  if(!npc.mpTier) {
    Logger.error(new Error(`MPDoc at ${npc.x}, ${npc.y} - ${npc.map} does not have a valid mpTier`));
    return;
  }

  const mpTiers = {
    Mage:       [0, 0, 1000, 2000],
    Thief:      [0, 0, 0, 0],
    Healer:     [0, 0, 900, 1800],
    Warrior:    [0, 0, 0, 0],
    Undecided:  [0, 0, 0, 0]
  };

  const levelTiers = [0, 13, 25, 50];

  const mpNormalizers = [100, 200, 300, 1500];

  const mpCosts = [
    { min: 100,     max: 500 },
    { min: 10000,   max: 30000 },
    { min: 200000,  max: 2000000 },
    { min: 2000000, max: 20000000 }
  ];

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Closer move.';

      return `${player.name}, greet! Am exiled scientist of Rys descent. Taught forbidden arts of increase magic force. Interest? Hold gold, say TEACH.`;
    });

  npc.parser.addCommand('teach')
    .set('syntax', ['teach'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 0) return 'Closer move.';

      const levelTier = levelTiers[npc.mpTier];
      if(player.level < levelTier) return 'Not experience enough for teach!';

      const playerBaseMp = player.getBaseStat('mp');
      const maxMpForTier = mpTiers[player.baseClass][npc.mpTier];

      if(playerBaseMp > maxMpForTier) return 'Too powerful! No help!';
      if(!player.$$room.npcLoader.checkPlayerHeldItem(player, 'Gold Coin', 'right')) return 'No gold! No help!';

      let cost = calcRequiredGoldForNextHPMP(player, maxMpForTier, mpNormalizers[npc.mpTier], mpCosts[npc.mpTier]);
      let totalMPGained = 0;
      let totalAvailable = player.rightHand.value;
      let totalCost = 0;

      if(cost > totalAvailable) return `Need ${cost.toLocaleString()} gold for magic force!`;

      while(cost > 0 && cost <= totalAvailable) {
        totalAvailable -= cost;
        totalCost += cost;
        totalMPGained++;
        player.gainBaseStat('mp', 1);

        if(player.getBaseStat('mp') >= maxMpForTier) {
          cost = -1;
        } else {
          cost = calcRequiredGoldForNextHPMP(player, maxMpForTier, mpNormalizers[npc.mpTier], mpCosts[npc.mpTier]);
        }
      }

      if(totalAvailable === 0) {
        totalAvailable = 1;
        totalCost -= 1;
      }

      player.rightHand.value = totalAvailable;

      return `Gained ${totalMPGained} magic forces! Cost ${totalCost.toLocaleString()} gold!`;
    });
};

export const TraderResponses = (npc: NPC) => {

  npc.parser.addCommand('hello')
    .set('syntax', ['hello'])
    .set('logic', (args, { player }) => {
      if(npc.distFrom(player) > 2) return 'Please move closer.';
      npc.$$room.showMarketBoard(player, npc);

      return `${player.name}, hello! Welcome to the Steelrose Trading Company. I'll be your agent today, how can I help you?`;
    });

};
