
import { SpellEffect } from '../../base/Effect';
import { Character } from '../../../shared/models/character';
import { Skill } from '../../base/Skill';

export class RecentlyStunned extends SpellEffect {

  iconData = {
    name: 'knockout',
    color: '#000',
    tooltipDesc: 'Recently stunned and cannot be stunned for a period.'
  };

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.duration = Math.floor(10 / (1 - caster.getTraitLevelAndUsageModifier('SustainedImmunity')));
    target.applyEffect(this);
  }
}

export class Stun extends SpellEffect {

  iconData = {
    name: 'knockout',
    color: '#990',
    tooltipDesc: 'Stunned and unable to act.'
  };

  maxSkillForSkillGain = 9;

  cast(caster: Character, target: Character, skillRef?: Skill) {
    this.setPotencyAndGainSkill(caster, skillRef);
    this.flagCasterName(caster.name);

    if(target.hasEffect('RecentlyStunned') || target.hasEffect('Stun')) {
      return this.effectMessage(caster, `${target.name} resisted your stun!`);
    }

    target.addAgro(caster, 30);

    // physical attack
    if(!skillRef) {
      this.duration = this.duration || 3;

    // cast via spell
    } else {
      const targetWil = target.getTotalStat('wil') - caster.getTraitLevelAndUsageModifier('IrresistibleStuns');
      if(targetWil > this.potency) return this.effectMessage(caster, `${target.name} resisted your stun!`);

      this.duration = Math.min(10, Math.max(7, this.potency - targetWil));
      this.duration += caster.getTraitLevel('NatureSpirit');
      this.updateDebuffDurationBasedOnTraits(caster);

      this.effectMessage(caster, { message: `You stun ${target.name}!`, sfx: 'spell-debuff-give' });
    }

    target.applyEffect(this);
  }

  effectStart(char: Character) {
    this.effectMessage(char, { message: 'You are stunned!', sfx: 'spell-debuff-receive' });
  }

  effectEnd(char: Character) {
    const recentlyStunned = new RecentlyStunned({});
    recentlyStunned.cast(char, char);
    this.effectMessage(char, 'You are no longer stunned.');
  }
}
