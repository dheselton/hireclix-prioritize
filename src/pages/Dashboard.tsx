import { useEffect, useState } from "react";
import { Customer, Doc, Integration } from "@/types";
import { fetchCustomers, fetchDocs, fetchIntegrations } from "@/lib/dataService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  TrendingUp, 
  FileText, 
  Activity, 
  ExternalLink, 
  HelpCircle,
  AlertCircle,
  UserX,
  FileWarning
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [docFilter, setDocFilter] = useState<"all" | "internal" | "client">("all");
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersData, docsData, integrationsData] = await Promise.all([
        fetchCustomers(),
        fetchDocs(),
        fetchIntegrations(),
      ]);
      setCustomers(customersData);
      setDocs(docsData);
      setIntegrations(integrationsData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalLiveSites = customers
    .filter(c => c.status === "Live")
    .reduce((sum, c) => sum + c.live_sites, 0);

  const integrationHealthPercent = Math.round(
    (integrations.filter(i => i.health === "Healthy").length / integrations.length) * 100
  );

  const recentlyLive = customers
    .filter(c => c.status === "Live" && c.go_live_date)
    .sort((a, b) => new Date(b.go_live_date!).getTime() - new Date(a.go_live_date!).getTime())
    .slice(0, 6);

  const filteredDocs = docs
    .filter(d => docFilter === "all" || d.audience === docFilter)
    .sort((a, b) => b.views_30d - a.views_30d)
    .slice(0, 6);

  const activeIntegrations = integrations.filter(i => i.status === "GA" || i.status === "Beta").slice(0, 4);

  const healthyIntegrations = integrations.filter(i => i.health === "Healthy");
  const degradedIntegrations = integrations.filter(i => i.health === "Degraded");
  const downIntegrations = integrations.filter(i => i.health === "Down");

  const customersMissingGoLive = customers.filter(c => c.status === "Live" && !c.go_live_date).length;
  const docsWithoutOwner = docs.filter(d => !d.owner).length;
  const integrationsWithLimitations = integrations.filter(i => i.known_limitations && i.known_limitations.trim() !== "").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="rounded-2xl p-8 bg-gradient-hero border border-border/50">
        <h1 className="text-4xl font-unbounded font-bold mb-2 text-primary">
          Career Site Dev & Design Ops
        </h1>
        <p className="text-muted-foreground">
          A hub for quick answers, resources, and live project context.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Live Sites</p>
                <p className="text-3xl font-bold text-primary" aria-live="polite">{totalLiveSites}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Integration Health</p>
                <p className="text-3xl font-bold text-primary" aria-live="polite">{integrationHealthPercent}%</p>
              </div>
              <Activity className="h-10 w-10 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-lg transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Docs</p>
                <p className="text-3xl font-bold text-primary" aria-live="polite">{docs.length}</p>
              </div>
              <FileText className="h-10 w-10 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Top Docs & Active Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Docs */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-unbounded text-foreground">Top Docs</CardTitle>
              <Tabs value={docFilter} onValueChange={(v) => setDocFilter(v as any)} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="internal" className="text-xs">Internal</TabsTrigger>
                  <TabsTrigger value="client" className="text-xs">Client</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <CardDescription className="text-sm">Most viewed in last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
          {filteredDocs.map((doc) => (
              <div key={doc.id} className="row flex items-center justify-between p-3 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground text-sm truncate">{doc.title}</h4>
                    <Badge variant="outline" className="badge-primary text-xs">
                      {doc.audience}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{doc.views_30d} views</p>
                </div>
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 focusable">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Integrations */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-unbounded text-foreground">Active Integrations</CardTitle>
            <CardDescription className="text-sm">Current ATS integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeIntegrations.map((integration) => (
              <Card key={integration.id} className="glass-card hover:shadow-md transition-all">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-foreground text-sm">{integration.name}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <StatusBadge status={integration.status} />
                        <StatusBadge status={integration.health} />
                        <Badge variant="outline" className="text-xs">{integration.directionality}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recently Live & Integration Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Live */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-unbounded text-foreground">Recently Live</CardTitle>
            <CardDescription className="text-sm">Last 6 deployments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentlyLive.map((customer) => (
              <div key={customer.id} className="row flex items-center justify-between p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-unbounded font-bold">
                    {customer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground text-sm">{customer.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {customer.go_live_date ? new Date(customer.go_live_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={customer.status} />
                  {customer.site_url && (
                    <a href={customer.site_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 focusable">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Integration Health Overview */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-unbounded text-foreground">Integration Health Overview</CardTitle>
            <CardDescription className="text-sm">Status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success"></div>
                  <span className="text-sm font-medium text-foreground">Healthy</span>
                </div>
                <Badge className="bg-success/20 text-success-foreground">{healthyIntegrations.length}</Badge>
              </div>
              
              {degradedIntegrations.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent"></div>
                    <span className="text-sm font-medium text-foreground">Degraded</span>
                  </div>
                  <Badge className="bg-accent/20 text-accent">{degradedIntegrations.length}</Badge>
                </div>
              )}

              {downIntegrations.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="text-sm font-medium text-foreground">Down</span>
                  </div>
                  <Badge className="bg-primary/20 text-primary">{downIntegrations.length}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Quick Answers & Implementation Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Answers */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-unbounded text-foreground">Quick Answers</CardTitle>
            <CardDescription className="text-sm">Frequently asked questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start h-auto p-3 focusable"
              onClick={() => navigate("/faq")}
            >
              <HelpCircle className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <span className="text-sm text-left">Where are one-pagers?</span>
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-auto p-3 focusable"
              onClick={() => navigate("/faq")}
            >
              <HelpCircle className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <span className="text-sm text-left">How to request a new integration?</span>
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-auto p-3 focusable"
              onClick={() => navigate("/design-system")}
            >
              <HelpCircle className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <span className="text-sm text-left">Client-First guide</span>
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-auto p-3 focusable"
              onClick={() => navigate("/design-system")}
            >
              <HelpCircle className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <span className="text-sm text-left">Design tokens reference</span>
            </Button>
          </CardContent>
        </Card>

        {/* Implementation Shortcuts */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-unbounded text-foreground">Implementation Shortcuts</CardTitle>
            <CardDescription className="text-sm">Quick access to filtered views</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-3 border-border focusable"
              onClick={() => navigate("/customers")}
            >
              <AlertCircle className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">Customers missing Go-Live Date</div>
                <div className="text-xs text-muted-foreground">{customersMissingGoLive} items</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-3 border-border focusable"
              onClick={() => navigate("/internal-docs")}
            >
              <UserX className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">Docs without owner</div>
                <div className="text-xs text-muted-foreground">{docsWithoutOwner} items</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-3 border-border focusable"
              onClick={() => navigate("/integrations")}
            >
              <FileWarning className="h-4 w-4 mr-2 text-success flex-shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">Integrations with known limitations</div>
                <div className="text-xs text-muted-foreground">{integrationsWithLimitations} items</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
