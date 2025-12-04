import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepeatableList } from "./RepeatableList";
import { AssigneePicker } from "../AssigneePicker";
import type { TechnicalData, DataModelChange, ApiIntegration, TechnicalRisk, ImplementationTask } from "@/types/featureDetail";

interface TechnicalTabProps {
  data: TechnicalData;
  onChange: (data: TechnicalData) => void;
}

const IMPLEMENTATION_TYPES = ['Pure Webflow', 'Webflow + Custom JS', 'Webflow Logic', 'External API', 'Backend Service', 'Third-Party Integration', 'Automation (Zapier/Make/etc)'];
const SYSTEM_TAGS = ['Webflow CMS', 'Webflow Forms', 'HubSpot', 'Greenhouse', 'ATS (Other)', 'AWS', 'Internal DB', 'Analytics', 'Auth'];
const DATA_CHANGE_TYPES = ['New Collection', 'New Field', 'Field Change', 'No Data Change'] as const;
const AUTH_METHODS = ['API Key', 'OAuth', 'Webhook', 'Other'] as const;
const DIRECTIONS = ['Read', 'Write', 'Both'] as const;
const IMPACT_LEVELS = ['Low', 'Medium', 'High'] as const;
const TASK_STATUSES = ['Not Started', 'In Progress', 'Done'] as const;
const DEFAULT_STATES = ['On', 'Off', 'Client Specific'] as const;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function TechnicalTab({ data, onChange }: TechnicalTabProps) {
  const toggleImplementationType = (type: string) => {
    if (data.implementationType.includes(type)) {
      onChange({ ...data, implementationType: data.implementationType.filter(t => t !== type) });
    } else {
      onChange({ ...data, implementationType: [...data.implementationType, type] });
    }
  };

  const toggleSystemTag = (tag: string) => {
    const existing = data.systemsTouched.find(s => s.tag === tag);
    if (existing) {
      onChange({ ...data, systemsTouched: data.systemsTouched.filter(s => s.tag !== tag) });
    } else {
      onChange({ ...data, systemsTouched: [...data.systemsTouched, { tag, notes: '' }] });
    }
  };

  const updateSystemNotes = (tag: string, notes: string) => {
    const updated = data.systemsTouched.map(s => s.tag === tag ? { ...s, notes } : s);
    onChange({ ...data, systemsTouched: updated });
  };

  const addDataModelChange = () => {
    const newChange: DataModelChange = {
      id: generateId(),
      entity: '',
      type: 'New Field',
      details: '',
      migrationNeeded: false
    };
    onChange({ ...data, dataModelChanges: [...data.dataModelChanges, newChange] });
  };

  const updateDataModelChange = (index: number, change: DataModelChange) => {
    const updated = [...data.dataModelChanges];
    updated[index] = change;
    onChange({ ...data, dataModelChanges: updated });
  };

  const removeDataModelChange = (index: number) => {
    onChange({ ...data, dataModelChanges: data.dataModelChanges.filter((_, i) => i !== index) });
  };

  const addApiIntegration = () => {
    const newApi: ApiIntegration = {
      id: generateId(),
      integration: '',
      endpoint: '',
      authMethod: 'API Key',
      direction: 'Read',
      notes: ''
    };
    onChange({ ...data, apiIntegrations: [...data.apiIntegrations, newApi] });
  };

  const updateApiIntegration = (index: number, api: ApiIntegration) => {
    const updated = [...data.apiIntegrations];
    updated[index] = api;
    onChange({ ...data, apiIntegrations: updated });
  };

  const removeApiIntegration = (index: number) => {
    onChange({ ...data, apiIntegrations: data.apiIntegrations.filter((_, i) => i !== index) });
  };

  const addRisk = () => {
    const newRisk: TechnicalRisk = {
      id: generateId(),
      risk: '',
      impact: 'Medium',
      likelihood: 'Medium',
      mitigationPlan: ''
    };
    onChange({ ...data, technicalRisks: [...data.technicalRisks, newRisk] });
  };

  const updateRisk = (index: number, risk: TechnicalRisk) => {
    const updated = [...data.technicalRisks];
    updated[index] = risk;
    onChange({ ...data, technicalRisks: updated });
  };

  const removeRisk = (index: number) => {
    onChange({ ...data, technicalRisks: data.technicalRisks.filter((_, i) => i !== index) });
  };

  const addTask = () => {
    const newTask: ImplementationTask = {
      id: generateId(),
      taskName: '',
      owner: '',
      status: 'Not Started',
      externalTicketLink: ''
    };
    onChange({ ...data, implementationTasks: [...data.implementationTasks, newTask] });
  };

  const updateTask = (index: number, task: ImplementationTask) => {
    const updated = [...data.implementationTasks];
    updated[index] = task;
    onChange({ ...data, implementationTasks: updated });
  };

  const removeTask = (index: number) => {
    onChange({ ...data, implementationTasks: data.implementationTasks.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* Technical Owner */}
      <div>
        <Label>Technical Owner <span className="text-destructive">*</span></Label>
        <AssigneePicker
          value={data.technicalOwner ? [data.technicalOwner] : []}
          onChange={(assignees) => onChange({ ...data, technicalOwner: assignees[0] || '' })}
        />
      </div>

      {/* Implementation Type */}
      <div>
        <Label>Implementation Type</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {IMPLEMENTATION_TYPES.map(type => (
            <Badge
              key={type}
              variant={data.implementationType.includes(type) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleImplementationType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {/* Systems & Services Touched */}
      <div>
        <Label>Systems & Services Touched</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SYSTEM_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={data.systemsTouched.find(s => s.tag === tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleSystemTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
        {data.systemsTouched.length > 0 && (
          <div className="mt-3 space-y-2">
            {data.systemsTouched.map(sys => (
              <div key={sys.tag} className="flex items-center gap-2">
                <Badge variant="secondary" className="w-28 justify-center text-xs">{sys.tag}</Badge>
                <Input
                  value={sys.notes}
                  onChange={(e) => updateSystemNotes(sys.tag, e.target.value)}
                  placeholder={`Notes for ${sys.tag}`}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Model Changes */}
      <div>
        <Label>Data Model Changes</Label>
        <RepeatableList
          items={data.dataModelChanges}
          onAdd={addDataModelChange}
          onRemove={removeDataModelChange}
          addLabel="Add Data Change"
          emptyMessage="No data model changes."
          renderItem={(change, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Input
                  value={change.entity}
                  onChange={(e) => updateDataModelChange(index, { ...change, entity: e.target.value })}
                  placeholder="Entity (e.g., Job Posting Collection)"
                  className="flex-1"
                />
                <Select
                  value={change.type}
                  onValueChange={(v) => updateDataModelChange(index, { ...change, type: v as typeof DATA_CHANGE_TYPES[number] })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_CHANGE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={change.details}
                  onChange={(e) => updateDataModelChange(index, { ...change, details: e.target.value })}
                  placeholder="Details"
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={change.migrationNeeded}
                    onCheckedChange={(checked) => updateDataModelChange(index, { ...change, migrationNeeded: checked })}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Migration Needed</span>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      {/* APIs & Integrations */}
      <div>
        <Label>APIs & Integrations</Label>
        <RepeatableList
          items={data.apiIntegrations}
          onAdd={addApiIntegration}
          onRemove={removeApiIntegration}
          addLabel="Add Integration"
          emptyMessage="No API integrations."
          renderItem={(api, index) => (
            <div className="space-y-2 pr-8">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={api.integration}
                  onChange={(e) => updateApiIntegration(index, { ...api, integration: e.target.value })}
                  placeholder="Integration / API"
                />
                <Input
                  value={api.endpoint}
                  onChange={(e) => updateApiIntegration(index, { ...api, endpoint: e.target.value })}
                  placeholder="Endpoint / Resource"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={api.authMethod}
                  onValueChange={(v) => updateApiIntegration(index, { ...api, authMethod: v as typeof AUTH_METHODS[number] })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={api.direction}
                  onValueChange={(v) => updateApiIntegration(index, { ...api, direction: v as typeof DIRECTIONS[number] })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={api.notes}
                  onChange={(e) => updateApiIntegration(index, { ...api, notes: e.target.value })}
                  placeholder="Notes"
                  className="flex-1"
                />
              </div>
            </div>
          )}
        />
      </div>

      {/* Feature Flags & Config */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Feature Flags & Config</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Feature Flag Name</Label>
            <Input
              value={data.featureFlagName}
              onChange={(e) => onChange({ ...data, featureFlagName: e.target.value })}
              placeholder="e.g., enable_new_jobs_page"
            />
          </div>
          <div>
            <Label>Default State</Label>
            <Select
              value={data.defaultState}
              onValueChange={(v) => onChange({ ...data, defaultState: v as typeof DEFAULT_STATES[number] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_STATES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Config Options</Label>
          <SmartTextarea
            value={data.configOptions}
            onChange={(e) => onChange({ ...data, configOptions: e.target.value })}
            rows={2}
            placeholder="key: value (one per line)"
          />
        </div>
      </div>

      {/* Performance & Security Notes */}
      <div>
        <Label>Performance / Caching Notes</Label>
        <SmartTextarea
          value={data.performanceNotes}
          onChange={(e) => onChange({ ...data, performanceNotes: e.target.value })}
          rows={2}
          placeholder="Caching strategy, performance considerations..."
        />
      </div>

      <div>
        <Label>Security & Compliance Notes</Label>
        <SmartTextarea
          value={data.securityNotes}
          onChange={(e) => onChange({ ...data, securityNotes: e.target.value })}
          rows={2}
          placeholder="PII handling, data residency, roles/permissions, audit needs"
        />
        <p className="text-xs text-muted-foreground mt-1">PII handling, data residency, roles/permissions, audit needs.</p>
      </div>

      {/* Technical Risks */}
      <div>
        <Label>Technical Risks & Mitigations</Label>
        <RepeatableList
          items={data.technicalRisks}
          onAdd={addRisk}
          onRemove={removeRisk}
          addLabel="Add Risk"
          emptyMessage="No technical risks identified."
          renderItem={(risk, index) => (
            <div className="space-y-2 pr-8">
              <Input
                value={risk.risk}
                onChange={(e) => updateRisk(index, { ...risk, risk: e.target.value })}
                placeholder="Risk description"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Impact</Label>
                  <Select
                    value={risk.impact}
                    onValueChange={(v) => updateRisk(index, { ...risk, impact: v as typeof IMPACT_LEVELS[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Likelihood</Label>
                  <Select
                    value={risk.likelihood}
                    onValueChange={(v) => updateRisk(index, { ...risk, likelihood: v as typeof IMPACT_LEVELS[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                value={risk.mitigationPlan}
                onChange={(e) => updateRisk(index, { ...risk, mitigationPlan: e.target.value })}
                placeholder="Mitigation plan"
              />
            </div>
          )}
        />
      </div>

      {/* Implementation Tasks */}
      <div>
        <Label>Implementation Tasks (High-Level)</Label>
        <RepeatableList
          items={data.implementationTasks}
          onAdd={addTask}
          onRemove={removeTask}
          addLabel="Add Task"
          emptyMessage="No implementation tasks."
          renderItem={(task, index) => (
            <div className="space-y-2 pr-8">
              <Input
                value={task.taskName}
                onChange={(e) => updateTask(index, { ...task, taskName: e.target.value })}
                placeholder="Task name"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <AssigneePicker
                    value={task.owner ? [task.owner] : []}
                    onChange={(assignees) => updateTask(index, { ...task, owner: assignees[0] || '' })}
                  />
                </div>
                <Select
                  value={task.status}
                  onValueChange={(v) => updateTask(index, { ...task, status: v as typeof TASK_STATUSES[number] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="url"
                value={task.externalTicketLink}
                onChange={(e) => updateTask(index, { ...task, externalTicketLink: e.target.value })}
                placeholder="External ticket link (optional)"
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
