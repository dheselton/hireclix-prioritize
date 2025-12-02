import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send } from "lucide-react";
import type { Feature, ProductCategory, ReleaseVersion } from "@/types/roadmap";
import type { 
  RequirementsData, 
  DesignData, 
  TechnicalData, 
  QAData, 
  RolloutData,
  OverviewData 
} from "@/types/featureDetail";
import { updateFeature } from "@/lib/roadmapService";
import { useToast } from "@/hooks/use-toast";
import { sendDueDateReminder, sendAssignmentNotification } from "@/lib/emailService";
import { OverviewTab } from "./feature-detail/OverviewTab";
import { RequirementsTab } from "./feature-detail/RequirementsTab";
import { DesignTab } from "./feature-detail/DesignTab";
import { TechnicalTab } from "./feature-detail/TechnicalTab";
import { QATab } from "./feature-detail/QATab";
import { RolloutTab } from "./feature-detail/RolloutTab";

interface FeatureDetailDrawerProps {
  feature: Feature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
  releaseVersions: ReleaseVersion[];
  onUpdate: () => void;
}

const defaultRequirementsData: RequirementsData = {
  userPersonas: [],
  userProblem: '',
  userStories: [],
  functionalRequirements: [],
  acceptanceCriteria: [],
  nonFunctionalRequirements: [],
  dependencies: [],
  outOfScope: '',
  successMetrics: [],
};

const defaultDesignData: DesignData = {
  designStatus: 'Not Started',
  figmaUrl: '',
  prototypeUrl: '',
  designSystemComponents: [],
  screenStates: [],
  interactionNotes: '',
  responsiveBehavior: { mobile: '', tablet: '', desktop: '' },
  accessibilityRequirements: [],
  uiCopy: '',
  toneNotes: '',
  seoKeywords: [],
  metaTitleGuidance: '',
  metaDescriptionGuidance: '',
};

const defaultTechnicalData: TechnicalData = {
  technicalOwner: '',
  implementationType: [],
  systemsTouched: [],
  dataModelChanges: [],
  apiIntegrations: [],
  featureFlagName: '',
  configOptions: '',
  defaultState: 'Off',
  performanceNotes: '',
  securityNotes: '',
  technicalRisks: [],
  implementationTasks: [],
};

const defaultQAData: QAData = {
  qaOwner: '',
  testingScopeSummary: '',
  testScenarios: [],
  devicesBrowsers: {
    desktop: { chrome: false, safari: false, firefox: false, edge: false },
    tablet: { chrome: false, safari: false, firefox: false, edge: false },
    mobile: { chrome: false, safari: false, firefox: false, edge: false },
  },
  testDataRequirements: '',
  automatedTests: [],
  regressionAreas: '',
  signOff: {
    readyForRollout: false,
    signOffBy: '',
    signOffDate: '',
    signOffNotes: '',
  },
};

const defaultRolloutData: RolloutData = {
  rolloutStrategy: 'All Clients',
  rolloutSummary: '',
  clientRollouts: [],
  rolloutChecklist: [],
  internalAnnouncementNotes: '',
  clientCommsTemplateLink: '',
  clientApprovals: '',
  trainingRequired: false,
  trainingAssets: [],
  internalTrainingComplete: false,
  clientTrainingComplete: false,
  monitoringPlan: '',
  keyMetrics: [],
  rollbackPlan: '',
  rolloutComplete: false,
  completionDate: '',
  postMortemLearnings: '',
};

const defaultOverviewData: OverviewData = {
  priority: 'P2 – Medium',
  effortSize: 'M',
  estimatedDevDays: null,
  stakeholders: [],
  sendDueDateReminder: false,
  notifyOnChange: false,
};

function parseJsonField<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

