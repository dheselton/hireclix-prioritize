import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X } from "lucide-react";
import type { ProductCategory, Feature } from "@/types/roadmap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SummaryHeaderProps {
  features: Feature[];
  categories: ProductCategory[];
  onAddFeature: () => void;
  filters: {
    category: string;
    featureLevel: string;
    featureType: string;
    status: string;
    search: string;
  };
  onFilterChange: (key: string, value: string) => void;
}

export function SummaryHeader({ 
  features, 
  categories, 
  onAddFeature, 
  filters, 
  onFilterChange 
}: SummaryHeaderProps) {
  const totalCategories = categories.length;
  const totalFeatures = features.length;
  const inDevelopment = features.filter(f => f.status === 'In Development').length;
  const readyForRelease = features.filter(f => f.status === 'Approved').length;
  const upcomingReleases = features.filter(f => 
    f.status !== 'Released' && f.release_version_id
  ).length;

  const stats = [
    { label: "Product Categories", value: totalCategories, color: "text-primary" },
    { label: "Total Features", value: totalFeatures, color: "text-foreground" },
    { label: "In Development", value: inDevelopment, color: "text-accent" },
    { label: "Ready for Release", value: readyForRelease, color: "text-success" },
    { label: "Upcoming Releases", value: upcomingReleases, color: "text-muted-foreground" },
  ];

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const clearFilters = () => {
    Object.keys(filters).forEach(key => onFilterChange(key, ''));
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6 bg-card border border-border shadow-card">
            <div className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 bg-card border border-border">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search features..."
                value={filters.search}
                onChange={(e) => onFilterChange('search', e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={filters.category} onValueChange={(v) => onFilterChange('category', v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Product Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.featureLevel} onValueChange={(v) => onFilterChange('featureLevel', v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Feature Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Levels</SelectItem>
              <SelectItem value="Core">Core</SelectItem>
              <SelectItem value="Integrations">Integrations</SelectItem>
              <SelectItem value="Add-On">Add-On</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.featureType} onValueChange={(v) => onFilterChange('featureType', v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Feature Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="Front End UI">Front End UI</SelectItem>
              <SelectItem value="Back End CMS/Data">Back End CMS/Data</SelectItem>
              <SelectItem value="SEO">SEO</SelectItem>
              <SelectItem value="Full Feature">Full Feature</SelectItem>
              <SelectItem value="3rd Party Integration">3rd Party Integration</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => onFilterChange('status', v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="Scope/Ideation">Scope/Ideation</SelectItem>
              <SelectItem value="Design">Design</SelectItem>
              <SelectItem value="In Development">In Development</SelectItem>
              <SelectItem value="QA">QA</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Released">Released</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}

          <Button onClick={onAddFeature} className="btn-primary ml-auto">
            <Plus className="w-4 h-4 mr-2" />
            Add Feature
          </Button>
        </div>
      </Card>
    </div>
  );
}
