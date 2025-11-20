import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Feature, ReleaseVersion, ProductCategory } from "@/types/roadmap";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  return (
    <Card className="relative bg-card border border-border p-6">
      <div className="flex items-start">
        {/* Pinned Category Labels */}
        <div className="flex-shrink-0 pr-4">
          <div className="h-12 flex items-center border-b border-border mb-2">
            <div className="w-48 font-semibold text-foreground">
              Product Category
            </div>
          </div>
          {categories.map((category) => (
            <div
              key={category.id}
              className="h-16 flex items-center border-b border-border"
            >
              <div className="w-48 font-medium text-muted-foreground">
                {category.name}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <ScrollArea className="w-full" ref={scrollRef}>
            <div className="min-w-max">
              {/* Header Row */}
              <div className="flex border-b border-border pb-2 mb-2 h-12 items-center">
                {nonBacklogVersions.map((version) => (
                  <div
                    key={version.id}
                    className="w-40 flex-shrink-0 text-center font-semibold text-foreground border-l border-border/50 first:border-l-0 px-2"
                  >
                    {version.name}
                  </div>
                ))}
              </div>

              {/* Timeline Rows */}
              {categories.map((category) => {
                const categoryFeatures = features.filter(
                  f => f.product_category_id === category.id
                );

                return (
                  <div key={category.id} className="flex border-b border-border h-16 items-center">
                    {nonBacklogVersions.map((version) => {
                      const versionFeatures = categoryFeatures.filter(
                        f => f.release_version_id === version.id
                      );

                      return (
                        <div
                          key={version.id}
                          className="w-40 flex-shrink-0 px-2 flex flex-wrap gap-1 items-center border-l border-border/50 first:border-l-0 hover:bg-muted/30 transition-colors h-full"
                        >
                          {versionFeatures.map((feature) => (
                            <Badge
                              key={feature.id}
                              variant="secondary"
                              className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={() => onFeatureClick(feature)}
                            >
                              {feature.title}
                            </Badge>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
}
