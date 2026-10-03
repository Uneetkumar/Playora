"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { overlayCloseClassName } from "../lib/styles.js";
import { useFocusReturn } from "../lib/focus-return.js";

/**
 * Modal dialog on Radix: focus trap, Escape and outside-click to dismiss,
 * scroll lock, and role="dialog" with aria-modal, labelled by DialogTitle and
 * described by DialogDescription. On close, focus goes back to whatever had
 * it when the dialog opened, with or without a DialogTrigger
 * (`useFocusReturn`).
 *
 * Modal only. Radix renders no overlay for `modal={false}`, and the content
 * lives inside the overlay here, so a non-modal dialog would render nothing;
 * the root does not accept `modal` for that reason. Use Popover for a panel
 * that leaves the page usable.
 *
 * Layout: the content sits *inside* the overlay, which is a scrolling flex
 * box, and centres itself with `m-auto`. Upstream shadcn instead centres the
 * content with translate(-50%, -50%), which the enter/exit keyframes then
 * overwrite (they animate `transform`), so it needs compensating slide
 * classes and still clips a dialog taller than the viewport. Auto margins
 * collapse to zero once the content overflows, so a tall dialog scrolls from
 * its top instead of losing it above the fold.
 */

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-modal flex overflow-y-auto bg-scrim p-4 sm:p-6",
      "duration-sheet data-[state=closed]:duration-sheet-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** The top-right close button. Turn off only for a dialog that must be answered. */
  showCloseButton?: boolean;
  overlayClassName?: string;
}

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    { className, children, showCloseButton = true, overlayClassName, onOpenAutoFocus, onCloseAutoFocus, ...props },
    ref,
  ) => {
    const focusReturn = useFocusReturn(onOpenAutoFocus, onCloseAutoFocus);
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName}>
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "relative m-auto grid w-full max-w-lg gap-4 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-overlay focus:outline-none",
              "duration-sheet ease-out-expo data-[state=closed]:duration-sheet-exit data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              className,
            )}
            {...props}
            {...focusReturn}
          >
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close className={overlayCloseClassName}>
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Right padding keeps a long title clear of the absolutely placed close button.
  return <div className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-bold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/* -------------------------------------------------------------------------- */
/* One-call dialog (and the pre-Radix API)                                    */
/* -------------------------------------------------------------------------- */

export interface SimpleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Applied to the dialog panel, e.g. a different max width. */
  className?: string;
}

/**
 * Title, optional description and a body, in one element. This was the whole
 * of the original hand-rolled Dialog's API; it now renders through the Radix
 * parts above, so callers keep their code and gain the accessibility.
 */
export function SimpleDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: SimpleDialogProps) {
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={className}
        // Radix warns when a dialog has no description unless told explicitly
        // that there is none.
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2">{children}</div>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}

/** Without `modal`: see the note at the top of this file. */
type DialogRootProps = Omit<React.ComponentProps<typeof DialogPrimitive.Root>, "modal">;

/**
 * Either the Radix root (`open` / `onOpenChange` / `defaultOpen`, composed with
 * DialogTrigger and DialogContent), or the legacy one-call form
 * (`isOpen` / `onClose` / `title`), told apart by `isOpen`. The `never` keys
 * stop the two shapes being mixed in one call.
 */
export type DialogProps =
  | (DialogRootProps & {
      isOpen?: never;
      onClose?: never;
      title?: never;
      description?: never;
      className?: never;
    })
  | SimpleDialogProps;

export function Dialog(props: DialogProps) {
  if (props.isOpen !== undefined) return <SimpleDialog {...props} />;
  return <DialogPrimitive.Root {...props} />;
}
