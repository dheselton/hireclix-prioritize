import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import InternalDocs from "./pages/InternalDocs";
import ClientDocs from "./pages/ClientDocs";
import LoomLibrary from "./pages/LoomLibrary";
import Integrations from "./pages/Integrations";
import DesignSystem from "./pages/DesignSystem";
import FAQ from "./pages/FAQ";
import Admin from "./pages/Admin";
import JobApiMonitor from "./pages/JobApiMonitor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col">
                <TopBar />
                <main className="flex-1 overflow-auto">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/internal-docs" element={<InternalDocs />} />
                    <Route path="/client-docs" element={<ClientDocs />} />
                    <Route path="/loom-library" element={<LoomLibrary />} />
                    <Route path="/integrations" element={<Integrations />} />
                    <Route path="/design-system" element={<DesignSystem />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/job-api-monitor" element={<JobApiMonitor />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
