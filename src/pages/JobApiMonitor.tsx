import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { JobApiLog, JobApiStats } from "@/types";
import { Activity, AlertCircle, ArrowUpDown, CheckCircle2, Clock, RefreshCw, Trash2, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function JobApiMonitor() {
  const [logs, setLogs] = useState<JobApiLog[]>([]);
  const [stats, setStats] = useState<JobApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<JobApiLog | null>(null);
  const [testingIngest, setTestingIngest] = useState(false);
  const [sortField, setSortField] = useState<keyof JobApiLog>("push_timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('job-api-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_api_logs'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch logs
      const { data: logsData, error: logsError } = await supabase
        .from('job_api_logs')
        .select('*')
        .order('push_timestamp', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setLogs((logsData || []) as JobApiLog[]);

      // Fetch stats using RPC
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_job_api_stats');

      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('sync-job-api-data');
      
      if (error) throw error;
      
      console.log('Sync response:', data);
      
      // Reload data after sync
      await loadData();
    } catch (error) {
      console.error('Error during manual sync:', error);
    }
  };

  const handleTestIngest = async () => {
    try {
      setTestingIngest(true);
      
      // Call the test-ingest edge function which securely handles the API key
      const { data, error } = await supabase.functions.invoke('test-ingest');
      
      if (error) throw error;
      
      toast({
        title: "Test Successful",
        description: "Sample data successfully pushed to ingest endpoint",
      });

      console.log('Test ingest response:', data);
      
      // Reload data to show the new test entry
      await loadData();
    } catch (error) {
      console.error('Error testing ingest:', error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to push test data",
      });
    } finally {
      setTestingIngest(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this log entry?")) return;

    try {
      const { error } = await supabase
        .from('job_api_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: String(error.message || error.details || "Failed to delete log entry"),
        });
        return;
      }

      toast({
        title: "Success",
        description: "Log entry deleted successfully",
      });

      await loadData();
    } catch (error) {
      console.error('Error deleting log:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: errorMessage || "An unexpected error occurred",
      });
    }
  };

  const handleSort = (field: keyof JobApiLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.push_id.toString().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || log.push_status === statusFilter;
    const matchesRecordType = recordTypeFilter === "all" || log.record_type === recordTypeFilter;
    return matchesSearch && matchesStatus && matchesRecordType;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case "FAILED":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "PARTIAL":
        return <Badge variant="secondary"><Activity className="w-3 h-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job API Monitor</h1>
          <p className="text-muted-foreground">Monitor job API pushes, failures, and performance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleTestIngest} variant="secondary" disabled={testingIngest || loading}>
            <Zap className={`w-4 h-4 mr-2 ${testingIngest ? 'animate-pulse' : ''}`} />
            Test Ingest
          </Button>
          <Button onClick={handleManualSync} variant="default" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync from AWS
          </Button>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Pushes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_pushes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.successful_pushes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed_pushes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Jobs Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_jobs_processed.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.total_errors}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Exec Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.avg_execution_time)}s</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Input
            placeholder="Search by company or push ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={recordTypeFilter} onValueChange={setRecordTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Pushes</CardTitle>
          <CardDescription>Latest 100 job API push records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("company_name")} className="h-8 px-2">
                      Company <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("push_id")} className="h-8 px-2">
                      Push ID <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("push_status")} className="h-8 px-2">
                      Status <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("push_timestamp")} className="h-8 px-2">
                      Timestamp <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("total_jobs_processed")} className="h-8 px-2">
                      Jobs <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("jobs_created")} className="h-8 px-2">
                      Created <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("jobs_updated")} className="h-8 px-2">
                      Updated <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("jobs_deleted")} className="h-8 px-2">
                      Deleted <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("total_errors")} className="h-8 px-2">
                      Errors <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort("execution_time_seconds")} className="h-8 px-2">
                      Exec Time <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort("record_type")} className="h-8 px-2">
                      Type <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.company_name}</TableCell>
                      <TableCell>{log.push_id}</TableCell>
                      <TableCell>{getStatusBadge(log.push_status)}</TableCell>
                      <TableCell>{format(new Date(log.push_timestamp), 'MMM dd, yyyy HH:mm')}</TableCell>
                      <TableCell className="text-right">{log.total_jobs_processed}</TableCell>
                      <TableCell className="text-right">{log.jobs_created}</TableCell>
                      <TableCell className="text-right">{log.jobs_updated}</TableCell>
                      <TableCell className="text-right">{log.jobs_deleted}</TableCell>
                      <TableCell className="text-right">
                        {log.total_errors > 0 ? (
                          <span className="text-red-600 font-semibold">{log.total_errors}</span>
                        ) : (
                          log.total_errors
                        )}
                      </TableCell>
                      <TableCell className="text-right">{log.execution_time_seconds}s</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.record_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(log.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedLog && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Push Details - {selectedLog.company_name}</CardTitle>
              <Button variant="ghost" onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="errors">Errors</TabsTrigger>
                <TabsTrigger value="additional">Additional Info</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Push ID</p>
                    <p className="font-semibold">{selectedLog.push_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p>{getStatusBadge(selectedLog.push_status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jobs Processed</p>
                    <p className="font-semibold">{selectedLog.total_jobs_processed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Execution Time</p>
                    <p className="font-semibold">{selectedLog.execution_time_seconds}s</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-semibold">{selectedLog.jobs_created}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Updated</p>
                    <p className="font-semibold">{selectedLog.jobs_updated}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deleted</p>
                    <p className="font-semibold">{selectedLog.jobs_deleted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Errors</p>
                    <p className="font-semibold text-red-600">{selectedLog.total_errors}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="errors">
                {selectedLog.total_errors > 0 ? (
                  <div className="space-y-2">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {selectedLog.total_errors} error(s) detected
                      </AlertDescription>
                    </Alert>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      {JSON.stringify(selectedLog.push_error_details, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>No errors detected</AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="additional">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(selectedLog.push_additional_info, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
