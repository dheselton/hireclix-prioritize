import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Integration } from "@/types";
import { fetchIntegrations, createIntegration } from "@/lib/dataService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, ExternalLink, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const integrationFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  vendor: z.string().trim().min(1, "Vendor is required").max(100, "Vendor must be less than 100 characters"),
  category: z.enum(["ATS", "Analytics", "SEO", "SSO", "CDN", "Other"]),
  status: z.enum(["GA", "Beta", "Planned", "Deprecated"]),
  health: z.enum(["Healthy", "Degraded", "Down"]),
  directionality: z.enum(["Unidirectional", "Bidirectional", "Mixed"]),
  version: z.string().trim().max(50, "Version must be less than 50 characters").optional(),
  docs_link: z.string().trim().url("Must be a valid URL").max(500, "URL must be less than 500 characters").optional().or(z.literal("")),
  owner: z.string().trim().max(100, "Owner must be less than 100 characters").optional(),
  capabilities: z.string().trim().min(1, "At least one capability is required"),
  known_limitations: z.string().trim().max(1000, "Limitations must be less than 1000 characters").optional(),
});

type IntegrationFormValues = z.infer<typeof integrationFormSchema>;

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      vendor: "",
      category: "ATS",
      status: "GA",
      health: "Healthy",
      directionality: "Unidirectional",
      version: "",
      docs_link: "",
      owner: "",
      capabilities: "",
      known_limitations: "",
    },
  });

  useEffect(() => {
    loadIntegrations();
    
    // Check if we should open the dialog from URL param
    if (searchParams.get("action") === "add") {
      setIsDialogOpen(true);
      // Remove the query param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadIntegrations = async () => {
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: IntegrationFormValues) => {
    setIsSubmitting(true);
    try {
      const capabilitiesArray = data.capabilities.split(",").map(cap => cap.trim()).filter(Boolean);
      
      await createIntegration({
        name: data.name,
        vendor: data.vendor,
        category: data.category,
        status: data.status,
        version: data.version || null,
        docs_link: data.docs_link || null,
        owner: data.owner || null,
        known_limitations: data.known_limitations || "",
        health: data.health,
        directionality: data.directionality,
        capabilities: capabilitiesArray,
      });

      toast({
        title: "Success",
        description: "Integration added successfully",
      });

      form.reset();
      setIsDialogOpen(false);
      await loadIntegrations();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add integration",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get all unique capabilities
  const allCapabilities = Array.from(
    new Set(integrations.flatMap(i => i.capabilities))
  ).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">Integrations</h1>
          <p className="text-muted-foreground">ATS and related integration inventory</p>
        </div>
        <Button 
          className="bg-success text-white hover:bg-success/90"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
            <DialogDescription>
              Add a new integration to the catalog. All fields are required except version, docs link, owner, and limitations.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Integration Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Greenhouse ATS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Greenhouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ATS">ATS</SelectItem>
                          <SelectItem value="Analytics">Analytics</SelectItem>
                          <SelectItem value="SEO">SEO</SelectItem>
                          <SelectItem value="SSO">SSO</SelectItem>
                          <SelectItem value="CDN">CDN</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="GA">GA</SelectItem>
                          <SelectItem value="Beta">Beta</SelectItem>
                          <SelectItem value="Planned">Planned</SelectItem>
                          <SelectItem value="Deprecated">Deprecated</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="health"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Health</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select health" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Healthy">Healthy</SelectItem>
                          <SelectItem value="Degraded">Degraded</SelectItem>
                          <SelectItem value="Down">Down</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="directionality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Directionality</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select directionality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Unidirectional">Unidirectional</SelectItem>
                          <SelectItem value="Bidirectional">Bidirectional</SelectItem>
                          <SelectItem value="Mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="capabilities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capabilities (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Job Posting, Candidate Sync, Apply Flow" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., v2.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="docs_link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documentation Link (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://docs.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="known_limitations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Known Limitations (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any known issues or limitations..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Integration"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="matrix">Capability Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id} className="glass-card p-5 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground">{integration.vendor}</p>
                  </div>
                  <StatusBadge status={integration.status} />
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={integration.health} />
                    <Badge variant="outline" className="badge-muted text-xs">
                      {integration.directionality}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Capabilities:</p>
                    <div className="flex flex-wrap gap-1">
                      {integration.capabilities.map(cap => (
                        <Badge key={cap} variant="secondary" className="badge-primary text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {integration.version || "No version"}
                  </span>
                   {integration.docs_link && (
                    <a href={integration.docs_link} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 px-2 focusable">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Docs
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix">
          <Card className="glass-card p-6 overflow-auto">
            <h2 className="text-xl mb-4">Capability Matrix</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[180px] sticky left-0 bg-muted/50 z-10">Integration</TableHead>
                    {allCapabilities.map(cap => (
                      <TableHead key={cap} className="text-center min-w-[140px]">
                        {cap}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id} className="hover:bg-accent/5">
                      <TableCell className="font-medium sticky left-0 bg-card z-10">
                        <div>
                          <div className="font-bold">{integration.name}</div>
                          <div className="text-xs text-muted-foreground">{integration.vendor}</div>
                        </div>
                      </TableCell>
                      {allCapabilities.map(cap => (
                        <TableCell key={cap} className="text-center">
                          {integration.capabilities.includes(cap) ? (
                            <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
