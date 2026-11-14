"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** A pop-up window built on the browser's own dialog element: it traps focus and closes with Esc. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    // Always close the dialog when it goes away, so the page is never left blocked behind it.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed background (not on the window itself) closes it.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card border border-white/15 bg-night-900 p-0 text-ink backdrop:bg-night-950/80 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-2xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-white/10 hover:text-ink"
            >
              <X aria-hidden className="size-6" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
