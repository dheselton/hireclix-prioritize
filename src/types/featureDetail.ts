// Structured types for Feature Detail form data

export interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
}

export interface FunctionalRequirement {
  id: string;
  description: string;
  priority: 'Must' | 'Should' | 'Nice';
  relatedUIElement: string;
  notes: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  isCriticalPath: boolean;
}

export interface NonFunctionalRequirement {
  tag: string;
  description: string;
}

export interface Dependency {
  id: string;
  type: 'Other Feature' | 'External Vendor' | 'Design' | 'Client Asset' | 'Tech Debt';
  description: string;
  isBlocking: boolean;
  link: string;
}

export interface SuccessMetric {
  id: string;
  metric: string;
  target: string;
  measurementSource: string;
}

export interface RequirementsData {
  userPersonas: string[];
  userProblem: string;
  userStories: UserStory[];
  functionalRequirements: FunctionalRequirement[];
  acceptanceCriteria: AcceptanceCriterion[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  dependencies: Dependency[];
  outOfScope: string;
  successMetrics: SuccessMetric[];
}

export interface ScreenState {
  id: string;
  name: string;
  description: string;
  status: 'Planned' | 'Designed' | 'In Dev' | 'Implemented';
  screenshotUrl: string;
}

export interface AccessibilityRequirement {
  id: string;
  requirement: string;
  type: 'Keyboard' | 'Screen Reader' | 'Contrast' | 'Copy' | 'Other';
  mustHave: boolean;
}

export interface DesignData {
  designStatus: 'Not Started' | 'In Progress' | 'Ready for Review' | 'Approved' | 'Needs Revisions';
  figmaUrl: string;
  prototypeUrl: string;
  designSystemComponents: string[];
  screenStates: ScreenState[];
  interactionNotes: string;
  responsiveBehavior: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  accessibilityRequirements: AccessibilityRequirement[];
  uiCopy: string;
  toneNotes: string;
  seoKeywords: string[];
  metaTitleGuidance: string;
  metaDescriptionGuidance: string;
}

export interface DataModelChange {
  id: string;
  entity: string;
  type: 'New Collection' | 'New Field' | 'Field Change' | 'No Data Change';
  details: string;
  migrationNeeded: boolean;
}

export interface ApiIntegration {
  id: string;
  integration: string;
  endpoint: string;
  authMethod: 'API Key' | 'OAuth' | 'Webhook' | 'Other';
  direction: 'Read' | 'Write' | 'Both';
  notes: string;
}

export interface TechnicalRisk {
  id: string;
  risk: string;
  impact: 'Low' | 'Medium' | 'High';
  likelihood: 'Low' | 'Medium' | 'High';
  mitigationPlan: string;
}

export interface ImplementationTask {
  id: string;
  taskName: string;
  owner: string;
  status: 'Not Started' | 'In Progress' | 'Done';
  externalTicketLink: string;
}

export interface TechnicalData {
  technicalOwner: string;
  implementationType: string[];
  systemsTouched: { tag: string; notes: string }[];
  dataModelChanges: DataModelChange[];
  apiIntegrations: ApiIntegration[];
  featureFlagName: string;
  configOptions: string;
  defaultState: 'On' | 'Off' | 'Client Specific';
  performanceNotes: string;
  securityNotes: string;
  technicalRisks: TechnicalRisk[];
  implementationTasks: ImplementationTask[];
}

export interface TestScenario {
  id: string;
  description: string;
  type: 'Happy Path' | 'Edge Case' | 'Negative' | 'Regression';
  relatedAC: string;
  status: 'Not Run' | 'Pass' | 'Fail' | 'Blocked';
  notes: string;
}

export interface AutomatedTest {
  id: string;
  area: string;
  type: 'Unit' | 'Integration' | 'E2E';
  coverageNotes: string;
}

export interface QAData {
  qaOwner: string;
  testingScopeSummary: string;
  testScenarios: TestScenario[];
  devicesBrowsers: {
    desktop: { chrome: boolean; safari: boolean; firefox: boolean; edge: boolean };
    tablet: { chrome: boolean; safari: boolean; firefox: boolean; edge: boolean };
    mobile: { chrome: boolean; safari: boolean; firefox: boolean; edge: boolean };
  };
  testDataRequirements: string;
  automatedTests: AutomatedTest[];
  regressionAreas: string;
  signOff: {
    readyForRollout: boolean;
    signOffBy: string;
    signOffDate: string;
    signOffNotes: string;
  };
}

export interface ClientRollout {
  id: string;
  clientName: string;
  rolloutPhase: 'Pilot' | 'Wave 1' | 'Wave 2' | 'Full' | 'Custom';
  environment: 'Staging' | 'Production' | 'Both';
  webflowSiteUrl: string;
  webflowSiteId: string;
  relevantCollections: string;
  featureFlagKey: string;
  owner: string;
  status: 'Not Started' | 'Config In Progress' | 'Waiting on Client' | 'Ready' | 'Live' | 'Rolled Back';
  notes: string;
}

export interface RolloutChecklistItem {
  id: string;
  item: string;
  owner: string;
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Done' | 'Skipped';
}

export interface TrainingAsset {
  id: string;
  name: string;
  url: string;
}

export interface RolloutData {
  rolloutStrategy: 'Internal Only' | 'Pilot Clients' | 'Gradual Rollout' | 'All Clients' | 'Client-By-Client';
  rolloutSummary: string;
  clientRollouts: ClientRollout[];
  rolloutChecklist: RolloutChecklistItem[];
  internalAnnouncementNotes: string;
  clientCommsTemplateLink: string;
  clientApprovals: string;
  trainingRequired: boolean;
  trainingAssets: TrainingAsset[];
  internalTrainingComplete: boolean;
  clientTrainingComplete: boolean;
  monitoringPlan: string;
  keyMetrics: string[];
  rollbackPlan: string;
  rolloutComplete: boolean;
  completionDate: string;
  postMortemLearnings: string;
}

export type FeaturePriority = 'P0 – Critical' | 'P1 – High' | 'P2 – Medium' | 'P3 – Low';
export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type ExtendedFeatureStatus = 
  | 'Backlog' | 'Discovery' | 'In Design' | 'Ready for Dev' 
  | 'In Dev' | 'QA' | 'Ready for Rollout' | 'Rolled Out' | 'On Hold' | 'Cancelled';

export interface OverviewData {
  description: string;
  priority: FeaturePriority;
  effortSize: EffortSize;
  estimatedDevDays: number | null;
  stakeholders: string[];
  sendDueDateReminder: boolean;
  notifyOnChange: boolean;
}
