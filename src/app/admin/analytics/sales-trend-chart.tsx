"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Area,
  ComposedChart,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { ChartDataPoint } from "./actions";

interface SalesTrendChartProps {
  data: ChartDataPoint[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      displayDate: format(parseISO(d.date), "MMM d"),
      eventHighlight: d.isEventDay ? d.sales : null,
    }));
  }, [data]);

  const eventDays = useMemo(() => {
    return chartData.filter((d) => d.isEventDay);
  }, [chartData]);

  if (data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No sales data available</p>
          <p className="text-sm">Data will appear once transactions are recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#AC0F16" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#AC0F16" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#EDE5D8" 
            vertical={false}
          />
          
          <XAxis
            dataKey="displayDate"
            tick={{ fill: "#6c5e5d", fontSize: 12 }}
            tickLine={{ stroke: "#EDE5D8" }}
            axisLine={{ stroke: "#EDE5D8" }}
            interval="preserveStartEnd"
          />
          
          <YAxis
            tick={{ fill: "#6c5e5d", fontSize: 12 }}
            tickLine={{ stroke: "#EDE5D8" }}
            axisLine={{ stroke: "#EDE5D8" }}
            tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
          />
          
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              
              const salesData = payload.find((p) => p.dataKey === "sales");
              const forecastData = payload.find((p) => p.dataKey === "forecast");
              const dataPoint = payload[0]?.payload as ChartDataPoint & { displayDate: string };
              
              return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                  <p className="font-semibold text-foreground mb-2">{label}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Sales:</span>
                      <span className="font-mono text-primary">
                        ₱{Number(salesData?.value ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Forecast:</span>
                      <span className="font-mono text-[#2EAFC5]">
                        ₱{Number(forecastData?.value ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {dataPoint?.isEventDay && (
                      <div className="pt-2 border-t border-border mt-2">
                        <span className="text-secondary font-medium">
                          Event: {dataPoint.eventName || "Event Day"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          
          {/* Area fill under sales line */}
          <Area
            type="monotone"
            dataKey="sales"
            stroke="transparent"
            fill="url(#salesGradient)"
          />
          
          {/* Actual Sales Line */}
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#AC0F16"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "#AC0F16", stroke: "#F9F6F0", strokeWidth: 2 }}
          />
          
          {/* Forecast Line (Dashed) */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#2EAFC5"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6, fill: "#2EAFC5", stroke: "#F9F6F0", strokeWidth: 2 }}
          />
          
          {/* Event Day Markers */}
          {eventDays.map((day, index) => (
            <ReferenceDot
              key={index}
              x={day.displayDate}
              y={day.sales}
              r={8}
              fill="#F1782F"
              stroke="#F9F6F0"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
