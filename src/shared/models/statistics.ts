
import { extend } from 'lodash';

import { Player } from './player';

export class Statistics {

  // imported
  private level: number;
  private xp: number;
  private axp: number;
  private baseClass: string;
  private skills: any;
  private name: string;

  // calculated
  private killstreak = 0;
  private bestKillstreak = 0;
  private kills = 0;
  private deaths = 0;
  private craftsAlchemy = 0;
  private craftsSpellforging = 0;
  private craftsRunewriting = 0;
  private craftsMetalworking = 0;
  private craftsSurvival = 0;
  private stepsTaken = 0;
  private lairsKilled = 0;
  private npcsGreeted = 0;
  private timesStripped = 0;

  constructor(opts) {
    extend(this, opts);
  }

  public get allStatisticAndValues(): any[] {
    return [
      { name: 'Killstreak', value: this.bestKillstreak },
      { name: 'Killstreak (cur)', value: this.killstreak },
      { name: 'Kills', value: this.kills },
      { name: 'Kills (Lair)', value: this.lairsKilled },
      { name: 'Deaths', value: this.deaths },
      { name: 'Strips', value: this.timesStripped },
      { name: 'Crafts (Alchemy)', value: this.craftsAlchemy },
      { name: 'Crafts (Spellforging)', value: this.craftsSpellforging },
      { name: 'Crafts (Runewriting)', value: this.craftsRunewriting },
      { name: 'Crafts (Metalworking)', value: this.craftsMetalworking },
      { name: 'Crafts (Survival)', value: this.craftsSurvival },
      { name: 'Steps Taken', value: this.stepsTaken },
      { name: 'NPCs Greeted', value: this.npcsGreeted }
    ]
  }

  public importFrom(player: Player) {
    this.level = player.level;
    this.xp = player.exp;
    this.axp = player.axp + ((<any>player.skillTree).totalAncientPoints * 100);
    this.baseClass = player.baseClass;
    this.skills = player.allSkills;
    this.name = player.name;
  }

  public addKill() {
    this.kills++;
    this.killstreak++;

    if(this.killstreak > this.bestKillstreak) {
      this.bestKillstreak = this.killstreak;
    }
  }

  public addDeath() {
    this.deaths++;
    this.killstreak = 0;
  }

  public craftAlchemy() {
    this.craftsAlchemy++;
  }

  public craftSpellforging() {
    this.craftsSpellforging++;
  }

  public craftRunewriting() {
    this.craftsRunewriting++;
  }

  public craftMetalworking() {
    this.craftsMetalworking++;
  }

  public craftSurvival() {
    this.craftsSurvival++;
  }

  public addStep(num: number = 1) {
    this.stepsTaken += num;
  }

  public addLairKill() {
    this.lairsKilled++;
  }

  public addNpcGreet() {
    this.npcsGreeted++;
  }

  public addStrip() {
    this.timesStripped++;
  }

}
