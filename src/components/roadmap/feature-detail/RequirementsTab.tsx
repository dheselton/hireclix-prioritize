import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepeatableList } from "./RepeatableList";
import type { RequirementsData, UserStory, FunctionalRequirement, AcceptanceCriterion, Dependency, SuccessMetric, NonFunctionalRequirement } from "@/types/featureDetail";
import { useState } from "react";

interface RequirementsTabProps {
  data: RequirementsData;
  onChange: (data: RequirementsData) => void;
}

const PERSONA_OPTIONS = ['Recruiter', 'Hiring Manager', 'Candidate', 'Admin', 'Analytics User', 'Developer', 'Client Admin'];
const NFR_TAGS = ['Performance', 'Security', 'Accessibility', 'SEO', 'Reliability', 'Compliance', 'Localization'];
const DEPENDENCY_TYPES = ['Other Feature', 'External Vendor', 'Design', 'Client Asset', 'Tech Debt'] as const;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function RequirementsTab({ data, onChange }: RequirementsTabProps) {
  const [newPersona, setNewPersona] = useState('');

  const addPersona = (persona: string) => {
    if (persona && !data.userPersonas.includes(persona)) {
      onChange({ ...data, userPersonas: [...data.userPersonas, persona] });
    }
    setNewPersona('');
  };

  const removePersona = (persona: string) => {
    onChange({ ...data, userPersonas: data.userPersonas.filter(p => p !== persona) });
  };

  const addUserStory = () => {
    const newStory: UserStory = { id: generateId(), asA: '', iWant: '', soThat: '' };
    onChange({ ...data, userStories: [...data.userStories, newStory] });
  };

  const updateUserStory = (index: number, story: UserStory) => {
    const updated = [...data.userStories];
    updated[index] = story;
    onChange({ ...data, userStories: updated });
  };

  const removeUserStory = (index: number) => {
    onChange({ ...data, userStories: data.userStories.filter((_, i) => i !== index) });
  };

  const addFR = () => {
    const newFR: FunctionalRequirement = {
      id: `FR-${data.functionalRequirements.length + 1}`,
      description: '',
      priority: 'Must',
      relatedUIElement: '',
      notes: ''
    };
    onChange({ ...data, functionalRequirements: [...data.functionalRequirements, newFR] });
  };

  const updateFR = (index: number, fr: FunctionalRequirement) => {
    const updated = [...data.functionalRequirements];
    updated[index] = fr;
    onChange({ ...data, functionalRequirements: updated });
  };

  const removeFR = (index: number) => {
    onChange({ ...data, functionalRequirements: data.functionalRequirements.filter((_, i) => i !== index) });
  };

  const addAC = () => {
    const newAC: AcceptanceCriterion = {
      id: `AC-${data.acceptanceCriteria.length + 1}`,
      description: '',
      isCriticalPath: false
    };
    onChange({ ...data, acceptanceCriteria: [...data.acceptanceCriteria, newAC] });
  };

  const updateAC = (index: number, ac: AcceptanceCriterion) => {
    const updated = [...data.acceptanceCriteria];
    updated[index] = ac;
    onChange({ ...data, acceptanceCriteria: updated });
  };

  const removeAC = (index: number) => {
    onChange({ ...data, acceptanceCriteria: data.acceptanceCriteria.filter((_, i) => i !== index) });
  };

  const toggleNFR = (tag: string) => {
    const existing = data.nonFunctionalRequirements.find(n => n.tag === tag);
    if (existing) {
      onChange({ ...data, nonFunctionalRequirements: data.nonFunctionalRequirements.filter(n => n.tag !== tag) });
    } else {
      onChange({ ...data, nonFunctionalRequirements: [...data.nonFunctionalRequirements, { tag, description: '' }] });
    }
  };

  const updateNFRDescription = (tag: string, description: string) => {
    const updated = data.nonFunctionalRequirements.map(n => 
      n.tag === tag ? { ...n, description } : n
    );
    onChange({ ...data, nonFunctionalRequirements: updated });
  };

  const addDependency = () => {
    const newDep: Dependency = {
      id: generateId(),
      type: 'Other Feature',
      description: '',
      isBlocking: false,
      link: ''
    };
    onChange({ ...data, dependencies: [...data.dependencies, newDep] });
  };

  const updateDependency = (index: number, dep: Dependency) => {
    const updated = [...data.dependencies];
    updated[index] = dep;
    onChange({ ...data, dependencies: updated });
  };

  const removeDependency = (index: number) => {
    onChange({ ...data, dependencies: data.dependencies.filter((_, i) => i !== index) });
  };

  const addMetric = () => {
    const newMetric: SuccessMetric = {
      id: generateId(),
      metric: '',
      target: '',
      measurementSource: ''
    };
    onChange({ ...data, successMetrics: [...data.successMetrics, newMetric] });
  };

  const updateMetric = (index: number, metric: SuccessMetric) => {
    const updated = [...data.successMetrics];
    updated[index] = metric;
    onChange({ ...data, successMetrics: updated });
  };

  const removeMetric = (index: number) => {
    onChange({ ...data, successMetrics: data.successMetrics.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* User Personas */}
      <div>
        <Label>User Personas</Label>
        <div className="flex flex-wrap gap-2 mt-2 mb-2">
          {data.userPersonas.map(persona => (
            <Badge key={persona} variant="secondary" className="flex items-center gap-1">
              {persona}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removePersona(persona)} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={newPersona} onValueChange={addPersona}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add persona" />
            </SelectTrigger>
            <SelectContent>
              {PERSONA_OPTIONS.filter(p => !data.userPersonas.includes(p)).map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* User Problem */}
      <div>
        <Label>User Problem / Job To Be Done <span className="text-destructive">*</span></Label>
        <Textarea
          value={data.userProblem}
          onChange={(e) => onChange({ ...data, userProblem: e.target.value })}
          rows={3}
          placeholder="Describe the user's problem in plain language"
        />
        <p className="text-xs text-muted-foreground mt-1">Describe the user's problem in plain language.</p>
      </div>

      {/* User Stories */}
      <div>
        <Label>User Stories</Label>
        <RepeatableList
          items={data.userStories}
          onAdd={addUserStory}
          onRemove={removeUserStory}
          addLabel="Add User Story"
          emptyMessage="No user stories added."
          renderItem={(story, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">As a</span>
                <Input
                  value={story.asA}
                  onChange={(e) => updateUserStory(index, { ...story, asA: e.target.value })}
                  placeholder="persona"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">I want</span>
                <Input
                  value={story.iWant}
                  onChange={(e) => updateUserStory(index, { ...story, iWant: e.target.value })}
                  placeholder="action/feature"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">So that</span>
                <Input
                  value={story.soThat}
                  onChange={(e) => updateUserStory(index, { ...story, soThat: e.target.value })}
                  placeholder="benefit/outcome"
                  className="flex-1"
                />
              </div>
            </div>
          )}
        />
      </div>

      {/* Functional Requirements */}
      <div>
        <Label>Functional Requirements</Label>
        <RepeatableList
          items={data.functionalRequirements}
          onAdd={addFR}
          onRemove={removeFR}
          addLabel="Add Requirement"
          emptyMessage="No functional requirements added."
          renderItem={(fr, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{fr.id}</Badge>
                <Select
                  value={fr.priority}
                  onValueChange={(v) => updateFR(index, { ...fr, priority: v as 'Must' | 'Should' | 'Nice' })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Must">Must</SelectItem>
                    <SelectItem value="Should">Should</SelectItem>
                    <SelectItem value="Nice">Nice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={fr.description}
                onChange={(e) => updateFR(index, { ...fr, description: e.target.value })}
                placeholder="Description"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={fr.relatedUIElement}
                  onChange={(e) => updateFR(index, { ...fr, relatedUIElement: e.target.value })}
                  placeholder="Related UI element"
                />
                <Input
                  value={fr.notes}
                  onChange={(e) => updateFR(index, { ...fr, notes: e.target.value })}
                  placeholder="Notes"
                />
              </div>
            </div>
          )}
        />
      </div>

      {/* Acceptance Criteria */}
      <div>
        <Label>Acceptance Criteria</Label>
        <RepeatableList
          items={data.acceptanceCriteria}
          onAdd={addAC}
          onRemove={removeAC}
          addLabel="Add Criterion"
          emptyMessage="No acceptance criteria added."
          renderItem={(ac, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{ac.id}</Badge>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={ac.isCriticalPath}
                    onCheckedChange={(checked) => updateAC(index, { ...ac, isCriticalPath: !!checked })}
                  />
                  <span className="text-xs text-muted-foreground">Critical Path</span>
                </div>
              </div>
              <Textarea
                value={ac.description}
                onChange={(e) => updateAC(index, { ...ac, description: e.target.value })}
                placeholder="Given/When/Then format encouraged"
                rows={2}
              />
            </div>
          )}
        />
      </div>

      {/* Non-Functional Requirements */}
      <div>
        <Label>Non-Functional Requirements</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {NFR_TAGS.map(tag => {
            const selected = data.nonFunctionalRequirements.find(n => n.tag === tag);
            return (
              <Badge
                key={tag}
                variant={selected ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleNFR(tag)}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
        {data.nonFunctionalRequirements.length > 0 && (
          <div className="mt-3 space-y-2">
            {data.nonFunctionalRequirements.map(nfr => (
              <div key={nfr.tag} className="flex items-center gap-2">
                <Badge variant="secondary" className="w-24 justify-center">{nfr.tag}</Badge>
                <Input
                  value={nfr.description}
                  onChange={(e) => updateNFRDescription(nfr.tag, e.target.value)}
                  placeholder={`Notes for ${nfr.tag}`}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependencies */}
      <div>
        <Label>Dependencies & Blocks</Label>
        <RepeatableList
          items={data.dependencies}
          onAdd={addDependency}
          onRemove={removeDependency}
          addLabel="Add Dependency"
          emptyMessage="No dependencies added."
          renderItem={(dep, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Select
                  value={dep.type}
                  onValueChange={(v) => updateDependency(index, { ...dep, type: v as typeof DEPENDENCY_TYPES[number] })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPENDENCY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={dep.isBlocking}
                    onCheckedChange={(checked) => updateDependency(index, { ...dep, isBlocking: !!checked })}
                  />
                  <span className="text-xs text-muted-foreground">Blocking</span>
                </div>
              </div>
              <Input
                value={dep.description}
                onChange={(e) => updateDependency(index, { ...dep, description: e.target.value })}
                placeholder="Description"
              />
              <Input
                value={dep.link}
                onChange={(e) => updateDependency(index, { ...dep, link: e.target.value })}
                placeholder="Link to related feature/task (URL)"
                type="url"
              />
            </div>
          )}
        />
      </div>

      {/* Out of Scope */}
      <div>
        <Label>Out of Scope</Label>
        <Textarea
          value={data.outOfScope}
          onChange={(e) => onChange({ ...data, outOfScope: e.target.value })}
          rows={3}
          placeholder="Explicitly list items not included in this release"
        />
        <p className="text-xs text-muted-foreground mt-1">Explicitly list items not included in this release.</p>
      </div>

      {/* Success Metrics */}
      <div>
        <Label>Success Metrics / KPIs</Label>
        <RepeatableList
          items={data.successMetrics}
          onAdd={addMetric}
          onRemove={removeMetric}
          addLabel="Add Metric"
          emptyMessage="No success metrics defined."
          renderItem={(metric, index) => (
            <div className="grid grid-cols-3 gap-2 pr-8">
              <Input
                value={metric.metric}
                onChange={(e) => updateMetric(index, { ...metric, metric: e.target.value })}
                placeholder="Metric name"
              />
              <Input
                value={metric.target}
                onChange={(e) => updateMetric(index, { ...metric, target: e.target.value })}
                placeholder="Target value"
              />
              <Input
                value={metric.measurementSource}
                onChange={(e) => updateMetric(index, { ...metric, measurementSource: e.target.value })}
                placeholder="Source (GA4, HubSpot...)"
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
