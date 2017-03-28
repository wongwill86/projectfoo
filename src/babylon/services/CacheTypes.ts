import * as Vec3Simple from './Vec3Simple';
import { HashStringMap } from './map/HashMap';

/*
 * Although it'll be safer to use classes with guard variables, using object literals are necessary to achieve
 * good performance, i.e. we want to perform over 1920x1080 constructions per 16ms
 */

/*
 * Generic Size in x,y,z
 */
export interface Size extends Vec3Simple.Vec3 {
  readonly _size_guard: boolean;
}

/*
 * Extend this to indicate that the value in power terms
 */
export interface Power {
  readonly _power_guard: boolean;
}

/*
 * Extend this to indicate interface is in world space coordinates
 */
export interface WorldSpace {
  readonly _world_space_guard: boolean;
}

/*
 * Extend this to indicate interface is in cache space coordinates
 */
export interface CacheSpace {
  readonly _cache_space_guard: boolean;
}

/*
 * Indicates this is a scaled inteface
 */
export interface Scaled<T extends Scale> {
  readonly _scale_specific_guard: T;
}

/*
 * Identify a scaled interface
 */
export interface Scale {
  readonly _scale_guard: boolean;
}

/*
 * Extend this to indicate interface is in voxel scale
 */
export interface VoxelScale extends Scale {
  readonly _voxel_scale_guard: boolean;
}

/*
 * Extend this to indicate this is in voxel block scale
 */
export interface VoxelBlockScale extends Scale {
  readonly _voxel_block_scale_guard: boolean;
}

/*
 * Extend this to indicate this is page block scale
 */
export interface PageBlockScale extends Scale {
  readonly _page_block_scale__guard: boolean;
}

/*
 * Size in power of two
 */
export interface SizePower extends Vec3Simple.Vec3, Size, Power {
}

/*
 * Size in terms of voxels in world space
 */
export interface SizeWorld extends Size, WorldSpace {
}

/*
 * Size in terms of number of blocks within a cache
 */
export interface SizeCache extends Size, CacheSpace {
}

/*
 * Interfaces for size in world or size in cache blocks
 */
export interface PageBlockSize extends SizeCache, Scaled<PageBlockScale> {
}

export interface VoxelBlockSize extends SizeCache, Scaled<VoxelBlockScale> {
}

export interface PageTableSize extends SizeWorld, Scaled<PageBlockScale> {
}

export interface VoxelCacheSize extends SizeWorld, Scaled<VoxelBlockScale> {
}

/*
 * Interfaces to describe coordinates
 */
export interface WorldCoordinates extends Vec3Simple.Vec3, WorldSpace {
}

export interface CacheCoordinates extends Vec3Simple.Vec3, CacheSpace {
}

/*
 * Coordinates for an individual voxel in the entire dataset
 */
export interface VoxelCoordinates extends WorldCoordinates, Scaled<VoxelScale> {
}

/*
 * Coordinates for a voxel block in the entire dataset
 */
export interface VoxelBlockCoordinates extends WorldCoordinates, Scaled<VoxelBlockScale> {
}

/*
 * Coordinates for a page table in the entire dataset
 */
export interface PageBlockCoordinates extends WorldCoordinates, Scaled<PageBlockScale> {
}

/*
 * Block coordinates within the voxel cache
 */
export interface VoxelCacheBlockCoordinates extends CacheCoordinates, Scaled<VoxelBlockScale> {
}

/*
 * Block coordinates within the page table
 */
export interface PageTableCacheBlockCoordinates extends CacheCoordinates, Scaled<PageBlockScale> {
}

export interface CacheBlock<U extends CacheCoordinates, V extends CacheInfo<S>, S extends Scale> {
  block: U;
  data: V;
}

export interface VoxelCacheBlock extends
  CacheBlock<VoxelCacheBlockCoordinates, VoxelCacheInfo, VoxelBlockScale> {}
export interface PageTableCacheBlock extends
  CacheBlock<PageTableCacheBlockCoordinates, PageTableInfo, PageBlockScale> {}

export interface CacheInfo<S extends Scale> extends Scaled<S> {
  readonly cache_info_guard: boolean;
}

export interface VoxelCacheInfo extends CacheInfo<VoxelBlockScale> {
  pageBlockCoordinates: PageBlockCoordinates;
}

export interface PageTableInfo extends CacheInfo<PageBlockScale> {
  mappedVoxelBlockCoordinates: HashStringMap<VoxelBlockCoordinates, boolean>;
}

/*
 *[> tslint:disable:no-bitwise <]
 *function isPowerTwo(val: number): boolean {
 *  return (val & (val - 1)) === 0;
 *}
 */
export function toPowerTwo(size: Size): SizePower {
  return {
    x: Math.log2(size.x),
    y: Math.log2(size.y),
    z: Math.log2(size.z),
  } as SizePower;
}
