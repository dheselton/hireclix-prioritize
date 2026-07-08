import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePrefs, ALL_EVENT_TYPES, EVENT_META } from "@/lib/pm/notifications";
import { AlertCircle } from "lucide-react";

export default function NotificationsSettings() {
  const { prefs, save } = usePrefs();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which events send you an in-app notification and which also email you. Urgent events (assigned, @mentions, overdue) are sent immediately when email is on; other events roll up into a daily digest.
        </p>
      </div>

      <Card className="p-4 border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-amber-900 dark:text-amber-200">Email delivery pending domain setup</div>
          <div className="text-amber-800/80 dark:text-amber-200/80 mt-0.5">
            In-app notifications work now. Email sending activates once an email sender domain is configured. Your email toggles below will be respected as soon as it's live.
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Event</div>
          <div className="text-center">In-app</div>
          <div className="text-center">Email</div>
        </div>
        {ALL_EVENT_TYPES.map(et => {
          const meta = EVENT_META[et];
          const p = prefs?.[et] ?? { in_app: true, email: true };
          return (
            <div key={et} className="grid grid-cols-[1fr_100px_100px] gap-4 px-4 py-4 border-b border-border last:border-b-0 items-center">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {meta.label}
                  {meta.urgent && <Badge variant="secondary" className="text-[10px]">Urgent</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.desc}</div>
              </div>
              <div className="flex justify-center">
                <Switch checked={p.in_app} onCheckedChange={(v) => save(et, { in_app: v })} />
              </div>
              <div className="flex justify-center">
                <Switch checked={p.email} onCheckedChange={(v) => save(et, { email: v })} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
