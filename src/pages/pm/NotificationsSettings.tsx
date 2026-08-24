import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePrefs, ALL_EVENT_TYPES, EVENT_META } from "@/lib/pm/notifications";
import { SettingsSubnav } from "@/components/pm/SettingsSubnav";

export default function NotificationsSettings() {
  const { prefs, save } = usePrefs();

  return (
    <div className="max-w-3xl mx-auto page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which events send you an in-app notification and which also email you. Mentions and assignments usually arrive within a minute; other events are batched about every five minutes.
        </p>
      </div>

      <SettingsSubnav current="notifications" />

      <Card className="overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Event</div>
          <div className="text-center">In-app</div>
          <div className="text-center">Email</div>
        </div>
        {ALL_EVENT_TYPES.map(et => {
          const meta = EVENT_META[et];
          const p = prefs?.[et] ?? { in_app: true, email: true };
          return (
            <div
              key={et}
              className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_100px_100px] sm:gap-4 px-3 sm:px-4 py-4 border-b border-border last:border-b-0 sm:items-center"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                  {meta.label}
                  {meta.urgent && <Badge variant="secondary" className="text-[10px]">Urgent</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.desc}</div>
              </div>
              <div className="flex items-center justify-between sm:justify-center gap-3">
                <span className="text-xs text-muted-foreground sm:hidden">In-app</span>
                <Switch checked={p.in_app} onCheckedChange={(v) => save(et, { in_app: v })} />
              </div>
              <div className="flex items-center justify-between sm:justify-center gap-3">
                <span className="text-xs text-muted-foreground sm:hidden">Email</span>
                <Switch checked={p.email} onCheckedChange={(v) => save(et, { email: v })} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
