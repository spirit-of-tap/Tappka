"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ResponsiveAlertDialogContextValue {
  isMobile: boolean
}

const ResponsiveAlertDialogContext =
  React.createContext<ResponsiveAlertDialogContextValue>({ isMobile: false })

function ResponsiveAlertDialog({
  children,
  ...props
}: React.ComponentProps<typeof AlertDialog>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <ResponsiveAlertDialogContext.Provider value={{ isMobile: true }}>
        <Drawer {...props}>{children}</Drawer>
      </ResponsiveAlertDialogContext.Provider>
    )
  }

  return (
    <ResponsiveAlertDialogContext.Provider value={{ isMobile: false }}>
      <AlertDialog {...props}>{children}</AlertDialog>
    </ResponsiveAlertDialogContext.Provider>
  )
}

function ResponsiveAlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) return <DrawerTrigger {...props} />
  return <AlertDialogTrigger {...props} />
}

function ResponsiveAlertDialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogContent>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) {
    return (
      <DrawerContent>
        <div className="overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </DrawerContent>
    )
  }
  return (
    <AlertDialogContent className={className} {...props}>
      {children}
    </AlertDialogContent>
  )
}

function ResponsiveAlertDialogHeader({
  ...props
}: React.ComponentProps<typeof AlertDialogHeader>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) return <DrawerHeader {...props} />
  return <AlertDialogHeader {...props} />
}

function ResponsiveAlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogFooter>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) {
    return (
      <DrawerFooter className={cn("flex-col-reverse", className)} {...props} />
    )
  }
  return <AlertDialogFooter className={className} {...props} />
}

function ResponsiveAlertDialogTitle({
  ...props
}: React.ComponentProps<typeof AlertDialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) return <DrawerTitle {...props} />
  return <AlertDialogTitle {...props} />
}

function ResponsiveAlertDialogDescription({
  ...props
}: React.ComponentProps<typeof AlertDialogDescription>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) return <DrawerDescription {...props} />
  return <AlertDialogDescription {...props} />
}

function ResponsiveAlertDialogAction({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogAction>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) {
    return (
      <DrawerClose asChild>
        <Button className={cn("w-full", className)} onClick={onClick} {...props}>
          {children}
        </Button>
      </DrawerClose>
    )
  }
  return (
    <AlertDialogAction className={className} onClick={onClick} {...props}>
      {children}
    </AlertDialogAction>
  )
}

function ResponsiveAlertDialogCancel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogCancel>) {
  const { isMobile } = React.useContext(ResponsiveAlertDialogContext)
  if (isMobile) {
    return (
      <DrawerClose asChild>
        <Button
          variant="outline"
          className={cn("w-full", className)}
          {...props}
        >
          {children}
        </Button>
      </DrawerClose>
    )
  }
  return (
    <AlertDialogCancel className={className} {...props}>
      {children}
    </AlertDialogCancel>
  )
}

export {
  ResponsiveAlertDialog as AlertDialog,
  ResponsiveAlertDialogTrigger as AlertDialogTrigger,
  ResponsiveAlertDialogContent as AlertDialogContent,
  ResponsiveAlertDialogHeader as AlertDialogHeader,
  ResponsiveAlertDialogFooter as AlertDialogFooter,
  ResponsiveAlertDialogTitle as AlertDialogTitle,
  ResponsiveAlertDialogDescription as AlertDialogDescription,
  ResponsiveAlertDialogAction as AlertDialogAction,
  ResponsiveAlertDialogCancel as AlertDialogCancel,
}
