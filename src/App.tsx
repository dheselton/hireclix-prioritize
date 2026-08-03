import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { RouteFallback } from "@/components/RouteFallback";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";

// Eager: default landing + auth entry (small, always needed early)
import WorkQueue from "./pages/pm/WorkQueue";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy: everything else — keeps initial bundle small
const Inbox = lazy(() => import("./pages/pm/Inbox"));
const Work = lazy(() => import("./pages/pm/Work"));
const ProjectDetail = lazy(() => import("./pages/pm/ProjectDetail"));
const Workload = lazy(() => import("./pages/pm/Workload"));
const GlobalTimeline = lazy(() => import("./pages/pm/GlobalTimeline"));
const Forms = lazy(() => import("./pages/pm/Forms"));
const FormBuilder = lazy(() => import("./pages/pm/FormBuilder"));
const PublicForm = lazy(() => import("./pages/pm/PublicForm"));
const Templates = lazy(() => import("./pages/pm/Templates"));
const TemplateBuilder = lazy(() => import("./pages/pm/TemplateBuilder"));
const Integrations = lazy(() => import("./pages/pm/Integrations"));
const TaskWorkspace = lazy(() => import("./pages/pm/TaskWorkspace"));
const Snippets = lazy(() => import("./pages/pm/Snippets"));
const Help = lazy(() => import("./pages/pm/Help"));
const Timesheet = lazy(() => import("./pages/pm/Timesheet"));
const NotificationsSettings = lazy(() => import("./pages/pm/NotificationsSettings"));
const ProductRoadmap = lazy(() => import("./pages/ProductRoadmap"));
const RoadmapDashboard = lazy(() => import("./pages/RoadmapDashboard"));

import { ActiveTimerProvider } from "@/components/pm/timer/ActiveTimerProvider";
import { FloatingTimerTray } from "@/components/pm/timer/FloatingTimerTray";
import { PreviewProvider } from "@/components/pm/attachments/PreviewProvider";

import { RoleRouteGuard } from "@/components/pm/SubmitterRouteGuard";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-dvh flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 min-w-0">
            <RoleRouteGuard>
              <Suspense fallback={<RouteFallback />}>{children}</Suspense>
            </RoleRouteGuard>
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
                <Route path="/f/:slug" element={<Suspense fallback={<RouteFallback />}><PublicForm /></Suspense>} />
                <Route path="/request" element={<Navigate to="/f/quick-request" replace />} />
                <Route path="/pm/request" element={<Navigate to="/f/quick-request" replace />} />

                <Route path="/" element={<Navigate to="/pm" replace />} />


                <Route path="/pm" element={<AppLayout><WorkQueue /></AppLayout>} />
                <Route path="/pm/inbox" element={<AppLayout><Inbox /></AppLayout>} />
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
