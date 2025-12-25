"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconTrash,
  IconX,
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  checkNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  type NotificationData,
} from "@/actions/notifications";

// Polling interval: 30 seconds
const POLL_INTERVAL = 30 * 1000;

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertCircle,
  error: IconX,
};

const typeColors: Record<string, string> = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

interface NotificationBellProps {
  userId: number;
  userType: "staff" | "vendor";
}

export function NotificationBell({ userId, userType }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const lastCountRef = useRef(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const result = await checkNotifications(userId, userType);
      setNotifications(result.notifications);
      setUnreadCount(result.newCount);

      // Show toast for new notifications
      if (result.newCount > lastCountRef.current && lastCountRef.current > 0) {
        const newNotification = result.notifications.find((n) => !n.is_read);
        if (newNotification) {
          toast.info(newNotification.title, {
            description: newNotification.message,
            action: newNotification.href
              ? {
                  label: "View",
                  onClick: () => router.push(newNotification.href!),
                }
              : undefined,
          });
        }
      }

      lastCountRef.current = result.newCount;
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setIsLoading(false);
    }
  }, [userId, userType, router]);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    if (notification.href) {
      router.push(notification.href);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId, userType);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleRemoveNotification = async (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notification && !notification.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleClearAll = async () => {
    await clearAllNotifications(userId, userType);
    setNotifications([]);
    setUnreadCount(0);
  };

  const hasUnread = unreadCount > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
        >
          {hasUnread ? (
            <IconBellRinging className="size-5 text-primary animate-pulse" />
          ) : (
            <IconBell className="size-5" />
          )}
          {hasUnread && (
            <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleMarkAllRead}
                >
                  <IconCheck className="size-3 mr-1" />
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleClearAll}
                >
                  <IconTrash className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
              <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-8">
              <IconBell className="size-8 mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || IconInfoCircle;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div
                      className={cn(
                        "shrink-0 mt-0.5",
                        typeColors[notification.type] || "text-blue-500"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium line-clamp-1",
                            !notification.is_read && "text-foreground"
                          )}
                        >
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveNotification(notification.id);
                          }}
                        >
                          <IconX className="size-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="shrink-0 self-center">
                        <div className="size-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

