import LRUCoordinator from './LRUCoordinator';
import * as Vec3Simple from './Vec3Simple';
import { Size, VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo } from './CacheTypes';

/* tslint:disable:no-empty */
const emptyDispose = (k: any, v: any) => {};

test('Initializes with correct amount of free blocks', () => {
  let coordinator = new  LRUCoordinator<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>(
    Vec3Simple.Vec3(4) as Size, emptyDispose);
  expect(coordinator.numberFreeBlocks).toBe(4 ** 3);
  expect(coordinator.loadFactor).toBe(0);
});
