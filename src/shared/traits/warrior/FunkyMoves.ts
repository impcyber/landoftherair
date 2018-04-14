
import { Trait } from '../../models/trait';

export class FunkyMoves extends Trait {

  static baseClass = 'Warrior';
  static traitName = 'FunkyMoves';
  static description = 'Learn to dance better, increasing your defense by 1 per point.';
  static icon = 'wingfoot';

  static upgrades = [
    { }, { }, { }, { }, { }
  ];

}
