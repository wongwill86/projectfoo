import * as Vec3Simple from './Vec3Simple';
import LRUCoordinator from './LRUCoordinator';
import { Size, SizePower, toPowerTwo,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlock, PageTableBlock,
  VoxelBlockInfo, PageBlockInfo,
} from './CacheTypes';



export default class CacheRegistry {
  public readonly voxelBlockLRU: LRUCoordinator<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>;
  public readonly pageTableLRU: LRUCoordinator<PageBlockCoordinates, PageTableBlock, PageBlockInfo>;

  private toVoxelBlockPower: SizePower;
  private toPageBlockPower: SizePower;

  constructor(public readonly pageDirectorySize: Size, public readonly pageTableSize: Size,
              public readonly voxelCacheSize: Size, public readonly pageBlockSize: Size,
              public readonly voxelBlockSize: Size) {
    // TODO verify all sizes are powers of 2!
    // TODO verify pagetableblocksize actually fits in page table size!

    this.toVoxelBlockPower = toPowerTwo(voxelBlockSize);
    this.toPageBlockPower = Vec3Simple.add(this.toVoxelBlockPower, toPowerTwo(pageBlockSize));

    this.voxelBlockLRU = new  LRUCoordinator<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>(
      Vec3Simple.Vec3(3) as Size, (key: VoxelBlockCoordinates, info: VoxelBlockInfo) => {
        console.log(`disposing ${JSON.stringify(key)} with ${JSON.stringify(info)}`);
      },
    );
    this.pageTableLRU = new LRUCoordinator<PageBlockCoordinates, PageTableBlock, PageBlockInfo>(
      Vec3Simple.Vec3(3) as Size, (key: PageBlockCoordinates, info: PageBlockInfo) => {
        console.log(`disposing ${JSON.stringify(key)} with ${JSON.stringify(info)}`);
      },
    );
  }

  public registerToCache(position: VoxelCoordinates) {
    console.log('registrin');
  }

  /*
   *public isCached(position: VoxelCoordinates): boolean {
   *  let voxelBlock = this.toVoxelBlock(position);
   *  return this.voxelBlockLRU.has(
   *}
   */

  /* tslint:disable:no-bitwise */
  public toPageBlockCoordinates(coordinates: VoxelCoordinates): PageBlockCoordinates {
    return <PageBlockCoordinates> {
      x: coordinates.x >> this.toPageBlockPower.x,
      y: coordinates.y >> this.toPageBlockPower.y,
      z: coordinates.z >> this.toPageBlockPower.z,
    };
  }

  /* tslint:disable:no-bitwise */
  public toVoxelBlockCoordinates(voxelCoordinates: VoxelCoordinates): VoxelBlockCoordinates {
    return <VoxelBlockCoordinates> {
      x: voxelCoordinates.x >> this.toVoxelBlockPower.x,
      y: voxelCoordinates.y >> this.toVoxelBlockPower.y,
      z: voxelCoordinates.z >> this.toVoxelBlockPower.z,
    };
  }

}
