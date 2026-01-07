"use client"

import * as React from "react"

interface AccordionProps {
  type?: "single" | "multiple"
  children: React.ReactNode
  className?: string
}

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

const Accordion = ({ type = "single", children, className }: AccordionProps) => {
  const [openItems, setOpenItems] = React.useState<string[]>([])

  const handleToggle = (value: string) => {
    if (type === "single") {
      setOpenItems(openItems.includes(value) ? [] : [value])
    } else {
      setOpenItems(prev => 
        prev.includes(value) 
          ? prev.filter(item => item !== value)
          : [...prev, value]
      )
    }
  }

  return (
    <div className={`w-full ${className || ''}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { 
            openItems, 
            onToggle: handleToggle,
            type 
          } as any)
        }
        return child
      })}
    </div>
  )
}

const AccordionItem = ({ value, children, className }: AccordionItemProps) => {
  return (
    <div className={`border-b ${className || ''}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { value } as any)
        }
        return child
      })}
    </div>
  )
}

const AccordionTrigger = ({ children, className }: AccordionTriggerProps) => {
  const context = React.useContext(AccordionContext)
  if (!context) throw new Error("AccordionTrigger must be used within AccordionItem")

  const isOpen = context.openItems.includes(context.value)

  return (
    <button
      className={`flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline ${className || ''}`}
      onClick={() => context.onToggle(context.value)}
    >
      {children}
      <svg 
        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

const AccordionContent = ({ children, className }: AccordionContentProps) => {
  const context = React.useContext(AccordionContext)
  if (!context) throw new Error("AccordionContent must be used within AccordionItem")

  const isOpen = context.openItems.includes(context.value)

  if (!isOpen) return null

  return (
    <div className={`overflow-hidden text-sm pb-4 pt-0 ${className || ''}`}>
      {children}
    </div>
  )
}

const AccordionContext = React.createContext<{
  value: string
  openItems: string[]
  onToggle: (value: string) => void
  type: "single" | "multiple"
} | null>(null)

const AccordionItemWithContext = ({ value, children, className }: AccordionItemProps) => {
  const context = React.useContext(AccordionContext)
  if (!context) throw new Error("AccordionItem must be used within Accordion")

  return (
    <AccordionContext.Provider value={{ ...context, value }}>
      <div className={`border-b ${className || ''}`}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

export { Accordion, AccordionTrigger, AccordionContent }
export { AccordionItemWithContext as AccordionItem }