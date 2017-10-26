
import { find, isUndefined } from 'lodash';

import { Command } from '../../../../base/Command';
import { Player } from '../../../../../shared/models/player';

export class LockerToRight extends Command {

  public name = '~WtR';
  public format = 'ItemSlot LockerID';

  async execute(player: Player, { room, gameState, args }) {
    const [slotId, lockerId] = args.split(' ');

    if(!this.checkPlayerEmptyHand(player)) return;
    if(!this.findLocker(player)) return;

    const locker = await room.loadLocker(player, lockerId);
    if(!locker) return false;

    const item = locker.takeItemFromSlot(+slotId);
    if(!item) return;

    this.trySwapRightToLeft(player);

    player.setRightHand(item);
    room.updateLocker(player, locker);
  }

}
