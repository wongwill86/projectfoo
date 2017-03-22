import * as Vec3Simple from './Vec3Simple';

/*
 * Although it'll be safer to use classes with guard variables, using object literals are necessary to achieve
 * good performance, i.e. we want to perform over 1920x1080 constructions per 16ms
 */

/*
 * Generic Size for x,y,z
 */
export interface Size extends Vec3Simple.Vec3 {
  readonly _size_guard: boolean;
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

/*
 * Generic Size but in power
 */
export interface SizePower extends Vec3Simple.Vec3 {
  readonly _size_power_guard: boolean;
}

/*
 * Coordinates for an individual voxel in the entire dataset
 */
export interface VoxelCoordinates extends Vec3Simple.Vec3 {
  readonly _voxel_coordinates_guard: boolean;
}

/*
 * Coordinates for a voxel block in the entire dataset
 */
export interface VoxelBlockCoordinates extends Vec3Simple.Vec3 {
  readonly _voxel_block_coordinates_guard: boolean;
}

/*
 * Coordinates for a page table in the entire dataset
 */
export interface PageBlockCoordinates extends Vec3Simple.Vec3 {
  readonly _page_block_coordinates_guard: boolean;
}

/*
 * Block coordinates within the voxel cache
 */
export interface VoxelCacheBlock extends Vec3Simple.Vec3 {
  readonly _voxel_cache_block_guard: boolean;
}

/*
 * Block coordinates within the page table
 */
export interface PageTableBlock extends Vec3Simple.Vec3 {
  readonly _page_table_block_guard: boolean;
}

export interface BlockInfo<T> {
  block: T;
}

export interface VoxelBlockInfo extends BlockInfo<VoxelCacheBlock> {
  pageTableBlock: PageTableBlock;
}

export interface PageBlockInfo extends BlockInfo<PageTableBlock> {
  size: number;
}
