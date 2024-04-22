export interface RenderTarget {
  /** @internal */
  readonly width: number;
  /** @internal */
  readonly height: number;
  /** @internal */
  readonly flipped: boolean;
  /** @internal */
  bind(): void;
}
