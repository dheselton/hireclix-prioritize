import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FeatureCard } from "./FeatureCard";
import type { Feature, ReleaseVersion } from "@/types/roadmap";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";

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
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
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
              <Card className="p-4 bg-muted/30 border border-border">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground">{version.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {versionFeatures.length} {versionFeatures.length === 1 ? 'feature' : 'features'}
                  </p>
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
  );
}
