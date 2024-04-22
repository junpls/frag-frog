import {Context} from './context';

/**
 * Main entry point. Creates a {@link Context} from an {@link HTMLCanvasElement}.
 *
 * @param canvas The canvas from which to create the context.
 * It is important, that {@link HTMLCanvasElement.getContext} was not already called on this
 * canvas before!
 * @returns The Frag Frog's {@link Context} object.
 */
export function fragFrog(canvas: HTMLCanvasElement): Context {
  return new Context(canvas);
}
