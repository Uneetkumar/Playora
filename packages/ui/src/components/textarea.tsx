import * as React from "react";
import { cn } from "../lib/utils.js";
import { fieldClassName } from "../lib/styles.js";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("flex min-h-20", fieldClassName, className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
