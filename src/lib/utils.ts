import {Doublebuffer} from './doublebuffer';
import {Framebuffer} from './framebuffer';
import {ITextureParameters} from './shader';

/** @internal */
export function range(end: number): number[] {
  return [...new Array(end).keys()];
}

/** @internal */
export function getTextureNumber(gl: WebGL2RenderingContext, index: number): number {
  switch (index) {
    case 0:
      return gl.TEXTURE0;
    case 1:
      return gl.TEXTURE1;
    case 2:
      return gl.TEXTURE2;
    case 3:
      return gl.TEXTURE3;
    case 4:
      return gl.TEXTURE4;
    case 5:
      return gl.TEXTURE5;
    case 6:
      return gl.TEXTURE6;
    case 7:
      return gl.TEXTURE7;
    case 8:
      return gl.TEXTURE8;
    case 9:
      return gl.TEXTURE9;
    case 10:
      return gl.TEXTURE10;
    case 11:
      return gl.TEXTURE11;
    case 12:
      return gl.TEXTURE12;
    case 13:
      return gl.TEXTURE13;
    case 14:
      return gl.TEXTURE14;
    case 15:
      return gl.TEXTURE15;
    case 16:
      return gl.TEXTURE16;
    case 17:
      return gl.TEXTURE17;
    case 18:
      return gl.TEXTURE18;
    case 19:
      return gl.TEXTURE19;
    case 20:
      return gl.TEXTURE20;
    case 21:
      return gl.TEXTURE21;
    case 22:
      return gl.TEXTURE22;
    case 23:
      return gl.TEXTURE23;
    case 24:
      return gl.TEXTURE24;
    case 25:
      return gl.TEXTURE25;
    case 26:
      return gl.TEXTURE26;
    case 27:
      return gl.TEXTURE27;
    case 28:
      return gl.TEXTURE28;
    case 29:
      return gl.TEXTURE29;
    case 30:
      return gl.TEXTURE30;
    case 31:
      return gl.TEXTURE31;
    default:
      throw new Error('Invalid texture index');
  }
}

/** @internal */
export function getColorAttachmentNumber(gl: WebGL2RenderingContext, index: number): number {
  switch (index) {
    case 0:
      return gl.COLOR_ATTACHMENT0;
    case 1:
      return gl.COLOR_ATTACHMENT1;
    case 2:
      return gl.COLOR_ATTACHMENT2;
    case 3:
      return gl.COLOR_ATTACHMENT3;
    case 4:
      return gl.COLOR_ATTACHMENT4;
    case 5:
      return gl.COLOR_ATTACHMENT5;
    case 6:
      return gl.COLOR_ATTACHMENT6;
    case 7:
      return gl.COLOR_ATTACHMENT7;
    case 8:
      return gl.COLOR_ATTACHMENT8;
    case 9:
      return gl.COLOR_ATTACHMENT9;
    case 10:
      return gl.COLOR_ATTACHMENT10;
    case 11:
      return gl.COLOR_ATTACHMENT11;
    case 12:
      return gl.COLOR_ATTACHMENT12;
    case 13:
      return gl.COLOR_ATTACHMENT13;
    case 14:
      return gl.COLOR_ATTACHMENT14;
    case 15:
      return gl.COLOR_ATTACHMENT15;
    default:
      throw new Error('Invalid attachment index');
  }
}

/** @internal */
export function isTexImageSource(value: unknown): value is TexImageSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    'width' in value &&
    'height' in value &&
    !(value instanceof Framebuffer) &&
    !(value instanceof Doublebuffer)
  );
}
