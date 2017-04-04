export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function Vec3(s: number): Vec3 { return {x: s, y: s, z: s}; };

export const stringify = (vec3: Vec3) => `${vec3.x}${vec3.y}${vec3.z}`;

export function add<T extends Vec3>(a: Vec3, b: Vec3) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z } as T;
}

export function subtract<T extends Vec3>(a: Vec3, b: Vec3) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } as T;
}

export function divide<T extends Vec3>(a: Vec3, b: Vec3) {
  return { x: a.x / b.x, y: a.y / b.y, z: a.z / b.z } as T;
}

export function multiply<T extends Vec3>(a: Vec3, b: Vec3) {
  return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z } as T;
}

export function strip(vec3: Vec3): Vec3 {
  return { x: vec3.x, y: vec3.y, z: vec3.z };
}
