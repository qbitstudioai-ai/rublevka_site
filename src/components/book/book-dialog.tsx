import { useLayoutEffect, useRef, type ReactNode } from "react";

export function BookDialog({
  title,
  children,
  close,
  contents = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  contents?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest("[inert], [hidden]"))
        trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      className={contents ? "book-dialog book-dialog--contents" : "book-dialog"}
      ref={dialog}
      aria-labelledby="dialog-heading"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <button className="close-dialog" onClick={close} aria-label="Закрыть">
        ×
      </button>
      <h2 id="dialog-heading">{title}</h2>
      {children}
    </dialog>
  );
}
