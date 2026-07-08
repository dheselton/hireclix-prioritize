import { Bell, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useMyNotifications, markNotificationRead, markAllRead, scanDueDateNotifications } from "@/lib/pm/notifications";
import { useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

export function NotificationsBell() {
  const nav = useNavigate();
  const { items, reload } = useMyNotifications(25);
  const unread = useMemo(() => items.filter(n => !n.read).length, [items]);

  useEffect(() => {
    scanDueDateNotifications().then(reload).catch(() => {});
    const int = setInterval(() => { scanDueDateNotifications().then(reload).catch(() => {}); }, 5 * 60 * 1000);
    return () => clearInterval(int);
  }, [reload]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 z-50 bg-popover" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => { await markAllRead(); reload(); }} disabled={unread === 0}>
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => nav("/pm/settings/notifications")} title="Preferences">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left px-3 py-2 hover:bg-accent/40 transition ${!n.read ? "bg-primary/5" : ""}`}
                  onClick={async () => {
                    if (!n.read) await markNotificationRead(n.id);
                    if (n.link) nav(n.link);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
