import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FeatureCard } from "./FeatureCard";
import type { Feature, ReleaseVersion } from "@/types/roadmap";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface KanbanBoardProps {
  features: Feature[];
  releaseVersions: ReleaseVersion[];
  onFeatureClick: (feature: Feature) => void;
  onFeaturesChange: () => void;
}

export function KanbanBoard({ 
  features, 
  releaseVersions, 
  onFeatureClick,
  onFeaturesChange 
}: KanbanBoardProps) {
  const { toast } = useToast();
  const [draggedFeature, setDraggedFeature] = useState<Feature | null>(null);
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
        variant: "destructive"
      });
    }
    setDraggedFeature(null);
  };

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
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={() => scroll('right')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <ScrollArea className="w-full" ref={scrollRef}>
        <div className="flex gap-4 p-6 min-h-[600px]">
          {releaseVersions.map((version) => {
            const versionFeatures = features.filter(
              f => f.release_version_id === version.id
            );

            return (
              <div
                key={version.id}
                className="flex-shrink-0 w-80"
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
