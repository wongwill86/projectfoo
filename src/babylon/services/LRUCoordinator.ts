import { Options, default as LRUMap } from './LRUMap';
import * as Vec3Simple from './Vec3Simple';
import { Size, BlockInfo } from './CacheTypes';

export default class LRUCoordinator<Coordinates extends Vec3Simple.Vec3,
Block extends Vec3Simple.Vec3, Info extends BlockInfo<Block>> {
  public max: number;

  private readonly freeBlocks: Block[] = [];
  private readonly blockLRU: LRUMap<Coordinates, Info>;

  constructor(size: Size, dispose: (key: Coordinates, value: Info) => void) {
    this.max = size.x * size.y * size.z;
    for (let x = 0; x < size.x; x ++) {
      for (let y = 0; y < size.y; y ++) {
        for (let z = 0; z < size.z; z ++) {
          this.freeBlocks.push({ x, y, z } as Block);
        }
      }
    }

    let options: Options<Coordinates, Info> = {
      max: this.max,
      toHash: Vec3Simple.stringify,
      dispose: (key: Coordinates, value: Info) => {
        this.freeBlocks.push(value.block);
        dispose(key, value);
      },
    };
    this.blockLRU = new LRUMap<Coordinates, Info>(options);
  }

  public get numberFreeBlocks() {
    return this.freeBlocks.length;
  }

  public get loadFactor() {
    return 1 - (this.numberFreeBlocks / this.max);
  }

  public get(coordinates: Coordinates) {
    return this.blockLRU.get(coordinates);
  }
}