export function FeatureDetailDrawer({
  feature,
  open,
  onOpenChange,
  categories,
  releaseVersions,
  onUpdate,
}: FeatureDetailDrawerProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Feature>>({});
  const [overviewData, setOverviewData] = useState<OverviewData>(defaultOverviewData);
  const [requirementsData, setRequirementsData] = useState<RequirementsData>(defaultRequirementsData);
  const [designData, setDesignData] = useState<DesignData>(defaultDesignData);
  const [technicalData, setTechnicalData] = useState<TechnicalData>(defaultTechnicalData);
  const [qaData, setQAData] = useState<QAData>(defaultQAData);
  const [rolloutData, setRolloutData] = useState<RolloutData>(defaultRolloutData);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  useEffect(() => {
    if (feature) {
      setFormData(feature);
      // Parse JSON fields for each tab
      setRequirementsData(parseJsonField(feature.documentation, defaultRequirementsData));
      setDesignData(parseJsonField(feature.design_specs, defaultDesignData));
      setTechnicalData(parseJsonField(feature.technical_notes, defaultTechnicalData));
      setQAData(parseJsonField(feature.qa_plan, defaultQAData));
      setRolloutData(parseJsonField(feature.rollout_instructions, defaultRolloutData));
      // Overview data from summary field
      setOverviewData(parseJsonField(feature.summary, defaultOverviewData));
    }
  }, [feature]);

  if (!feature) return null;

  const handleSave = async () => {
    try {
      const { product_category, release_version, ...updateData } = formData;
      
      // Serialize structured data to JSON strings
      const dataToSave = {
        ...updateData,
        summary: JSON.stringify(overviewData),
        documentation: JSON.stringify(requirementsData),
        design_specs: JSON.stringify(designData),
        technical_notes: JSON.stringify(technicalData),
        qa_plan: JSON.stringify(qaData),
        rollout_instructions: JSON.stringify(rolloutData),
      };
      
      await updateFeature(feature.id, dataToSave);
      toast({
        title: "Success",
        description: "Feature updated successfully.",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update feature.",
        variant: "destructive",
      });
    }
  };

  const handleSendReminder = async () => {
    if (!formData.assignees?.length) {
      toast({
        title: "No assignees",
        description: "Please add assignees before sending a reminder.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReminder(true);
    try {
      const result = await sendDueDateReminder({
        id: feature.id,
        title: formData.title || feature.title,
        assignees: formData.assignees,
        due_date: formData.due_date,
        status: formData.status || feature.status,
      });

      if (result.success) {
        toast({
          title: "Reminder sent",
          description: `Due date reminder sent to ${formData.assignees.join(', ')}.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Failed to send reminder",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleSendAssignmentNotification = async () => {
    if (!formData.assignees?.length) {
      toast({
        title: "No assignees",
        description: "Please add assignees first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReminder(true);
    try {
      const result = await sendAssignmentNotification({
        id: feature.id,
        title: formData.title || feature.title,
        assignees: formData.assignees,
        due_date: formData.due_date,
        status: formData.status || feature.status,
      });

      if (result.success) {
        toast({
          title: "Notification sent",
          description: `Assignment notification sent to ${formData.assignees.join(', ')}.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Feature Details</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendReminder}
                disabled={isSendingReminder || !formData.assignees?.length}
              >
                <Mail className="w-4 h-4 mr-1" />
                Reminder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendAssignmentNotification}
                disabled={isSendingReminder || !formData.assignees?.length}
              >
                <Send className="w-4 h-4 mr-1" />
                Notify
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
            <TabsTrigger value="qa">QA</TabsTrigger>
            <TabsTrigger value="rollout">Rollout</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab
              formData={formData}
              overviewData={overviewData}
              categories={categories}
              releaseVersions={releaseVersions}
              onFormChange={(updates) => setFormData({ ...formData, ...updates })}
              onOverviewChange={setOverviewData}
            />
          </TabsContent>

          <TabsContent value="requirements" className="mt-4">
            <RequirementsTab
              data={requirementsData}
              onChange={setRequirementsData}
            />
          </TabsContent>

          <TabsContent value="design" className="mt-4">
            <DesignTab
              data={designData}
              onChange={setDesignData}
            />
          </TabsContent>

          <TabsContent value="technical" className="mt-4">
            <TechnicalTab
              data={technicalData}
              onChange={setTechnicalData}
            />
          </TabsContent>

          <TabsContent value="qa" className="mt-4">
            <QATab
              data={qaData}
              onChange={setQAData}
            />
          </TabsContent>

          <TabsContent value="rollout" className="mt-4">
            <RolloutTab
              data={rolloutData}
              onChange={setRolloutData}
            />
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6 sticky bottom-0 bg-background py-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
