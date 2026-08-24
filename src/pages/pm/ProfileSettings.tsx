import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/lib/pm/mockUser";
import { loadPmRoster } from "@/lib/pm/pmRoster";
import { SettingsSubnav } from "@/components/pm/SettingsSubnav";
import { UserAvatar } from "@/components/pm/UserAvatar";
import { toast } from "sonner";

const PRESET_COLORS = ["#0f4c75", "#3282b8", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0d9488", "#475569"];
const MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

const ROLE_LABEL: Record<string, string> = {
  pm: "Project Manager", designer: "Designer", developer: "Developer", submitter: "Submitter",
  ba: "Business Analyst", tech_lead: "Technical Resource",
  qa: "QA", strategist: "Strategist", analyst: "Analyst", csm: "CSM", support: "Support",
};

export default function ProfileSettings() {
  const { user: authUser, refreshPmUser } = useAuth();
  const { user, roles } = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [color, setColor] = useState(user?.avatar_color ?? PRESET_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setColor(user.avatar_color ?? PRESET_COLORS[0]);
    setAvatarUrl(user.avatar_url ?? null);
  }, [user?.id, user?.name, user?.avatar_color, user?.avatar_url]);

  if (!user) return null;
  const userId = user.id;

  async function persist(patch: { name?: string; avatar_color?: string | null; avatar_url?: string | null }) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pm_users")
        .update(patch)
        .eq("id", userId);
      if (error) throw error;
      await loadPmRoster();
      await refreshPmUser();
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next) {
      toast.error("Name is required");
      return;
    }
    await persist({ name: next, avatar_color: color });
  }

  async function onPickFile(file: File | undefined) {
    if (!file || !authUser) return;
    if (!IMAGE_TYPES.has(file.type)) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo must be 2 MB or smaller");
      return;
    }
    setSaving(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${authUser.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      const { error } = await supabase.from("pm_users").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;
      await loadPmRoster();
      await refreshPmUser();
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload photo");
    } finally {
      setSaving(false);
    }
  }

  async function onRemovePhoto() {
    if (!authUser) return;
    setSaving(true);
    try {
      await supabase.storage.from("avatars").remove([
        `${authUser.id}/avatar.jpg`,
        `${authUser.id}/avatar.jpeg`,
        `${authUser.id}/avatar.png`,
        `${authUser.id}/avatar.webp`,
        `${authUser.id}/avatar.gif`,
      ]);
      setAvatarUrl(null);
      const { error } = await supabase.from("pm_users").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      await loadPmRoster();
      await refreshPmUser();
      toast.success("Photo removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove photo");
    } finally {
      setSaving(false);
    }
  }

  const roleLabels = roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ");

  return (
    <div className="max-w-3xl mx-auto page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your display name is what teammates see in @mentions. Role changes stay on the Team page.
        </p>
      </div>
      <SettingsSubnav current="profile" />

      <Card className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UserAvatar userId={user.id} size="md" />
          <div className="min-w-0">
            <div className="font-medium truncate">{user.name}</div>
            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{roleLabels}</div>
          </div>
        </div>

        <form onSubmit={onSaveName} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <Label>Avatar color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full border border-border"
                  style={{ backgroundColor: c, outline: color === c ? "2px solid hsl(var(--ring))" : undefined, outlineOffset: 2 }}
                />
              ))}
              <input
                type="color"
                value={color || "#0f4c75"}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer bg-transparent border-0"
                aria-label="Custom avatar color"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>Save name and color</Button>
        </form>

        <div className="space-y-2">
          <Label>Photo</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => fileRef.current?.click()}>
              Upload photo
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => void onRemovePhoto()}>
                Remove photo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF up to 2 MB.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            <div className="text-sm">{user.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Role</div>
            <div className="text-sm">{roleLabels || "—"}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
