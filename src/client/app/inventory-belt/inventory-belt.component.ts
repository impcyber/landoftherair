import { Component, Input } from '@angular/core';
import { ColyseusGameService } from '../colyseus.game.service';
import { IPlayer } from '../../../shared/interfaces/character';

@Component({
  selector: 'app-inventory-belt',
  templateUrl: './inventory-belt.component.html',
  styleUrls: ['./inventory-belt.component.scss']
})
export class InventoryBeltComponent {

  @Input()
  public size;

  get player(): IPlayer {
    return this.colyseusGame.character;
  }

  get maxSize() {
    return this.player.belt.size;
  }

  get slots(): number[] {
    return Array(this.maxSize).fill(null).map((v, i) => i);
  }

  constructor(public colyseusGame: ColyseusGameService) {}

}
