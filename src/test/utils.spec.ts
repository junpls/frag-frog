import {expect} from '@esm-bundle/chai';
import {getColorAttachmentNumber, getTextureNumber} from '../lib/utils';

describe('utils', () => {
  let ctx: WebGL2RenderingContext;

  beforeEach(() => {
    const canvas = document.createElement('canvas');
    ctx = canvas.getContext('webgl2')!;
  });

  it('throws on getting invalid texture number index', () => {
    expect(() => {
      getTextureNumber(ctx, -1);
    }).to.throw();

    expect(() => {
      getTextureNumber(ctx, 32);
    }).to.throw();
  });

  it('returns texture number within valid range', () => {
    for (let i = 0; i < 32; i++) {
      expect(getTextureNumber(ctx, i)).to.exist;
    }
  });

  it('throws on getting invalid color attachment index', () => {
    expect(() => {
      getColorAttachmentNumber(ctx, -1);
    }).to.throw();

    expect(() => {
      getColorAttachmentNumber(ctx, 16);
    }).to.throw();
  });

  it('returns color attachment number within valid range', () => {
    for (let i = 0; i < 16; i++) {
      expect(getColorAttachmentNumber(ctx, i)).to.exist;
    }
  });
});
