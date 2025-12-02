import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepeatableList } from "./RepeatableList";
import { AssigneePicker } from "../AssigneePicker";
import type { RolloutData, ClientRollout, RolloutChecklistItem, TrainingAsset } from "@/types/featureDetail";
import { useState } from "react";

interface RolloutTabProps {
  data: RolloutData;
  onChange: (data: RolloutData) => void;
}

const ROLLOUT_STRATEGIES = ['Internal Only', 'Pilot Clients', 'Gradual Rollout', 'All Clients', 'Client-By-Client'] as const;
const ROLLOUT_PHASES = ['Pilot', 'Wave 1', 'Wave 2', 'Full', 'Custom'] as const;
const ENVIRONMENTS = ['Staging', 'Production', 'Both'] as const;
const CLIENT_STATUSES = ['Not Started', 'Config In Progress', 'Waiting on Client', 'Ready', 'Live', 'Rolled Back'] as const;
const CHECKLIST_STATUSES = ['Not Started', 'In Progress', 'Done', 'Skipped'] as const;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function RolloutTab({ data, onChange }: RolloutTabProps) {
  const [newMetric, setNewMetric] = useState('');

  const addClientRollout = () => {
    const newClient: ClientRollout = {
      id: generateId(),
      clientName: '',
      rolloutPhase: 'Pilot',
      environment: 'Staging',
      webflowSiteUrl: '',
      webflowSiteId: '',
      relevantCollections: '',
      featureFlagKey: '',
      owner: '',
      status: 'Not Started',
      notes: ''
    };
    onChange({ ...data, clientRollouts: [...data.clientRollouts, newClient] });
  };

  const updateClientRollout = (index: number, client: ClientRollout) => {
    const updated = [...data.clientRollouts];
    updated[index] = client;
    onChange({ ...data, clientRollouts: updated });
  };

  const removeClientRollout = (index: number) => {
    onChange({ ...data, clientRollouts: data.clientRollouts.filter((_, i) => i !== index) });
  };

  const addChecklistItem = () => {
    const newItem: RolloutChecklistItem = {
      id: generateId(),
      item: '',
      owner: '',
      dueDate: '',
      status: 'Not Started'
    };
    onChange({ ...data, rolloutChecklist: [...data.rolloutChecklist, newItem] });
  };

  const updateChecklistItem = (index: number, item: RolloutChecklistItem) => {
    const updated = [...data.rolloutChecklist];
    updated[index] = item;
    onChange({ ...data, rolloutChecklist: updated });
  };

  const removeChecklistItem = (index: number) => {
    onChange({ ...data, rolloutChecklist: data.rolloutChecklist.filter((_, i) => i !== index) });
  };

  const addTrainingAsset = () => {
    const newAsset: TrainingAsset = {
      id: generateId(),
      name: '',
      url: ''
    };
    onChange({ ...data, trainingAssets: [...data.trainingAssets, newAsset] });
  };

  const updateTrainingAsset = (index: number, asset: TrainingAsset) => {
    const updated = [...data.trainingAssets];
    updated[index] = asset;
    onChange({ ...data, trainingAssets: updated });
  };

  const removeTrainingAsset = (index: number) => {
    onChange({ ...data, trainingAssets: data.trainingAssets.filter((_, i) => i !== index) });
  };

  const addMetric = () => {
    if (newMetric && !data.keyMetrics.includes(newMetric)) {
      onChange({ ...data, keyMetrics: [...data.keyMetrics, newMetric] });
    }
    setNewMetric('');
  };

  const removeMetric = (metric: string) => {
    onChange({ ...data, keyMetrics: data.keyMetrics.filter(m => m !== metric) });
  };

  return (
    <div className="space-y-6">
      {/* Rollout Strategy */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Rollout Strategy</h4>
        <div>
          <Label>Strategy</Label>
          <Select
            value={data.rolloutStrategy}
            onValueChange={(v) => onChange({ ...data, rolloutStrategy: v as typeof ROLLOUT_STRATEGIES[number] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              {ROLLOUT_STRATEGIES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Summary</Label>
          <Textarea
            value={data.rolloutSummary}
            onChange={(e) => onChange({ ...data, rolloutSummary: e.target.value })}
            rows={2}
            placeholder="Short description of rollout strategy and any constraints"
          />
        </div>
      </div>

      {/* Client Rollout Matrix */}
      <div>
        <Label>Client Rollout Matrix</Label>
        <RepeatableList
          items={data.clientRollouts}
          onAdd={addClientRollout}
          onRemove={removeClientRollout}
          addLabel="Add Client"
          emptyMessage="No clients added to rollout."
          renderItem={(client, index) => (
            <div className="space-y-3 pr-8">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={client.clientName}
                  onChange={(e) => updateClientRollout(index, { ...client, clientName: e.target.value })}
                  placeholder="Client Name"
                />
                <Select
                  value={client.rolloutPhase}
                  onValueChange={(v) => updateClientRollout(index, { ...client, rolloutPhase: v as typeof ROLLOUT_PHASES[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLLOUT_PHASES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={client.environment}
                  onValueChange={(v) => updateClientRollout(index, { ...client, environment: v as typeof ENVIRONMENTS[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={client.status}
                  onValueChange={(v) => updateClientRollout(index, { ...client, status: v as typeof CLIENT_STATUSES[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="url"
                  value={client.webflowSiteUrl}
                  onChange={(e) => updateClientRollout(index, { ...client, webflowSiteUrl: e.target.value })}
                  placeholder="Webflow Site URL"
                />
                <Input
                  value={client.webflowSiteId}
                  onChange={(e) => updateClientRollout(index, { ...client, webflowSiteId: e.target.value })}
                  placeholder="Webflow Site ID"
                />
              </div>
              <Input
                value={client.relevantCollections}
                onChange={(e) => updateClientRollout(index, { ...client, relevantCollections: e.target.value })}
                placeholder="Relevant Collections / Pages"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={client.featureFlagKey}
                  onChange={(e) => updateClientRollout(index, { ...client, featureFlagKey: e.target.value })}
                  placeholder="Feature Flag / Config Key"
                />
                <div>
                  <AssigneePicker
                    value={client.owner ? [client.owner] : []}
                    onChange={(assignees) => updateClientRollout(index, { ...client, owner: assignees[0] || '' })}
                  />
                </div>
              </div>
              <Input
                value={client.notes}
                onChange={(e) => updateClientRollout(index, { ...client, notes: e.target.value })}
                placeholder="Notes"
              />
            </div>
          )}
        />
      </div>

      {/* Rollout Checklist */}
      <div>
        <Label>Rollout Checklist</Label>
        <RepeatableList
          items={data.rolloutChecklist}
          onAdd={addChecklistItem}
          onRemove={removeChecklistItem}
          addLabel="Add Checklist Item"
          emptyMessage="No checklist items."
          renderItem={(item, index) => (
            <div className="space-y-2 pr-8">
              <Input
                value={item.item}
                onChange={(e) => updateChecklistItem(index, { ...item, item: e.target.value })}
                placeholder="e.g., Enable feature flag in staging"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <AssigneePicker
                    value={item.owner ? [item.owner] : []}
                    onChange={(assignees) => updateChecklistItem(index, { ...item, owner: assignees[0] || '' })}
                  />
                </div>
                <Input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => updateChecklistItem(index, { ...item, dueDate: e.target.value })}
                  className="w-36"
                />
                <Select
                  value={item.status}
                  onValueChange={(v) => updateChecklistItem(index, { ...item, status: v as typeof CHECKLIST_STATUSES[number] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKLIST_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        />
      </div>

      {/* Client Communication Plan */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Client Communication Plan</h4>
        <div>
          <Label>Internal Announcement Notes</Label>
          <Textarea
            value={data.internalAnnouncementNotes}
            onChange={(e) => onChange({ ...data, internalAnnouncementNotes: e.target.value })}
            rows={2}
            placeholder="Link to Slack/Confluence/etc."
          />
        </div>
        <div>
          <Label>Client Email / Comms Template Link</Label>
          <Input
            type="url"
            value={data.clientCommsTemplateLink}
            onChange={(e) => onChange({ ...data, clientCommsTemplateLink: e.target.value })}
            placeholder="URL to email template"
          />
        </div>
        <div>
          <Label>Required Client Approvals</Label>
          <Textarea
            value={data.clientApprovals}
            onChange={(e) => onChange({ ...data, clientApprovals: e.target.value })}
            rows={2}
            placeholder="Client / Type of Approval / Status"
          />
        </div>
      </div>

      {/* Training & Enablement */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Training & Enablement</h4>
        <div className="flex items-center justify-between">
          <Label className="font-normal">Training Required?</Label>
          <Switch
            checked={data.trainingRequired}
            onCheckedChange={(checked) => onChange({ ...data, trainingRequired: checked })}
          />
        </div>
        {data.trainingRequired && (
          <>
            <div>
              <Label>Training Assets</Label>
              <RepeatableList
                items={data.trainingAssets}
                onAdd={addTrainingAsset}
                onRemove={removeTrainingAsset}
                addLabel="Add Asset"
                emptyMessage="No training assets."
                renderItem={(asset, index) => (
                  <div className="flex items-center gap-2 pr-8">
                    <Input
                      value={asset.name}
                      onChange={(e) => updateTrainingAsset(index, { ...asset, name: e.target.value })}
                      placeholder="Asset name"
                      className="flex-1"
                    />
                    <Input
                      type="url"
                      value={asset.url}
                      onChange={(e) => updateTrainingAsset(index, { ...asset, url: e.target.value })}
                      placeholder="URL"
                      className="flex-1"
                    />
                  </div>
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Internal Training Complete?</Label>
              <Switch
                checked={data.internalTrainingComplete}
                onCheckedChange={(checked) => onChange({ ...data, internalTrainingComplete: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Client Training Complete?</Label>
              <Switch
                checked={data.clientTrainingComplete}
                onCheckedChange={(checked) => onChange({ ...data, clientTrainingComplete: checked })}
              />
            </div>
          </>
        )}
      </div>

      {/* Monitoring & Rollback */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Monitoring & Rollback</h4>
        <div>
          <Label>Monitoring Plan</Label>
          <Textarea
            value={data.monitoringPlan}
            onChange={(e) => onChange({ ...data, monitoringPlan: e.target.value })}
            rows={2}
            placeholder="What will we watch post-launch? (errors, performance, user behavior, etc.)"
          />
        </div>
        <div>
          <Label>Key Metrics to Monitor</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {data.keyMetrics.map(metric => (
              <Badge key={metric} variant="secondary" className="flex items-center gap-1">
                {metric}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeMetric(metric)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newMetric}
              onChange={(e) => setNewMetric(e.target.value)}
              placeholder="Add metric"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMetric())}
            />
            <button type="button" onClick={addMetric} className="text-sm text-primary hover:underline">Add</button>
          </div>
        </div>
        <div>
          <Label>Rollback Plan</Label>
          <Textarea
            value={data.rollbackPlan}
            onChange={(e) => onChange({ ...data, rollbackPlan: e.target.value })}
            rows={3}
            placeholder="Exact steps to disable feature, revert Webflow changes, and any data fixes"
          />
        </div>
      </div>

      {/* Rollout Completion */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Rollout Completion</h4>
        <div className="flex items-center justify-between">
          <Label className="font-normal">Rollout Complete?</Label>
          <Switch
            checked={data.rolloutComplete}
            onCheckedChange={(checked) => onChange({ ...data, rolloutComplete: checked })}
          />
        </div>
        <div>
          <Label>Completion Date</Label>
          <Input
            type="date"
            value={data.completionDate}
            onChange={(e) => onChange({ ...data, completionDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Post-Mortem / Learnings</Label>
          <Textarea
            value={data.postMortemLearnings}
            onChange={(e) => onChange({ ...data, postMortemLearnings: e.target.value })}
            rows={3}
            placeholder="What went well, what could be improved"
          />
        </div>
      </div>
    </div>
  );
}
