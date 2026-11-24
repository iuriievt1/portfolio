'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  readonly open: boolean;
  /** Called when the person closes the dialog: the X button, the Escape key or a click beside it. */
  readonly onClose: () => void;
  readonly title: string;
  /** What the X button does, for screen readers and as a hint. */
  readonly closeLabel: string;
  readonly children: ReactNode;
}

/**
 * A window over the page for a short form. It is the dialog of the browser itself,
 * so the focus stays inside it, Escape closes it and the page behind cannot be clicked.
 */
export function Dialog({ open, onClose, title, closeLabel, children }: DialogProps) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = element.current;

    if (open && dialog?.open === false) {
      dialog.showModal();
    }

    if (!open && dialog?.open === true) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={element}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // The dialog has no padding, so a click on the element itself is a click beside the window.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-110 translate-y-2 rounded-lg bg-white text-berry-950 opacity-0 shadow-xl transition-[opacity,translate,overlay,display] transition-discrete duration-200 ease-out backdrop:bg-berry-950/0 backdrop:transition-[background-color,overlay,display] backdrop:transition-discrete backdrop:duration-200 open:translate-y-0 open:opacity-100 open:backdrop:bg-berry-950/40 starting:open:translate-y-2 starting:open:opacity-0 starting:open:backdrop:bg-berry-950/0"
    >
      <div className="relative flex flex-col p-6">
        <h2 id={titleId} className="pr-10 text-xl font-extrabold tracking-[-0.02em]">
          {title}
        </h2>
        {children}
        {/* After the content, so the dialog opens with the focus in its first field, not on the X. */}
        <button
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          className="absolute top-5 right-4.5 flex size-8 items-center justify-center rounded-xs text-gray-600 transition-colors outline-none hover:bg-gray-100 hover:text-berry-950 focus-visible:ring-4 focus-visible:ring-berry-500/14 [&_svg]:size-4.5"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
    </dialog>
  );
}
