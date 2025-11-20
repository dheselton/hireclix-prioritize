import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeatureDetailDrawer } from "@/components/roadmap/FeatureDetailDrawer";
import { fetchFeatures, fetchProductCategories, fetchReleaseVersions } from "@/lib/roadmapService";
import type { Feature, ReleaseVersion, FeatureStatus } from "@/types/roadmap";
import { format, isAfter, isBefore, subDays } from "date-fns";
import { Calendar, AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react";

const statusColors: Record<string, string> = {
  "Scope/Ideation": "badge-muted",
  "Design": "badge-primary",
  "In Development": "badge-accent",
  "QA": "badge-primary",
  "Approved": "badge-success",
  "Released": "badge-success"
};

export default function RoadmapDashboard() {
  const navigate = useNavigate();
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    category: '',
    featureLevel: '',
    status: '',
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

  // Filter features based on selected filters
  const filteredFeatures = useMemo(() => {
    return features.filter(feature => {
      if (filters.category && feature.product_category_id !== filters.category) return false;
      if (filters.featureLevel && feature.feature_level !== filters.featureLevel) return false;
      if (filters.status && feature.status !== filters.status) return false;
      
      // Date range filter
      if (filters.dateRange !== 'all' && feature.due_date) {
        const dueDate = new Date(feature.due_date);
        const now = new Date();
        
        if (filters.dateRange === 'this-quarter') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const featureQuarter = Math.floor(dueDate.getMonth() / 3);
          if (dueDate.getFullYear() !== now.getFullYear() || featureQuarter !== currentQuarter) return false;
        } else if (filters.dateRange === 'next-90') {
          const in90Days = new Date(now);
          in90Days.setDate(in90Days.getDate() + 90);
          if (isAfter(dueDate, in90Days) || isBefore(dueDate, now)) return false;
        } else if (filters.dateRange === 'this-year') {
          if (dueDate.getFullYear() !== now.getFullYear()) return false;
        }
      }
      
      return true;
    });
  }, [features, filters]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredFeatures.length;
    const inDevelopment = filteredFeatures.filter(f => f.status === 'In Development').length;
    const inDesign = filteredFeatures.filter(f => f.status === 'Design').length;
    const inQA = filteredFeatures.filter(f => f.status === 'QA').length;
    const approved = filteredFeatures.filter(f => f.status === 'Approved').length;
    
    const thirtyDaysAgo = subDays(new Date(), 30);
    const releasedLast30 = filteredFeatures.filter(f => 
      f.status === 'Released' && 
      f.updated_at && 
      isAfter(new Date(f.updated_at), thirtyDaysAgo)
    ).length;

    return { total, inDevelopment, inDesign, inQA, approved, releasedLast30 };
  }, [filteredFeatures]);

  // Get active releases (Q2 2025 - Q2 2027)
  const activeReleases = useMemo(() => {
    return releaseVersions
      .filter(v => !v.is_backlog && v.year >= 2025 && v.year <= 2027)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return (a.quarter || 0) - (b.quarter || 0);
      });
  }, [releaseVersions]);

  // Calculate release progress
  const releaseProgress = useMemo(() => {
    return activeReleases.map(release => {
      const releaseFeatures = filteredFeatures.filter(f => f.release_version_id === release.id);
      const total = releaseFeatures.length;
      const completed = releaseFeatures.filter(f => f.status === 'Released' || f.status === 'Approved').length;
      const inDesign = releaseFeatures.filter(f => f.status === 'Design').length;
      const inDevelopment = releaseFeatures.filter(f => f.status === 'In Development').length;
      const inQA = releaseFeatures.filter(f => f.status === 'QA').length;
      const readyForRelease = releaseFeatures.filter(f => f.status === 'Approved').length;
      
      const now = new Date();
      const overdue = releaseFeatures.filter(f => 
        f.due_date && 
        isAfter(now, new Date(f.due_date)) && 
        f.status !== 'Released'
      ).length;
      
      const progress = total > 0 ? (completed / total) * 100 : 0;
      
      return {
        release,
        total,
        completed,
        progress,
        inDesign,
        inDevelopment,
        inQA,
        readyForRelease,
        overdue
      };
    });
  }, [activeReleases, filteredFeatures]);

  // Features currently in development
  const inDevelopmentFeatures = useMemo(() => {
    return filteredFeatures
      .filter(f => f.status === 'In Development' || f.status === 'QA')
      .sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return 0;
      });
  }, [filteredFeatures]);

  // At-risk and overdue features
  const atRiskFeatures = useMemo(() => {
    const now = new Date();
    return filteredFeatures
      .filter(f => f.due_date && isAfter(now, new Date(f.due_date)) && f.status !== 'Released')
      .sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return 0;
      });
  }, [filteredFeatures]);

  // Recent activity (recently updated features)
  const recentActivity = useMemo(() => {
    return [...filteredFeatures]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [filteredFeatures]);

  const handleFeatureClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setDetailDrawerOpen(true);
  };

  const handleReleaseClick = (releaseId: string) => {
    navigate(`/?release=${releaseId}`);
  };

  const getDaysOverdue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-unbounded font-bold text-foreground mb-2">
              Roadmap Dashboard
            </h1>
            <p className="text-muted-foreground">
              At-a-glance view of product features, progress, and upcoming releases
            </p>
          </div>
          <Button onClick={() => navigate('/')}>
            View Full Roadmap
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="this-quarter">This Quarter</SelectItem>
                    <SelectItem value="next-90">Next 90 Days</SelectItem>
                    <SelectItem value="this-year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Product Category</label>
                <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Feature Level</label>
                <Select value={filters.featureLevel} onValueChange={(value) => setFilters(prev => ({ ...prev, featureLevel: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    <SelectItem value="Core">Core</SelectItem>
                    <SelectItem value="Integrations">Integrations</SelectItem>
                    <SelectItem value="Add-On">Add-On</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">Total Features</div>
                <div className="text-3xl font-bold">{metrics.total}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">In Development</div>
                <div className="text-3xl font-bold">{metrics.inDevelopment}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">In Design</div>
                <div className="text-3xl font-bold">{metrics.inDesign}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">In QA / Testing</div>
                <div className="text-3xl font-bold">{metrics.inQA}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">Ready for Release</div>
                <div className="text-3xl font-bold">{metrics.approved}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-foreground">
                <div className="text-sm font-medium mb-1">Released (30d)</div>
                <div className="text-3xl font-bold">{metrics.releasedLast30}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Release Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Release Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {releaseProgress.map(({ release, total, completed, progress, inDesign, inDevelopment, inQA, readyForRelease, overdue }) => (
                <Card 
                  key={release.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleReleaseClick(release.id)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{release.name}</h3>
                        {overdue > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {overdue} overdue
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">{completed} / {total}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Design</span>
                          <span className="font-medium text-foreground">{inDesign}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Dev</span>
                          <span className="font-medium text-foreground">{inDevelopment}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">QA</span>
                          <span className="font-medium text-foreground">{inQA}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Ready</span>
                          <span className="font-medium text-foreground">{readyForRelease}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* In Development & At Risk sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* In Development */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                In Development
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inDevelopmentFeatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No features currently in development
                  </p>
                ) : (
                  inDevelopmentFeatures.map(feature => (
                    <Card 
                      key={feature.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleFeatureClick(feature)}
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm text-foreground">{feature.title}</h4>
                          
                          <div className="flex flex-wrap gap-1">
                            {feature.product_category && (
                              <Badge className="badge-primary text-xs">{feature.product_category.name}</Badge>
                            )}
                            {feature.release_version && (
                              <Badge className="badge-muted text-xs">{feature.release_version.name}</Badge>
                            )}
                            <Badge className={`${statusColors[feature.status]} text-xs`}>
                              {feature.status}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            {feature.assignees.length > 0 && (
                              <span>{feature.assignees.join(', ')}</span>
                            )}
                            {feature.due_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(feature.due_date), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* At Risk & Overdue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                At Risk & Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {atRiskFeatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No overdue features
                  </p>
                ) : (
                  atRiskFeatures.map(feature => (
                    <Card 
                      key={feature.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-destructive/20"
                      onClick={() => handleFeatureClick(feature)}
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm text-foreground">{feature.title}</h4>
                          
                          <div className="flex flex-wrap gap-1">
                            {feature.product_category && (
                              <Badge className="badge-primary text-xs">{feature.product_category.name}</Badge>
                            )}
                            {feature.release_version && (
                              <Badge className="badge-muted text-xs">{feature.release_version.name}</Badge>
                            )}
                            <Badge className={`${statusColors[feature.status]} text-xs`}>
                              {feature.status}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            {feature.assignees.length > 0 && (
                              <span className="text-muted-foreground">{feature.assignees.join(', ')}</span>
                            )}
                            {feature.due_date && (
                              <div className="flex items-center gap-1 text-destructive font-medium">
                                <AlertCircle className="w-3 h-3" />
                                {getDaysOverdue(feature.due_date)} days overdue
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity
                </p>
              ) : (
                recentActivity.map(feature => (
                  <div
                    key={feature.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleFeatureClick(feature)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">{feature.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {feature.product_category && (
                          <Badge className="badge-primary text-xs">{feature.product_category.name}</Badge>
                        )}
                        {feature.release_version && (
                          <Badge className="badge-muted text-xs">{feature.release_version.name}</Badge>
                        )}
                        <Badge className={`${statusColors[feature.status]} text-xs`}>
                          {feature.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground ml-4">
                      {format(new Date(feature.updated_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <FeatureDetailDrawer
          feature={selectedFeature}
          open={detailDrawerOpen}
          onOpenChange={setDetailDrawerOpen}
          categories={categories}
          releaseVersions={releaseVersions}
          onUpdate={refetchFeatures}
        />
      </div>
    </div>
  );
}
