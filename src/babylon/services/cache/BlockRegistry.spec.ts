import { default as createBlockRegistry } from './BlockRegistry';
import * as Vec3Simple from '../Vec3Simple';
import { SizeCache, VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelCacheInfo,
  VoxelBlockScale }
from './types/CacheTypes';

/*
 * Arbitrary fake update function that doubles the page block coordinates of we are updating, otherwise set it to 1,1,1
 */
const createInfo = (info?: VoxelCacheInfo): VoxelCacheInfo => {
  if (info === undefined) {
    return { pageBlockCoordinates: { x: 1, y: 1, z: 1 } } as VoxelCacheInfo;
  } else {
    return { pageBlockCoordinates: Vec3Simple.add(info.pageBlockCoordinates, info.pageBlockCoordinates),
    } as VoxelCacheInfo;
  }
};

test('Initializes with correct amount of free blocks', () => {
  let dim = 4;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache<VoxelBlockScale>);
  expect(registry.numberFreeBlocks).toBe(4 ** 3);
});

test('Values are set from free blocks and can be retrieved via \'get\' and \'find\'', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache<VoxelBlockScale>);
  let coordinates = Vec3Simple.Vec3(1) as VoxelBlockCoordinates;
  registry.set(coordinates, createInfo);
  expect(registry.get(coordinates)).not.toBeUndefined();
  expect(registry.find(coordinates)).not.toBeUndefined();
});

test('Values are shifted out of free memory correctly and the create function is correctly called', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache<VoxelBlockScale>);
  // Use up all blocks
  let firstCoordinates = Vec3Simple.Vec3(0) as VoxelBlockCoordinates;
  registry.set(firstCoordinates, createInfo);

  for (let i = 1; i < dim ** 3; i ++) {
    let coordinates = Vec3Simple.Vec3(i) as VoxelBlockCoordinates;
    registry.set(coordinates, createInfo);
  }
  expect(registry.numberFreeBlocks).toBe(0);

  // extract the block info generated from setting (i.e. the free block that was assigned);
  let firstBlock = registry.find(firstCoordinates);
  expect(firstBlock).not.toBeUndefined();
  expect(firstBlock!.info.pageBlockCoordinates).toMatchObject({ x: 1, y: 1, z: 1 });


  // add one more to shift out the first coordinate
  let coordinates = Vec3Simple.Vec3(8) as VoxelBlockCoordinates;
  let removedInfo = registry.set(coordinates, createInfo);
  expect(removedInfo!.info.pageBlockCoordinates).toMatchObject({ x: 1, y: 1, z: 1 });

  // ensure that the blockInfo for the stored block is a new updated one
  let storedInfo = registry.find(coordinates);
  expect(storedInfo).not.toBeUndefined();
  expect(storedInfo!.info.pageBlockCoordinates).toMatchObject({ x: 1, y: 1, z: 1 });
});

test('Info is updated when key is called/touched for LRU', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache<VoxelBlockScale>);
  // Use up all blocks
  let firstCoordinates = Vec3Simple.Vec3(0) as VoxelBlockCoordinates;
  registry.set(firstCoordinates, createInfo);

  // set again to touch update LRU
  registry.set(firstCoordinates, createInfo);

  // extract the block info generated from setting (i.e. the free block that was assigned);
  let firstBlock = registry.find(firstCoordinates);
  expect(firstBlock).not.toBeUndefined();
  expect(firstBlock!.info.pageBlockCoordinates).toMatchObject({ x: 2, y: 2, z: 2 });

});

test('No data is created when createInfo is not specified', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache<VoxelBlockScale>);
  // Use up all blocks
  let firstCoordinates = Vec3Simple.Vec3(0) as VoxelBlockCoordinates;
  registry.set(firstCoordinates);

  expect(registry.numberRegisteredBlocks).toBe(0);
});
