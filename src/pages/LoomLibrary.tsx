import { useState, useEffect } from "react";
import { Plus, Search, Grid3x3, List, Pencil, ExternalLink, Play, Pin, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { LoomVideo } from "@/types";
import { fetchLoomVideos, createLoomVideo, updateLoomVideo, deleteLoomVideo } from "@/lib/dataService";
import { Checkbox } from "@/components/ui/checkbox";
const videoFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  loom_url: z.string().url("Must be a valid URL"),
  description: z.string().min(1, "Description is required").max(500),
  tags: z.string(),
  folder: z.string().optional(),
  thumbnail_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  duration: z.string().optional(),
  is_pinned: z.boolean().default(false)
});
type VideoFormValues = z.infer<typeof videoFormSchema>;
export default function LoomLibrary() {
  const [videos, setVideos] = useState<LoomVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVideo, setEditingVideo] = useState<LoomVideo | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "views">("recent");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const {
    toast
  } = useToast();
  const form = useForm<VideoFormValues>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      title: "",
      loom_url: "",
      description: "",
      tags: "",
      folder: "",
      thumbnail_url: "",
      duration: "",
      is_pinned: false
    }
  });
  useEffect(() => {
    loadVideos();
  }, []);
  const fetchLoomMetadata = async (url: string) => {
    try {
      setIsFetchingMetadata(true);
      const response = await fetch(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Failed to fetch Loom metadata');
      const data = await response.json();
      return {
        title: data.title || '',
        description: data.description || '',
        thumbnail_url: data.thumbnail_url || '',
        duration: data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : ''
      };
    } catch (error) {
      console.error("Error fetching Loom metadata:", error);
      throw error;
    } finally {
      setIsFetchingMetadata(false);
    }
  };
  const handleFetchMetadata = async () => {
    const currentUrl = form.getValues("loom_url");
    if (!currentUrl) {
      toast({
        title: "No URL",
        description: "Please enter a Loom URL first",
        variant: "destructive"
      });
      return;
    }
    try {
      const metadata = await fetchLoomMetadata(currentUrl);
      form.setValue("title", metadata.title);
      form.setValue("description", metadata.description);
      form.setValue("thumbnail_url", metadata.thumbnail_url);
      if (metadata.duration) {
        form.setValue("duration", metadata.duration);
      }
      toast({
        title: "Success",
        description: "Video details fetched from Loom"
      });
    } catch (error) {
      toast({
        title: "Couldn't fetch Loom info",
        description: "We couldn't pull info from this Loom. You can add it manually.",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    const subscription = form.watch((value, {
      name
    }) => {
      if (name === "loom_url" && value.loom_url && !editingVideo) {
        const url = value.loom_url;
        if (url.includes('loom.com/share/')) {
          handleFetchMetadata();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, editingVideo]);
  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await fetchLoomVideos();
      setVideos(data);
    } catch (error) {
      console.error("Error loading videos:", error);
      toast({
        title: "Error",
        description: "Failed to load videos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleEdit = (video: LoomVideo) => {
    setEditingVideo(video);
    form.reset({
      title: video.title,
      loom_url: video.loom_url,
      description: video.description,
      tags: video.tags.join(", "),
      folder: video.folder || "",
      thumbnail_url: video.thumbnail_url || "",
      duration: video.duration || "",
      is_pinned: video.is_pinned
    });
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingVideo(null);
    form.reset();
  };
  const handleDelete = async () => {
    if (!editingVideo) return;
    
    const confirmed = window.confirm("Are you sure you want to delete this video? This action cannot be undone.");
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await deleteLoomVideo(editingVideo.id);
      toast({
        title: "Success",
        description: "Video deleted successfully"
      });
      handleCloseDialog();
      loadVideos();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: VideoFormValues) => {
    try {
      setIsSubmitting(true);
      const tagsArray = values.tags.split(",").map(t => t.trim()).filter(Boolean);
      const videoData = {
        title: values.title,
        loom_url: values.loom_url,
        description: values.description,
        tags: tagsArray,
        folder: values.folder || null,
        thumbnail_url: values.thumbnail_url || null,
        duration: values.duration || null,
        is_pinned: values.is_pinned,
        view_count: 0
      };
      if (editingVideo) {
        await updateLoomVideo(editingVideo.id, videoData);
        toast({
          title: "Success",
          description: "Video updated successfully"
        });
      } else {
        await createLoomVideo(videoData);
        toast({
          title: "Success",
          description: "Video added successfully"
        });
      }
      handleCloseDialog();
      loadVideos();
    } catch (error) {
      console.error("Error saving video:", error);
      toast({
        title: "Error",
        description: "Failed to save video",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique folders
  const folders = Array.from(new Set(videos.map(v => v.folder).filter(Boolean))) as string[];

  // Get all unique tags
  const allTags = Array.from(new Set(videos.flatMap(v => v.tags)));

  // Filter and sort videos
  let filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase()) || video.description.toLowerCase().includes(searchQuery.toLowerCase()) || video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = !selectedFolder || video.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });
  if (sortBy === "views") {
    filteredVideos = filteredVideos.sort((a, b) => b.view_count - a.view_count);
  } else {
    filteredVideos = filteredVideos.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
  }
  if (loading) {
    return <div className="p-8">Loading...</div>;
  }
  return <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Loom Library</h1>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Loom Video
          </Button>
        </div>
        <p className="text-muted-foreground">
          Central repository for Loom explainer videos, walkthroughs, and how-tos
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVideo ? "Edit Video" : "Add New Video"}</DialogTitle>
            <DialogDescription>
              {editingVideo ? "Update the video details below" : "Add a new Loom video to the library"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({
              field
            }) => <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Video title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="loom_url" render={({
              field
            }) => <FormItem>
                    <FormLabel>Loom URL</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="https://www.loom.com/share/..." {...field} />
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" onClick={handleFetchMetadata} disabled={isFetchingMetadata || !field.value} title="Fetch video details from Loom">
                        <RefreshCw className={`h-4 w-4 ${isFetchingMetadata ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="description" render={({
              field
            }) => <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the video" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="tags" render={({
              field
            }) => <FormItem>
                    <FormLabel>Tags (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="webflow, integration, how-to" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="folder" render={({
              field
            }) => <FormItem>
                    <FormLabel>Folder/Collection (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Webflow Integrations" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="thumbnail_url" render={({
              field
            }) => <FormItem>
                    <FormLabel>Thumbnail URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="duration" render={({
              field
            }) => <FormItem>
                    <FormLabel>Duration (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="5:30" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="is_pinned" render={({
              field
            }) => <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Pin this video to the top</FormLabel>
                    <FormMessage />
                  </FormItem>} />
              <DialogFooter className="flex justify-between items-center">
                <div>
                  {editingVideo && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : editingVideo ? "Update Video" : "Add Video"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search videos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as "recent" | "views")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="views">Most Viewed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}>
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {folders.length > 0 && <div className="mb-6 flex gap-2 flex-wrap">
          <Button variant={!selectedFolder ? "default" : "outline"} size="sm" onClick={() => setSelectedFolder(null)}>
            All Videos
          </Button>
          {folders.map(folder => <Button key={folder} variant={selectedFolder === folder ? "default" : "outline"} size="sm" onClick={() => setSelectedFolder(folder)}>
              {folder}
            </Button>)}
        </div>}

      {filteredVideos.length === 0 ? <div className="text-center py-12 text-muted-foreground">
          No videos found. Add your first Loom video to get started.
        </div> : viewMode === "grid" ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map(video => <Card key={video.id} className="flex flex-col hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer" onClick={() => window.open(video.loom_url, "_blank")}>
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {video.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                    {video.title}
                  </CardTitle>
                </div>
                <CardDescription className="line-clamp-2">{video.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {video.thumbnail_url ? <div className="relative mb-3 aspect-video rounded-md overflow-hidden bg-muted">
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div> : <div className="relative mb-3 aspect-video rounded-md bg-muted flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>}
                <div className="flex flex-wrap gap-1 mb-2">
                  {video.tags.map(tag => <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>)}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {video.duration && <span>{video.duration}</span>}
                  <span>{video.view_count} views</span>
                </div>
                {video.folder && <div className="mt-2 text-sm text-muted-foreground">
                    📁 {video.folder}
                  </div>}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1" onClick={e => {
            e.stopPropagation();
            window.open(video.loom_url, "_blank");
          }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Video
                </Button>
                <Button variant="outline" size="sm" onClick={e => {
            e.stopPropagation();
            handleEdit(video);
          }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>)}
        </div> : <div className="space-y-4">
          {filteredVideos.map(video => <Card key={video.id} className="hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={() => window.open(video.loom_url, "_blank")}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2 my-0 mx-0">
                    <CardTitle className="flex items-center gap-2">
                      {video.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                      {video.title}
                    </CardTitle>
                    <CardDescription>{video.description}</CardDescription>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="default" size="sm" onClick={e => {
                e.stopPropagation();
                window.open(video.loom_url, "_blank");
              }}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Video
                    </Button>
                    <Button variant="outline" size="sm" onClick={e => {
                e.stopPropagation();
                handleEdit(video);
              }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-2">
                  {video.tags.map(tag => <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>)}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {video.duration && <span>{video.duration}</span>}
                  <span>{video.view_count} views</span>
                  {video.folder && <span>📁 {video.folder}</span>}
                </div>
              </CardContent>
            </Card>)}
        </div>}
    </div>;
}