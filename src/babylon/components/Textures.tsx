import BABYLON from 'babylonjs';

export class VoxelCacheTexture extends BABYLON.CustomTexture {
  constructor(name: string, scene: BABYLON.Scene) {
    let gl = scene.getEngine()._gl as WebGL2RenderingContext;
    let options: BABYLON.CustomTextureOptions = {
      width: 512,
      height: 512,
      depth: 512,
      level: 0,
      internalFormat: gl.R16UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_SHORT,
    };
    super(name, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, options);
    this.update(null);
  }
}
export class PageTableTexture extends BABYLON.CustomTexture {
  constructor(name: string, scene: BABYLON.Scene) {
    let gl = scene.getEngine()._gl as WebGL2RenderingContext;
    let options: BABYLON.CustomTextureOptions = {
      width: 512,
      height: 512,
      depth: 512,
      level: 0,
      internalFormat: gl.RGBA8UI,
      format: gl.RGBA_INTEGER,
      type: gl.UNSIGNED_BYTE,
    };
    super(name, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, options);
    this.update(null);
  }
}

export class PageDirectoryTexture extends BABYLON.CustomTexture {
  constructor(name: string, scene: BABYLON.Scene) {
    let gl = scene.getEngine()._gl as WebGL2RenderingContext;
    let options: BABYLON.CustomTextureOptions = {
      width: 4,
      height: 4,
      depth: 4,
      level: 0,
      internalFormat: gl.RGBA8UI,
      format: gl.RGBA_INTEGER,
      type: gl.UNSIGNED_BYTE,
    };
    super(name, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, options);
    this.update(null);
  }
}

export class ScreenTexture extends BABYLON.CustomTexture {
  constructor(name: string, scene: BABYLON.Scene, options: BABYLON.CustomTextureOptions) {
    super(name, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, options);
    this.isRenderTarget = true;
    this.coordinatesMode = BABYLON.Texture.PROJECTION_MODE;
    let gl = this.getScene().getEngine()._gl as WebGL2RenderingContext;

    if (options.type === gl.FLOAT) {
      this._texture.type = BABYLON.Engine.TEXTURETYPE_FLOAT;
    } else if (options.type === gl.UNSIGNED_BYTE || options.type === gl.UNSIGNED_SHORT ||
               options.type === gl.UNSIGNED_INT) {
      this._texture.type = BABYLON.Engine.TEXTURETYPE_UNSIGNED_INT;
    }
    this.update(undefined);
  }
}
