import * as Vec3Simple from '../Vec3Simple';
import { HashStringMap } from '../map/HashMap';
import { default as createPageVoxelRegistry, PageVoxelRegistry } from './PageVoxelRegistry';
import { default as createPageDirectoryRegistry, PageDirectoryRegistry } from './PageDirectoryRegistry';
import CacheConfig from './CacheConfig';
import {
  MapState,
  SizeWorld,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlockCoordinates, PageTableCacheBlockCoordinates,
  VoxelScale, VoxelBlockScale, PageBlockScale,
} from './CacheTypes';


export interface CacheDelta {
  addedVoxelCache?: [VoxelCacheBlockCoordinates, VoxelBlockCoordinates];
  addedPageTable?: [PageTableCacheBlockCoordinates, [VoxelCacheBlockCoordinates, VoxelBlockCoordinates]];
  removedVoxelCache?: VoxelCacheBlockCoordinates[];
  removedPageTable?: [PageTableCacheBlockCoordinates, VoxelBlockCoordinates | MapState][];
  pageDirectory?: [PageBlockCoordinates, MapState];
}

export default function createCacheRegistry(config: CacheConfig): CacheRegistry {
  /*
   * pageTableSize: SizeWorld<PageBlockScale>,
   *                                 voxelCacheSize: SizeWorld<VoxelBlockScale>,
   *                                 pageBlockSize: SizeWorld<PageBlockScale>,
   *                                 voxelBlockSize: SizeWorld<VoxelBlockScale>,
   *                                 datasetSize: SizeWorld<VoxelScale>): CacheRegistry {
   */

  let lruRegistry = createPageVoxelRegistry(config);
  let pageDirectoryRegistry = createPageDirectoryRegistry(config);

  return new CacheRegistry(lruRegistry, pageDirectoryRegistry);
}

export class CacheRegistry {
  constructor(public readonly pageVoxelRegistry: PageVoxelRegistry,
              public readonly pageDirectoryRegistry: PageDirectoryRegistry) {}

  public access(pageBlockCoordinates: PageBlockCoordinates, voxelBlockCoordinates: VoxelBlockCoordinates): CacheDelta {
    // check if this is empty space defined in the page directory
    if (this.pageDirectoryRegistry.isEmpty(pageBlockCoordinates) ||
        this.pageVoxelRegistry.isEmpty(pageBlockCoordinates, voxelBlockCoordinates)) {
      return {};
    }

    // this is not empty, requires update
    return this.pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);
  }

  public markEmptyPageBlock(pageBlockCoordinates: PageBlockCoordinates) : CacheDelta {
    return Object.assign(this.pageVoxelRegistry.markEmptyPageBlock(pageBlockCoordinates),
                         this.pageDirectoryRegistry.markEmpty(pageBlockCoordinates));
  }

  public markEmptyVoxelBlock(voxelBlockCoordinates: VoxelBlockCoordinates) {
  }

}
