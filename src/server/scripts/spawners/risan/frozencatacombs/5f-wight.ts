
import { Spawner } from '../../../../base/Spawner';

const npcIds = [
  'Catacombs Wight 5F'
];

export class CatacombsWight5FSpawner extends Spawner {

  constructor(room, opts) {
    super(room, opts, {
      respawnRate: 40,
      initialSpawn: 2,
      maxCreatures: 3,
      spawnRadius: 1,
      randomWalkRadius: 15,
      leashRadius: 25,
      npcIds
    });
  }

}
