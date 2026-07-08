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
import Work from "./pages/pm/Work";
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
import Snippets from "./pages/pm/Snippets";
import Help from "./pages/pm/Help";
import Timesheet from "./pages/pm/Timesheet";
import NotificationsSettings from "./pages/pm/NotificationsSettings";
import { ActiveTimerProvider } from "@/components/pm/timer/ActiveTimerProvider";
import { FloatingTimerTray } from "@/components/pm/timer/FloatingTimerTray";
import { PreviewProvider } from "@/components/pm/attachments/PreviewProvider";

const queryClient = new QueryClient();

import { RoleRouteGuard } from "@/components/pm/SubmitterRouteGuard";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto">
            <RoleRouteGuard>{children}</RoleRouteGuard>
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
            <ActiveTimerProvider>
              <PreviewProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/f/:slug" element={<PublicForm />} />

                <Route path="/" element={<Navigate to="/pm" replace />} />

                <Route path="/pm" element={<AppLayout><WorkQueue /></AppLayout>} />
                <Route path="/pm/work" element={<AppLayout><Work /></AppLayout>} />
                <Route path="/pm/board" element={<Navigate to="/pm/work" replace />} />
                <Route path="/pm/projects" element={<Navigate to="/pm/work" replace />} />
                <Route path="/pm/projects/:id" element={<AppLayout><ProjectDetail /></AppLayout>} />
                <Route path="/pm/tasks/:id" element={<AppLayout><TaskWorkspace /></AppLayout>} />
                <Route path="/pm/workload" element={<AppLayout><Workload /></AppLayout>} />
                <Route path="/pm/timeline" element={<AppLayout><GlobalTimeline /></AppLayout>} />
                <Route path="/pm/forms" element={<AppLayout><Forms /></AppLayout>} />
                <Route path="/pm/forms/:id/edit" element={<AppLayout><FormBuilder /></AppLayout>} />
                <Route path="/pm/templates" element={<AppLayout><Templates /></AppLayout>} />
                <Route path="/pm/templates/:id/edit" element={<AppLayout><TemplateBuilder /></AppLayout>} />
                <Route path="/pm/integrations" element={<AppLayout><Integrations /></AppLayout>} />
                <Route path="/snippets" element={<AppLayout><Snippets /></AppLayout>} />
                <Route path="/pm/help" element={<AppLayout><Help /></AppLayout>} />
                <Route path="/pm/time" element={<AppLayout><Timesheet /></AppLayout>} />
                <Route path="/pm/settings/notifications" element={<AppLayout><NotificationsSettings /></AppLayout>} />

                {/* Legacy roadmap */}
                <Route path="/roadmap" element={<AppLayout><ProductRoadmap /></AppLayout>} />
                <Route path="/roadmap/dashboard" element={<AppLayout><RoadmapDashboard /></AppLayout>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              <FloatingTimerTray />
              </PreviewProvider>
            </ActiveTimerProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
