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
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Scroll horizontally to view future releases
      </p>
      <Card className="relative bg-card border border-border overflow-hidden">
        <div className="flex">
          {/* Pinned Category Labels */}
          <div className="flex-shrink-0 bg-card z-10 border-r border-border">
            <div className="h-14 flex items-center px-6 border-b border-border bg-muted/30">
              <div className="font-semibold text-foreground text-sm">
                Product Category
              </div>
            </div>
            {categories.map((category, idx) => (
              <div
                key={category.id}
                className={`h-14 flex items-center px-6 border-b border-border ${
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
          <div className="flex-1 relative">
            {/* Scroll gradient indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10" />
            
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

            <ScrollArea className="w-full" ref={scrollRef}>
              <div className="min-w-max">
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
                      className={`flex border-b border-border h-14 items-center ${
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
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  );
}
