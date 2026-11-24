'use client';

import { Children, useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

interface CarouselProps {
  /** How often the row moves on by itself, in milliseconds. */
  readonly everyMs: number;
  /** The width of a card at each screen size. */
  readonly cardClassName: string;
  /** The cards. They are drawn twice, so the row can go round and round. */
  readonly children: ReactNode;
}

/** How long the row has to stand still before it is put back to the first copy of the cards. */
const settledAfterMs = 140;

/**
 * A row of cards that goes round: after the last card comes the first one again. It moves on
 * by itself, one card at a time, and a person can swipe it or drag it with the mouse.
 * It stands still while a person points at it or touches it, while it is off the screen
 * and when the system asks for less motion.
 */
export function Carousel({ everyMs, cardClassName, children }: CarouselProps) {
  const track = useRef<HTMLUListElement>(null);
  const held = useRef(false);
  const onScreen = useRef(false);
  const drag = useRef<{ startX: number; startLeft: number }>(undefined);
  const cards = Children.toArray(children);

  useEffect(() => {
    const list = track.current;

    if (!list) {
      return undefined;
    }

    /** How far apart two cards are, and how long one copy of the cards is. */
    const measure = (): { step: number; lap: number } => {
      const [first, second] = list.children;
      const copy = list.children[cards.length];

      return first instanceof HTMLElement &&
        second instanceof HTMLElement &&
        copy instanceof HTMLElement
        ? { step: second.offsetLeft - first.offsetLeft, lap: copy.offsetLeft - first.offsetLeft }
        : { step: 0, lap: 0 };
    };

    // The second copy of the cards looks like the first one. When the row has gone past the
    // first copy it is put back by one lap, at once, and nobody sees a jump.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = (): void => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const { lap } = measure();

        if (lap === 0 || drag.current) {
          return;
        }

        if (list.scrollLeft > lap) {
          list.scrollTo({ left: list.scrollLeft - lap, behavior: 'instant' });
        } else if (list.scrollLeft <= 0) {
          list.scrollTo({ left: list.scrollLeft + lap, behavior: 'instant' });
        }
      }, settledAfterMs);
    };

    list.addEventListener('scroll', onScroll, { passive: true });

    const watcher = new IntersectionObserver(([entry]) => {
      onScreen.current = entry?.isIntersecting ?? false;
    });

    watcher.observe(list);

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = calm
      ? undefined
      : setInterval(() => {
          if (!held.current && onScreen.current && !document.hidden) {
            list.scrollBy({ left: measure().step, behavior: 'smooth' });
          }
        }, everyMs);

    return () => {
      list.removeEventListener('scroll', onScroll);
      watcher.disconnect();
      clearTimeout(settle);
      clearInterval(timer);
    };
  }, [cards.length, everyMs]);

  // A mouse cannot swipe, so it drags the row.
  function startDrag(event: PointerEvent<HTMLUListElement>): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    const list = event.currentTarget;

    drag.current = { startX: event.clientX, startLeft: list.scrollLeft };
    list.setPointerCapture(event.pointerId);
    // While the row follows the mouse it must not snap to a card or glide.
    list.style.scrollSnapType = 'none';
    list.style.scrollBehavior = 'auto';
  }

  function moveDrag(event: PointerEvent<HTMLUListElement>): void {
    if (drag.current) {
      event.currentTarget.scrollLeft =
        drag.current.startLeft - (event.clientX - drag.current.startX);
    }
  }

  function endDrag(event: PointerEvent<HTMLUListElement>): void {
    if (!drag.current) {
      return;
    }

    const list = event.currentTarget;

    drag.current = undefined;
    list.style.scrollSnapType = '';
    list.style.scrollBehavior = '';
    // Lets the row settle on the nearest card.
    list.scrollBy({ left: 0 });
  }

  return (
    <ul
      ref={track}
      onPointerEnter={() => {
        held.current = true;
      }}
      onPointerLeave={() => {
        held.current = false;
      }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="-mx-5 flex cursor-grab snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto scroll-smooth px-5 select-none [scrollbar-width:none] active:cursor-grabbing motion-reduce:scroll-auto sm:-mx-8 sm:scroll-px-8 sm:gap-4 sm:px-8 lg:mx-0 lg:scroll-px-0 lg:gap-5 lg:px-0 [&_img]:pointer-events-none [&::-webkit-scrollbar]:hidden"
    >
      {[false, true].map((copy) =>
        cards.map((card, index) => (
          <li
            // The cards never change places, so their place in the row names them.
            key={`${copy ? 'copy' : 'card'}-${String(index)}`}
            aria-hidden={copy || undefined}
            className={`flex-none snap-start ${cardClassName}`}
          >
            {card}
          </li>
        )),
      )}
    </ul>
  );
}
