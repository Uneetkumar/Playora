import * as React from "react";
import { cn } from "../lib/utils.js";

/**
 * A plain <label>. Upstream shadcn wraps @radix-ui/react-label, which only
 * adds double-click text-selection prevention; not worth a dependency.
 * `peer-disabled` dims the label when it follows a disabled `peer` control.
 */
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";
