"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseEventSourceOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  enabled?: boolean;
}

/**
 * Custom hook for Server-Sent Events (SSE) connection
 * Provides real-time updates without constant polling
 */
export function useEventSource(url: string, options: UseEventSourceOptions = {}) {
  const { onMessage, onError, onOpen, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<Event | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setLastError(null);
        onOpen?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch {
          // Handle non-JSON messages (like heartbeats)
        }
      };

      eventSource.onerror = (error) => {
        setIsConnected(false);
        setLastError(error);
        onError?.(error);
        
        // Reconnect after 5 seconds on error
        eventSource.close();
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
    }
  }, [url, enabled, onMessage, onError, onOpen]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Reconnect when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isConnected && enabled) {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connect, isConnected, enabled]);

  return { isConnected, lastError };
}
