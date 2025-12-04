import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AssigneePicker } from "../AssigneePicker";
import type { Feature, ProductCategory, ReleaseVersion } from "@/types/roadmap";
import type { OverviewData, FeaturePriority, EffortSize, ExtendedFeatureStatus } from "@/types/featureDetail";

interface OverviewTabProps {
  formData: Partial<Feature>;
  overviewData: OverviewData;
  categories: ProductCategory[];
  releaseVersions: ReleaseVersion[];
  onFormChange: (data: Partial<Feature>) => void;
  onOverviewChange: (data: OverviewData) => void;
}

const STATUS_COLORS: Record<ExtendedFeatureStatus, string> = {
  'Backlog': 'bg-slate-500',
  'Discovery': 'bg-purple-500',
  'In Design': 'bg-pink-500',
  'Ready for Dev': 'bg-blue-500',
  'In Dev': 'bg-amber-500',
  'QA': 'bg-orange-500',
  'Ready for Rollout': 'bg-teal-500',
  'Rolled Out': 'bg-green-500',
  'On Hold': 'bg-gray-500',
  'Cancelled': 'bg-red-500',
};

const FEATURE_LEVELS = ['Core', 'Enhancement', 'Experiment', 'Bugfix'] as const;
const FEATURE_TYPES = ['Front End UI', 'Backend', 'Integration', 'Infrastructure', 'Analytics', 'Configuration Only', 'Content'] as const;
const STATUSES: ExtendedFeatureStatus[] = ['Backlog', 'Discovery', 'In Design', 'Ready for Dev', 'In Dev', 'QA', 'Ready for Rollout', 'Rolled Out', 'On Hold', 'Cancelled'];
const PRIORITIES: FeaturePriority[] = ['P0 – Critical', 'P1 – High', 'P2 – Medium', 'P3 – Low'];
const EFFORT_SIZES: EffortSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export function OverviewTab({
  formData,
  overviewData,
  categories,
  releaseVersions,
  onFormChange,
  onOverviewChange,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={formData.title || ''}
          onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
          placeholder="Short, action-oriented feature name"
        />
        <p className="text-xs text-muted-foreground mt-1">Short, action-oriented feature name.</p>
      </div>

      {/* Summary */}
      <div>
        <Label>Summary <span className="text-destructive">*</span></Label>
        <SmartTextarea
          value={overviewData.description || ''}
          onChange={(e) => onOverviewChange({ ...overviewData, description: e.target.value })}
          rows={3}
          placeholder="Business context, goals, and what problems this feature solves"
        />
        <p className="text-xs text-muted-foreground mt-1">Business context, goals, and what problems this feature solves.</p>
      </div>

      {/* Product Category & Release Version */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Product Category <span className="text-destructive">*</span></Label>
          <Select
            value={formData.product_category_id || ''}
            onValueChange={(value) => onFormChange({ ...formData, product_category_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Release Version <span className="text-destructive">*</span></Label>
          <Select
            value={formData.release_version_id || ''}
            onValueChange={(value) => onFormChange({ ...formData, release_version_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {releaseVersions.map(ver => (
                <SelectItem key={ver.id} value={ver.id}>{ver.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feature Level & Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Feature Level <span className="text-destructive">*</span></Label>
          <Select
            value={formData.feature_level || ''}
            onValueChange={(value) => onFormChange({ ...formData, feature_level: value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_LEVELS.map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Feature Type <span className="text-destructive">*</span></Label>
          <Select
            value={formData.feature_type || ''}
            onValueChange={(value) => onFormChange({ ...formData, feature_type: value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status <span className="text-destructive">*</span></Label>
          <Select
            value={formData.status || ''}
            onValueChange={(value) => onFormChange({ ...formData, status: value as any })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(status => (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                    {status}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Priority <span className="text-destructive">*</span></Label>
          <Select
            value={overviewData.priority || ''}
            onValueChange={(value) => onOverviewChange({ ...overviewData, priority: value as FeaturePriority })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={formData.start_date || ''}
            onChange={(e) => onFormChange({ ...formData, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input
            type="date"
            value={formData.due_date || ''}
            onChange={(e) => onFormChange({ ...formData, due_date: e.target.value })}
          />
        </div>
      </div>

      {/* Effort Estimate */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Effort Size</Label>
          <Select
            value={overviewData.effortSize || ''}
            onValueChange={(value) => onOverviewChange({ ...overviewData, effortSize: value as EffortSize })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {EFFORT_SIZES.map(size => (
                <SelectItem key={size} value={size}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Estimated Dev Days</Label>
          <Input
            type="number"
            min={0}
            value={overviewData.estimatedDevDays ?? ''}
            onChange={(e) => onOverviewChange({ ...overviewData, estimatedDevDays: e.target.value ? Number(e.target.value) : null })}
            placeholder="e.g., 5"
          />
        </div>
      </div>

      {/* Assignees */}
      <div>
        <Label>Assignees <span className="text-destructive">*</span></Label>
        <AssigneePicker
          value={formData.assignees || []}
          onChange={(assignees) => onFormChange({ ...formData, assignees })}
        />
        <p className="text-xs text-muted-foreground mt-1">First assignee is considered primary.</p>
      </div>

      {/* Stakeholders */}
      <div>
        <Label>Stakeholders</Label>
        <AssigneePicker
          value={overviewData.stakeholders || []}
          onChange={(stakeholders) => onOverviewChange({ ...overviewData, stakeholders })}
        />
      </div>

      {/* Reminders & Notifications */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Reminders & Notifications</h4>
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-normal">Send Due Date Reminder</Label>
            <p className="text-xs text-muted-foreground">Email assignees before due date</p>
          </div>
          <Switch
            checked={overviewData.sendDueDateReminder}
            onCheckedChange={(checked) => onOverviewChange({ ...overviewData, sendDueDateReminder: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-normal">Notify Assignees on Change</Label>
            <p className="text-xs text-muted-foreground">When Status or Due Date changes</p>
          </div>
          <Switch
            checked={overviewData.notifyOnChange}
            onCheckedChange={(checked) => onOverviewChange({ ...overviewData, notifyOnChange: checked })}
          />
        </div>
      </div>
    </div>
  );
}
