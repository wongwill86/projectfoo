import React from 'react';
import BABYLON from 'babylonjs';
import fragmentShader from '../shaders/dvr.fragment.glsl';
import vertexShader from '../shaders/dvr.vertex.glsl';
import composeFragmentShader from '../shaders/compose.fragment.glsl';
import { VoxelCacheTexture, PageTableTexture, PageDirectoryTexture, ScreenTexture } from './Textures';

export interface SceneProps {
  width: number;
  height: number;
  canvasId: string;
}

export interface SceneState {
}

export default class Scene extends React.Component<SceneProps, SceneState> {
  static readonly VOXEL_BLOCK_SIZE: number = 32;
  static readonly VOXEL_BLOCK_SIZE_BITS: number = Math.log2(Scene.VOXEL_BLOCK_SIZE);

  public static propTypes = {
    width: React.PropTypes.number.isRequired,
    height: React.PropTypes.number.isRequired,
    canvasId: React.PropTypes.string,
  };

  public canvas: HTMLCanvasElement;
  public engine: BABYLON.Engine;
  public scene: BABYLON.Scene;
  public camera: BABYLON.ArcRotateCamera;
  public materials: Map<String, BABYLON.ShaderMaterial>;
  public gl: WebGL2RenderingContext;
  public pageDirectory: PageDirectoryTexture;
  public pageTable: PageTableTexture;
  public voxelCache: VoxelCacheTexture;
  public cacheState: BABYLON.Texture;
  public framebuffer: WebGLFramebuffer;

  private cacheBuffer: Uint32Array;

  private dataset = {
    dimensions: new BABYLON.Vector3(4096, 4096, 4096),
    resolution: new BABYLON.Vector3(6, 6, 30.0),
  };

  public updateCamera(): void {
    if (this.camera.radius < 0.01) {
      this.camera.radius = 0.01;
    } else if (this.camera.radius > 1000.0) {
      this.camera.radius = 1000.0;
    }
  }

  public componentDidMount() {

    const options: { [id: string]: boolean; } = {
      'alpha': true,
      'depth': true,
      'stencil': false,
      'antialias': false,
      'failIfMajorPerformanceCaveat': true,
    };

    let canvas = document.getElementById(this.props.canvasId) as HTMLCanvasElement;

    if (!canvas) {
      return;
    }

    this.engine = new BABYLON.Engine(canvas, options.antialias, options, false);
    this.materials = new Map<String, BABYLON.ShaderMaterial>();
    this.gl = this.engine._gl as WebGL2RenderingContext;
    this.canvas = canvas;

    this.createScene();
    this.cacheBuffer = new Uint32Array(this.canvas.width * this.canvas.height * 4);

    this.engine.runRenderLoop(() => {
      this.scene.render();
      this.updateCamera();
    });
    setTimeout(() => {
      console.log('Updating cache');
      this.updateCacheBuffer();
      this.fetchMisses(this.aggregateMisses());
    }, 5000);
  }

