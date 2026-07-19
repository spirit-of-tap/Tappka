"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// Re-export Dialog types for consumers
export type { DialogProps } from "@radix-ui/react-dialog"

interface ResponsiveDialogContextValue {
  isMobile: boolean
}

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue>({
  isMobile: false,
})

function ResponsiveDialog({
  children,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true }}>
        <Drawer {...props}>{children}</Drawer>
      </ResponsiveDialogContext.Provider>
    )
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false }}>
      <Dialog {...props}>{children}</Dialog>
    </ResponsiveDialogContext.Provider>
  )
}

function ResponsiveDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerTrigger {...props} />
  return <DialogTrigger {...props} />
}

function ResponsiveDialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) {
    // Strip max-w-* classes that would constrain the full-width drawer
    const drawerClassName = className
      ?.split(" ")
      .filter((c) => !c.startsWith("max-w-"))
      .join(" ")
    return (
      <DrawerContent className={drawerClassName} {...props}>
        <div className="overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </DrawerContent>
    )
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  )
}

function ResponsiveDialogHeader({
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerHeader {...props} />
  return <DialogHeader {...props} />
}

function ResponsiveDialogFooter({
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerFooter {...props} />
  return <DialogFooter {...props} />
}

function ResponsiveDialogTitle({
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerTitle {...props} />
  return <DialogTitle {...props} />
}

function ResponsiveDialogDescription({
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerDescription {...props} />
  return <DialogDescription {...props} />
}

function ResponsiveDialogClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) return <DrawerClose {...props} />
  return <DialogClose {...props} />
}

export {
  ResponsiveDialog as Dialog,
  ResponsiveDialogTrigger as DialogTrigger,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogClose as DialogClose,
}
