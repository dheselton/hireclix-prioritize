import { supabase } from "@/integrations/supabase/client";

interface SendReminderParams {
  type: 'due_date' | 'overdue' | 'status_change' | 'assignment' | 'stakeholder_assignment';
  featureId: string;
  featureTitle: string;
  assignees: string[];
  dueDate?: string;
  status?: string;
  message?: string;
  summary?: string;
  category?: string;
  releaseVersion?: string;
}

export async function sendReminder(params: SendReminderParams): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Sending reminder:", params);
    
    const { data, error } = await supabase.functions.invoke('send-reminder-email', {
      body: params,
    });

    if (error) {
      console.error("Error sending reminder:", error);
      return { success: false, error: error.message };
    }

    console.log("Reminder sent successfully:", data);
    return { success: true };
  } catch (err: any) {
    console.error("Exception sending reminder:", err);
    return { success: false, error: err.message };
  }
}

export async function sendDueDateReminder(feature: {
  id: string;
  title: string;
  assignees: string[];
  due_date?: string;
  status: string;
}) {
  if (!feature.assignees?.length) {
    return { success: false, error: "No assignees to notify" };
  }

  return sendReminder({
    type: 'due_date',
    featureId: feature.id,
    featureTitle: feature.title,
    assignees: feature.assignees,
    dueDate: feature.due_date,
    status: feature.status,
  });
}

export async function sendOverdueReminder(feature: {
  id: string;
  title: string;
  assignees: string[];
  due_date?: string;
  status: string;
}) {
  if (!feature.assignees?.length) {
    return { success: false, error: "No assignees to notify" };
  }

  return sendReminder({
    type: 'overdue',
    featureId: feature.id,
    featureTitle: feature.title,
    assignees: feature.assignees,
    dueDate: feature.due_date,
    status: feature.status,
  });
}

export async function sendAssignmentNotification(feature: {
  id: string;
  title: string;
  assignees: string[];
  due_date?: string;
  status: string;
  summary?: string;
  category?: string;
  releaseVersion?: string;
}) {
  if (!feature.assignees?.length) {
    return { success: false, error: "No assignees to notify" };
  }

  return sendReminder({
    type: 'assignment',
    featureId: feature.id,
    featureTitle: feature.title,
    assignees: feature.assignees,
    dueDate: feature.due_date,
    status: feature.status,
    summary: feature.summary,
    category: feature.category,
    releaseVersion: feature.releaseVersion,
  });
}

export async function sendStakeholderNotification(feature: {
  id: string;
  title: string;
  stakeholders: string[];
  due_date?: string;
  status: string;
  summary?: string;
  category?: string;
  releaseVersion?: string;
}) {
  if (!feature.stakeholders?.length) {
    return { success: false, error: "No stakeholders to notify" };
  }

  return sendReminder({
    type: 'stakeholder_assignment',
    featureId: feature.id,
    featureTitle: feature.title,
    assignees: feature.stakeholders,
    dueDate: feature.due_date,
    status: feature.status,
    summary: feature.summary,
    category: feature.category,
    releaseVersion: feature.releaseVersion,
  });
}

export async function sendStatusChangeNotification(
  feature: {
    id: string;
    title: string;
    assignees: string[];
    due_date?: string;
  },
  newStatus: string
) {
  if (!feature.assignees?.length) {
    return { success: false, error: "No assignees to notify" };
  }

  return sendReminder({
    type: 'status_change',
    featureId: feature.id,
    featureTitle: feature.title,
    assignees: feature.assignees,
    dueDate: feature.due_date,
    status: newStatus,
  });
}
