import {expect} from '@esm-bundle/chai';
import {fragFrog} from '../lib/index';
import {Context} from '../lib/context';
import sinon from 'sinon';

describe('E2E', () => {
  let canvas: HTMLCanvasElement;
  let ff: Context;
  let inCanvas = document.createElement('canvas');

  const rotateShaderSrc = `
  precision mediump float;
  varying vec2 v_tpos;
  uniform sampler2D u_texture;
  void main(void) {
    vec4 texColor = texture2D(u_texture, v_tpos);
    gl_FragColor = vec4(texColor.gbr, 1.0);
  }
`;

  const wrapShaderSrc = `
  precision mediump float;
  varying vec2 v_tpos;
  uniform sampler2D u_texture;
  void main(void) {
    gl_FragColor = texture2D(u_texture, v_tpos * 2.0);
  }`;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;

    inCanvas = document.createElement('canvas');
    inCanvas.width = 10;
    inCanvas.height = 10;
    const ctx = inCanvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = 'red';
    ctx.fillRect(5, 0, 5, 5);
    ctx.fillRect(0, 5, 5, 5);

    ff = fragFrog(canvas);
  });

  it('gets created', () => {
    expect(ff).to.exist;
  });

  it('throws when another context already exists', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext('2d');
    expect(() => {
      fragFrog(canvas);
    }).to.throw();
  });

  it('throws when trying to compile invalid shader', () => {
    expect(() => {
      ff.createShader('test');
    }).to.throw();
  });

  it('single pass', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    shader.draw(ff.out, {u_texure: ff.u.sampler2D(inCanvas)});
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 0, b: 255, a: 255});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
  });

  const rotateShaderSrc2 = `
  precision mediump float;
  varying vec2 v_tpos2;
  uniform sampler2D u_texture;
  void main(void) {
    vec4 texColor = texture2D(u_texture, v_tpos2);
    gl_FragColor = vec4(texColor.gbr, 1.0);
  }
`;

  it('supports alternative named for varyings', () => {
    const shader = ff.createShader(rotateShaderSrc2, {varyings: {v_tpos2: ff.v.UV()}});
    shader.draw(ff.out, {u_texure: ff.u.sampler2D(inCanvas)});
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 0, b: 255, a: 255});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
  });

  it('multi pass (frame buffer)', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const fb1 = ff.createFramebuffer();
    const fb2 = ff.createFramebuffer();
    shader.draw(fb1, {u_texture: ff.u.sampler2D(inCanvas)});
    shader.draw(fb2, {u_texture: ff.u.sampler2D(fb1)});
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(fb2)});
    expect(ff.getColorAt(0, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
  });

  it('throws when trying to read from unseeded double buffer', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const db = ff.createDoublebuffer();
    expect(() => {
      shader.draw(db, {u_texure: ff.u.sampler2D(db)});
    }).to.throw();
  });

  it('multi pass (double buffer)', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const db = ff.createDoublebuffer();
    db.seed(inCanvas);
    shader.draw(db, {u_texure: ff.u.sampler2D(db)});
    shader.draw(db, {u_texure: ff.u.sampler2D(db)});
    shader.draw(db, {u_texure: ff.u.sampler2D(db)});
    db.flush();
    expect(ff.getColorAt(0, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
  });

  it('seeds a double buffer implicitly with a frame buffer', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const fb = ff.createFramebuffer();
    const db = ff.createDoublebuffer();
    shader.draw(fb, {u_texture: ff.u.sampler2D(inCanvas)});
    shader.draw(db, {u_texure: ff.u.sampler2D(fb)});
    db.flush();
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 255, b: 0, a: 255});
  });

  it('seeds a double buffer explicitly with a frame buffer', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const fb = ff.createFramebuffer();
    const db = ff.createDoublebuffer();
    shader.draw(fb, {u_texture: ff.u.sampler2D(inCanvas)});
    db.seed(fb);
    db.flush();
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 0, b: 255, a: 255});
  });

  it('seeds a double buffer implicitly with another', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const db1 = ff.createDoublebuffer();
    const db2 = ff.createDoublebuffer();
    shader.draw(db1, {u_texure: ff.u.sampler2D(inCanvas)});
    shader.draw(db2, {u_texure: ff.u.sampler2D(db1)});
    db2.flush();
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 255, b: 0, a: 255});
  });

  it('seeds a double buffer explicitly with another', () => {
    const shader = ff.createShader(rotateShaderSrc, {varyings: {v_tpos: ff.v.UV()}});
    const db1 = ff.createDoublebuffer();
    const db2 = ff.createDoublebuffer();
    shader.draw(db1, {u_texture: ff.u.sampler2D(inCanvas)});
    db2.seed(db1);
    db2.flush();
    expect(ff.getColorAt(0, 9)).to.eql({r: 0, g: 0, b: 255, a: 255});
  });

  it('GLES 3.0 (multiple targets)', () => {
    const shader = ff.createShader(`#version 300 es
    precision mediump float;
    layout(location = 0) out vec4 out_a;
    layout(location = 1) out vec4 out_b;
    void main(void) {
      out_a = vec4(1.0, 0.0, 0.0, 1.0);
      out_b = vec4(0.0, 1.0, 0.0, 1.0);
    }`);
    const fb = ff.createFramebuffer(2);
    shader.draw(fb);
    fb.flush(0);
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 0, b: 0, a: 255});
    fb.flush(1);
    expect(ff.getColorAt(0, 0)).to.eql({r: 0, g: 255, b: 0, a: 255});
  });

  it('texture wrap: repeat', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(inCanvas, {wrap: 'repeat'})});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(9, 9)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(6, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(9, 0)).to.eql({r: 255, g: 0, b: 0, a: 255});
  });

  it('texture wrap: clampToEdge', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(inCanvas, {wrap: 'clampToEdge'})});
    expect(ff.getColorAt(6, 9)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(9, 6)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(0, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(9, 0)).to.eql({r: 255, g: 0, b: 0, a: 255});
  });

  it('texture wrap: mirroredRepeat (on source)', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(inCanvas, {wrap: 'mirroredRepeat'})});
    expect(ff.getColorAt(0, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(0, 9)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(9, 0)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(9, 9)).to.eql({r: 255, g: 255, b: 255, a: 255});
  });

  it('texture wrap: custom', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {
      u_texture: ff.u.sampler2D(inCanvas, gl => {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }),
    });
    expect(ff.getColorAt(6, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(9, 6)).to.eql({r: 255, g: 255, b: 255, a: 255});
    expect(ff.getColorAt(0, 9)).to.eql({r: 255, g: 0, b: 0, a: 255});
    expect(ff.getColorAt(9, 0)).to.eql({r: 255, g: 0, b: 0, a: 255});
  });

  it('filter: nearest', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {
      u_texture: ff.u.sampler2D(inCanvas, {filter: 'nearest', wrap: 'repeat'}),
    });
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
  });

  it('filter: linear', () => {
    const shader = ff.createShader(wrapShaderSrc);
    shader.draw(ff.out, {
      u_texture: ff.u.sampler2D(inCanvas, {filter: 'linear', wrap: 'repeat'}),
    });
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.true;
  });

  const noopSrc = `
  precision mediump float;
  varying vec2 v_tpos;
  uniform sampler2D u_texture;
  void main(void) {
    gl_FragColor = texture2D(u_texture, v_tpos);
  }`;

  const checks = document.createElement('canvas');
  checks.width = 10;
  checks.height = 10;
  const ctx = checks.getContext('2d')!;
  const imgData = ctx.createImageData(10, 10);
  const data = imgData.data;
  for (let i = 0; i < 100; i++) {
    if ((i % 2 ^ Math.floor(i / 10) % 2) === 0) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  it('resizes to out', () => {
    const shader = ff.createShader(noopSrc);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
    ff.resize(5, 5);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    let foundFull = false;
    for (let i = 0; i < 5; i++) {
      if (ff.getColorAt(i, 0).b === 0 || ff.getColorAt(i, 0).b === 255) {
        foundFull = true;
      }
    }
    expect(foundFull).to.be.false;
  });

  it('resizes to out (resizing externally)', () => {
    const shader = ff.createShader(noopSrc);
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
    canvas.width = 5;
    canvas.height = 5;
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    let foundFull = false;
    for (let i = 0; i < 5; i++) {
      if (ff.getColorAt(i, 0).b === 0 || ff.getColorAt(i, 0).b === 255) {
        foundFull = true;
      }
    }
    expect(foundFull).to.be.false;
  });

  it('resizes to buffer', () => {
    const shader = ff.createShader(noopSrc);
    const fb = ff.createFramebuffer();
    shader.draw(fb, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    fb.flush();
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
    ff.resize(5, 5);
    shader.draw(fb, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    ff.resize(10, 10);
    fb.flush();
    let foundFull = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b === 0 || ff.getColorAt(i, 0).b === 255) {
        foundFull = true;
      }
    }
    expect(foundFull).to.be.false;
  });

  it('resizes to buffer (resizing externally)', () => {
    const shader = ff.createShader(noopSrc);
    const fb = ff.createFramebuffer();
    shader.draw(fb, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    fb.flush();
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
    canvas.width = 5;
    canvas.height = 5;
    shader.draw(fb, {u_texture: ff.u.sampler2D(checks, {filter: 'linear'})});
    canvas.width = 10;
    canvas.height = 10;
    fb.flush();
    let foundFull = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b === 0 || ff.getColorAt(i, 0).b === 255) {
        foundFull = true;
      }
    }
    expect(foundFull).to.be.false;
  });

  it('uses scaled-down framebuffers', () => {
    const shader = ff.createShader(noopSrc);
    const fb = ff.createFramebuffer(1, 2);
    shader.draw(fb, {u_texture: ff.u.sampler2D(checks)});
    fb.flush();
    let foundFull = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b === 0 || ff.getColorAt(i, 0).b === 255) {
        foundFull = true;
      }
    }
    expect(foundFull).to.be.false;
  });

  it('passes float', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform float u_test;
    void main(void) {
      gl_FragColor = vec4(u_test);
    }`);
    shader.draw(ff.out, {u_test: ff.u.float(0.5)});
    expect(ff.getColorAt(0, 0).b).to.eql(128);
  });

  it('passes int', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform int u_test;
    void main(void) {
      gl_FragColor = vec4(float(u_test)/255.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.int(128)});
    expect(ff.getColorAt(0, 0).b).to.eql(128);
  });

  it('passes bool', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform bool u_test;
    void main(void) {
      gl_FragColor = u_test ? vec4(1.0) : vec4(0.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.bool(false)});
    expect(ff.getColorAt(0, 0).b).to.eql(0);
    shader.draw(ff.out, {u_test: ff.u.bool(true)});
    expect(ff.getColorAt(0, 0).b).to.eql(255);
  });

  it('passes vec2', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform vec2 u_test;
    void main(void) {
      gl_FragColor = vec4(u_test.xy, 1.0, 1.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.vec2(0.5, 0.5)});
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 0).g).to.eql(128);
  });

  it('passes vec3', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform vec3 u_test;
    void main(void) {
      gl_FragColor = vec4(u_test.xyz, 1.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.vec3(0.5, 0.5, 0.5)});
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 0).g).to.eql(128);
    expect(ff.getColorAt(0, 0).b).to.eql(128);
  });

  it('passes vec4', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform vec4 u_test;
    void main(void) {
      gl_FragColor = u_test;
    }`);
    shader.draw(ff.out, {u_test: ff.u.vec4(0.5, 0.5, 0.5, 0.5)});
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 0).g).to.eql(128);
    expect(ff.getColorAt(0, 0).b).to.eql(128);
    expect(ff.getColorAt(0, 0).a).to.eql(128);
  });

  it('passes arbitrary uniform', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform vec2 u_test;
    void main(void) {
      gl_FragColor = vec4(u_test.xy, 1.0, 1.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.uniform((gl, loc) => gl.uniform2fv(loc, [0.5, 0.5]))});
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 0).g).to.eql(128);
  });

  it('passes resolution', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform vec2 u_test;
    void main(void) {
      gl_FragColor = vec4(float(u_test.x) / 20.0, float(u_test.y) / 20.0, 1.0, 1.0);
    }`);
    shader.draw(ff.out, {u_test: ff.u.resolution()});
    expect(ff.getColorAt(0, 0).r).to.eql(128);
  });

  it('passes time', async () => {
    const shader = ff.createShader(`precision mediump float;
    uniform float u_test;
    void main(void) {
      gl_FragColor = vec4(sin(u_test)*0.5+0.5);
    }`);
    await new Promise(r => setTimeout(r, 20));
    shader.draw(ff.out, {u_test: ff.u.time()});
    expect(Math.abs(ff.getColorAt(0, 0).r - 131)).to.be.lessThan(3);
  });

  it('passes delta', () => {
    const shader = ff.createShader(`precision mediump float;
    uniform float u_test;
    void main(void) {
      gl_FragColor = vec4(u_test);
    }`);
    shader.draw(ff.out, {u_test: ff.u.delta()});
    expect(ff.getColorAt(0, 0).r).to.eql(Math.round((1 / 60) * 255));
    shader.draw(ff.out, {u_test: ff.u.delta()});
    expect(ff.getColorAt(0, 0).r).to.be.lessThan(255);
  });

  const grid = document.createElement('canvas');
  grid.width = 2;
  grid.height = 2;
  const gridCtx = grid.getContext('2d')!;
  const gridImgData = gridCtx.createImageData(2, 2);
  const gridData = gridImgData.data;
  gridData[0 * 4 + 3] = gridData[1 * 4 + 3] = gridData[2 * 4 + 3] = gridData[3 * 4 + 3] = 255;
  gridData[0 * 4] = 255;
  gridData[1 * 4] = 0;
  gridData[2 * 4] = 0;
  gridData[3 * 4] = 255;
  gridCtx.putImageData(gridImgData, 0, 0);

  it('passes pixel', () => {
    ff.resize(2, 2);
    const shader = ff.createShader(
      `precision mediump float;
    varying vec2 v_tpos;
    uniform vec2 u_pixel;
    uniform sampler2D u_texture;
    void main(void) {
      gl_FragColor = texture2D(u_texture, v_tpos + u_pixel * 0.5);
    }`
    );
    shader.draw(ff.out, {
      u_pixel: ff.u.pixel(),
      u_texture: ff.u.sampler2D(grid, {wrap: 'repeat', filter: 'linear'}),
    });
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 1).r).to.eql(128);
    expect(ff.getColorAt(1, 0).r).to.eql(128);
    expect(ff.getColorAt(1, 1).r).to.eql(128);
  });

  it('passes halfpixel', () => {
    ff.resize(2, 2);
    const shader = ff.createShader(
      `precision mediump float;
    varying vec2 v_tpos;
    uniform vec2 u_halfpixel;
    uniform sampler2D u_texture;
    void main(void) {
      gl_FragColor = texture2D(u_texture, v_tpos + u_halfpixel);
    }`
    );
    shader.draw(ff.out, {
      u_halfpixel: ff.u.halfpixel(),
      u_texture: ff.u.sampler2D(grid, {wrap: 'repeat', filter: 'linear'}),
    });
    expect(ff.getColorAt(0, 0).r).to.eql(128);
    expect(ff.getColorAt(0, 1).r).to.eql(128);
    expect(ff.getColorAt(1, 0).r).to.eql(128);
    expect(ff.getColorAt(1, 1).r).to.eql(128);
  });

  it('defaults to nearest sampling if hardware does not support linear on float textures', () => {
    // @ts-ignore
    ff.floatingPointTexturesSupported = true;
    // @ts-ignore
    ff.floatingPointTexturesLinearSamplingSupported = false;

    const noopShader = ff.createShader(noopSrc);
    const wrapShader = ff.createShader(wrapShaderSrc);
    const fb = ff.createFramebuffer(1, 1, true);
    noopShader.draw(fb, {
      u_texture: ff.u.sampler2D(inCanvas),
    });
    wrapShader.draw(ff.out, {
      u_texture: ff.u.sampler2D(fb, {wrap: 'repeat'}),
    });
    let foundMix = false;
    for (let i = 0; i < 10; i++) {
      if (ff.getColorAt(i, 0).b !== 0 && ff.getColorAt(i, 0).b !== 255) {
        foundMix = true;
      }
    }
    expect(foundMix).to.be.false;
  });

  it('warning when client uses unsupported linear float texture sampling intentionally', () => {
    // @ts-ignore
    ff.floatingPointTexturesSupported = true;
    // @ts-ignore
    ff.floatingPointTexturesLinearSamplingSupported = false;

    const noopShader = ff.createShader(noopSrc);
    const wrapShader = ff.createShader(wrapShaderSrc);
    const fb = ff.createFramebuffer(1, 1, true);
    noopShader.draw(fb, {
      u_texture: ff.u.sampler2D(inCanvas),
    });
    const spy = sinon.spy(console, 'error');
    wrapShader.draw(ff.out, {
      u_texture: ff.u.sampler2D(fb, {filter: 'linear', wrap: 'repeat'}),
    });
    expect(spy.getCall(0).args[0]).to.include('OES_texture_float_linear');
    spy.restore();
  });

  it('warning when client creates float texture without support', () => {
    // @ts-ignore
    ff.floatingPointTexturesSupported = false;

    const spy = sinon.spy(console, 'error');
    ff.createFramebuffer(1, 1, true);
    expect(spy.getCall(0).args[0]).to.include('EXT_color_buffer_float');
    spy.restore();
  });

  const noopXYSrc = `
  precision mediump float;
  varying vec2 v_pos;
  uniform vec2 u_resolution;
  uniform sampler2D u_texture;
  void main(void) {
    gl_FragColor = texture2D(u_texture, v_pos / u_resolution);
  }`;

  it('XY instead of UV', () => {
    const shader = ff.createShader(noopXYSrc, {varyings: {v_pos: ff.v.XY()}});
    shader.draw(ff.out, {u_texture: ff.u.sampler2D(inCanvas), u_resolution: ff.u.resolution()});
    const ctx = inCanvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, inCanvas.width, inCanvas.height).data;
    for (let x = 0; x < inCanvas.width; x++) {
      for (let y = 0; y < inCanvas.height; y++) {
        const color = ff.getColorAt(x, y);
        expect(imgData[(y * canvas.width + x) * 4 + 0]).to.equal(color.r);
        expect(imgData[(y * canvas.width + x) * 4 + 1]).to.equal(color.g);
        expect(imgData[(y * canvas.width + x) * 4 + 2]).to.equal(color.b);
        expect(imgData[(y * canvas.width + x) * 4 + 3]).to.equal(color.a);
      }
    }
  });
});
