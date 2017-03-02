import * as React from 'react';
import * as BABYLON from 'babylonjs';
import DatasetParser from '../tools/data/DatasetParser';
import fragmentShader from '../shaders/dvr.fragment.glsl';
import vertexShader from '../shaders/dvr.vertex.glsl';

export interface SceneProps {
  width: number;
  height: number;
  canvasId: string;
}

export interface SceneState {
}

export default class Scene extends React.Component<SceneProps, SceneState> {
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

  private dataset = {
    dimensions: new BABYLON.Vector3(256, 256, 256),
    resolution: new BABYLON.Vector3(16.5, 16.5, 23.0),
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

    let canvas =
      document.getElementById(this.props.canvasId) as HTMLCanvasElement;

    if (!canvas) {
      return;
    }

    this.engine = new BABYLON.Engine(canvas, options.antialias,
                                     options, false);
    this.materials = new Map<String, BABYLON.ShaderMaterial>();
    this.gl = this.engine._gl as WebGL2RenderingContext;
    this.canvas = canvas;

    this.createScene();

    this.engine.runRenderLoop(() => {
      this.scene.render();
      this.updateCamera();
    });

  }

  public createScene(): void {

    // Scene
    this.scene = new BABYLON.Scene(this.engine);

    // Camera
    this.camera = new BABYLON.ArcRotateCamera(
      'EyeCamera', 0.0, 0.0, 0.0, BABYLON.Vector3.Zero(), this.scene);
    this.camera.setPosition(new BABYLON.Vector3(0.0, 0.0, -1.0));
    this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
    this.camera.fov = Math.PI / 4.0;
    this.camera.attachControl(this.canvas, false, true);
    this.camera.maxZ = 1000.0;
    this.camera.minZ = 0.01;
    this.camera.wheelPrecision = 100.0;

    // Dataset
    const physicalExtent =
      this.dataset.dimensions.multiply(this.dataset.resolution);
    const maxExtent = Math.max(physicalExtent.x,
                               Math.max(physicalExtent.y, physicalExtent.z));
    const distort = new BABYLON.Vector3(
      maxExtent, maxExtent, maxExtent).divide(physicalExtent);

    // Textures + Uniforms
    const cubeTex = new BABYLON.Texture(
      'datasets/e2198.raw', this.scene, true, false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE, undefined, undefined, undefined,
      false, undefined, DatasetParser);

    // Shader Materials
    let shaderStore = BABYLON.Effect.ShadersStore as {[id: string]: string};
    shaderStore.dvrVertexShader = vertexShader.trim();
    shaderStore.dvrPixelShader = fragmentShader.trim();

    let frontplaneMaterial: BABYLON.ShaderMaterial =
      new BABYLON.ShaderMaterial('singlePass', this.scene, 'dvr', {
        needAlphaBlending: true,
        attributes: ['uv'],
        uniforms: ['view', 'worldViewProjection'],
    });
    frontplaneMaterial.setVector3('distortionCorrection', distort);
    // TODO: Could read that from perspective matrix in Shader...
    frontplaneMaterial.setFloat('fovy', this.camera.fov);
    frontplaneMaterial.setTexture('cubeTex', cubeTex);
    this.materials.set('singlePass', frontplaneMaterial);

    // Mesh
    const frontplane = BABYLON.MeshBuilder.CreatePlane(
      'billboard', { size: 1.0 }, this.scene);
    frontplane.position = new BABYLON.Vector3(0.0, 0.0, 0.0);
    frontplane.material = frontplaneMaterial;
  }

  public componentWillUnmount() {
    this.engine.stopRenderLoop();
    if (this.engine.scenes.length !== 0) {
      while (this.engine.scenes.length > 0) {
        this.engine.scenes[0].dispose();
      }
    }
    this.engine.dispose();
  }

  render() {
    return <div>
              <canvas
                height={this.props.height} width={this.props.width}
                id={this.props.canvasId}/>
          </div>;
  };
}
