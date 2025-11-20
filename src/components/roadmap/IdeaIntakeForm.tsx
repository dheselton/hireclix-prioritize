import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategory } from "@/types/roadmap";
import { createFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";

interface IdeaIntakeFormProps {
  categories: ProductCategory[];
  backlogVersionId: string | null;
  onSuccess: () => void;
}

export function IdeaIntakeForm({ categories, backlogVersionId, onSuccess }: IdeaIntakeFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    product_category_id: '',
    feature_level: 'Core' as const,
    feature_type: 'Full Feature' as const,
    status: 'Scope/Ideation' as const,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Validation error",
        description: "Title is required.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeature({
        ...formData,
        release_version_id: backlogVersionId || undefined,
        assignees: [],
        subtask_count: 0,
        sort_order: 0,
      });
      
      toast({
        title: "Success",
        description: "Idea added to backlog successfully."
      });
      
      // Reset form
      setFormData({
        title: '',
        summary: '',
        product_category_id: '',
        feature_level: 'Core',
        feature_type: 'Full Feature',
        status: 'Scope/Ideation',
      });
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add idea to backlog.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Idea / Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter feature title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Description / Context</Label>
            <Textarea
              id="summary"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Describe the idea or request"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Product Category</Label>
            <Select
              value={formData.product_category_id}
              onValueChange={(value) => setFormData({ ...formData, product_category_id: value })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Feature Level</Label>
            <Select
              value={formData.feature_level}
              onValueChange={(value: any) => setFormData({ ...formData, feature_level: value })}
            >
              <SelectTrigger id="level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Core">Core</SelectItem>
                <SelectItem value="Integrations">Integrations</SelectItem>
                <SelectItem value="Add-On">Add-On</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Feature Type</Label>
            <Select
              value={formData.feature_type}
              onValueChange={(value: any) => setFormData({ ...formData, feature_type: value })}
            >
              <SelectTrigger id="type">
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

          <div className="space-y-2">
            <Label htmlFor="status">Suggested Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="status">
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            Add to Backlog
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
