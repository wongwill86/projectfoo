export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function Vec3(s: number): Vec3 { return {x: s, y: s, z: s}; };

export const stringify = (vec3: Vec3) => JSON.stringify(vec3, ['x', 'y', 'z']);

export function add<T extends Vec3>(a: T, b: T) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z } as T;
}

export function subtract<T extends Vec3>(a: T, b: T) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } as T;
}

export function divide<T extends Vec3>(a: T, b: T) {
  return { x: a.x / b.x, y: a.y / b.y, z: a.z / b.z } as T;
}

export function multiply<T extends Vec3>(a: T, b: T) {
  return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z } as T;
}

export function strip <T extends Vec3>(vec3: T): Vec3 {
  return { x: vec3.x, y: vec3.y, z: vec3.z };
}
