import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FeatureCard } from "./FeatureCard";
import type { Feature, ReleaseVersion } from "@/types/roadmap";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KanbanBoardProps {
  features: Feature[];
  releaseVersions: ReleaseVersion[];
  onFeatureClick: (feature: Feature) => void;
  onFeaturesChange: () => void;
  onViewBacklog?: () => void;
}

export function KanbanBoard({ 
  features, 
  releaseVersions, 
  onFeatureClick,
  onFeaturesChange,
  onViewBacklog 
}: KanbanBoardProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [draggedFeature, setDraggedFeature] = useState<Feature | null>(null);
  const [mobileVersionId, setMobileVersionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleDragStart = (feature: Feature) => {
    setDraggedFeature(feature);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (releaseVersionId: string) => {
    if (!draggedFeature) return;

    try {
      await updateFeature(draggedFeature.id, {
        release_version_id: releaseVersionId
      });
      toast({
        title: "Feature moved",
        description: "Feature has been moved to the new release version."
      });
      onFeaturesChange();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move feature.",
        variant: "destructive",
      });
    }
    setDraggedFeature(null);
  };

  const moveFeature = async (featureId: string, releaseVersionId: string) => {
    try {
      await updateFeature(featureId, { release_version_id: releaseVersionId });
      toast({ title: "Feature moved", description: "Feature has been moved to the new release version." });
      onFeaturesChange();
    } catch {
      toast({ title: "Error", description: "Failed to move feature.", variant: "destructive" });
    }
  };

  // Filter out backlog versions
  const nonBacklogVersions = releaseVersions.filter(v => !v.is_backlog);
  const backlogVersion = releaseVersions.find(v => v.is_backlog);
  const backlogCount = backlogVersion 
    ? features.filter(f => f.release_version_id === backlogVersion.id).length 
    : 0;

  const activeMobileId = mobileVersionId ?? nonBacklogVersions[0]?.id ?? null;
  const activeMobileVersion = nonBacklogVersions.find(v => v.id === activeMobileId) ?? nonBacklogVersions[0];
  const activeMobileFeatures = activeMobileVersion
    ? features.filter(f => f.release_version_id === activeMobileVersion.id)
    : [];

  if (isMobile) {
    return (
      <Card className="bg-card border border-border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Select value={activeMobileVersion?.id} onValueChange={setMobileVersionId}>
            <SelectTrigger className="flex-1 min-w-0">
              <SelectValue placeholder="Release version" />
            </SelectTrigger>
            <SelectContent>
              {nonBacklogVersions.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({features.filter(f => f.release_version_id === v.id).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onViewBacklog && backlogCount > 0 && (
            <Button variant="outline" size="sm" onClick={onViewBacklog}>
              Backlog ({backlogCount})
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {activeMobileFeatures.map(feature => (
            <div key={feature.id} className="space-y-2">
              <FeatureCard feature={feature} onClick={() => onFeatureClick(feature)} />
              <Select
                value={feature.release_version_id ?? undefined}
                onValueChange={(v) => moveFeature(feature.id, v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  {nonBacklogVersions.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {!activeMobileFeatures.length && (
            <p className="text-sm text-muted-foreground text-center py-8">No features in this release.</p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative bg-card border border-border">
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={() => scroll('left')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-auto right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={() => scroll('right')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <ScrollArea className="w-full" ref={scrollRef}>
        <div className="flex gap-4 p-4 md:p-6 min-h-[400px] md:min-h-[600px]">
          {nonBacklogVersions.map((version) => {
            const versionFeatures = features.filter(
              f => f.release_version_id === version.id
            );

            return (
              <div
                key={version.id}
                className="flex-shrink-0 w-[min(20rem,85vw)]"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(version.id)}
              >
                <Card className="p-4 bg-background border border-border h-full">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{version.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {versionFeatures.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {versionFeatures.map((feature) => (
                      <div
                        key={feature.id}
                        draggable
                        onDragStart={() => handleDragStart(feature)}
                        className="cursor-move"
                      >
                        <FeatureCard
                          feature={feature}
                          onClick={() => onFeatureClick(feature)}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
