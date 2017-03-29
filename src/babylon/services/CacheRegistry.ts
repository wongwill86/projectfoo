import * as Vec3Simple from './Vec3Simple';
import { HashStringMap } from './map/HashMap';
import { default as createBlockRegistry, BlockRegistry } from './BlockRegistry';
import { SizeWorld, SizePower, toPowerTwo,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlockCoordinates, PageTableCacheBlockCoordinates,
  VoxelCacheBlock, PageTableCacheBlock,
  VoxelCacheInfo, PageTableInfo,
  VoxelBlockScale, PageBlockScale,
} from './CacheTypes';


/*
 *export default function createCacheRegistry(): CacheRegistry {
 *
 *}
 */
export default class CacheRegistry {
  public readonly voxelBlockLRU: BlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>;
  public readonly pageTableLRU: BlockRegistry<
    PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>;

  private toVoxelBlockPower: SizePower;
  private toPageBlockPower: SizePower;

  public static getVoxelCreateInfoFunction = (pageBlockCoordinates: PageBlockCoordinates,
                                              voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info?: VoxelCacheInfo): VoxelCacheInfo => ({ pageBlockCoordinates, voxelBlockCoordinates } as VoxelCacheInfo);

  public static getPageCreateInfoFunction = (voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info: PageTableInfo = {} as PageTableInfo): PageTableInfo => {
      let mappedVoxelBlockCoordinates: HashStringMap<VoxelBlockCoordinates, boolean>;

      if (info.mappedVoxelBlockCoordinates === undefined) {
        mappedVoxelBlockCoordinates = new HashStringMap<VoxelBlockCoordinates, boolean>();
      } else {
        mappedVoxelBlockCoordinates = info.mappedVoxelBlockCoordinates;
      }

      mappedVoxelBlockCoordinates.set(voxelBlockCoordinates, true);

      return { mappedVoxelBlockCoordinates } as PageTableInfo;
    }

  constructor(public readonly pageTableSize: SizeWorld, public readonly voxelCacheSize: SizeWorld,
              public readonly pageBlockSize: SizeWorld, public readonly voxelBlockSize: SizeWorld) {
    // TODO verify all sizes are powers of 2!
    // TODO verify pagetableblocksize actually fits in page table size!

    this.toVoxelBlockPower = toPowerTwo(voxelBlockSize);
    this.toPageBlockPower = Vec3Simple.add(this.toVoxelBlockPower, toPowerTwo(pageBlockSize));

    this.voxelBlockLRU = createBlockRegistry<
      VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
      voxelCacheSize, voxelBlockSize);
    this.pageTableLRU = createBlockRegistry<
      PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>(
      pageTableSize, pageBlockSize);
  }

  public registerToCache(position: VoxelCoordinates) {
    let voxelBlockCoordinates = this.toVoxelBlockCoordinates(position);
    let pageBlockCoordinates = this.toPageBlockCoordinates(position);

    let voxelCreateInfoFunction = CacheRegistry.getVoxelCreateInfoFunction(pageBlockCoordinates, voxelBlockCoordinates);
    let pageCreateInfoFunction = CacheRegistry.getPageCreateInfoFunction(voxelBlockCoordinates);

    let oldVoxelCacheBlock = this.voxelBlockLRU.set(voxelBlockCoordinates, voxelCreateInfoFunction);
    let oldPageTableCacheBlock = this.pageTableLRU.set(pageBlockCoordinates, pageCreateInfoFunction);

    // We had replaced an existing voxel block, try to remove it from the page table cache
    if (oldVoxelCacheBlock !== undefined) {
      let updatePageTable = this.pageTableLRU.find(oldVoxelCacheBlock.info.pageBlockCoordinates);
      // the page table already have been displaced by thhe page table cache
      if (updatePageTable !== undefined) {
        updatePageTable.info.mappedVoxelBlockCoordinates.delete(oldVoxelCacheBlock.info.voxelBlockCoordinates);
      } /* else {
        console.error('This should not happen, cache hit in voxel block but miss in page Table!')
      } */
    }

    // We had replaced an existing page table, try to remove all voxel blocks stored in there
    if (oldPageTableCacheBlock !== undefined) {
      // iterator requires tsconfig downlevelIteration, but only available in TS nightly currently (TS > 2.2)
      // for (let oldVoxelBlockCoordinates of oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys()) {
      let iterable =  oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys();
      for (let iterValue = iterable.next(); !iterValue.done; iterValue = iterable.next()) {
        this.voxelBlockLRU.delete(iterValue.value);
      }
    }
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
