import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SummaryHeader } from "@/components/roadmap/SummaryHeader";
import { KanbanBoard } from "@/components/roadmap/KanbanBoard";
import { Timeline } from "@/components/roadmap/Timeline";
import { FeatureDetailDrawer } from "@/components/roadmap/FeatureDetailDrawer";
import { NewFeatureDrawer } from "@/components/roadmap/NewFeatureDrawer";
import { fetchFeatures, fetchProductCategories, fetchReleaseVersions } from "@/lib/roadmapService";
import type { Feature } from "@/types/roadmap";

export default function ProductRoadmap() {
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

  const filteredFeatures = useMemo(() => {
    return features.filter(feature => {
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
  }, [features, filters]);

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
      <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-8">
        <div>
          <h1 className="text-3xl font-unbounded font-bold text-foreground mb-2">
            Product Roadmap
          </h1>
          <p className="text-muted-foreground">
            Plan, track, and manage product features across releases
          </p>
        </div>

        <SummaryHeader
          features={filteredFeatures}
          categories={categories}
          onAddFeature={handleAddFeature}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <div>
          <h2 className="text-xl font-bold mb-4 text-foreground">Release Versions</h2>
          <KanbanBoard
            features={filteredFeatures}
            releaseVersions={releaseVersions}
            onFeatureClick={handleFeatureClick}
            onFeaturesChange={handleUpdate}
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
