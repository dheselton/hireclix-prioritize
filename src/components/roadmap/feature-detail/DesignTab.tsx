import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartTextarea } from "@/components/ui/smart-textarea";
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
import type { DesignData, ScreenState, AccessibilityRequirement } from "@/types/featureDetail";
import { useState } from "react";

interface DesignTabProps {
  data: DesignData;
  onChange: (data: DesignData) => void;
}

const DESIGN_STATUSES = ['Not Started', 'In Progress', 'Ready for Review', 'Approved', 'Needs Revisions'] as const;
const SCREEN_STATUSES = ['Planned', 'Designed', 'In Dev', 'Implemented'] as const;
const ACCESSIBILITY_TYPES = ['Keyboard', 'Screen Reader', 'Contrast', 'Copy', 'Other'] as const;
const DESIGN_SYSTEM_COMPONENTS = ['Button', 'Card', 'Modal', 'Form', 'Table', 'Navigation', 'Header', 'Footer', 'Badge', 'Toast', 'Dropdown', 'Tabs'];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function DesignTab({ data, onChange }: DesignTabProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const addScreenState = () => {
    const newScreen: ScreenState = {
      id: generateId(),
      name: '',
      description: '',
      status: 'Planned',
      screenshotUrl: ''
    };
    onChange({ ...data, screenStates: [...data.screenStates, newScreen] });
  };

  const updateScreenState = (index: number, screen: ScreenState) => {
    const updated = [...data.screenStates];
    updated[index] = screen;
    onChange({ ...data, screenStates: updated });
  };

  const removeScreenState = (index: number) => {
    onChange({ ...data, screenStates: data.screenStates.filter((_, i) => i !== index) });
  };

  const addAccessibilityReq = () => {
    const newReq: AccessibilityRequirement = {
      id: generateId(),
      requirement: '',
      type: 'Keyboard',
      mustHave: false
    };
    onChange({ ...data, accessibilityRequirements: [...data.accessibilityRequirements, newReq] });
  };

  const updateAccessibilityReq = (index: number, req: AccessibilityRequirement) => {
    const updated = [...data.accessibilityRequirements];
    updated[index] = req;
    onChange({ ...data, accessibilityRequirements: updated });
  };

  const removeAccessibilityReq = (index: number) => {
    onChange({ ...data, accessibilityRequirements: data.accessibilityRequirements.filter((_, i) => i !== index) });
  };

  const toggleDesignComponent = (component: string) => {
    if (data.designSystemComponents.includes(component)) {
      onChange({ ...data, designSystemComponents: data.designSystemComponents.filter(c => c !== component) });
    } else {
      onChange({ ...data, designSystemComponents: [...data.designSystemComponents, component] });
    }
  };

  const addKeyword = () => {
    if (newKeyword && !data.seoKeywords.includes(newKeyword)) {
      onChange({ ...data, seoKeywords: [...data.seoKeywords, newKeyword] });
    }
    setNewKeyword('');
  };

  const removeKeyword = (keyword: string) => {
    onChange({ ...data, seoKeywords: data.seoKeywords.filter(k => k !== keyword) });
  };

  return (
    <div className="space-y-6">
      {/* Design Status */}
      <div>
        <Label>Design Status</Label>
        <Select
          value={data.designStatus}
          onValueChange={(v) => onChange({ ...data, designStatus: v as typeof DESIGN_STATUSES[number] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {DESIGN_STATUSES.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Primary Design Links */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Primary Design Links</h4>
        <div>
          <Label>Main Figma File URL</Label>
          <Input
            type="url"
            value={data.figmaUrl}
            onChange={(e) => onChange({ ...data, figmaUrl: e.target.value })}
            placeholder="https://figma.com/file/..."
          />
        </div>
        <div>
          <Label>Prototype / Flow URL</Label>
          <Input
            type="url"
            value={data.prototypeUrl}
            onChange={(e) => onChange({ ...data, prototypeUrl: e.target.value })}
            placeholder="https://figma.com/proto/..."
          />
        </div>
        <div>
          <Label>Design System Components Used</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DESIGN_SYSTEM_COMPONENTS.map(comp => (
              <Badge
                key={comp}
                variant={data.designSystemComponents.includes(comp) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleDesignComponent(comp)}
              >
                {comp}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Key Screens & States */}
      <div>
        <Label>Key Screens & States</Label>
        <RepeatableList
          items={data.screenStates}
          onAdd={addScreenState}
          onRemove={removeScreenState}
          addLabel="Add Screen/State"
          emptyMessage="No screens or states defined."
          renderItem={(screen, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Input
                  value={screen.name}
                  onChange={(e) => updateScreenState(index, { ...screen, name: e.target.value })}
                  placeholder="Screen/State name"
                  className="flex-1"
                />
                <Select
                  value={screen.status}
                  onValueChange={(v) => updateScreenState(index, { ...screen, status: v as typeof SCREEN_STATUSES[number] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCREEN_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={screen.description}
                onChange={(e) => updateScreenState(index, { ...screen, description: e.target.value })}
                placeholder="Description"
              />
              <Input
                type="url"
                value={screen.screenshotUrl}
                onChange={(e) => updateScreenState(index, { ...screen, screenshotUrl: e.target.value })}
                placeholder="Screenshot URL (optional)"
              />
            </div>
          )}
        />
      </div>

      {/* Interaction & UX Notes */}
      <div>
        <Label>Interaction & UX Notes</Label>
        <SmartTextarea
          value={data.interactionNotes}
          onChange={(e) => onChange({ ...data, interactionNotes: e.target.value })}
          rows={3}
          placeholder="Animations, micro-interactions, transitions, error states, empty states, loading states"
        />
        <p className="text-xs text-muted-foreground mt-1">Animations, micro-interactions, transitions, error states, empty states, loading states.</p>
      </div>

      {/* Responsive Behavior */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Responsive Behavior</h4>
        <div>
          <Label>Mobile</Label>
          <Input
            value={data.responsiveBehavior.mobile}
            onChange={(e) => onChange({ ...data, responsiveBehavior: { ...data.responsiveBehavior, mobile: e.target.value } })}
            placeholder="Mobile-specific behavior notes"
          />
        </div>
        <div>
          <Label>Tablet</Label>
          <Input
            value={data.responsiveBehavior.tablet}
            onChange={(e) => onChange({ ...data, responsiveBehavior: { ...data.responsiveBehavior, tablet: e.target.value } })}
            placeholder="Tablet-specific behavior notes"
          />
        </div>
        <div>
          <Label>Desktop</Label>
          <Input
            value={data.responsiveBehavior.desktop}
            onChange={(e) => onChange({ ...data, responsiveBehavior: { ...data.responsiveBehavior, desktop: e.target.value } })}
            placeholder="Desktop-specific behavior notes"
          />
        </div>
      </div>

      {/* Accessibility Requirements */}
      <div>
        <Label>Accessibility Requirements</Label>
        <RepeatableList
          items={data.accessibilityRequirements}
          onAdd={addAccessibilityReq}
          onRemove={removeAccessibilityReq}
          addLabel="Add Requirement"
          emptyMessage="No accessibility requirements defined."
          renderItem={(req, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Select
                  value={req.type}
                  onValueChange={(v) => updateAccessibilityReq(index, { ...req, type: v as typeof ACCESSIBILITY_TYPES[number] })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESSIBILITY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={req.mustHave}
                    onCheckedChange={(checked) => updateAccessibilityReq(index, { ...req, mustHave: checked })}
                  />
                  <span className="text-xs text-muted-foreground">Must Have</span>
                </div>
              </div>
              <Input
                value={req.requirement}
                onChange={(e) => updateAccessibilityReq(index, { ...req, requirement: e.target.value })}
                placeholder="Requirement description"
              />
            </div>
          )}
        />
      </div>

      {/* Content & Copy */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Content & Copy</h4>
        <div>
          <Label>Key UI Copy</Label>
          <SmartTextarea
            value={data.uiCopy}
            onChange={(e) => onChange({ ...data, uiCopy: e.target.value })}
            rows={3}
            placeholder="Element: Copy text (one per line)"
          />
        </div>
        <div>
          <Label>Tone & Voice Notes</Label>
          <Input
            value={data.toneNotes}
            onChange={(e) => onChange({ ...data, toneNotes: e.target.value })}
            placeholder="e.g., Professional but friendly"
          />
        </div>
      </div>

      {/* SEO Considerations */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">SEO Considerations (for Webflow pages)</h4>
        <div>
          <Label>Target Keywords</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {data.seoKeywords.map(kw => (
              <Badge key={kw} variant="secondary" className="flex items-center gap-1">
                {kw}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeKeyword(kw)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add keyword"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            />
            <button type="button" onClick={addKeyword} className="text-sm text-primary hover:underline">Add</button>
          </div>
        </div>
        <div>
          <Label>Meta Title Guidance</Label>
          <Input
            value={data.metaTitleGuidance}
            onChange={(e) => onChange({ ...data, metaTitleGuidance: e.target.value })}
            placeholder="Guidance for page title"
          />
        </div>
        <div>
          <Label>Meta Description Guidance</Label>
          <SmartTextarea
            value={data.metaDescriptionGuidance}
            onChange={(e) => onChange({ ...data, metaDescriptionGuidance: e.target.value })}
            rows={2}
            placeholder="Guidance for meta description"
          />
        </div>
      </div>
    </div>
  );
}
