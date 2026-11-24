'use client';

import { Button } from '@bluberi/ui/components/button';
import { Dialog } from '@bluberi/ui/components/dialog';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** The side of the square a logo is saved as, in pixels. */
const logoSide = 512;
/** How far a person can zoom in. */
const maxZoom = 3;
/** How far an arrow key moves the picture: a part of what is seen. */
const keyStep = 0.05;

export interface LogoCropperLabels {
  readonly title: string;
  readonly text: string;
  /** What the slider does, for screen readers. */
  readonly zoom: string;
  readonly use: string;
  readonly close: string;
}

interface LogoCropperProps {
  /** The picture the person chose. Null while nothing is being adjusted. */
  readonly file: File | null;
  readonly labels: LogoCropperLabels;
  readonly onCancel: () => void;
  /** Called with the square the person cut out of the picture. */
  readonly onCrop: (logo: Blob) => void;
  /** The file cannot be read as a picture. */
  readonly onInvalid: () => void;
}

/** What is seen of the picture: how close, and where its middle is, in pixels of the picture. */
interface View {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

/** The side of the square that is seen, in pixels of the picture. */
function seenSide(picture: ImageBitmap, zoom: number): number {
  return Math.min(picture.width, picture.height) / zoom;
}

/** Keeps the square inside the picture, so a logo never has an empty edge. */
function inside(picture: ImageBitmap, view: View): View {
  const half = seenSide(picture, view.zoom) / 2;

  return {
    zoom: view.zoom,
    x: Math.min(Math.max(view.x, half), picture.width - half),
    y: Math.min(Math.max(view.y, half), picture.height - half),
  };
}

function draw(canvas: HTMLCanvasElement, picture: ImageBitmap, view: View): void {
  const side = seenSide(picture, view.zoom);
  const context = canvas.getContext('2d');

  context?.clearRect(0, 0, canvas.width, canvas.height);
  context?.drawImage(
    picture,
    view.x - side / 2,
    view.y - side / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

/**
 * Lets a seller choose which square of a picture becomes the logo: the picture is dragged
 * into place and zoomed. It starts in the middle. The square is cut out in the browser,
 * so only the logo itself is uploaded.
 */
export function LogoCropper({ file, labels, onCancel, onCrop, onInvalid }: LogoCropperProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragFrom = useRef<{ readonly x: number; readonly y: number }>(undefined);
  const [picture, setPicture] = useState<ImageBitmap>();
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });

  // The newest callback without reading the file again when the page draws.
  const invalid = useRef(onInvalid);

  useEffect(() => {
    invalid.current = onInvalid;
  }, [onInvalid]);

  useEffect(() => {
    if (!file) {
      return;
    }

    let current = true;
    let opened: ImageBitmap | undefined;

    createImageBitmap(file).then(
      (bitmap) => {
        if (!current) {
          bitmap.close();

          return;
        }

        opened = bitmap;
        setPicture(bitmap);
        setView({ zoom: 1, x: bitmap.width / 2, y: bitmap.height / 2 });
      },
      () => {
        if (current) {
          invalid.current();
        }
      },
    );

    return () => {
      current = false;
      opened?.close();
      setPicture(undefined);
    };
  }, [file]);

  useEffect(() => {
    if (canvas.current && picture) {
      draw(canvas.current, picture, view);
    }
  }, [picture, view]);

  /** Moves the picture by a part of what is seen: one is the whole side of the square. */
  function move(right: number, down: number): void {
    if (!picture) {
      return;
    }

    const side = seenSide(picture, view.zoom);

    setView(
      inside(picture, { zoom: view.zoom, x: view.x - right * side, y: view.y - down * side }),
    );
  }

  function drag(event: PointerEvent<HTMLCanvasElement>): void {
    const from = dragFrom.current;

    if (!from) {
      return;
    }

    const width = event.currentTarget.clientWidth;

    dragFrom.current = { x: event.clientX, y: event.clientY };
    move((event.clientX - from.x) / width, (event.clientY - from.y) / width);
  }

  function moveWithKey(event: KeyboardEvent<HTMLCanvasElement>): void {
    const steps: Partial<Record<string, readonly [number, number]>> = {
      ArrowLeft: [keyStep, 0],
      ArrowRight: [-keyStep, 0],
      ArrowUp: [0, keyStep],
      ArrowDown: [0, -keyStep],
    };
    const step = steps[event.key];

    if (step) {
      event.preventDefault();
      move(...step);
    }
  }

  return (
    <Dialog open={file !== null} onClose={onCancel} title={labels.title} closeLabel={labels.close}>
      <p className="mt-1.5 text-[13px] font-semibold text-gray-600">{labels.text}</p>
      <div className="mt-5 flex flex-col items-center gap-5">
        <canvas
          ref={canvas}
          width={logoSide}
          height={logoSide}
          tabIndex={0}
          aria-label={labels.text}
          className="size-64 max-w-full cursor-grab touch-none rounded-lg bg-gray-100 outline-none focus-visible:ring-4 focus-visible:ring-berry-500/14 active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragFrom.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={drag}
          onPointerUp={() => {
            dragFrom.current = undefined;
          }}
          onPointerCancel={() => {
            dragFrom.current = undefined;
          }}
          onKeyDown={moveWithKey}
        />
        <input
          type="range"
          aria-label={labels.zoom}
          min={1}
          max={maxZoom}
          step={0.01}
          value={view.zoom}
          disabled={!picture}
          className="w-64 max-w-full cursor-pointer accent-berry-500"
          onChange={(event) => {
            if (picture) {
              setView(inside(picture, { ...view, zoom: Number(event.target.value) }));
            }
          }}
        />
        <Button
          className="w-full"
          disabled={!picture}
          onClick={() => {
            if (!picture) {
              return;
            }

            const square = document.createElement('canvas');

            square.width = logoSide;
            square.height = logoSide;
            draw(square, picture, view);
            square.toBlob((logo) => {
              if (logo) {
                onCrop(logo);
              } else {
                onInvalid();
              }
            }, 'image/png');
          }}
        >
          {labels.use}
        </Button>
      </div>
    </Dialog>
  );
}
