import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function BookingDialog({
  children,
  busy,
  onClose,
}: {
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="booking-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <span className="dialog-eyebrow">Your trial booking</span>
          <h2 id="dialog-title">One step closer to discovery</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close booking"
          disabled={busy}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <ol className="booking-steps" aria-label="Booking progress">
        <li>
          <span>
            <Check size={12} />
          </span>
          Child
        </li>
        <li>
          <span>
            <Check size={12} />
          </span>
          Class
        </li>
        <li aria-current="step">
          <span className="booking-step-current">3</span>Payment & status
        </li>
      </ol>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
