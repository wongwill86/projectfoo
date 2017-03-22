import LRUHashString from './LRUCustomHash';
import * as Vec3Simple from './Vec3Simple';
import { SizeBlock, BlockInfo, Scaled, Scale, WorldSpace, CacheSpace } from './CacheTypes';

export default function createBlockRegistry<
    WorldCoordinates extends Vec3Simple.Vec3 & WorldSpace & Scaled<S>,
    CacheBlockCoordinates extends Vec3Simple.Vec3 & CacheSpace & Scaled<S>,
    Info extends BlockInfo<CacheBlockCoordinates>,
    S extends Scale>(size: SizeBlock): BlockRegistry<WorldCoordinates,
    CacheBlockCoordinates, Info, S> {
  let options  = {
    limit: size.x * size.y * size.z,
    toHash: Vec3Simple.stringify,
  };
  let blockLRU = new LRUHashString<WorldCoordinates, Info>(options);
  return new BlockRegistry<WorldCoordinates, CacheBlockCoordinates, Info, S>(size, blockLRU);
}

export class BlockRegistry<
    WorldCoordinates extends Vec3Simple.Vec3 & WorldSpace & Scaled<S>,
    CacheBlockCoordinates extends Vec3Simple.Vec3 & CacheSpace & Scaled<S>,
    Info extends BlockInfo<CacheBlockCoordinates>,
    S extends Scale> {
  private readonly freeBlocks: CacheBlockCoordinates[] = [];

  constructor(public size: SizeBlock, public lru: LRUHashString<WorldCoordinates, Info>) {
    for (let x = 0; x < size.x; x ++) {
      for (let y = 0; y < size.y; y ++) {
        for (let z = 0; z < size.z; z ++) {
          this.freeBlocks.push({ x, y, z } as CacheBlockCoordinates);
        }
      }
    }
  }

  public get numberFreeBlocks(): number {
    return this.freeBlocks.length;
  }

  public get(worldCoordinates: WorldCoordinates): Info | undefined {
    return this.lru.get(worldCoordinates);
  }

  public set(worldCoordinates: WorldCoordinates,
             createInfo: (coordinates: WorldCoordinates, cacheBlockCoordinates: CacheBlockCoordinates) => Info,
            ): Info | undefined {
    let removedInfo: Info | undefined = undefined;

    // touch the coordinates in the LRU to update most recent
    if (this.lru.get(worldCoordinates) === undefined) {
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
          console.error(`Free blocks out of sync with LRU. Tried to shift out worldCoordinates ${worldCoordinates} ` +
                        `from LRU but none were found.`);
          return undefined;
        }
      }
      this.lru.set(worldCoordinates, createInfo(worldCoordinates, freeBlock));
    }
    return removedInfo;
  }
}
