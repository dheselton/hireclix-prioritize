import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RepeatableList } from "./RepeatableList";
import { AssigneePicker } from "../AssigneePicker";
import { Github, Plus, ChevronDown, ChevronRight, Clock, Trash2, Copy } from "lucide-react";
import type { TechnicalData, DataModelChange, ApiIntegration, TechnicalRisk, ImplementationTask, CodeSnippet, CodeSnippetVersion } from "@/types/featureDetail";

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

      {/* GitHub Repository */}
      <div className="space-y-2 p-4 border border-border rounded-lg bg-card/50">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <Label>GitHub Repository</Label>
        </div>
        <SmartTextarea
          value={data.githubRepoUrl || ''}
          onChange={(e) => onChange({ ...data, githubRepoUrl: e.target.value })}
          rows={1}
          placeholder="https://github.com/org/repo"
          className="min-h-[40px]"
        />
      </div>

      {/* Code Snippets Manager */}
      <CodeSnippetsManager
        snippets={data.codeSnippets || []}
        onChange={(codeSnippets) => onChange({ ...data, codeSnippets })}
      />
    </div>
  );
}

const LANGUAGES = ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'Python', 'SQL', 'JSON', 'YAML', 'Bash', 'Ruby', 'Go', 'Rust', 'PHP', 'Java', 'C#', 'Other'];

function CodeSnippetsManager({ snippets, onChange }: { snippets: CodeSnippet[]; onChange: (s: CodeSnippet[]) => void }) {
  const addSnippet = () => {
    const newVersion: CodeSnippetVersion = {
      id: generateId(),
      versionLabel: 'v1.0',
      code: '',
      language: 'TypeScript',
      notes: '',
      createdAt: new Date().toISOString(),
    };
    const newSnippet: CodeSnippet = {
      id: generateId(),
      title: '',
      language: 'TypeScript',
      versions: [newVersion],
    };
    onChange([...snippets, newSnippet]);
  };

  const removeSnippet = (index: number) => {
    onChange(snippets.filter((_, i) => i !== index));
  };

  const updateSnippet = (index: number, updated: CodeSnippet) => {
    const copy = [...snippets];
    copy[index] = updated;
    onChange(copy);
  };

  return (
    <div>
      <Label>Code Snippets</Label>
      <div className="space-y-4 mt-2">
        {snippets.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No code snippets added yet.</p>
        )}
        {snippets.map((snippet, index) => (
          <SnippetCard
            key={snippet.id}
            snippet={snippet}
            onUpdate={(s) => updateSnippet(index, s)}
            onRemove={() => removeSnippet(index)}
          />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addSnippet}>
          <Plus className="h-3 w-3 mr-1" />
          Add Snippet
        </Button>
      </div>
    </div>
  );
}

function SnippetCard({ snippet, onUpdate, onRemove }: { snippet: CodeSnippet; onUpdate: (s: CodeSnippet) => void; onRemove: () => void }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addingVersion, setAddingVersion] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newVersionCode, setNewVersionCode] = useState('');
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [editingLatest, setEditingLatest] = useState(false);

  const latestVersion = snippet.versions[snippet.versions.length - 1];
  const olderVersions = snippet.versions.slice(0, -1).reverse();

  const handleAddVersion = () => {
    if (!newVersionCode.trim()) return;
    const ver: CodeSnippetVersion = {
      id: generateId(),
      versionLabel: newVersionLabel || `v${snippet.versions.length + 1}.0`,
      code: newVersionCode,
      language: snippet.language,
      notes: newVersionNotes,
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...snippet, versions: [...snippet.versions, ver] });
    setAddingVersion(false);
    setNewVersionLabel('');
    setNewVersionCode('');
    setNewVersionNotes('');
  };

  const updateLatestCode = (code: string) => {
    const updatedVersions = [...snippet.versions];
    updatedVersions[updatedVersions.length - 1] = { ...latestVersion, code };
    onUpdate({ ...snippet, versions: updatedVersions });
  };

  const updateLatestNotes = (notes: string) => {
    const updatedVersions = [...snippet.versions];
    updatedVersions[updatedVersions.length - 1] = { ...latestVersion, notes };
    onUpdate({ ...snippet, versions: updatedVersions });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="border border-border rounded-lg bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center gap-2">
        <Input
          value={snippet.title}
          onChange={(e) => onUpdate({ ...snippet, title: e.target.value })}
          placeholder="Snippet title"
          className="flex-1 font-medium"
        />
        <Select
          value={snippet.language}
          onValueChange={(v) => onUpdate({ ...snippet, language: v })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Latest Version */}
      {latestVersion && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{latestVersion.versionLabel}</Badge>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(latestVersion.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyCode(latestVersion.code)}>
                <Copy className="h-3 w-3 mr-1" />Copy
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingLatest(!editingLatest)}>
                {editingLatest ? 'Preview' : 'Edit'}
              </Button>
            </div>
          </div>
          {editingLatest ? (
            <div className="space-y-2">
              <textarea
                value={latestVersion.code}
                onChange={(e) => updateLatestCode(e.target.value)}
                className="w-full min-h-[120px] rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Paste code here..."
              />
              <Input
                value={latestVersion.notes}
                onChange={(e) => updateLatestNotes(e.target.value)}
                placeholder="Version notes (optional)"
                className="text-xs"
              />
            </div>
          ) : (
            <pre className="bg-muted/50 border border-input rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              <code>{latestVersion.code || '// No code yet'}</code>
            </pre>
          )}
          {latestVersion.notes && !editingLatest && (
            <p className="text-xs text-muted-foreground mt-1 italic">{latestVersion.notes}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pb-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setAddingVersion(!addingVersion)}>
          <Plus className="h-3 w-3 mr-1" />New Version
        </Button>
        {olderVersions.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-xs">
                {historyOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                History ({olderVersions.length})
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {/* Add Version Form */}
      {addingVersion && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Input
              value={newVersionLabel}
              onChange={(e) => setNewVersionLabel(e.target.value)}
              placeholder={`v${snippet.versions.length + 1}.0`}
              className="w-28 text-xs"
            />
            <Input
              value={newVersionNotes}
              onChange={(e) => setNewVersionNotes(e.target.value)}
              placeholder="What changed?"
              className="flex-1 text-xs"
            />
          </div>
          <textarea
            value={newVersionCode}
            onChange={(e) => setNewVersionCode(e.target.value)}
            className="w-full min-h-[100px] rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Paste new version code..."
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAddVersion}>Save Version</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingVersion(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Version History */}
      {historyOpen && olderVersions.length > 0 && (
        <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
          {olderVersions.map(ver => (
            <div key={ver.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ver.versionLabel}</Badge>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ver.createdAt).toLocaleDateString()}</span>
                <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] ml-auto" onClick={() => copyCode(ver.code)}>
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
              </div>
              {ver.notes && <p className="text-xs text-muted-foreground italic">{ver.notes}</p>}
              <pre className="bg-muted/50 border border-input rounded-md p-2 text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                <code>{ver.code}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
