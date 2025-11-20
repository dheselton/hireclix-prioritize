import { useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Scroll horizontally to view future releases
      </p>
      <Card className="relative bg-card border border-border overflow-hidden">
        <div className="flex relative">
          {/* Pinned Category Labels */}
          <div className="flex-shrink-0 bg-card z-20 border-r border-border">
            <div className="h-14 flex items-center px-6 border-b border-border bg-muted/30">
              <div className="font-semibold text-foreground text-sm">
                Product Category
              </div>
            </div>
            {categories.map((category, idx) => (
              <div
                key={category.id}
                className={`h-14 flex items-center px-6 border-b border-border last:border-b-0 ${
                  idx % 2 === 0 ? 'bg-muted/20' : 'bg-card'
                }`}
              >
                <div className="font-medium text-muted-foreground text-sm">
                  {category.name}
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable Timeline */}
          <div className="flex-1 relative overflow-hidden">
            {/* Scroll gradient indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10" />
            
            {/* Scroll Buttons - Positioned outside the scrollable area */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Scrollable container */}
            <div 
              ref={scrollContainerRef}
              className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="inline-block min-w-full">
                {/* Header Row */}
                <div className="flex border-b border-border h-14 items-center bg-muted/30">
                  {nonBacklogVersions.map((version) => (
                    <div
                      key={version.id}
                      className="w-36 flex-shrink-0 text-center font-semibold text-foreground border-l border-border/50 first:border-l-0 px-3"
                    >
                      {version.name}
                    </div>
                  ))}
                </div>

                {/* Timeline Rows */}
                {categories.map((category, idx) => {
                  const categoryFeatures = features.filter(
                    f => f.product_category_id === category.id
                  );

                  return (
                    <div 
                      key={category.id} 
                      className={`flex border-b border-border last:border-b-0 h-14 items-center ${
                        idx % 2 === 0 ? 'bg-muted/20' : 'bg-card'
                      }`}
                    >
                      {nonBacklogVersions.map((version) => {
                        const versionFeatures = categoryFeatures.filter(
                          f => f.release_version_id === version.id
                        );

                        return (
                          <div
                            key={version.id}
                            className="w-36 flex-shrink-0 px-3 py-2 flex flex-wrap gap-1 items-center justify-center border-l border-border/50 first:border-l-0 hover:bg-muted/50 transition-colors h-full"
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
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
