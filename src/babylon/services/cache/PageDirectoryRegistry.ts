import { HashStringMap } from './map/HashMap';
import * as Vec3Simple from '../Vec3Simple';
import CacheConfig from './CacheConfig';
import { CacheDelta } from './CacheRegistry';

import {
  MapState, SizeCache,
  PageBlockCoordinates, PageTableCacheBlockCoordinates,
  PageDirectoryScale,
} from './CacheTypes';

export default function createPageDirectoryRegistry(config: CacheConfig) {
    let size = Vec3Simple.divide<SizeCache<PageDirectoryScale>>(
      config.datasetSize, Vec3Simple.multiply(config.voxelBlockSize, config.pageBlockSize));
    let map = new HashStringMap<PageBlockCoordinates, PageDirectoryEntry>({ toHash: Vec3Simple.stringify });
    return new PageDirectoryRegistry(map, size);
}

export interface PageDirectoryEntry {
  status: MapState;
  CacheCoordinates?: PageTableCacheBlockCoordinates;
}

/*
 * The PageDirectory keeps track of which page blocks are mapped in the cached and at what location within the page
 * table cache.
 *
 */
export class PageDirectoryRegistry {

  constructor(public readonly map: HashStringMap<PageBlockCoordinates, PageDirectoryEntry>,
              public readonly datasetSize: SizeCache<PageDirectoryScale>) {}

  public markEmpty(pageBlockCoordinates: PageBlockCoordinates): CacheDelta {
    this.map.set(pageBlockCoordinates, { status: MapState.Empty });
    return { pageDirectory: [ pageBlockCoordinates, MapState.Empty ] };
  }

  public isEmpty(pageBlockCoordinates: PageBlockCoordinates): boolean {
    let entry = this.map.get(pageBlockCoordinates);
    return entry !== undefined && entry.status === MapState.Empty;
  }
}