  public createScene(): void {
    // Scene
    this.scene = new BABYLON.Scene(this.engine);

    // Camera
    this.camera = new BABYLON.ArcRotateCamera('EyeCamera', 0.0, 0.0, 0.0, BABYLON.Vector3.Zero(), this.scene);
    this.camera.setPosition(new BABYLON.Vector3(0.0, 0.0, -1.0));
    this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
    this.camera.fov = Math.PI / 4.0;
    this.camera.attachControl(this.canvas, false, true);
    this.camera.maxZ = 1000.0;
    this.camera.minZ = 0.01;
    this.camera.wheelPrecision = 100.0;

    // Dataset
    const physicalExtent = this.dataset.dimensions.multiply(this.dataset.resolution);
    const maxExtent = Math.max(physicalExtent.x, Math.max(physicalExtent.y, physicalExtent.z));
    const distort = new BABYLON.Vector3(maxExtent, maxExtent, maxExtent).divide(physicalExtent);

    // Shader Materials
    let shaderStore = BABYLON.Effect.ShadersStore as { [id: string]: string };
    shaderStore.dvrVertexShader = vertexShader.trim();
    shaderStore.dvrPixelShader = fragmentShader.trim();

    let frontplaneMaterial: BABYLON.ShaderMaterial = new BABYLON.ShaderMaterial('singlePass', this.scene, 'dvr', {
      needAlphaBlending: true,
      attributes: ['uv'],
      uniforms: ['view', 'worldViewProjection'],
    });
    this.materials.set('singlePass', frontplaneMaterial);

    // Mesh
    const frontplane = BABYLON.MeshBuilder.CreatePlane('billboard', { size: 1.0 }, this.scene);
    frontplane.position = new BABYLON.Vector3(0.0, 0.0, 0.0);
    frontplane.material = frontplaneMaterial;

    // Textures + Framebuffers
    this.voxelCache = new VoxelCacheTexture('voxelCache', this.scene);
    this.pageTable = new PageTableTexture('pageTable', this.scene);
    this.pageDirectory = new PageDirectoryTexture('pageDirectory', this.scene);

    this.gl.activeTexture(this.gl.TEXTURE0);

    const segColorTex = new BABYLON.RenderTargetTexture('segColorTex',
      { width: this.canvas.width, height: this.canvas.height }, this.scene, false, true,
      BABYLON.Engine.TEXTURETYPE_UNSIGNED_INT, false, BABYLON.Texture.NEAREST_SAMPLINGMODE, false, false);

    this.gl.activeTexture(this.gl.TEXTURE1);
    const segIDTex = new ScreenTexture(
      'segIDTex', this.scene, {
        level: 0,
        width: this.canvas.width,
        height: this.canvas.height,
        internalFormat: this.gl.R32UI,
        format: this.gl.RED_INTEGER,
        type: this.gl.UNSIGNED_INT,
      });

    this.gl.activeTexture(this.gl.TEXTURE2);
    const depthTex = new ScreenTexture(
      'segDepthTex', this.scene, {
        level: 0,
        width: this.canvas.width,
        height: this.canvas.height,
        internalFormat: this.gl.RGBA32F,
        format: this.gl.RGBA,
        type: this.gl.FLOAT,
      });

    this.gl.activeTexture(this.gl.TEXTURE3);
    this.cacheState = new ScreenTexture(
      'cacheState', this.scene, {
        level: 0,
        width: this.canvas.width,
        height: this.canvas.height,
        internalFormat: this.gl.RGBA32UI,
        format: this.gl.RGBA_INTEGER,
        type: this.gl.UNSIGNED_INT,
      });

    this.gl.activeTexture(this.gl.TEXTURE0);

    this.framebuffer = segColorTex._texture._framebuffer;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT1, this.gl.TEXTURE_2D,
      segIDTex._texture, 0);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT2, this.gl.TEXTURE_2D,
      depthTex._texture, 0);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT3, this.gl.TEXTURE_2D,
      this.cacheState._texture, 0);

    this.gl.drawBuffers([
      this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1, this.gl.COLOR_ATTACHMENT2, this.gl.COLOR_ATTACHMENT3]);

    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer creation failed!');
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    segColorTex.onClear = (engine: BABYLON.Engine) => {
      this.gl.clearBufferfv(this.gl.COLOR, 0, [0.2, 0.2, 0.3, 1.0]); // segColorTex (Segment Color)
      this.gl.clearBufferuiv(this.gl.COLOR, 1, [0, 0, 0, 0]);        // segIDTex (Segment ID)
      this.gl.clearBufferfv(this.gl.COLOR, 2, [0.0, 0.0, 0.0, 0.0]); // depthTex (Segment Depth)
      this.gl.clearBufferuiv(this.gl.COLOR, 3, [0, 0, 0, 0]); // cacheState (miss/empty)
    };

    this.scene.customRenderTargets.push(segColorTex);
    segColorTex.renderList.push(frontplane);

    // Uniforms
    frontplaneMaterial.setVector3('distortionCorrection', distort);
    frontplaneMaterial.setFloat('fovy', this.camera.fov);
    frontplaneMaterial.setTexture('voxelCache', this.voxelCache);
    frontplaneMaterial.setTexture('pageTable', this.pageTable);
    frontplaneMaterial.setTexture('pageDirectory', this.pageDirectory);

    // Post Processes
    shaderStore.composePixelShader = composeFragmentShader.trim();
    const postProcess = new BABYLON.PostProcess('compose', 'compose', [],
                                                ['segColorTex', 'segIDTex', 'segDepthTex', 'cacheState'],
      1.0, this.camera, BABYLON.Texture.NEAREST_SAMPLINGMODE, this.engine, true);

    postProcess.onApply = (effect) => {
      effect.setTexture('segColorTex', segColorTex);
      effect.setTexture('segIDTex', segIDTex);
      effect.setTexture('segDepthTex', depthTex);
      effect.setTexture('cacheState', this.cacheState);
    };
  }

  public updateCacheBuffer(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) === this.gl.FRAMEBUFFER_COMPLETE) {
      this.gl.readBuffer(this.gl.COLOR_ATTACHMENT3);
      this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT,
                        this.cacheBuffer);
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

  }

  /* tslint:disable:no-bitwise */
  public aggregateMisses(): Map<string, number> {
    let cacheMisses: Map<string, number> = new Map<string, number>();
    for (let index = 0; index < this.cacheBuffer.length; index ++) {
      let x: number = this.cacheBuffer[index];
      let y: number = this.cacheBuffer[index + 1];
      let z: number = this.cacheBuffer[index + 2];
      let cacheAndLOD: number = this.cacheBuffer[index + 2];
      if (cacheAndLOD !== 0) {
        let key: string =
          (x >> Scene.VOXEL_BLOCK_SIZE_BITS).toString() +
          (y >> Scene.VOXEL_BLOCK_SIZE_BITS).toString() +
          (z >> Scene.VOXEL_BLOCK_SIZE_BITS).toString();
        cacheMisses.set(key, cacheAndLOD && 0x1F);
      }
    }
    return cacheMisses;
  }

  public fetchMisses(cacheMisses: Map<string, number>) {
    console.log('# cacheMisses!!! : ' + cacheMisses.size);
    cacheMisses.forEach((value: number, key: string, map: Map<string, number>) => {
      // console.log(`Missing cachLevel ${map.get(key)} at ${key}`);
    });
  }

  public componentWillUnmount() {
    this.engine.stopRenderLoop();
    if (this.engine.scenes.length !== 0) {
      while (this.engine.scenes.length > 0) {
        this.engine.scenes[0].dispose();
      }
    }
    this.engine.wipeCaches();
    this.engine.dispose();
  }

  render() {
    return <div>
      <canvas height={this.props.height} width={this.props.width} id={this.props.canvasId} />
    </div>;
  };
}
