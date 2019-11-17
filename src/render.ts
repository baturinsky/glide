import * as twgl from "./twgl/twgl-full.js";
import {
  m4,
  BufferInfo,
  FramebufferInfo,
  ProgramInfo,
  VertexArrayInfo,
  v3
} from "./twgl/twgl-full";

import { loadText, loadFile } from "./util";
import { Vec3 } from "./twgl/v3.js";
import { Mat4 } from "./twgl/m4.js";

type PassInfo = {
  programs: [string, string];
  programInfo?: ProgramInfo;
  source?: BufferInfo | VertexArrayInfo;
  target?: FramebufferInfo;
  overwrite?: boolean;
  uniforms?: any;
  then?: () => void;
};

const voxResolution = 200;
const noiseResolution = 200;
const superSampling = 1;

export let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;

const fullScreenQuad = {
  position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
};

//m4.transformPoint(m4.rotateZ(m4.identity(), time * 0.1), [

const up = [0, 0, 1];

export let render: (time: number, pos: Vec3, dir: Vec3) => void;

export async function prepareRender(
  crash: () => void,
  collect: (arg0: number) => void,
  collected: Uint8Array
) {
  canvas = document.getElementById("c") as HTMLCanvasElement;
  gl = canvas.getContext("webgl2");

  if (!gl) {
    document.children[0].innerHTML =
      "This browser has no WebGL2 support or it is not turned on.";
    return;
  }

  /*gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("OES_texture_float_linear");
  gl.getExtension("WEBGL_color_buffer_float");*/

  twgl.addExtensionsToContext(gl);

  const shaderSources = [
    "noise-f",
    "simple-geo-v",
    "star-f",
    "raymarch-f",
    "lattice-v",
    "geo-f",
    "quad-v",
    "light-f",
    "screen-f"
  ];

  const shaderFiles = await Promise.all(
    shaderSources.map(f => {
      let inlined = document.getElementById(`${f}.glsl`);
      if (inlined) return inlined.innerHTML;
      return (
        document.getElementById(`${f}.glsl`) || loadFile(`./shaders/${f}.glsl`)
      );
    })
  );
  const shaders = shaderFiles.reduce(
    (p, c, i) => ((p[shaderSources[i]] = c), p),
    {}
  );

  const [
    noiseFs,
    simpleGeoVs,
    starFs,
    raymarchFs,
    latticeVs,
    geoFs,
    quadVs,
    lightFs,
    screenFs
  ] = shaderFiles;

  //let va = await loadStage();

  const bufferWH = [
    canvas.clientWidth * superSampling,
    canvas.clientHeight * superSampling
  ];

  const depthTexture = twgl.createTexture(gl, {
    width: bufferWH[0],
    height: bufferWH[1],
    internalFormat: gl.DEPTH24_STENCIL8
  });

  const normalTexture = twgl.createTexture(gl, {
    width: bufferWH[0],
    height: bufferWH[1],
    internalFormat: gl.RGB,
    min: gl.NEAREST
  });

  let noise = makeTheNoise([quadVs, noiseFs]);

  const terrainPass: PassInfo = {
    programs: [quadVs, raymarchFs],
    source: twgl.createBufferInfoFromArrays(gl, fullScreenQuad),
    target: twgl.createFramebufferInfo(
      gl,
      [
        { internalFormat: gl.RGBA16F },
        { attachment: normalTexture },
        { format: gl.DEPTH_STENCIL, attachment: depthTexture }
      ],
      bufferWH[0],
      bufferWH[1]
    )
  };

  gl.enable(gl.DEPTH_TEST);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

  let starsGeometry = {
    color: { size: 1, data: [...new Array(6)].map((v, i) => 0) },
    position: fullScreenQuad.position.map(n => n * 1000 + 500)
  };

  console.log(starsGeometry);

  const starPass: PassInfo = {
    programs: [simpleGeoVs, starFs],
    overwrite: true,
    source: twgl.createBufferInfoFromArrays(gl, starsGeometry),
    target: terrainPass.target
  };

  const lightPass: PassInfo = {
    programs: [quadVs, lightFs],
    uniforms: {
      u_color: terrainPass.target.attachments[0],
      u_normal: terrainPass.target.attachments[1],
      u_depth: terrainPass.target.attachments[2]
    },
    source: twgl.createBufferInfoFromArrays(gl, fullScreenQuad),
    target: twgl.createFramebufferInfo(
      gl,
      [{ internalFormat: gl.RGBA16F }],
      bufferWH[0],
      bufferWH[1]
    )
  };
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

  const viewportPass: PassInfo = {
    programs: [quadVs, screenFs],
    uniforms: {
      u_color: lightPass.target.attachments[0],
      u_bufferSize: bufferWH
    },
    source: twgl.createBufferInfoFromArrays(gl, fullScreenQuad)
  };

  twgl.resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);

  //const capturer = new CCapture( { format: 'webm' } );

  render = (time: number, eye: Vec3, direction: Vec3) => {
    const fov = (40 * Math.PI) / 180;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const zNear = 0.5;
    const zFar = 800;
    const perspective = m4.perspective(fov, aspect, zNear, zFar);

    const camera = m4.lookAt(eye, v3.add(eye, direction), up);

    const raycastCamera = m4.lookAt([0, 0, 0], direction, up);
    const raycastProjection = m4.inverse(
      m4.multiply(perspective, m4.inverse(raycastCamera))
    );

    const viewTransform = m4.inverse(camera);
    const viewProjectionTransform = m4.multiply(perspective, viewTransform);
    const inverceViewProjectionTransform = m4.inverse(viewProjectionTransform);

    //console.log(v3.subtract(m4.transformPoint(invertViewProjectionTransform, [0,1,0]), eye));

    const world = m4.identity();

    const uniforms = {
      "u_light[0].pos": [1300, 1000, 2000],
      "u_light[0].color": [1, 1, 1, 1],
      u_ambient: [1, 1, 1, 0.3],
      u_specular: [1, 1, 1, 5],
      u_shininess: 50,
      u_time: time,
      u_orbRadius: 1 + Math.sin(time * 3) * 0.2,
      u_eye: eye,
      u_resolution: voxResolution,
      u_scale: 100,
      u_depthRange: [zNear, zFar],
      u_bufferSize: bufferWH,
      u_viewInverse: camera,
      u_world: world,
      u_worldInverseTranspose: m4.transpose(m4.inverse(world)),
      u_worldViewProjection: viewProjectionTransform,
      u_inverseWorldViewProjection: inverceViewProjectionTransform,
      u_raycastProjection: raycastProjection,
      u_collected: collected,
      u_noise: noise
    };

    Object.assign(lightPass.uniforms, uniforms);

    terrainPass.uniforms = uniforms;

    renderPass(gl, terrainPass);

    gl.flush();
    const data = new Float32Array(4);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
    if (data[0]) crash();
    else if (data[1]) collect(data[1]);

    renderPass(gl, lightPass);

    renderPass(gl, viewportPass);
  };
}

