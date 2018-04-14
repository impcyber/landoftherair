
import { PartyTrait } from '../../models/partytrait';

export class PartyDefense extends PartyTrait {

  static traitName = 'PartyDefense';
  static description = 'Increase your defensive capabilities while in a party.';
  static icon = 'armor-vest';

  static upgrades = [
    { }, { }, { capstone: true }
  ];

}
