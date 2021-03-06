
import { Command } from '../../../base/Command';
import { Player } from '../../../../shared/models/player';
import { MessageHelper } from '../../../helpers/world/message-helper';

export class Dance extends Command {

  public name = 'dance';
  public format = 'Target?';

  async execute(player: Player, { args }) {
    const possTargets = MessageHelper.getPossibleMessageTargets(player, args);

    if(possTargets && possTargets[0]) {
      const target = possTargets[0];

      player.sendClientMessage(`You dance with ${target.name}!`);
      target.sendClientMessage(`${player.name} dances with you!`);
      player.sendClientMessageToRadius(`${player.name} dances with ${target.name}!`, 4, [player.uuid, target.uuid]);
      player.removeAgro(target);
      return;
    }

    player.sendClientMessage('You dance!');
    player.sendClientMessageToRadius(`${player.name} dances!`, 4, [player.uuid]);

  }
}
