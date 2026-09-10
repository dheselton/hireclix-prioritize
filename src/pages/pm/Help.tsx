import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { BookOpen, Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getGuideMarkdown } from "@/lib/pm/helpContent";
import {
  defaultPackId,
  getPack,
  matchedPacks,
  packsForRoles,
  parseGuideParam,
  visibleGuides,
  type HelpPackId,
} from "@/lib/pm/helpRegistry";

function isInternalAppPath(href: string | undefined): href is string {
  if (!href) return false;
  return href.startsWith("/") && !href.startsWith("//");
}

export default function Help() {
  const { roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const packList = useMemo(() => packsForRoles(roles), [roles]);
  const matchedIds = useMemo(() => new Set(matchedPacks(roles).map((p) => p.id)), [roles]);

  const parsed = parseGuideParam(searchParams.get("guide"));
  const [packId, setPackId] = useState<HelpPackId>(() => parsed?.packId ?? defaultPackId(roles));
  const [slug, setSlug] = useState(() => {
    if (parsed?.slug) return parsed.slug;
    const pack = getPack(defaultPackId(roles));
    return visibleGuides(pack, roles)[0]?.slug ?? pack.guides[0]?.slug ?? "_shared/glossary";
  });
  const [copied, setCopied] = useState(false);

  // Sync from URL when ?guide= changes (deep links / share).
  useEffect(() => {
    const p = parseGuideParam(searchParams.get("guide"));
    if (!p) return;
    setPackId(p.packId);
    setSlug(p.slug);
  }, [searchParams]);

  // When roles resolve and no guide param, pick default pack.
  useEffect(() => {
    if (searchParams.get("guide")) return;
    const id = defaultPackId(roles);
    setPackId(id);
    const guides = visibleGuides(getPack(id), roles);
    if (guides[0]) setSlug(guides[0].slug);
  }, [roles, searchParams]);

  const pack = getPack(packId);
  const guides = useMemo(() => visibleGuides(pack, roles), [pack, roles]);

  useEffect(() => {
    if (!guides.some((g) => g.slug === slug) && guides[0]) {
      setSlug(guides[0].slug);
    }
  }, [guides, slug]);

  const markdown = getGuideMarkdown(slug) ?? "_Guide content is missing. Check `docs/guides/` and the Help registry._";
  const activeGuide = guides.find((g) => g.slug === slug) ?? pack.guides.find((g) => g.slug === slug);

  const selectGuide = useCallback(
    (nextPack: HelpPackId, nextSlug: string) => {
      setPackId(nextPack);
      setSlug(nextSlug);
      setSearchParams({ guide: nextSlug }, { replace: true });
    },
    [setSearchParams],
  );

  const share = useCallback(async () => {
    const url = `${window.location.origin}/pm/help?guide=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Guide link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }, [slug]);

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-info shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Help & Walkthroughs</h1>
            <p className="text-sm text-muted-foreground">
              Short flows by role. Same guides live in <code className="text-xs">docs/guides/</code> for Slack and onboarding.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={share} className="self-start">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Share this guide
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {packList.map((p) => {
          const isYours = matchedIds.has(p.id) && p.id !== "external";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const next = visibleGuides(p, roles)[0] ?? p.guides[0];
                selectGuide(p.id, next.slug);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                packId === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent text-foreground",
              )}
            >
              {p.label}
              {isYours && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-80">you</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{pack.description}</p>

      <div className="grid gap-4 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
        <Card className="h-fit md:sticky md:top-4">
          <CardContent className="p-3 space-y-1">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Guides</p>
            {guides.map((g) => (
              <button
                key={g.slug}
                type="button"
                onClick={() => selectGuide(packId, g.slug)}
                className={cn(
                  "w-full rounded-md px-2 py-2 text-left text-sm transition-colors",
                  slug === g.slug ? "bg-accent text-foreground font-medium" : "hover:bg-muted/60 text-muted-foreground",
                )}
              >
                <span className="block">{g.title}</span>
                <span className="text-[11px] opacity-70">~{g.minutes} min</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            {activeGuide && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{pack.label}</Badge>
                <span className="text-xs text-muted-foreground">~{activeGuide.minutes} min</span>
                <span className="text-xs text-muted-foreground font-mono truncate">{activeGuide.slug}.md</span>
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => {
                    if (isInternalAppPath(href)) {
                      if (href.startsWith("/pm/help")) {
                        const q = href.includes("?") ? new URL(href, "https://prioritize.local").searchParams.get("guide") : null;
                        if (q) {
                          return (
                            <button
                              type="button"
                              className="text-primary underline underline-offset-2 font-medium"
                              onClick={() => {
                                const found = parseGuideParam(q);
                                if (!found) return;
                                const stay = getPack(packId).guides.some((g) => g.slug === found.slug);
                                selectGuide(stay ? packId : found.packId, found.slug);
                              }}
                            >
                              {children}
                            </button>
                          );
                        }
                      }
                      return (
                        <Link to={href} className="text-primary underline underline-offset-2 font-medium">
                          {children}
                        </Link>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-1">
                        {children}
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
