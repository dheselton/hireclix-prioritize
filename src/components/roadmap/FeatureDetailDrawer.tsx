import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Feature, ProductCategory, ReleaseVersion } from "@/types/roadmap";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";

interface FeatureDetailDrawerProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
  releaseVersions: ReleaseVersion[];
  onUpdate: () => void;
}

export function FeatureDetailDrawer({
  feature,
  open,
  onOpenChange,
  categories,
  releaseVersions,
  onUpdate,
}: FeatureDetailDrawerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Feature>>({});

  useEffect(() => {
    if (feature) {
      setFormData(feature);
    }
  }, [feature]);

  if (!feature) return null;

  const handleSave = async () => {
    try {
      // Exclude nested objects - only send scalar fields that exist as columns
      const { product_category, release_version, ...updateData } = formData;
      
      console.log('Updating feature:', feature.id, 'with data:', updateData);
      const result = await updateFeature(feature.id, updateData);
      console.log('Update successful:', result);
      toast({
        title: "Success",
        description: "Feature updated successfully.",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Feature update error:', error);
      const errorMessage = error?.message || error?.toString() || "Failed to update feature.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Feature Details</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="qa">QA</TabsTrigger>
            <TabsTrigger value="rollout">Rollout</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Summary</Label>
              <Textarea
                value={formData.summary || ''}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Category</Label>
                <Select
                  value={formData.product_category_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, product_category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Release Version</Label>
                <Select
                  value={formData.release_version_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, release_version_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {releaseVersions.map(ver => (
                      <SelectItem key={ver.id} value={ver.id}>{ver.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Feature Level</Label>
                <Select
                  value={formData.feature_level || ''}
                  onValueChange={(value) => setFormData({ ...formData, feature_level: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Core">Core</SelectItem>
                    <SelectItem value="Integrations">Integrations</SelectItem>
                    <SelectItem value="Add-On">Add-On</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Feature Type</Label>
                <Select
                  value={formData.feature_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, feature_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Front End UI">Front End UI</SelectItem>
                    <SelectItem value="Back End CMS/Data">Back End CMS/Data</SelectItem>
                    <SelectItem value="SEO">SEO</SelectItem>
                    <SelectItem value="Full Feature">Full Feature</SelectItem>
                    <SelectItem value="3rd Party Integration">3rd Party Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status || ''}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scope/Ideation">Scope/Ideation</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="In Development">In Development</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Released">Released</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="requirements" className="space-y-4 mt-4">
            <div>
              <Label>Documentation</Label>
              <Textarea
                value={formData.documentation || ''}
                onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
                rows={10}
                placeholder="Enter requirements and documentation..."
              />
            </div>
          </TabsContent>

          <TabsContent value="design" className="space-y-4 mt-4">
            <div>
              <Label>Design Specifications</Label>
              <Textarea
                value={formData.design_specs || ''}
                onChange={(e) => setFormData({ ...formData, design_specs: e.target.value })}
                rows={10}
                placeholder="Enter design specs, links to Figma, mockups..."
              />
            </div>
          </TabsContent>

          <TabsContent value="technical" className="space-y-4 mt-4">
            <div>
              <Label>Technical Notes</Label>
              <Textarea
                value={formData.technical_notes || ''}
                onChange={(e) => setFormData({ ...formData, technical_notes: e.target.value })}
                rows={10}
                placeholder="Enter technical implementation notes..."
              />
            </div>
          </TabsContent>

          <TabsContent value="qa" className="space-y-4 mt-4">
            <div>
              <Label>QA Plan</Label>
              <Textarea
                value={formData.qa_plan || ''}
                onChange={(e) => setFormData({ ...formData, qa_plan: e.target.value })}
                rows={10}
                placeholder="Enter QA testing plan..."
              />
            </div>
          </TabsContent>

          <TabsContent value="rollout" className="space-y-4 mt-4">
            <div>
              <Label>Rollout Instructions</Label>
              <Textarea
                value={formData.rollout_instructions || ''}
                onChange={(e) => setFormData({ ...formData, rollout_instructions: e.target.value })}
                rows={10}
                placeholder="Enter rollout instructions and ClickUp export details..."
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
          <Button onClick={handleSave} className="btn-primary flex-1">
            Save Changes
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
