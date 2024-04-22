import {Context} from './context';
import {RenderTarget} from './render-target';
import {Shader} from './shader';
import {UniformSource} from './texture-source';
import {getColorAttachmentNumber, getTextureNumber, range} from './utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FramebufferTexture extends UniformSource {}

export class Framebuffer implements RenderTarget, UniformSource {
  /** @internal */
  private fbo!: WebGLFramebuffer;
  /** @internal */
  private textures!: WebGLTexture[];
  /** @internal */
  public width!: number;
  /** @internal */
  public height!: number;
  /** @internal */
  public readonly flipped = false;

  /** @internal */
  private context!: Context;
  /** @internal */
  private numTextures!: number;
  /** @internal */
  private scale!: number;
  /** @internal */
  public readonly usesFloatingPointTextures!: boolean;

  /** @internal */
  constructor(
    context: Context,
    numTextures: number,
    scale: number,
    useFloatingPointTextures: boolean
  ) {
    this.context = context;
    this.numTextures = numTextures;
    this.scale = scale;
    this.usesFloatingPointTextures = useFloatingPointTextures;
    this.init();
  }

  /** @internal */
  private init(): void {
    if (this.fbo) {
      this.destroy();
    }
    this.fbo = this.context.gl.createFramebuffer()!;
    this.context.gl.bindFramebuffer(this.context.gl.FRAMEBUFFER, this.fbo);

    this.width = Math.floor(this.context.canvas.width * this.scale);
    this.height = Math.floor(this.context.canvas.height * this.scale);

    this.textures = range(this.numTextures).map(i => {
      const fboTexture = this.context.createTexture();
      this.context.gl.bindTexture(this.context.gl.TEXTURE_2D, fboTexture);
      if (this.usesFloatingPointTextures && this.context.floatingPointTexturesSupported) {
        this.context.gl.texImage2D(
          this.context.gl.TEXTURE_2D,
          0,
          this.context.gl.RGBA32F,
          this.width,
          this.height,
          0,
          this.context.gl.RGBA,
          this.context.gl.FLOAT,
          null
        );
      } else {
        if (this.usesFloatingPointTextures) {
          console.error(
            `Your system is lacking the "EXT_color_buffer_float" extension, which is required for
            floating-point textures.'
          )`
          );
        }
        this.context.gl.texImage2D(
          this.context.gl.TEXTURE_2D,
          0,
          this.context.gl.RGBA,
          this.width,
          this.height,
          0,
          this.context.gl.RGBA,
          this.context.gl.UNSIGNED_BYTE,
          null
        );
      }
      this.context.gl.framebufferTexture2D(
        this.context.gl.FRAMEBUFFER,
        getColorAttachmentNumber(this.context.gl, i),
        this.context.gl.TEXTURE_2D,
        fboTexture,
        0
      );
      return fboTexture;
    });

    this.context.gl.drawBuffers(
      range(this.numTextures).map(i => getColorAttachmentNumber(this.context.gl, i))
    );
  }

  /** @internal */
  private destroy(): void {
    for (const texture of this.textures) {
      this.context.gl.deleteTexture(texture);
    }
    this.context.gl.deleteFramebuffer(this.fbo);
  }

  /** @internal */
  public bind(): boolean {
    if (
      this.width !== Math.floor(this.context.canvas.width * this.scale) ||
      this.height !== Math.floor(this.context.canvas.height * this.scale)
    ) {
      this.init();
    } else {
      this.context.gl.bindFramebuffer(this.context.gl.FRAMEBUFFER, this.fbo);
    }
    return false;
  }

  /** @internal */
  public activate(location: WebGLUniformLocation, shader: Shader): void {
    this.getTexture(0).activate(location, shader);
  }

  /**
   * Get a specific texture from the framebuffer by index.
   * Useful for frame buffers with multiple textures.
   *
   * @param index Index of the texture to get.
   * @returns The texture.
   */
  public getTexture(index: number): FramebufferTexture {
    return {
      activate: (location: WebGLUniformLocation, shader: Shader) => {
        this.context.gl.uniform1i(location, shader.getTextureCounter());
        this.context.gl.activeTexture(
          getTextureNumber(this.context.gl, shader.getTextureCounter())
        );
        this.context.gl.bindTexture(this.context.gl.TEXTURE_2D, this.textures[index]);
        this.context.setActiveTextureParams(undefined, this.usesFloatingPointTextures);
        shader.incTextureCounter();
      },
    };
  }

  /**
   * Render buffer to the `Context`s canvas.
   */
  public flush(index = 0): void {
    this.context.blitShader.draw(this.context.out, {
      u_texture: this.getTexture(index),
    });
  }
}