function renderPass(gl: WebGL2RenderingContext, pass: PassInfo) {
  twgl.bindFramebufferInfo(gl, pass.target);
  if (!pass.overwrite) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!pass.programInfo) {
    pass.programInfo = twgl.createProgramInfo(gl, pass.programs, error =>
      console.log(error)
    );
  }
  const program = pass.programInfo;
  gl.useProgram(program.program);
  twgl.setBuffersAndAttributes(gl, program, pass.source);
  twgl.setUniforms(program, pass.uniforms);
  twgl.drawBufferInfo(gl, pass.source);
  if (pass.then) {
    pass.then();
  }
}

function logBuffer(
  gl: WebGL2RenderingContext,
  attachment = gl.COLOR_ATTACHMENT0
) {
  gl.flush();
  const data = new Float32Array(100 * 100 * 1);
  gl.readBuffer(attachment);
  gl.readPixels(0, 0, 100, 100, gl.RED, gl.FLOAT, data);
}

function makeTheNoise(programs: [string, string]) {
  let numPixels = noiseResolution * noiseResolution * noiseResolution;
  let noise2DSide = Math.ceil(Math.sqrt(numPixels));

  const noisePass: PassInfo = {
    programs,
    source: twgl.createBufferInfoFromArrays(gl, fullScreenQuad),
    uniforms: { u_resolution: noiseResolution, u_side: noise2DSide },
    target: twgl.createFramebufferInfo(
      gl,
      [{ internalFormat: gl.R32F }],
      noise2DSide,
      noise2DSide
    )
  };

  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

  renderPass(gl, noisePass);

  gl.flush();
  const data = new Float32Array(noise2DSide * noise2DSide);
  gl.readBuffer(gl.COLOR_ATTACHMENT0);
  gl.readPixels(0, 0, noise2DSide, noise2DSide, gl.RED, gl.FLOAT, data);

  const noise3DTexture = twgl.createTexture(gl, {
    target: gl.TEXTURE_3D,
    width: noiseResolution,
    height: noiseResolution,
    depth: noiseResolution,
    wrap: gl.MIRRORED_REPEAT,
    minMag: gl.LINEAR,
    internalFormat: gl.R16F,
    src: data.slice(0, numPixels)
  });

  return noise3DTexture;
}
