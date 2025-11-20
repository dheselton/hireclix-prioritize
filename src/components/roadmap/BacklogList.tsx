import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, ArrowUpRight } from "lucide-react";
import type { Feature, ProductCategory, ReleaseVersion, FeatureStatus } from "@/types/roadmap";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BacklogListProps {
  features: Feature[];
  categories: ProductCategory[];
  releaseVersions: ReleaseVersion[];
  onFeatureClick: (feature: Feature) => void;
  onUpdate: () => void;
}

export function BacklogList({
  features,
  categories,
  releaseVersions,
  onFeatureClick,
  onUpdate,
}: BacklogListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [selectedReleaseVersion, setSelectedReleaseVersion] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FeatureStatus>('Scope/Ideation');

  const nonBacklogVersions = releaseVersions.filter(v => !v.is_backlog);

  const filteredFeatures = useMemo(() => {
    return features.filter(feature => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesTitle = feature.title.toLowerCase().includes(searchLower);
        const matchesSummary = feature.summary?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesSummary) return false;
      }

      // Category filter
      if (filterCategory && feature.product_category_id !== filterCategory) return false;

      // Level filter
      if (filterLevel && feature.feature_level !== filterLevel) return false;

      // Type filter
      if (filterType && feature.feature_type !== filterType) return false;

      // Status filter
      if (filterStatus && feature.status !== filterStatus) return false;

      return true;
    });
  }, [features, searchTerm, filterCategory, filterLevel, filterType, filterStatus]);

  const handlePromote = (feature: Feature) => {
    setSelectedFeature(feature);
    setSelectedReleaseVersion('');
    setSelectedStatus(feature.status as FeatureStatus);
    setPromoteDialogOpen(true);
  };

  const handlePromoteConfirm = async () => {
    if (!selectedFeature || !selectedReleaseVersion) return;

    try {
      await updateFeature(selectedFeature.id, {
        release_version_id: selectedReleaseVersion,
        status: selectedStatus,
      });

      toast({
        title: "Feature promoted",
        description: "Feature has been moved to the selected release version."
      });

      setPromoteDialogOpen(false);
      setSelectedFeature(null);
      onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to promote feature.",
        variant: "destructive"
      });
    }
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Backlog & Unplanned Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search backlog..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {filterCategory && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterCategory('')}
                >
                  Category: {categories.find(c => c.id === filterCategory)?.name}
                </Button>
              )}
              {filterLevel && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterLevel('')}
                >
                  Level: {filterLevel}
                </Button>
              )}
              {filterType && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterType('')}
                >
                  Type: {filterType}
                </Button>
              )}
              {filterStatus && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterStatus('')}
                >
                  Status: {filterStatus}
                </Button>
              )}
              
              <Select value={filterCategory || undefined} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLevel || undefined} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Core">Core</SelectItem>
                  <SelectItem value="Integrations">Integrations</SelectItem>
                  <SelectItem value="Add-On">Add-On</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType || undefined} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Front End UI">Front End UI</SelectItem>
                  <SelectItem value="Back End CMS/Data">Back End CMS/Data</SelectItem>
                  <SelectItem value="SEO">SEO</SelectItem>
                  <SelectItem value="Full Feature">Full Feature</SelectItem>
                  <SelectItem value="3rd Party Integration">3rd Party Integration</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus || undefined} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scope/Ideation">Scope/Ideation</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="In Development">In Development</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredFeatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No backlog items found
              </div>
            ) : (
              filteredFeatures.map((feature) => (
                <Card key={feature.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onFeatureClick(feature)}
                        className="text-left w-full group"
                      >
                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {feature.title}
                        </h4>
                      </button>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{getCategoryName(feature.product_category_id)}</Badge>
                        <Badge variant="secondary">{feature.feature_level}</Badge>
                        <Badge variant="secondary">{feature.feature_type}</Badge>
                        <Badge>{feature.status}</Badge>
                      </div>

                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {format(new Date(feature.created_at), 'MMM d, yyyy')}</span>
                        <span>Updated: {format(new Date(feature.updated_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePromote(feature)}
                      >
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        Promote to Release
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Promote Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Release</DialogTitle>
            <DialogDescription>
              Select a release version and status for this feature.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Release Version</label>
              <Select value={selectedReleaseVersion} onValueChange={setSelectedReleaseVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select release version" />
                </SelectTrigger>
                <SelectContent>
                  {nonBacklogVersions.map(version => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as FeatureStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scope/Ideation">Scope/Ideation</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="In Development">In Development</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePromoteConfirm} disabled={!selectedReleaseVersion}>
              Promote Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
