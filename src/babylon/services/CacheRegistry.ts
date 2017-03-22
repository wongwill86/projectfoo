import * as Vec3Simple from './Vec3Simple';
import { default as createBlockRegistry, BlockRegistry } from './BlockRegistry';
import { Size, SizePower, SizeBlock, toPowerTwo,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlock, PageTableBlock,
  VoxelBlockInfo, PageBlockInfo,
  VoxelBlockScale, PageBlockScale,
} from './CacheTypes';

/*
 *export default function createCacheRegistry(): CacheRegistry {
 *
 *}
 */
export default class CacheRegistry {
  public readonly voxelBlockLRU: BlockRegistry<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo, VoxelBlockScale>;
  public readonly pageTableLRU: BlockRegistry<PageBlockCoordinates, PageTableBlock, PageBlockInfo, PageBlockScale>;

  private toVoxelBlockPower: SizePower;
  private toPageBlockPower: SizePower;

  constructor(public readonly pageDirectorySize: Size, public readonly pageTableSize: Size,
              public readonly voxelCacheSize: Size, public readonly pageBlockSize: Size,
              public readonly voxelBlockSize: Size) {
    // TODO verify all sizes are powers of 2!
    // TODO verify pagetableblocksize actually fits in page table size!

    this.toVoxelBlockPower = toPowerTwo(voxelBlockSize);
    this.toPageBlockPower = Vec3Simple.add(this.toVoxelBlockPower, toPowerTwo(pageBlockSize));

    this.voxelBlockLRU = createBlockRegistry<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo, VoxelBlockScale>(
      Vec3Simple.divide(voxelCacheSize, voxelBlockSize) as SizeBlock);
    this.pageTableLRU = createBlockRegistry<PageBlockCoordinates, PageTableBlock, PageBlockInfo, PageBlockScale>(
      Vec3Simple.divide(pageTableSize, pageBlockSize) as SizeBlock);
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
