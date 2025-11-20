import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Feature, ReleaseVersion, ProductCategory } from "@/types/roadmap";

interface TimelineProps {
  features: Feature[];
  releaseVersions: ReleaseVersion[];
  categories: ProductCategory[];
  onFeatureClick: (feature: Feature) => void;
}

export function Timeline({ 
  features, 
  releaseVersions, 
  categories, 
  onFeatureClick 
}: TimelineProps) {
  const nonBacklogVersions = releaseVersions.filter(v => !v.is_backlog);

  return (
    <Card className="p-6 bg-card border border-border">
      <h3 className="font-bold text-lg mb-4 text-foreground">Quarterly Timeline</h3>
      
      <ScrollArea className="w-full">
        <div className="min-w-max">
          {/* Header Row */}
          <div className="flex border-b border-border mb-4">
            <div className="w-48 flex-shrink-0 py-3 font-semibold text-sm text-foreground">
              Product Category
            </div>
            {nonBacklogVersions.map((version) => (
              <div key={version.id} className="w-40 flex-shrink-0 py-3 text-center border-l border-border">
                <div className="font-semibold text-sm text-foreground">{version.name}</div>
              </div>
            ))}
          </div>

          {/* Category Rows */}
          {categories.map((category) => {
            const categoryFeatures = features.filter(
              f => f.product_category_id === category.id
            );

            return (
              <div key={category.id} className="flex border-b border-border/50">
                <div className="w-48 flex-shrink-0 py-4 font-medium text-sm text-foreground">
                  {category.name}
                </div>
                {nonBacklogVersions.map((version) => {
                  const versionFeatures = categoryFeatures.filter(
                    f => f.release_version_id === version.id
                  );

                  return (
                    <div 
                      key={version.id} 
                      className="w-40 flex-shrink-0 p-2 border-l border-border/50"
                    >
                      <div className="space-y-1">
                        {versionFeatures.map((feature) => (
                          <Badge
                            key={feature.id}
                            className="badge-primary text-xs cursor-pointer hover:opacity-80 w-full justify-start truncate"
                            onClick={() => onFeatureClick(feature)}
                          >
                            {feature.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
