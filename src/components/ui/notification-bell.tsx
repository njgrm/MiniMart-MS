"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconTrash,
  IconX,
  IconPackage,
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
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
  useNotificationStore,
  type Notification,
} from "@/stores/use-notification-store";

const typeIcons = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertCircle,
  error: IconX,
};

const typeColors = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  } = useNotificationStore();

  // Hydrate the store on mount
  useEffect(() => {
    setMounted(true);
    useNotificationStore.persist.rehydrate();
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.href) {
      router.push(notification.href);
      setIsOpen(false);
    }
  };

  const unread = mounted ? unreadCount() : 0;
  const hasUnread = unread > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={`Notifications${hasUnread ? ` (${unread} unread)` : ""}`}
        >
          {hasUnread ? (
            <IconBellRinging className="size-5 text-primary animate-pulse" />
          ) : (
            <IconBell className="size-5" />
          )}
          {hasUnread && (
            <Badge
              className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
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
                  onClick={markAllAsRead}
                >
                  <IconCheck className="size-3 mr-1" />
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearAll}
                >
                  <IconTrash className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[300px]">
          {!mounted ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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
                const Icon = typeIcons[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={cn("shrink-0 mt-0.5", typeColors[notification.type])}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm font-medium line-clamp-1",
                          !notification.read && "text-foreground"
                        )}>
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                        >
                          <IconX className="size-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
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

