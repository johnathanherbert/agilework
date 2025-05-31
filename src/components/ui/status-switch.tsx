"use client"

import * as React from "react"
import { ItemStatus } from "@/types"
import { cn } from "@/lib/utils"
import { Check, Clock, AlertCircle, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface StatusSwitchProps {
  value: ItemStatus
  onValueChange: (value: ItemStatus) => void
  disabled?: boolean
  className?: string
  size?: 'default' | 'sm'
}

export function StatusSwitch({
  value,
  onValueChange,
  disabled = false,
  className,
  size = 'default',
}: StatusSwitchProps) {  const statuses: ItemStatus[] = ["Ag. Pagamento", "Pago", "Pago Parcial"]
  
  // Get color classes for each status
  const getStatusClasses = (status: ItemStatus): string => {
    switch (status) {
      case "Ag. Pagamento":
        return "border-red-500 bg-red-50 text-red-700 hover:bg-red-100 data-[state=active]:bg-red-100 dark:border-red-400 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30"
      case "Pago":
        return "border-green-500 bg-green-50 text-green-700 hover:bg-green-100 data-[state=active]:bg-green-100 dark:border-green-400 dark:bg-green-950/20 dark:text-green-300 dark:hover:bg-green-900/30"
      case "Pago Parcial":
        return "border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 data-[state=active]:bg-yellow-100 dark:border-yellow-400 dark:bg-yellow-950/20 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
      default:
        return "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-300"
    }
  }
  
  // Get icon for each status
  const getStatusIcon = (status: ItemStatus) => {
    switch (status) {
      case "Ag. Pagamento":
        return <Clock className="h-4 w-4 mr-1 text-red-500 dark:text-red-400" />
      case "Pago":
        return <Check className="h-4 w-4 mr-1 text-green-500 dark:text-green-400" />
      case "Pago Parcial":
        return <AlertCircle className="h-4 w-4 mr-1 text-yellow-500 dark:text-yellow-400" />
      default:
        return null
    }
  }
  
  // Get display text for each status
  const getStatusText = (status: ItemStatus): string => {
    switch (status) {
      case "Ag. Pagamento":
        return "Aguardando"
      case "Pago":
        return "Pago"
      case "Pago Parcial":
        return "Parcial"
      default:
        return status
    }
  }
    return (
    <DropdownMenu>      <DropdownMenuTrigger        disabled={disabled}        className={cn(
          "flex items-center justify-between rounded-md border transition-colors",
          getStatusClasses(value),
          size === 'default' ? "px-4 py-1.5" : "px-3 py-1",
          disabled && "opacity-50 cursor-not-allowed",
          "w-full", // Sempre ocupa 100% da largura do container pai
          className
        )}
      >        <div className="flex items-center">
          {getStatusIcon(value)}
          <span className={cn("font-medium", size === 'default' ? "text-sm min-w-[70px]" : "text-xs min-w-[65px]")}>{getStatusText(value)}</span>
        </div>
        <ChevronDown className={cn("ml-2 opacity-50", size === 'default' ? "h-4 w-4" : "h-3 w-3")} />
      </DropdownMenuTrigger>      <DropdownMenuContent align="center" className={cn(size === 'default' ? "w-[200px]" : "w-[180px]")}>
        <DropdownMenuItem 
          className={cn(
            "flex items-center cursor-pointer", 
            value === "Ag. Pagamento" && "bg-red-50 dark:bg-red-950/20"
          )}
          onClick={() => onValueChange("Ag. Pagamento")}
        >
          <Clock className={cn("mr-2 text-red-500", size === 'default' ? "h-4 w-4" : "h-3 w-3")} />
          <span className={size === 'default' ? "" : "text-xs"}>Aguardando Pagamento</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className={cn(
            "flex items-center cursor-pointer", 
            value === "Pago" && "bg-green-50 dark:bg-green-950/20"
          )}
          onClick={() => onValueChange("Pago")}
        >
          <Check className={cn("mr-2 text-green-500", size === 'default' ? "h-4 w-4" : "h-3 w-3")} />
          <span className={size === 'default' ? "" : "text-xs"}>Pago</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className={cn(
            "flex items-center cursor-pointer", 
            value === "Pago Parcial" && "bg-yellow-50 dark:bg-yellow-950/20"
          )}
          onClick={() => onValueChange("Pago Parcial")}
        >
          <AlertCircle className={cn("mr-2 text-yellow-500", size === 'default' ? "h-4 w-4" : "h-3 w-3")} />
          <span className={size === 'default' ? "" : "text-xs"}>Pago Parcial</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
