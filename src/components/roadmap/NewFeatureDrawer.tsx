import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategory, ReleaseVersion, FeatureLevel, FeatureType, FeatureStatus } from "@/types/roadmap";
import { createFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";

interface NewFeatureDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
  releaseVersions: ReleaseVersion[];
  onCreate: () => void;
}

export function NewFeatureDrawer({
  open,
  onOpenChange,
  categories,
  releaseVersions,
  onCreate,
}: NewFeatureDrawerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    product_category_id: '',
    release_version_id: '',
    feature_level: 'Core' as FeatureLevel,
    feature_type: 'Full Feature' as FeatureType,
    status: 'Scope/Ideation' as FeatureStatus,
    start_date: '',
    due_date: '',
    documentation: '',
  });

  const handleCreate = async () => {
    if (!formData.title) {
      toast({
        title: "Error",
        description: "Please enter a feature title.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createFeature({
        ...formData,
        assignees: [],
        subtask_count: 0,
        sort_order: 0,
      });
      toast({
        title: "Success",
        description: "Feature created successfully.",
      });
      onCreate();
      onOpenChange(false);
      // Reset form
      setFormData({
        title: '',
        summary: '',
        product_category_id: '',
        release_version_id: '',
        feature_level: 'Core',
        feature_type: 'Full Feature',
        status: 'Scope/Ideation',
        start_date: '',
        due_date: '',
        documentation: '',
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create feature.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Feature</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter feature title"
            />
          </div>

          <div>
            <Label>Summary</Label>
            <Textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Brief description of the feature"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product Category</Label>
              <Select
                value={formData.product_category_id}
                onValueChange={(value) => setFormData({ ...formData, product_category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
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
                value={formData.release_version_id}
                onValueChange={(value) => setFormData({ ...formData, release_version_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
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
                value={formData.feature_level}
                onValueChange={(value) => setFormData({ ...formData, feature_level: value as FeatureLevel })}
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
                value={formData.feature_type}
                onValueChange={(value) => setFormData({ ...formData, feature_type: value as FeatureType })}
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
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as FeatureStatus })}
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
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Documentation</Label>
            <Textarea
              value={formData.documentation}
              onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
              placeholder="Add any documentation, requirements, or notes"
              rows={5}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button onClick={handleCreate} className="btn-primary flex-1">
            Create Feature
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
