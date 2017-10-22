
import { startsWith } from 'lodash';

import { Skill } from '../../../../../base/Skill';
import { Character, SkillClassNames } from '../../../../../../shared/models/character';
import { Light as CastEffect } from '../../../../../effects/Light';

export class Light extends Skill {

  static macroMetadata = {
    name: 'Light',
    macro: 'cast light',
    icon: 'candle-light',
    color: '#aa0',
    mode: 'clickToTarget',
    tooltipDesc: 'Clear darkness near the target (3x3).'
  };

  public name = ['light', 'cast light'];

  flagSkills = [SkillClassNames.Restoration];

  mpCost = () => 25;
  range = () => 5;

  execute(user: Character, { gameState, args, effect }) {

    const target = this.getTarget(user, args, true);
    if(!target) return;

    if(!this.tryToConsumeMP(user, effect)) return;

    this.use(user, target);
  }

  use(user: Character, target: Character) {
    const effect = new CastEffect({});
    effect.cast(user, target, this);
  }

}
