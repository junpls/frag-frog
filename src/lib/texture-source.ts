import {Shader} from './shader';

export interface UniformSource {
  /** @internal */
  activate(location: WebGLUniformLocation, shader: Shader): void;
}
