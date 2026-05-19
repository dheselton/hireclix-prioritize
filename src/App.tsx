import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

// Roadmap (legacy)
import ProductRoadmap from "./pages/ProductRoadmap";
import RoadmapDashboard from "./pages/RoadmapDashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// PM
import WorkQueue from "./pages/pm/WorkQueue";
import Board from "./pages/pm/Board";
import ProjectList from "./pages/pm/ProjectList";
import ProjectDetail from "./pages/pm/ProjectDetail";
import Workload from "./pages/pm/Workload";
import GlobalTimeline from "./pages/pm/GlobalTimeline";
import Forms from "./pages/pm/Forms";
import FormBuilder from "./pages/pm/FormBuilder";
import PublicForm from "./pages/pm/PublicForm";
import Templates from "./pages/pm/Templates";
import TemplateBuilder from "./pages/pm/TemplateBuilder";
import Integrations from "./pages/pm/Integrations";
import TaskWorkspace from "./pages/pm/TaskWorkspace";
import { ActiveTimerProvider } from "@/components/pm/timer/ActiveTimerProvider";
import { FloatingTimerTray } from "@/components/pm/timer/FloatingTimerTray";

const queryClient = new QueryClient();

import { SubmitterRouteGuard } from "@/components/pm/SubmitterRouteGuard";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto">
            <SubmitterRouteGuard>{children}</SubmitterRouteGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/f/:slug" element={<PublicForm />} />

              <Route path="/" element={<Navigate to="/pm" replace />} />

              <Route path="/pm" element={<AppLayout><WorkQueue /></AppLayout>} />
              <Route path="/pm/board" element={<AppLayout><Board /></AppLayout>} />
              <Route path="/pm/projects" element={<AppLayout><ProjectList /></AppLayout>} />
              <Route path="/pm/projects/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
              <Route path="/pm/workload" element={<AppLayout><Workload /></AppLayout>} />
              <Route path="/pm/timeline" element={<AppLayout><GlobalTimeline /></AppLayout>} />
              <Route path="/pm/forms" element={<AppLayout><Forms /></AppLayout>} />
              <Route path="/pm/forms/:id/edit" element={<AppLayout><FormBuilder /></AppLayout>} />
              <Route path="/pm/templates" element={<AppLayout><Templates /></AppLayout>} />
              <Route path="/pm/templates/:id/edit" element={<AppLayout><TemplateBuilder /></AppLayout>} />
              <Route path="/pm/integrations" element={<AppLayout><Integrations /></AppLayout>} />

              {/* Legacy roadmap */}
              <Route path="/roadmap" element={<AppLayout><ProductRoadmap /></AppLayout>} />
              <Route path="/roadmap/dashboard" element={<AppLayout><RoadmapDashboard /></AppLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
