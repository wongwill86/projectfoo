import { default as createBlockRegistry } from './BlockRegistry';
import * as Vec3Simple from './Vec3Simple';
import { SizeBlock, VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo } from './CacheTypes';

const basicCreateInfo = (coordinates: VoxelBlockCoordinates, block: VoxelCacheBlock) => <VoxelBlockInfo>{ block };

test('Initializes with correct amount of free blocks', () => {
  let dim = 4;
  let registry = createBlockRegistry<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>(
    Vec3Simple.Vec3(dim) as SizeBlock);
  expect(registry.numberFreeBlocks).toBe(4 ** 3);
});

test('Values are set and can be retrieved', () => {
  let dim = 2;
  let registry = createBlockRegistry<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>(
    Vec3Simple.Vec3(dim) as SizeBlock);
  let lru = registry.lru;
  let coordinates = Vec3Simple.Vec3(1) as VoxelBlockCoordinates;
  registry.set(coordinates, basicCreateInfo);
  expect(lru.has(coordinates)).toBeTruthy();
  expect(registry.get(coordinates)).not.toBeUndefined();
});

test('Values are shifted out', () => {
  let dim = 2;
  let registry = createBlockRegistry<VoxelBlockCoordinates, VoxelCacheBlock, VoxelBlockInfo>(
    Vec3Simple.Vec3(dim) as SizeBlock);
  let lru = registry.lru;
  // Use up all blocks
  let firstCoordinates = Vec3Simple.Vec3(0) as VoxelBlockCoordinates;
  registry.set(firstCoordinates, basicCreateInfo);

  for (let i = 1; i < dim ** 3; i ++) {
    let coordinates = Vec3Simple.Vec3(i) as VoxelBlockCoordinates;
    registry.set(coordinates, basicCreateInfo);
  }
  expect(registry.numberFreeBlocks).toBe(0);

  // extract the block info generated from setting (i.e. the free block that was assigned);
  let firstInfo = lru.find(firstCoordinates);
  expect(firstInfo).not.toBeUndefined();

  // add one more to shift out the first coordinate
  let coordinates = Vec3Simple.Vec3(8) as VoxelBlockCoordinates;
  let removedInfo = registry.set(coordinates, basicCreateInfo);
  expect(removedInfo).toBe(firstInfo);
});
