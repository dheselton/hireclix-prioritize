import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummaryHeader } from "@/components/roadmap/SummaryHeader";
import { KanbanBoard } from "@/components/roadmap/KanbanBoard";
import { Timeline } from "@/components/roadmap/Timeline";
import { FeatureDetailDrawer } from "@/components/roadmap/FeatureDetailDrawer";
import { NewFeatureDrawer } from "@/components/roadmap/NewFeatureDrawer";
import { BacklogList } from "@/components/roadmap/BacklogList";
import { fetchFeatures, fetchProductCategories, fetchReleaseVersions } from "@/lib/roadmapService";
import type { Feature } from "@/types/roadmap";

export default function ProductRoadmap() {
  const [activeTab, setActiveTab] = useState("roadmap");
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [newFeatureDrawerOpen, setNewFeatureDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    featureLevel: '',
    featureType: '',
    status: '',
    search: '',
  });

  const { data: features = [], refetch: refetchFeatures } = useQuery({
    queryKey: ['features'],
    queryFn: fetchFeatures,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['productCategories'],
    queryFn: fetchProductCategories,
  });

  const { data: releaseVersions = [] } = useQuery({
    queryKey: ['releaseVersions'],
    queryFn: fetchReleaseVersions,
  });

  // Separate backlog features from scheduled features
  const backlogVersion = releaseVersions.find(v => v.is_backlog);
  const backlogFeatures = features.filter(f => 
    f.release_version_id === backlogVersion?.id || !f.release_version_id
  );
  const scheduledFeatures = features.filter(f => 
    f.release_version_id && f.release_version_id !== backlogVersion?.id
  );

  const filteredFeatures = useMemo(() => {
    return scheduledFeatures.filter(feature => {
      if (filters.category && feature.product_category_id !== filters.category) return false;
      if (filters.featureLevel && feature.feature_level !== filters.featureLevel) return false;
      if (filters.featureType && feature.feature_type !== filters.featureType) return false;
      if (filters.status && feature.status !== filters.status) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = feature.title.toLowerCase().includes(searchLower);
        const matchesSummary = feature.summary?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesSummary) return false;
      }
      return true;
    });
  }, [scheduledFeatures, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setDetailDrawerOpen(true);
  };

  const handleAddFeature = () => {
    setNewFeatureDrawerOpen(true);
  };

  const handleUpdate = () => {
    refetchFeatures();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-unbounded font-bold text-foreground mb-2">
              Product Roadmap
            </h1>
            <p className="text-muted-foreground">
              Plan, track, and manage product features across releases
            </p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            View Dashboard
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="ideas">
              Ideas & Backlog
              {backlogFeatures.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {backlogFeatures.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roadmap" className="space-y-6 mt-6">
            <SummaryHeader
              features={filteredFeatures}
              categories={categories}
              onAddFeature={handleAddFeature}
              filters={filters}
              onFilterChange={handleFilterChange}
            />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Release Versions</h2>
                {backlogFeatures.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("ideas")}
                  >
                    Backlog · {backlogFeatures.length} items
                  </Button>
                )}
              </div>
              <KanbanBoard
                features={filteredFeatures}
                releaseVersions={releaseVersions}
                onFeatureClick={handleFeatureClick}
                onFeaturesChange={handleUpdate}
                onViewBacklog={() => setActiveTab("ideas")}
              />
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4 text-foreground">Quarterly Timeline</h2>
              <Timeline
                features={filteredFeatures}
                releaseVersions={releaseVersions}
                categories={categories}
                onFeatureClick={handleFeatureClick}
              />
            </div>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6 mt-6">
            <BacklogList
              features={backlogFeatures}
              categories={categories}
              releaseVersions={releaseVersions}
              backlogVersionId={backlogVersion?.id || null}
              onFeatureClick={handleFeatureClick}
              onUpdate={handleUpdate}
            />
          </TabsContent>
        </Tabs>

        <FeatureDetailDrawer
          feature={selectedFeature}
          open={detailDrawerOpen}
          onOpenChange={setDetailDrawerOpen}
          categories={categories}
          releaseVersions={releaseVersions}
          onUpdate={handleUpdate}
        />

        <NewFeatureDrawer
          open={newFeatureDrawerOpen}
          onOpenChange={setNewFeatureDrawerOpen}
          categories={categories}
          releaseVersions={releaseVersions}
          onCreate={handleUpdate}
        />
      </div>
    </div>
  );
}
