import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Doc } from "@/types";
import { fetchDocs, updateDoc, createDoc } from "@/lib/dataService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Plus, Grid3x3, List, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

const docFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  url: z.string().trim().url("Must be a valid URL").max(500, "URL must be less than 500 characters"),
  description: z.string().trim().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  tags: z.string().trim().min(1, "At least one tag is required"),
  type: z.enum(["one-pager", "implementation", "how-to", "integration", "design", "other"]),
  owner: z.string().trim().max(100, "Owner must be less than 100 characters").optional(),
});

type DocFormValues = z.infer<typeof docFormSchema>;

export default function ClientDocs() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const form = useForm<DocFormValues>({
    resolver: zodResolver(docFormSchema),
    defaultValues: {
      title: "",
      url: "",
      description: "",
      tags: "",
      type: "one-pager",
      owner: "",
    },
  });

  useEffect(() => {
    loadDocs();
    
    // Check if we should open the dialog from URL param
    if (searchParams.get("action") === "add") {
      setIsDialogOpen(true);
      // Remove the query param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadDocs = async () => {
    try {
      const data = await fetchDocs();
      setDocs(data.filter(d => d.audience === "client"));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load docs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc: Doc) => {
    setEditingDoc(doc);
    form.reset({
      title: doc.title,
      url: doc.url,
      description: doc.description,
      tags: doc.tags.join(", "),
      type: doc.type,
      owner: doc.owner || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDoc(null);
    form.reset();
  };

  const onSubmit = async (data: DocFormValues) => {
    setIsSubmitting(true);
    try {
      const tagsArray = data.tags.split(",").map(tag => tag.trim()).filter(Boolean);
      
      if (editingDoc) {
        // Update existing doc
        await updateDoc(editingDoc.id, {
          title: data.title,
          url: data.url,
          description: data.description,
          tags: tagsArray,
          type: data.type,
          owner: data.owner || null,
        });

        toast({
          title: "Success",
          description: "Client doc updated successfully",
        });
      } else {
        // Create new doc
        await createDoc({
          title: data.title,
          url: data.url,
          description: data.description,
          tags: tagsArray,
          type: data.type,
          owner: data.owner || null,
          audience: "client",
        });

        toast({
          title: "Success",
          description: "Client doc added successfully",
        });
      }

      handleCloseDialog();
      await loadDocs();
    } catch (error) {
      toast({
        title: "Error",
        description: editingDoc ? "Failed to update client doc" : "Failed to add client doc",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDocs = docs.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <h1 className="text-3xl font-unbounded font-bold mb-2">Client-Facing Docs</h1>
          <p className="text-muted-foreground">Public guides, one-pagers, and client resources</p>
        </div>
        <Button 
          className="bg-accent text-accent-foreground hover:bg-accent-hover"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client Doc
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Client Doc" : "Add Client Doc"}</DialogTitle>
            <DialogDescription>
              {editingDoc ? "Update the client-facing documentation item" : "Add a new client-facing documentation item"}. All fields are required except owner.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Getting Started Guide" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Docs URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://docs.google.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of the document..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Getting Started, Setup, Tutorial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one-pager">One-Pager</SelectItem>
                        <SelectItem value="implementation">Implementation</SelectItem>
                        <SelectItem value="how-to">How-To</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
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

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (editingDoc ? "Updating..." : "Adding...") : (editingDoc ? "Update Client Doc" : "Add Client Doc")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search client-facing docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-primary text-primary-foreground" : ""}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-primary text-primary-foreground" : ""}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No client-facing docs found
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc) => (
              <Card key={doc.id} className="glass-card hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-unbounded text-foreground leading-tight">{doc.title}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground leading-snug">{doc.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {doc.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary-hover">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Doc
                      </Button>
                    </a>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{doc.views_30d} views</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        onClick={() => handleEdit(doc)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((doc) => (
              <Card key={doc.id} className="glass-card hover:shadow-lg transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <h3 className="font-unbounded font-bold text-foreground">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground leading-snug">{doc.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Button className="bg-primary text-primary-foreground hover:bg-primary-hover">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Doc
                          </Button>
                        </a>
                        <span className="text-xs text-muted-foreground">{doc.views_30d} views</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-auto"
                          onClick={() => handleEdit(doc)}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
