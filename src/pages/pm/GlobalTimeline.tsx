import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTasks, fetchProjects } from "@/lib/pm/api";
import type { PmTask, PmProject } from "@/types/pm";
import { GanttChart } from "@/components/pm/GanttChart";
import { TaskDrawer, useTaskDrawerLink } from "@/components/pm/TaskDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function GlobalTimeline() {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const drawer = useTaskDrawerLink();

  useEffect(() => { fetchTasks().then(setTasks); fetchProjects().then(setProjects); }, []);
  const visible = filter === "all" ? tasks : tasks.filter(t => t.project_id === filter);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-unbounded">Global Timeline</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="all">All projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        <GanttChart tasks={visible} deps={[]} onTaskClick={drawer.open} />
      </CardContent></Card>
      <TaskDrawer />
    </div>
  );
}
