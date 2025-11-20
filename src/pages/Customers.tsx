import { useEffect, useState } from "react";
import { Customer, CustomerType, CustomerStatus } from "@/types";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/dataService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Filter, ExternalLink, Plus } from "lucide-react";
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

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | CustomerType>("all");
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.ats.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || customer.type === filterType;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-3xl mb-2">Customers</h1>
          <p className="text-muted-foreground">Manage Career Site customers and JobFlow SEO clients</p>
        </div>
        <Button className="bg-success text-white hover:bg-success/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card className="glass-card p-6">
        <Tabs defaultValue="all" onValueChange={(value) => setFilterType(value as any)}>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all">All ({customers.length})</TabsTrigger>
              <TabsTrigger value="Career Site">
                Career Sites ({customers.filter(c => c.type === "Career Site").length})
              </TabsTrigger>
              <TabsTrigger value="JobFlow SEO">
                JobFlow SEO ({customers.filter(c => c.type === "JobFlow SEO").length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <CustomerTable customers={filteredCustomers} />
          </TabsContent>
          <TabsContent value="Career Site" className="mt-0">
            <CustomerTable customers={filteredCustomers} />
          </TabsContent>
          <TabsContent value="JobFlow SEO" className="mt-0">
            <CustomerTable customers={filteredCustomers} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function CustomerTable({ customers }: { customers: Customer[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>ATS</TableHead>
            <TableHead>Go-Live Date</TableHead>
            <TableHead>Live Sites</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No customers found
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.id} className="row cursor-pointer">
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="badge-muted">{customer.type}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={customer.status} />
                </TableCell>
                <TableCell>{customer.ats}</TableCell>
                <TableCell>
                  {customer.go_live_date ? new Date(customer.go_live_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="badge-primary">{customer.live_sites}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{customer.owner || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {customer.site_url && (
                      <a href={customer.site_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 focusable">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    {customer.dashboard_url && (
                      <a href={customer.dashboard_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 focusable">
                          <ExternalLink className="h-4 w-4 text-success" />
                        </Button>
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
