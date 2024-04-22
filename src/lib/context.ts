import {createProxyWithLogging} from '../dev-utils/logging-proxy';
import {Doublebuffer} from './doublebuffer';
import {Framebuffer, FramebufferTexture} from './framebuffer';
import {RenderTarget} from './render-target';
import {ITextureParameters, Shader} from './shader';
import {UniformSource} from './texture-source';
import {isTexImageSource} from './utils';
import {wrapTexImageSource} from './wrapped-tex-image-source';

const coordUV = Symbol();
const coordXY = Symbol();

export class Context {
  public readonly gl: WebGL2RenderingContext;
  public readonly canvas: HTMLCanvasElement;

  /**
   * Use this as the `target` in {@link Shader.draw} to render onto the canvas from which the
   * {@link Context} was created.
   */
  public readonly out: RenderTarget;

  /** @internal */
  public readonly blitShader: Shader;

  public readonly floatingPointTexturesSupported: boolean;
  public readonly floatingPointTexturesLinearSamplingSupported: boolean;

  /**
   * Wrappers for passing JavaScript variables to uniforms in the shader.
   */
  public readonly u: {
    /**
     * Will evaluate to the `[width, height]` of the render target in pixels.
     * -> GLES `vec2`
     */
    resolution: () => UniformSource;
    /**
     * A `vec2` expressing the width and the height of a pixel in
     * texture space.
     * -> GLES `vec2`
     */
    pixel: () => UniformSource;
    /**
     * A `vec2` expressing half the width and the height of a pixel in texture
     * space.
     * -> GLES `vec2`
     */
    halfpixel: () => UniformSource;
    /**
     * Time since the creation of the context in seconds.
     * -> GLES `float`
     */
    time: () => UniformSource;
    /**
     * Time since the last draw call in seconds.
     * Will evaluate to 1/60 on the first draw call.
     * -> GLES `float`
     */
    delta: () => UniformSource;
    /**
     * Wraps a JavaScript number as a GLES `float`.
     */
    float: (value: number) => UniformSource;
    /**
     * Wraps two JavaScript numbers as a GLES `vec2`.
     */
    vec2: (x: number, y: number) => UniformSource;
    /**
     * Wraps three JavaScript numbers as a GLES `vec3`.
     */
    vec3: (r: number, g: number, b: number) => UniformSource;
    /**
     * Wraps four JavaScript numbers as a GLES `vec4`.
     */
    vec4: (r: number, g: number, b: number, a: number) => UniformSource;
    /**
     * Wraps a JavaScript numbers as a GLES `int`.
     */
    int: (value: number) => UniformSource;
    /**
     * Wraps a JavaScript boolean as a GLES `bool`.
     */
    bool: (value: boolean) => UniformSource;
    /**
     * Fallback for when Frag Frog does not have a wrapper for the desired data type.
     * Arbitrary code can be executed in the callback, e.g.:
     *
     * ```ts
     * shader.draw(context.out, {
     *   u_mat: context.u.uniform((gl, location) => {
     *     gl.uniformMatrix2fv(location, false, [2, 1, 2, 2]);
     *   }),
     * });
     * ```
     */
    uniform: (
      uniformSetter: (gl: WebGL2RenderingContext, location: WebGLUniformLocation) => void
    ) => UniformSource;
    /**
     * For passing objects that represent textures to the shader as a GLSL `sampler2D`.
     *
     * @param value The texture source.
     * @param params The texture params. Defaults to ```
     * {
     *   minFilter: 'linear',
     *   magFilter: 'linear',
     *   wrap: 'repeat'
     *  }```
     *
     * For custom setups (e.g. different horizontal and vertical wrapping), you can supply a
     * function that sets the texture params manually. It will be called in a context where the
     * texture is bound.
     * E.g.:
     *
     * ```ts
     * shader.draw(ff.out, {
     *   u_texture: ff.u.sampler2D(inCanvas, (gl) => {
     *     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
     *     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
     *   }),
     * });
     * ```
     */
    sampler2D: (
      value: TexImageSource | Framebuffer | FramebufferTexture | Doublebuffer,
      params?: ITextureParameters | ((gl: WebGL2RenderingContext) => void)
    ) => UniformSource;
  };

