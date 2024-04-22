import {createProxyWithLogging} from '../dev-utils/logging-proxy';
import {Context} from './context';
import {Doublebuffer} from './doublebuffer';
import {RenderTarget} from './render-target';
import {UniformSource as UniformSource} from './texture-source';

export interface ITextureParameters {
  /**
   * The same value is applied to the MIN and MAX filter.
   */
  filter?: 'linear' | 'nearest';
  /**
   * The same value is applied to horizontal and vertical wrap.
   */
  wrap?: 'repeat' | 'clampToEdge' | 'mirroredRepeat';
}

export class Shader {
  /** @internal */
  private context: Context;
  /** @internal */
  protected gl: WebGL2RenderingContext;
  /** @internal */
  protected program: WebGLProgram;

  /** @internal */
  protected uniformLocations: {[key: string]: WebGLUniformLocation} = {};
  /** @internal */
  protected textures = new Map<TexImageSource, WebGLTexture>();
  /** @internal */
  protected u_flip: WebGLUniformLocation;
  /** @internal */
  protected u_resParam: WebGLUniformLocation | undefined;

  /** @internal */
  private textureCounter = 0;

  /** @internal */
  constructor(
    src: string,
    context: Context,
    options: {
      varyings?: {[key: string]: Symbol};
    }
  ) {
    this.context = context;
    this.gl = this.context.gl!;

    let uvParam = 'v_tpos';
    let xyParam = undefined;
    if (options.varyings) {
      for (const key in options.varyings) {
        if (options.varyings[key] === this.context.v.UV()) {
          uvParam = key;
        } else if (options.varyings[key] === this.context.v.XY()) {
          xyParam = key;
        }
      }
    }

    const vtxShaderSource2 = `
    attribute vec2 a_vpos;
    attribute vec2 a_tpos;
    uniform bool u_fragfrog_flip;
    varying vec2 ${uvParam};
    ${xyParam !== undefined ? 'uniform vec2 u_fragfrog_res;' : ''}
    ${xyParam !== undefined ? `varying vec2 ${xyParam};` : ''}

    void main(void) {
      gl_Position = vec4(a_vpos, 0.0, 1.0);
      if (u_fragfrog_flip) {
        ${uvParam} = vec2(a_tpos.x, 1.0 - a_tpos.y);
        ${
          xyParam !== undefined
            ? `${xyParam} = vec2(a_tpos.x, 1.0 - a_tpos.y) * u_fragfrog_res;`
            : ''
        };
      } else {
        ${uvParam} = a_tpos;
        ${xyParam !== undefined ? `${xyParam} = a_tpos * u_fragfrog_res;` : ''};
      }
    }`;

    const vtxShaderSource3 = `#version 300 es
    in vec2 a_vpos;
    in vec2 a_tpos;
    uniform bool u_fragfrog_flip;
    out vec2 ${uvParam};
    ${xyParam !== undefined ? 'uniform vec2 u_fragfrog_res;' : ''}
    ${xyParam !== undefined ? `out vec2 ${xyParam};` : ''}

    void main(void) {
      gl_Position = vec4(a_vpos, 0.0, 1.0);
      if (u_fragfrog_flip) {
        ${uvParam} = vec2(a_tpos.x, 1.0 - a_tpos.y);
        ${
          xyParam !== undefined
            ? `${xyParam} = vec2(a_tpos.x, 1.0 - a_tpos.y) * u_fragfrog_res;`
            : ''
        };
      } else {
        ${uvParam} = a_tpos;
        ${xyParam !== undefined ? `${xyParam} = a_tpos * u_fragfrog_res;` : ''};
      }
    }`;

    const isWebGL3 = src.startsWith('#version 300 es');

    const vtxShader = this.createShader(
      this.gl.VERTEX_SHADER,
      isWebGL3 ? vtxShaderSource3 : vtxShaderSource2
    );
    const fragShader = this.createShader(this.gl.FRAGMENT_SHADER, src);
    this.program = this.createProgram(vtxShader, fragShader);

    this.u_flip = this.gl.getUniformLocation(this.program, 'u_fragfrog_flip')!;
    if (xyParam) {
      this.u_resParam = this.gl.getUniformLocation(this.program, 'u_fragfrog_res')!;
    }
  }

  /** @internal */
  public getOrCreateTexture(key: TexImageSource): WebGLTexture {
    let texture = this.textures.get(key);
    if (!texture) {
      texture = this.context.createTexture();
      this.textures.set(key, texture);
    }
    return texture;
  }

  /** @internal */
  private createProgram(vtxShader: WebGLShader, fragShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram()!;

    this.gl.attachShader(program, vtxShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);
    this.gl.useProgram(program);

    const a_vpos = this.gl.getAttribLocation(program, 'a_vpos'); // vertex coordinate
    const a_tpos = this.gl.getAttribLocation(program, 'a_tpos'); // texture coordinate
    this.gl.enableVertexAttribArray(a_vpos);
    this.gl.enableVertexAttribArray(a_tpos);

    this.createQuad(a_vpos, a_tpos);

    return program;
  }

  /** @internal */
  private createQuad(a_vpos: number, a_tpos: number): void {
    const vpos_buf = this.gl.createBuffer();
    const tpos_buf = this.gl.createBuffer();
    const idx_buf = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vpos_buf);
    // Order: Bottom-Left, Bottom-Right, Top-Right, Top-Left
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
      this.gl.STATIC_DRAW
    );
    this.gl.vertexAttribPointer(a_vpos, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, tpos_buf);
    // Corresponding texture coordinates
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      this.gl.STATIC_DRAW
    );
    this.gl.vertexAttribPointer(a_tpos, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, idx_buf);
    // Draw the square as a triangle strip
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 3, 2]),
      this.gl.STATIC_DRAW
    );
    this.gl.vertexAttribPointer(a_tpos, 2, this.gl.FLOAT, false, 0, 0);
  }

  /** @internal */
  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Error compiling shader', this.gl.getShaderInfoLog(shader));
      throw new Error('Error compiling shader');
    }
    return shader;
  }

  /**
   * Executes the shader.
   *
   * *(Sends the draw call to the GPU. The actual execution will happen asynchronously.)*
   *
   * @param target Where to render to.
   * @param uniforms The GLSL uniforms to pass to the shader.
   * See {@link Context.u} for all possible data formats.
   */
  public draw(
    target: RenderTarget,
    uniforms: {
      [key: string]: UniformSource;
    } = {}
  ): void {
    this.gl.useProgram(this.program);
    this.textureCounter = 0;

    target.bind();
    this.gl.viewport(0, 0, target.width, target.height);

    for (const key in uniforms) {
      const location = this.getUniformLocation(key);
      const value = uniforms[key];
      value.activate(location, this);
    }

    if (target instanceof Doublebuffer) {
      target.advance();
    }

    this.gl.uniform1f(this.u_flip, target.flipped ? 1 : 0);
    if (this.u_resParam) {
      this.gl.uniform2fv(this.u_resParam, [target.width, target.height]);
    }
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, 4, this.gl.UNSIGNED_SHORT, 0);
  }

  /** @internal */
  private getUniformLocation(key: string): WebGLUniformLocation {
    let location: WebGLUniformLocation | null = this.uniformLocations[key];
    if (!location) {
      location = this.gl.getUniformLocation(this.program, key)!;
      this.uniformLocations[key] = location;
    }
    return location;
  }

  /** @internal */
  public getTextureCounter(): number {
    return this.textureCounter;
  }

  /** @internal */
  public incTextureCounter(): void {
    this.textureCounter++;
  }
}
