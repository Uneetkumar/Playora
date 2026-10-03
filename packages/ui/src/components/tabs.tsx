"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/utils.js";
import { focusRing } from "../lib/styles.js";

/**
 * Tabs on Radix: role="tablist"/"tab"/"tabpanel" wired together, arrow keys
 * move between tabs, and each panel is labelled by its tab.
 *
 * Two looks, chosen on the list and inherited by its triggers through context:
 * `segmented` (default) — a pill track for switching views of one thing — and
 * `underline` for page-level sections such as a profile's tabs.
 */

type TabsListVariant = "segmented" | "underline";
const ListVariant = React.createContext<TabsListVariant>("segmented");

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsListVariant;
}

export const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "segmented", ...props }, ref) => (
    <ListVariant.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          variant === "segmented"
            ? "inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-surface p-1 text-muted-foreground"
            : "flex items-center gap-6 border-b border-border text-muted-foreground",
          className,
        )}
        {...props}
      />
    </ListVariant.Provider>
  ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(ListVariant);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-hover ease-out-expo",
        "hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        focusRing,
        variant === "segmented"
          ? "h-full rounded-md px-3 data-[state=active]:bg-raised data-[state=active]:text-foreground data-[state=active]:shadow-card"
          : "-mb-px border-b-2 border-transparent px-1 pb-3 pt-1 data-[state=active]:border-primary data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 rounded-lg", focusRing, className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/* -------------------------------------------------------------------------- */
/* Legacy one-call form                                                       */
/* -------------------------------------------------------------------------- */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface SimpleTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

/**
 * The original Tabs API — a row of tabs from an array, with optional counts —
 * now rendered through the Radix parts above. It has no panels: the caller
 * swaps the content below it, so the triggers' `aria-controls` points nowhere.
 * New code should compose TabsList/TabsTrigger/TabsContent instead.
 */
export function SimpleTabs({ tabs, activeTab, onTabChange, className }: SimpleTabsProps) {
  return (
    <TabsPrimitive.Root value={activeTab} onValueChange={onTabChange}>
      <TabsList className={className}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="rounded-full bg-foreground/10 px-1.5 text-[11px] font-bold tabular-nums leading-4">
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsPrimitive.Root>
  );
}

type TabsRootProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

/**
 * Either the Radix root (`value` / `defaultValue` / `onValueChange`, composed
 * with TabsList, TabsTrigger and TabsContent) or the legacy array form
 * (`tabs` / `activeTab` / `onTabChange`), told apart by `tabs`.
 */
export type TabsProps =
  | (TabsRootProps & { tabs?: never; activeTab?: never; onTabChange?: never })
  | SimpleTabsProps;

export const Tabs = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Root>, TabsProps>(
  (props, ref) => {
    if (props.tabs !== undefined) return <SimpleTabs {...props} />;
    return <TabsPrimitive.Root ref={ref} {...props} />;
  },
);
Tabs.displayName = "Tabs";
