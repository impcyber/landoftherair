
import { clone, includes } from 'lodash';

import { Quest } from '../../../base/Quest';
import { Player } from '../../../../shared/models/player';

export class KillOrcs extends Quest {

  public static isRepeatable = true;
  static killsRequired = 40;

  public static get requirements() {
    return {
      type: 'kill',
      npcIds: [
        'Tower Orc',
        'Tower Orc Mage',
        'Tower Orc Healer',
        'Tower Orc Warlord'
      ]
    };
  }

  public static get initialData(): any {
    return clone({ kills: 0 });
  }

  public static canUpdateProgress(player: Player, questOpts: any = {}): boolean {
    return questOpts.kill && includes(this.requirements.npcIds, questOpts.kill);
  }

  public static updateProgress(player: Player, questOpts: any = {}): void {
    const { kills } = player.getQuestData(this);

    const structure = this.initialData;
    structure.kills = kills + 1;

    if(structure.kills <= this.killsRequired) {
      player.sendQuestMessage(this, `You have killed ${structure.kills}/${this.killsRequired} orcs.`);
    }

    player.setQuestData(this, structure);
  }

  public static isComplete(player: Player): boolean {
    const { kills } = player.getQuestData(this);

    return kills >= this.killsRequired;
  }

  public static incompleteText(player: Player): string {
    const { kills } = player.getQuestData(this);

    return `By my records, you have to kill ${this.killsRequired - kills} orcs yet!`;
  }

  public static completeFor(player: Player): void {
    this.givePlayerRewards(player);
    player.completeQuest(this);
  }

  public static givePlayerRewards(player: Player): void {
    this.rewardPlayerGold(player, 35000);
    player.gainExp(200000);
    player.sendClientMessage('You received 200,000 XP and 35,000 gold!');
  }
}
