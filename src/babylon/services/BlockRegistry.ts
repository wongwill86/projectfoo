import LRUHashString from './LRUCustomHash';
import * as Vec3Simple from './Vec3Simple';
import { SizeBlock, BlockInfo } from './CacheTypes';

export default function createBlockRegistry<
Coordinates extends Vec3Simple.Vec3,
Block extends Vec3Simple.Vec3,
Info extends BlockInfo<Block>>(size: SizeBlock) {
  let options  = {
    limit: size.x * size.y * size.z,
    toHash: Vec3Simple.stringify,
  };
  let blockLRU = new LRUHashString<Coordinates, Info>(options);
  return new BlockRegistry<Coordinates, Block, Info>(size, blockLRU);
}

export class BlockRegistry<
    Coordinates extends Vec3Simple.Vec3,
    Block extends Vec3Simple.Vec3,
    Info extends BlockInfo<Block>> {
  private readonly freeBlocks: Block[] = [];

  constructor(public size: SizeBlock, public lru: LRUHashString<Coordinates, Info>) {
    for (let x = 0; x < size.x; x ++) {
      for (let y = 0; y < size.y; y ++) {
        for (let z = 0; z < size.z; z ++) {
          this.freeBlocks.push({ x, y, z } as Block);
        }
      }
    }
  }

  public get numberFreeBlocks(): number {
    return this.freeBlocks.length;
  }

  public get(coordinates: Coordinates): Info | undefined {
    return this.lru.get(coordinates);
  }

  public set(coordinates: Coordinates, createInfo: (coordinates: Coordinates, block: Block) => Info): Info | undefined {
    let removedInfo: Info | undefined = undefined;

    // touch the coordinates in the LRU to update most recent
    if (this.lru.get(coordinates) === undefined) {
      // try to get an empty block
      let freeBlock = this.freeBlocks.pop();

      // no empty blocks left (usually the case)
      if (freeBlock === undefined) {

        // recycle the least recently used block
        let shift = this.lru.shift();
        if (shift !== undefined) {
          removedInfo = shift[1];
          freeBlock = removedInfo.block;
        } else {
          // this shouldn't happen!
          console.error(`Free blocks out of sync with LRU. Tried to shift out coordinates ${coordinates} from LRU` +
                        `but none were found.`);
          return undefined;
        }
      }
      this.lru.set(coordinates, createInfo(coordinates, freeBlock));
    }
    return removedInfo;
  }
}
