"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./button.js";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog.js";
import { Spinner } from "./spinner.js";
import { cn } from "../lib/utils.js";

export interface ConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional element that opens the dialog (rendered with asChild). */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra content between the description and the buttons. */
  children?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** `destructive` paints the confirm button red: leaving, resigning, deleting. */
  variant?: "default" | "destructive";
  /**
   * Runs on confirm. The dialog closes once it settles; if it returns a
   * promise the buttons are disabled meanwhile, and a rejection leaves the
   * dialog open so the person can retry or cancel.
   */
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * A question that must be answered: "Leave the match?", "Resign?".
 *
 * Built on the Dialog primitive with alert-dialog behaviour layered on, as
 * Radix's own AlertDialog does: role="alertdialog", a click outside does not
 * dismiss it (an accidental tap must not count as an answer), and focus
 * starts on Cancel so a stray Enter takes the safe way out. Escape still
 * cancels. Closing returns focus to whatever had it when the question opened
 * (DialogContent does this), so a question asked from a menu button and
 * cancelled lands back on that button, trigger or no trigger.
 */
export function ConfirmDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  icon,
  className,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const [pending, setPending] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) onCancel?.();
    setOpen(next);
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Stay open: the caller reports its own error, and the person can retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className={cn("max-w-md", className)}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader className="pr-0">
          {icon && (
            <div
              className={cn(
                "mb-2 flex h-11 w-11 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5",
                variant === "destructive"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary-accent",
              )}
              aria-hidden
            >
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="mt-2">
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={() => void handleConfirm()}
          >
            {pending && <Spinner size="xs" tone="current" label="Working" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}
