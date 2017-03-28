import { default as createBlockRegistry } from './BlockRegistry';
import * as Vec3Simple from './Vec3Simple';
import { SizeCache, VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelCacheInfo,
  VoxelBlockScale }
from './CacheTypes';

/*
 * Arbitrary fake update function that doubles the page block coordinates of we are updating, otherwise set it to 1,1,1
 */
const createData = (block?: VoxelCacheBlock): VoxelCacheInfo => {
  if (block === undefined) {
    return { pageBlockCoordinates: { x: 1, y: 1, z: 1 } } as VoxelCacheInfo;
  } else {
    return { pageBlockCoordinates: Vec3Simple.add(block.data.pageBlockCoordinates, block.data.pageBlockCoordinates),
    } as VoxelCacheInfo;
  }
};

test('Initializes with correct amount of free blocks', () => {
  let dim = 4;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache);
  expect(registry.numberFreeBlocks).toBe(4 ** 3);
});

test('Values are set and can be retrieved', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache);
  let lru = registry.lru;
  let coordinates = Vec3Simple.Vec3(1) as VoxelBlockCoordinates;
  registry.set(coordinates, createData);
  expect(lru.has(coordinates)).toBeTruthy();
  expect(registry.get(coordinates)).not.toBeUndefined();
});

test('Values are shifted out of free memory correctly and the update function is correctly called', () => {
  let dim = 2;
  let registry = createBlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
    Vec3Simple.Vec3(dim) as SizeCache);
  let lru = registry.lru;
  // Use up all blocks
  let firstCoordinates = Vec3Simple.Vec3(0) as VoxelBlockCoordinates;
  registry.set(firstCoordinates, createData);

  for (let i = 1; i < dim ** 3; i ++) {
    let coordinates = Vec3Simple.Vec3(i) as VoxelBlockCoordinates;
    registry.set(coordinates, createData);
  }
  expect(registry.numberFreeBlocks).toBe(0);

  // extract the block info generated from setting (i.e. the free block that was assigned);
  let firstInfo = lru.find(firstCoordinates);
  expect(firstInfo).not.toBeUndefined();
  expect(firstInfo!.data.pageBlockCoordinates).toMatchObject({ x: 1, y: 1, z: 1 });


  // add one more to shift out the first coordinate
  let coordinates = Vec3Simple.Vec3(8) as VoxelBlockCoordinates;
  let removedInfo = registry.set(coordinates, createData);
  expect(removedInfo!.data.pageBlockCoordinates).toMatchObject({ x: 1, y: 1, z: 1 });

  // ensure that the blockInfo for the stored block is a new updated one
  let storedInfo = registry.find(coordinates);
  expect(storedInfo).not.toBeUndefined();
  expect(storedInfo!.data.pageBlockCoordinates).toMatchObject({ x: 2, y: 2, z: 2 });
});