  /**
   * Wrappers for assigning special functionalities to varyings in the shader.
   */
  public readonly v = {
    /**
     * Position of the current fragment in the range (0, 1) x (0, 1).
     * (0, 0) is in the top left corner and the Y-axis points down.
     * -> GLES `vec2`
     */
    UV: () => coordUV,
    /**
     * Position of the current fragment in the range (0, canvasWidth - 1) x (0, canvasHeight - 1).
     * (0, 0) is in the top left corner and the Y-axis points down.
     * -> GLES `vec2`
     */
    XY: () => coordXY,
  };

  /** @internal */
  constructor(canvas: HTMLCanvasElement) {
    // this.gl = createProxyWithLogging(canvas.getContext('webgl2')!);
    this.gl = canvas.getContext('webgl2')!;

    if (this.gl === null) {
      throw new Error(
        'Could not get a webgl2 context from the supplied canvas. ' +
          'Ensure, that `getContext` was not called on it before.'
      );
    }

    this.floatingPointTexturesSupported = !!this.gl.getExtension('EXT_color_buffer_float');
    this.floatingPointTexturesLinearSamplingSupported = !!this.gl.getExtension(
      'OES_texture_float_linear'
    );
    this.canvas = canvas;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.out = {
      get width() {
        return self.canvas.width;
      },
      get height() {
        return self.canvas.height;
      },
      flipped: true,
      bind: () => {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      },
    };

    const firstTime = Date.now() / 1000;
    let lastTime = 0;

    this.u = {
      resolution: () => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform2fv(location, [this.canvas.width, this.canvas.height]);
          },
        };
      },
      pixel: () => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform2fv(location, [1 / this.canvas.width, 1 / this.canvas.height]);
          },
        };
      },
      halfpixel: () => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform2fv(location, [0.5 / this.canvas.width, 0.5 / this.canvas.height]);
          },
        };
      },
      time: () => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform1f(location, Date.now() / 1000 - firstTime);
          },
        };
      },
      delta: () => {
        return {
          activate: (location: WebGLUniformLocation) => {
            const now = Date.now() / 1000;
            if (lastTime === 0) {
              this.gl.uniform1f(location, 1 / 60);
            } else {
              this.gl.uniform1f(location, now - lastTime);
            }
            lastTime = now;
          },
        };
      },
      float: (value: number) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform1f(location, value);
          },
        };
      },
      int: (value: number) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform1i(location, value);
          },
        };
      },
      bool: (value: boolean) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform1i(location, value ? 1 : 0);
          },
        };
      },
      vec2: (x: number, y: number) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform2fv(location, [x, y]);
          },
        };
      },
      vec3: (x: number, y: number, z: number) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform3fv(location, [x, y, z]);
          },
        };
      },
      vec4: (r: number, g: number, b: number, a: number) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            this.gl.uniform4fv(location, [r, g, b, a]);
          },
        };
      },
      uniform: (
        uniformSetter: (gl: WebGL2RenderingContext, location: WebGLUniformLocation) => void
      ) => {
        return {
          activate: (location: WebGLUniformLocation) => {
            uniformSetter(this.gl, location);
          },
        };
      },
      sampler2D: (
        image: TexImageSource | Framebuffer | FramebufferTexture | Doublebuffer,
        params?: ITextureParameters | ((gl: WebGL2RenderingContext) => void)
      ) => {
        return {
          activate: (location: WebGLUniformLocation, shader: Shader) => {
            if (isTexImageSource(image)) {
              wrapTexImageSource(this.gl, image).activate(location, shader);
            } else {
              image.activate(location, shader);
            }
            const usesFloatingPointTextures =
              (image instanceof Framebuffer && image.usesFloatingPointTextures) ||
              (image instanceof Doublebuffer && image.getWriteBuffer().usesFloatingPointTextures);
            if (typeof params === 'function') {
              this.setActiveTextureParams(undefined, usesFloatingPointTextures);
              params(this.gl);
            } else {
              this.setActiveTextureParams(params, usesFloatingPointTextures);
            }
          },
        };
      },
    };

    const blitSrc = `
precision mediump float;

varying vec2 v_tpos;
uniform sampler2D u_texture;

void main(void) {
  gl_FragColor = texture2D(u_texture, v_tpos);
}
`;
    this.blitShader = this.createShader(blitSrc, {
      varyings: {v_tpos: this.v.UV()},
    });
  }

  /**
   * Compiles a shader program from the provided fragment shader source code.
   *
   * @param src The GLSL fragment shader source code.
   * @param options
   *  - Define the functionalities of the shader's varyings.
   * @returns The shader instance.
   */
  public createShader(
    src: string,
    options: {
      varyings?: {[key: string]: Symbol};
    } = {}
  ): Shader {
    return new Shader(src, this, options);
  }

  /**
   * Creates an object that can be used as an off-screen render target.
   *
   * @param numTextures How many textures the framebuffer should have.
   * Defaults to `1`.
   * Only relevant when rendering to multiple targets.
   * @param scaledownFactor By which factor the framebuffer should be smaller than the `Context`'s
   * canvas.
   * Defaults to `1`, i.e. no scaledown.
   * @param useFloatingPointTextures Whether the buffer should use floating point textures. This is
   * required if you want to prevent capping your floats to [0, 1] between shader passes, but not
   * every system supports it.
   * @returns The framebuffer wrapper object.
   */
  public createFramebuffer(
    numTextures = 1,
    scaledownFactor = 1,
    useFloatingPointTextures = false
  ): Framebuffer {
    return new Framebuffer(this, numTextures, scaledownFactor, useFloatingPointTextures);
  }

  /**
   * A buffer to which one can conveniently read from and write to in the same draw call.
   *
   * In order to keep it simple, `Doublebuffer`s don't support multiple render targets.
   * If your use case requires this, use `Framebuffer`s instead.
   *
   * @param useFloatingPointTextures Whether the buffer should use floating point textures. This is
   * required if you want to prevent capping your floats to [0, 1] between shader passes, but not
   * every system supports it.
   * @returns The doublebuffer wrapper object.
   */
  public createDoublebuffer(useFloatingPointTextures = false): Doublebuffer {
    return new Doublebuffer(this, useFloatingPointTextures);
  }

  /** @internal */
  public createTexture(): WebGLTexture {
    const texture = this.gl.createTexture();
    return texture!;
  }

  /**
   * Resizes the `Context`s canvas, and thereby the default resolution that the shaders work with.
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Returns the color of a specific pixel on the {@link Context}'s canvas.
   *
   * **ATTENTION:**
   * This function will block the main thread for a hard to predict duration!
   * Calling `draw` will only enqueue the job in the GPU, but won't wait for it to actually finish.
   * Thus, calling `draw` is usually very cheap.
   * However, in order to read a pixel from the canvas, the browser has to wait for the shader to
   * run. How long this takes does not only depend on the complexity of your shader, but also on
   * other tasks currently waiting in the queue.
   * WebGL features no asynchronous method for this purpose.
   *
   * @param x Whole number coordinate in the range [0, width).
   * @param y Whole number coordinate in the range [0, height).
   * @returns Object representing the color at the given location as:
   *
   * - r: Red channel
   * - g: Green channel
   * - b: Blue channel
   * - a: Alpha channel
   *
   * Each component in the range [0, 255].
   */
  public getColorAt(x: number, y: number): {r: number; g: number; b: number; a: number} {
    const dest = new Uint8Array(4);
    this.gl.readPixels(
      x,
      this.canvas.height - y - 1,
      1,
      1,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      dest
    );
    return {r: dest.at(0)!, g: dest.at(1)!, b: dest.at(2)!, a: dest.at(3)!};
  }

  /** @internal */
  public setActiveTextureParams(
    params?: ITextureParameters,
    usesFloatingPointTextures = false
  ): void {
    const filter =
      params?.filter ??
      (usesFloatingPointTextures && !this.floatingPointTexturesLinearSamplingSupported
        ? 'nearest'
        : 'linear');
    if (
      usesFloatingPointTextures &&
      !this.floatingPointTexturesLinearSamplingSupported &&
      params?.filter === 'linear'
    ) {
      console.error(`You are trying to use linear sampling on a floating point texture, but your
      system does not support the "OES_texture_float_linear" extension.`);
    }

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      filter === 'linear' ? this.gl.LINEAR : this.gl.NEAREST
    );

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      filter === 'linear' ? this.gl.LINEAR : this.gl.NEAREST
    );

    const textureWrap = params?.wrap ?? 'mirroredRepeat';
    const glConst =
      textureWrap === 'repeat'
        ? this.gl.REPEAT
        : textureWrap === 'clampToEdge'
          ? this.gl.CLAMP_TO_EDGE
          : this.gl.MIRRORED_REPEAT;
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, glConst);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, glConst);
  }
}
