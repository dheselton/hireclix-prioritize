import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, RefreshCw, Upload, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { syncFromClickUp } from "@/lib/dataService";

export default function Admin() {
  const [clickUpUrl, setClickUpUrl] = useState("https://api.clickup.com/api/v2");
  const [clickUpToken, setClickUpToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async (type: string) => {
    setSyncing(true);
    try {
      await syncFromClickUp({ baseUrl: clickUpUrl, token: clickUpToken });
      toast({
        title: "Sync Complete",
        description: `${type} synced successfully (stub)`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Admin</h1>
        <p className="text-muted-foreground">System configuration and data management</p>
      </div>

      {/* ClickUp Configuration */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-accent" />
          <h2 className="text-2xl">ClickUp Integration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="clickup-url">API Base URL</Label>
            <Input
              id="clickup-url"
              value={clickUpUrl}
              onChange={(e) => setClickUpUrl(e.target.value)}
              placeholder="https://api.clickup.com/api/v2"
            />
          </div>
          <div>
            <Label htmlFor="clickup-token">API Token</Label>
            <Input
              id="clickup-token"
              type="password"
              value={clickUpToken}
              onChange={(e) => setClickUpToken(e.target.value)}
              placeholder="Enter ClickUp API token"
            />
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto hover:border-accent hover:text-accent"
          >
            Save Configuration
          </Button>
        </div>
      </Card>

      {/* Data Sync */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-5 w-5 text-accent" />
          <h2 className="text-2xl">Data Synchronization</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Sync data from external sources. Note: These are stub functions for demonstration.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={() => handleSync("Customers")}
            disabled={syncing}
            variant="outline"
            className="hover:border-accent hover:text-accent"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync Customers
          </Button>
          <Button
            onClick={() => handleSync("Docs")}
            disabled={syncing}
            variant="outline"
            className="hover:border-accent hover:text-accent"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync Docs
          </Button>
          <Button
            onClick={() => handleSync("Integrations")}
            disabled={syncing}
            variant="outline"
            className="hover:border-accent hover:text-accent"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync Integrations
          </Button>
        </div>
      </Card>

      {/* Data Import */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-accent" />
          <h2 className="text-2xl">Data Import</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Import data from CSV files with field mapping (stub functionality)
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Input type="file" accept=".csv" className="flex-1" />
            <Button variant="outline" className="hover:border-accent hover:text-accent">
              Import Customers
            </Button>
          </div>
          <div className="flex gap-3">
            <Input type="file" accept=".csv" className="flex-1" />
            <Button variant="outline" className="hover:border-accent hover:text-accent">
              Import Docs
            </Button>
          </div>
        </div>
      </Card>

      {/* User Roles */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-accent" />
          <h2 className="text-2xl">User Roles</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Role-based access control (UI only for now, authentication deferred)
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium">Admin</p>
              <p className="text-sm text-muted-foreground">Full system access</p>
            </div>
            <Badge variant="default" className="bg-primary">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium">Editor</p>
              <p className="text-sm text-muted-foreground">Create and edit content</p>
            </div>
            <Badge variant="secondary">Available</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium">Viewer</p>
              <p className="text-sm text-muted-foreground">Read-only access</p>
            </div>
            <Badge variant="secondary">Available</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
