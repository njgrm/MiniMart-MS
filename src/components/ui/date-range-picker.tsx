"use client"

import * as React from "react"
import { format, subDays, isBefore, startOfMonth } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

export type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
  className?: string
  align?: "start" | "center" | "end"
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  align = "start",
}: DateRangePickerProps) {
  // Independent month states for each calendar
  const [leftMonth, setLeftMonth] = React.useState<Date>(
    date?.from ? startOfMonth(date.from) : startOfMonth(subDays(new Date(), 30))
  );
  const [rightMonth, setRightMonth] = React.useState<Date>(
    date?.to ? startOfMonth(date.to) : startOfMonth(new Date())
  );

  // Handle date selection for range
  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;

    if (!date?.from) {
      // First click - set start date
      onDateChange({ from: selectedDate, to: undefined });
    } else if (!date.to) {
      // Second click - set end date
      if (isBefore(selectedDate, date.from)) {
        // If selecting before start, swap them
        onDateChange({ from: selectedDate, to: date.from });
      } else {
        onDateChange({ from: date.from, to: selectedDate });
      }
    } else {
      // Third click - start new selection
      onDateChange({ from: selectedDate, to: undefined });
    }
  };

  // Get modifiers for highlighting the range
  const rangeModifiers = React.useMemo(() => {
    if (!date?.from) return {};
    
    return {
      selected: date.from,
      range_start: date.from,
      range_end: date.to,
      range_middle: date.to ? {
        after: date.from,
        before: date.to,
      } : undefined,
    };
  }, [date]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal h-9",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex flex-col md:flex-row">
            {/* Left Calendar - Start Date */}
            <div className="border-b md:border-b-0 md:border-r">
              <Calendar
                mode="single"
                selected={date?.from}
                onSelect={handleSelect}
                month={leftMonth}
                onMonthChange={setLeftMonth}
                captionLayout="dropdown"
                modifiers={rangeModifiers}
                modifiersClassNames={{
                  range_start: "bg-primary text-primary-foreground rounded-l-md",
                  range_end: "bg-primary text-primary-foreground rounded-r-md",
                  range_middle: "bg-primary/20 rounded-none",
                }}
              />
            </div>
            {/* Right Calendar - End Date */}
            <div>
              <Calendar
                mode="single"
                selected={date?.to}
                onSelect={handleSelect}
                month={rightMonth}
                onMonthChange={setRightMonth}
                captionLayout="dropdown"
                modifiers={rangeModifiers}
                modifiersClassNames={{
                  range_start: "bg-primary text-primary-foreground rounded-l-md",
                  range_end: "bg-primary text-primary-foreground rounded-r-md",
                  range_middle: "bg-primary/20 rounded-none",
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
