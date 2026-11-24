import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ImageProcessor, widthsFor } from './image-processor.js';

function photo(width: number, height: number): ReturnType<typeof sharp> {
  return sharp({ create: { width, height, channels: 3, background: { r: 108, g: 76, b: 255 } } });
}

describe('widthsFor', () => {
  it.each([
    [4000, [320, 640, 1280, 2560]],
    [2560, [320, 640, 1280, 2560]],
    [2000, [320, 640, 1280, 2000]],
    [1280, [320, 640, 1280]],
    [1000, [320, 640, 1000]],
    [320, [320]],
    [100, [100]],
  ])('for a photo %i pixels wide stores the widths %j', (width, widths) => {
    expect(widthsFor(width)).toEqual(widths);
  });
});

describe('ImageProcessor', () => {
  const processor = new ImageProcessor();

  it('makes WebP copies of every width, smallest first, and keeps the proportions', async () => {
    const copies = await processor.process(await photo(3000, 2000).jpeg().toBuffer());

    expect(copies.map(({ width, height }) => [width, height])).toEqual([
      [320, 213],
      [640, 427],
      [1280, 853],
      [2560, 1707],
    ]);

    for (const copy of copies) {
      const metadata = await sharp(copy.body).metadata();

      expect(metadata).toMatchObject({ format: 'webp', width: copy.width, height: copy.height });
    }
  });

  it('never enlarges a small photo', async () => {
    const copies = await processor.process(await photo(500, 300).png().toBuffer());

    expect(copies.map(({ width, height }) => [width, height])).toEqual([
      [320, 192],
      [500, 300],
    ]);
  });

  it('turns a photo the right way up', async () => {
    // Orientation 6 means the camera was held sideways: the picture is stored lying on its side.
    const sideways = await photo(400, 300).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const copies = await processor.process(sideways);

    expect(copies.map(({ width, height }) => [width, height])).toEqual([[300, 400]]);
  });

  it('removes the data a camera adds to a photo', async () => {
    const withExif = await photo(400, 300)
      .withExif({ IFD0: { Make: 'Bluberi Camera', Copyright: 'Jana' } })
      .jpeg()
      .toBuffer();

    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const [copy] = await processor.process(withExif);
    const metadata = await sharp(copy?.body).metadata();

    expect(metadata.exif).toBeUndefined();
    expect(copy?.body.includes('Bluberi Camera')).toBe(false);
  });

  it('keeps transparency', async () => {
    const transparent = await sharp({
      create: { width: 400, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const [copy] = await processor.process(transparent);

    expect((await sharp(copy?.body).metadata()).hasAlpha).toBe(true);
  });

  it.each([
    ['a text file', (): Promise<Buffer> => Promise.resolve(Buffer.from('not a photo at all'))],
    ['an empty file', (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0))],
    ['a GIF', (): Promise<Buffer> => photo(100, 100).gif().toBuffer()],
    ['a TIFF', (): Promise<Buffer> => photo(100, 100).tiff().toBuffer()],
    [
      'a broken JPEG',
      async (): Promise<Buffer> => (await photo(400, 300).jpeg().toBuffer()).subarray(0, 200),
    ],
  ])('refuses %s', async (_name, file) => {
    await expect(processor.process(await file())).rejects.toMatchObject({
      code: 'IMAGE_INVALID',
    });
  });
});
