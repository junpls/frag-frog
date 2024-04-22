import {Context} from './context';
import {Framebuffer, FramebufferTexture} from './framebuffer';
import {RenderTarget} from './render-target';
import {Shader} from './shader';
import {UniformSource} from './texture-source';

export class Doublebuffer implements RenderTarget, UniformSource {
  /** @internal */
  private seedBuffer: UniformSource | undefined;
  /** @internal */
  private buffers: [Framebuffer, Framebuffer];
  /** @internal */
  private count = 0;
  /** @internal */
  private context!: Context;

  /** @internal */
  public get width() {
    return this.getWriteBuffer().width;
  }
  /** @internal */
  public get height() {
    return this.getWriteBuffer().height;
  }
  /** @internal */
  public readonly flipped = false;

  /** @internal */
  constructor(context: Context, useFloatingPointTextures: boolean) {
    this.context = context;
    this.buffers = [
      context.createFramebuffer(1, 1, useFloatingPointTextures),
      context.createFramebuffer(1, 1, useFloatingPointTextures),
    ];
  }

  /**
   * Explicitly set the initial value of the buffer.
   *
   * @param value Texture to seed the buffer with.
   */
  public seed(value: Framebuffer | TexImageSource | Doublebuffer) {
    this.seedBuffer = this.context.u.sampler2D(value);
    this.count = 0;
  }

  /** @internal */
  private getReadBuffer(): UniformSource {
    if (this.count === 0) {
      if (this.seedBuffer) {
        return this.seedBuffer;
      } else {
        throw new Error(
          'Cannot do an initial read from an unseeded double buffer. Please call `seed` first.'
        );
      }
    } else {
      return this.buffers[this.count % 2].getTexture(0);
    }
  }

  /** @internal */
  public getWriteBuffer(): Framebuffer {
    return this.buffers[(this.count + 1) % 2];
  }

  /**
   * Render buffer to the `Context`s canvas.
   */
  public flush(): void {
    this.context.blitShader.draw(this.context.out, {
      u_texture: this.getReadBuffer(),
    });
  }

  /** @internal */
  public advance(): void {
    this.count++;
  }

  /** @internal */
  public bind(): boolean {
    this.getWriteBuffer().bind();
    return false;
  }

  /** @internal */
  public activate(location: WebGLUniformLocation, shader: Shader): void {
    this.getReadBuffer().activate(location, shader);
  }
}
