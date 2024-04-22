import {Shader} from './shader';
import {UniformSource} from './texture-source';
import {getTextureNumber} from './utils';

/** @internal */
export function wrapTexImageSource(
  gl: WebGL2RenderingContext,
  value: TexImageSource
): UniformSource {
  return {
    activate: (location: WebGLUniformLocation, shader: Shader) => {
      const texture = shader.getOrCreateTexture(value);
      gl.uniform1i(location, shader.getTextureCounter());
      gl.activeTexture(getTextureNumber(gl, shader.getTextureCounter()));
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.RGBA, gl.FLOAT, value);
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, value);
      shader.incTextureCounter();
    },
  };
}
