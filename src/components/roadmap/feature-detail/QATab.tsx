import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { SmartTextarea } from "@/components/ui/smart-textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { QAData, TestScenario, AutomatedTest } from "@/types/featureDetail";

interface QATabProps {
  data: QAData;
  onChange: (data: QAData) => void;
}

const TEST_TYPES = ['Happy Path', 'Edge Case', 'Negative', 'Regression'] as const;
const TEST_STATUSES = ['Not Run', 'Pass', 'Fail', 'Blocked'] as const;
const AUTOMATED_TEST_TYPES = ['Unit', 'Integration', 'E2E'] as const;
const BROWSERS = ['chrome', 'safari', 'firefox', 'edge'] as const;
const DEVICES = ['desktop', 'tablet', 'mobile'] as const;

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function QATab({ data, onChange }: QATabProps) {
  const addTestScenario = () => {
    const newScenario: TestScenario = {
      id: `TS-${data.testScenarios.length + 1}`,
      description: '',
      type: 'Happy Path',
      relatedAC: '',
      status: 'Not Run',
      notes: ''
    };
    onChange({ ...data, testScenarios: [...data.testScenarios, newScenario] });
  };

  const updateTestScenario = (index: number, scenario: TestScenario) => {
    const updated = [...data.testScenarios];
    updated[index] = scenario;
    onChange({ ...data, testScenarios: updated });
  };

  const removeTestScenario = (index: number) => {
    onChange({ ...data, testScenarios: data.testScenarios.filter((_, i) => i !== index) });
  };

  const addAutomatedTest = () => {
    const newTest: AutomatedTest = {
      id: generateId(),
      area: '',
      type: 'Unit',
      coverageNotes: ''
    };
    onChange({ ...data, automatedTests: [...data.automatedTests, newTest] });
  };

  const updateAutomatedTest = (index: number, test: AutomatedTest) => {
    const updated = [...data.automatedTests];
    updated[index] = test;
    onChange({ ...data, automatedTests: updated });
  };

  const removeAutomatedTest = (index: number) => {
    onChange({ ...data, automatedTests: data.automatedTests.filter((_, i) => i !== index) });
  };

  const toggleBrowser = (device: typeof DEVICES[number], browser: typeof BROWSERS[number]) => {
    const currentDevice = data.devicesBrowsers[device];
    onChange({
      ...data,
      devicesBrowsers: {
        ...data.devicesBrowsers,
        [device]: {
          ...currentDevice,
          [browser]: !currentDevice[browser]
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* QA Owner */}
      <div>
        <Label>QA Owner <span className="text-destructive">*</span></Label>
        <AssigneePicker
          value={data.qaOwner ? [data.qaOwner] : []}
          onChange={(assignees) => onChange({ ...data, qaOwner: assignees[0] || '' })}
        />
      </div>

      {/* Testing Scope Summary */}
      <div>
        <Label>Testing Scope Summary</Label>
        <SmartTextarea
          value={data.testingScopeSummary}
          onChange={(e) => onChange({ ...data, testingScopeSummary: e.target.value })}
          rows={3}
          placeholder="What will be tested, what won't, and any special constraints"
        />
        <p className="text-xs text-muted-foreground mt-1">What will be tested, what won't, and any special constraints.</p>
      </div>

      {/* Test Scenarios */}
      <div>
        <Label>Test Scenarios</Label>
        <RepeatableList
          items={data.testScenarios}
          onAdd={addTestScenario}
          onRemove={removeTestScenario}
          addLabel="Add Test Scenario"
          emptyMessage="No test scenarios defined."
          renderItem={(scenario, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{scenario.id}</Badge>
                <Select
                  value={scenario.type}
                  onValueChange={(v) => updateTestScenario(index, { ...scenario, type: v as typeof TEST_TYPES[number] })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={scenario.status}
                  onValueChange={(v) => updateTestScenario(index, { ...scenario, status: v as typeof TEST_STATUSES[number] })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SmartTextarea
                value={scenario.description}
                onChange={(e) => updateTestScenario(index, { ...scenario, description: e.target.value })}
                placeholder="Test scenario description"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={scenario.relatedAC}
                  onChange={(e) => updateTestScenario(index, { ...scenario, relatedAC: e.target.value })}
                  placeholder="Related AC (e.g., AC-1)"
                />
                <Input
                  value={scenario.notes}
                  onChange={(e) => updateTestScenario(index, { ...scenario, notes: e.target.value })}
                  placeholder="Notes / Bug Link"
                />
              </div>
            </div>
          )}
        />
      </div>

      {/* Devices & Browsers Matrix */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Devices & Browsers Matrix</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-2"></th>
                {BROWSERS.map(browser => (
                  <th key={browser} className="text-center py-2 px-2 capitalize">{browser}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEVICES.map(device => (
                <tr key={device} className="border-t border-border">
                  <td className="py-2 px-2 capitalize font-medium">{device}</td>
                  {BROWSERS.map(browser => (
                    <td key={browser} className="text-center py-2 px-2">
                      <Checkbox
                        checked={data.devicesBrowsers[device][browser]}
                        onCheckedChange={() => toggleBrowser(device, browser)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Data Requirements */}
      <div>
        <Label>Test Data Requirements</Label>
        <SmartTextarea
          value={data.testDataRequirements}
          onChange={(e) => onChange({ ...data, testDataRequirements: e.target.value })}
          rows={3}
          placeholder="Fake accounts, staging clients, seed data, feature flags required"
        />
        <p className="text-xs text-muted-foreground mt-1">Fake accounts, staging clients, seed data, feature flags required.</p>
      </div>

      {/* Automated Tests */}
      <div>
        <Label>Automated Tests</Label>
        <RepeatableList
          items={data.automatedTests}
          onAdd={addAutomatedTest}
          onRemove={removeAutomatedTest}
          addLabel="Add Automated Test"
          emptyMessage="No automated tests defined."
          renderItem={(test, index) => (
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <Input
                  value={test.area}
                  onChange={(e) => updateAutomatedTest(index, { ...test, area: e.target.value })}
                  placeholder="Area (e.g., Job Search)"
                  className="flex-1"
                />
                <Select
                  value={test.type}
                  onValueChange={(v) => updateAutomatedTest(index, { ...test, type: v as typeof AUTOMATED_TEST_TYPES[number] })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATED_TEST_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={test.coverageNotes}
                onChange={(e) => updateAutomatedTest(index, { ...test, coverageNotes: e.target.value })}
                placeholder="Coverage notes"
              />
            </div>
          )}
        />
      </div>

      {/* Regression Areas */}
      <div>
        <Label>Regression Areas to Check</Label>
        <SmartTextarea
          value={data.regressionAreas}
          onChange={(e) => onChange({ ...data, regressionAreas: e.target.value })}
          rows={3}
          placeholder="Areas that need regression testing"
        />
      </div>

      {/* Sign-off */}
      <div className="space-y-3 p-4 border border-border rounded-lg bg-card/50">
        <h4 className="text-sm font-medium">Sign-off</h4>
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-normal">Ready for Rollout?</Label>
          </div>
          <Switch
            checked={data.signOff.readyForRollout}
            onCheckedChange={(checked) => onChange({
              ...data,
              signOff: { ...data.signOff, readyForRollout: checked }
            })}
          />
        </div>
        <div>
          <Label>Sign-off By</Label>
          <AssigneePicker
            value={data.signOff.signOffBy ? [data.signOff.signOffBy] : []}
            onChange={(assignees) => onChange({
              ...data,
              signOff: { ...data.signOff, signOffBy: assignees[0] || '' }
            })}
          />
        </div>
        <div>
          <Label>Sign-off Date</Label>
          <DatePicker
            value={data.signOff.signOffDate}
            onChange={(v) => onChange({
              ...data,
              signOff: { ...data.signOff, signOffDate: v ?? '' }
            })}
          />
        </div>
        <div>
          <Label>Sign-off Notes</Label>
          <SmartTextarea
            value={data.signOff.signOffNotes}
            onChange={(e) => onChange({
              ...data,
              signOff: { ...data.signOff, signOffNotes: e.target.value }
            })}
            rows={2}
            placeholder="Any notes or conditions"
          />
        </div>
      </div>
    </div>
  );
}
