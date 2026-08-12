"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  [
    "group/tabs-list text-muted-foreground flex items-center",
    // A tab bar must never widen its container. Past that it scrolls, without a
    // track: a visible scrollbar under a row of tabs reads as a rendering fault.
    "max-w-full overflow-x-auto no-scrollbar",
    "group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:overflow-visible",
  ],
  {
    variants: {
      variant: {
        // The default: an underline bar. Reads as page navigation, survives long
        // labels and any number of sections, and does not box the content in.
        line: [
          "w-full justify-start gap-1 rounded-none bg-transparent",
          "group-data-[orientation=horizontal]/tabs:border-b",
          "group-data-[orientation=vertical]/tabs:border-l group-data-[orientation=vertical]/tabs:items-stretch",
        ],
        // Segmented control. For a true either/or toggle over the *same* content —
        // day vs week, list vs grid — not for navigating between sections. Sized by
        // its own padding rather than a fixed height, so a trigger carrying a count
        // is not squeezed into 36px.
        segmented:
          "w-fit justify-center rounded-lg bg-muted p-[3px] group-data-[orientation=horizontal]/tabs:min-h-9",
      },
    },
    defaultVariants: {
      variant: "line",
    },
  }
)

function TabsList({
  className,
  variant = "line",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Shared: typography, focus, disabled, icon sizing.
        "group/tabs-trigger relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground data-[state=active]:text-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",

        // Segmented: a raised chip filling the muted track. `self-stretch` replaces
        // the old `h-[calc(100%-1px)]`, which needed the list to keep a fixed height.
        "group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:self-stretch group-data-[variant=segmented]/tabs-list:rounded-md group-data-[variant=segmented]/tabs-list:border group-data-[variant=segmented]/tabs-list:border-transparent group-data-[variant=segmented]/tabs-list:px-2 group-data-[variant=segmented]/tabs-list:py-1",
        "group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-background group-data-[variant=segmented]/tabs-list:data-[state=active]:shadow-sm",
        "dark:group-data-[variant=segmented]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=segmented]/tabs-list:data-[state=active]:bg-input/30",

        // Line: the indicator sits *on* the list's border rather than floating a
        // magic number of pixels below the trigger, so it lines up at any padding.
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:pb-2.5 group-data-[variant=line]/tabs-list:pt-1.5",
        "group-data-[variant=line]/tabs-list:after:bg-primary group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:rounded-full group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity",
        "group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[orientation=horizontal]/tabs:group-data-[variant=line]/tabs-list:after:h-0.5",
        "group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:after:inset-y-0 group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:after:-left-px group-data-[orientation=vertical]/tabs:group-data-[variant=line]/tabs-list:after:w-0.5",
        "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",

        className
      )}
      {...props}
    />
  )
}

const tabsCountVariants = cva(
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums transition-colors",
  {
    variants: {
      tone: {
        /** Ambient — how many things are in there. */
        default:
          "bg-muted text-muted-foreground group-data-[variant=segmented]/tabs-list:bg-foreground/10 group-data-[state=active]/tabs-trigger:bg-primary/10 group-data-[state=active]/tabs-trigger:text-primary",
        /** Someone is waiting on you. Reserve it for one tab at most. */
        attention: "bg-destructive text-white",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
)

/**
 * Count pill for a tab label. Every call site was otherwise rebuilding the same
 * `Badge` with four class overrides, and none of them agreed on the sizing.
 * Renders nothing at zero — an empty list is not news.
 */
function TabsTriggerCount({
  count,
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof tabsCountVariants> & { count: number }) {
  if (count <= 0) return null

  return (
    <span
      data-slot="tabs-trigger-count"
      className={cn(tabsCountVariants({ tone }), className)}
      {...props}
    >
      {count}
    </span>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsTriggerCount,
  TabsContent,
  tabsListVariants,
}
