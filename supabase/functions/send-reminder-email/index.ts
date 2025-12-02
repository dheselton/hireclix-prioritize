import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// App URL for generating links to roadmap items
const APP_URL = Deno.env.get("APP_URL") || "https://aqdpshgmpgccujwwkdxd.lovableproject.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
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

// Navy blue color palette from the project design system
const colors = {
  primary: '#0f4c75',        // Navy blue (--primary: 209 75% 19%)
  primaryLight: '#3282b8',   // Lighter navy
  primaryDark: '#0b3954',    // Darker navy
  accent: '#bbe1fa',         // Light blue accent
  warning: '#f59e0b',        // Amber for due dates
  danger: '#dc2626',         // Red for overdue
  success: '#059669',        // Green for released
  text: '#1a1a2e',           // Dark text
  textMuted: '#64748b',      // Muted text
  textLight: '#94a3b8',      // Light text
  background: '#f8fafc',     // Light background
  white: '#ffffff',
};

// Email template styles
const styles = {
  container: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    background-color: ${colors.white};
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `,
  header: `
    padding: 32px 24px;
    text-align: center;
  `,
  headerTitle: `
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: ${colors.white};
  `,
  body: `
    padding: 32px 24px;
    background-color: ${colors.white};
  `,
  featureTitle: `
    font-size: 20px;
    font-weight: 600;
    color: ${colors.text};
    margin: 0 0 16px 0;
  `,
  infoBox: `
    background: linear-gradient(135deg, ${colors.background} 0%, #e2e8f0 100%);
    border-left: 4px solid ${colors.primary};
    padding: 16px 20px;
    border-radius: 0 8px 8px 0;
    margin: 20px 0;
  `,
  summaryBox: `
    background: ${colors.background};
    border: 1px solid #e5e5e5;
    padding: 16px 20px;
    border-radius: 8px;
    margin: 20px 0;
    font-size: 14px;
    line-height: 1.6;
    color: #4a4a4a;
  `,
  label: `
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${colors.textMuted};
    margin-bottom: 4px;
  `,
  value: `
    font-size: 15px;
    color: ${colors.text};
    margin: 0;
  `,
  button: `
    display: inline-block;
    background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%);
    color: ${colors.white};
    text-decoration: none;
    padding: 14px 28px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 15px;
    margin: 24px 0;
    box-shadow: 0 4px 14px rgba(15, 76, 117, 0.4);
  `,
  footer: `
    background: ${colors.background};
    padding: 24px;
    text-align: center;
    border-top: 1px solid #e2e8f0;
  `,
  footerText: `
    color: ${colors.textLight};
    font-size: 12px;
    margin: 0;
    line-height: 1.6;
  `,
  divider: `
    height: 1px;
    background: #e2e8f0;
    margin: 24px 0;
    border: none;
  `,
};

const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'Scope/Ideation': colors.primaryLight,
    'Design': '#ec4899',
    'In Development': colors.primary,
    'QA': colors.warning,
    'Approved': '#10b981',
    'Released': colors.success,
  };
  return statusColors[status] || colors.textMuted;
};

const getHeaderGradient = (type: string): string => {
  const gradients: Record<string, string> = {
    'due_date': `linear-gradient(135deg, ${colors.warning} 0%, #d97706 100%)`,
    'overdue': `linear-gradient(135deg, ${colors.danger} 0%, #b91c1c 100%)`,
    'status_change': `linear-gradient(135deg, ${colors.primaryLight} 0%, ${colors.primary} 100%)`,
    'assignment': `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
    'stakeholder_assignment': `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`,
  };
  return gradients[type] || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`;
};

const getIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'due_date': '📅',
    'overdue': '🚨',
    'status_change': '🔄',
    'assignment': '👋',
    'stakeholder_assignment': '📋',
  };
  return icons[type] || '📋';
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'Not set';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

const generateEmailHtml = (
  type: string,
  featureId: string,
  featureTitle: string,
  content: { heading: string; message: string; details?: string },
  metadata: { status?: string; dueDate?: string; summary?: string; category?: string; releaseVersion?: string }
): string => {
  const featureUrl = `${APP_URL}/roadmap?feature=${featureId}`;
  const headerBg = getHeaderGradient(type);
  const icon = getIcon(type);
  const statusColor = getStatusColor(metadata.status || '');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.heading}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #e2e8f0;">
  <div style="${styles.container}">
    <!-- Header -->
    <div style="${styles.header} background: ${headerBg};">
      <div style="font-size: 48px; margin-bottom: 12px;">${icon}</div>
      <h1 style="${styles.headerTitle}">${content.heading}</h1>
    </div>
    
    <!-- Body -->
    <div style="${styles.body}">
      <h2 style="${styles.featureTitle}">${featureTitle}</h2>
      
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        ${content.message}
      </p>
      
      ${content.details ? `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">${content.details}</p>` : ''}
      
      ${metadata.summary ? `
        <div style="${styles.summaryBox}">
          <div style="${styles.label}">Summary</div>
          <p style="margin: 8px 0 0 0; color: #374151;">${metadata.summary}</p>
        </div>
      ` : ''}
      
      <!-- Info Box -->
      <div style="${styles.infoBox}">
        <table style="width: 100%; border-collapse: collapse;">
          ${metadata.status ? `
            <tr>
              <td style="padding: 8px 0; vertical-align: top;">
                <div style="${styles.label}">Status</div>
                <span style="
                  display: inline-block;
                  background: ${statusColor}20;
                  color: ${statusColor};
                  padding: 4px 12px;
                  border-radius: 20px;
                  font-size: 13px;
                  font-weight: 600;
                ">${metadata.status}</span>
              </td>
            </tr>
          ` : ''}
          ${metadata.dueDate ? `
            <tr>
              <td style="padding: 8px 0;">
                <div style="${styles.label}">Due Date</div>
                <p style="${styles.value}">${formatDate(metadata.dueDate)}</p>
              </td>
            </tr>
          ` : ''}
          ${metadata.category ? `
            <tr>
              <td style="padding: 8px 0;">
                <div style="${styles.label}">Category</div>
                <p style="${styles.value}">${metadata.category}</p>
              </td>
            </tr>
          ` : ''}
          ${metadata.releaseVersion ? `
            <tr>
              <td style="padding: 8px 0;">
                <div style="${styles.label}">Release Version</div>
                <p style="${styles.value}">${metadata.releaseVersion}</p>
              </td>
            </tr>
          ` : ''}
        </table>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${featureUrl}" style="${styles.button}">
          View Feature in Roadmap →
        </a>
      </div>
      
      <hr style="${styles.divider}">
      
      <p style="color: ${colors.textMuted}; font-size: 13px; text-align: center; margin: 0;">
        Click the button above to view full details and take action on this feature.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="${styles.footer}">
      <p style="${styles.footerText}">
        This is an automated notification from <strong>HireClix Product Roadmap</strong>.<br>
        You're receiving this because you're assigned to or a stakeholder of this feature.
      </p>
      <p style="${styles.footerText}; margin-top: 12px;">
        <a href="${APP_URL}/roadmap" style="color: ${colors.primary}; text-decoration: none;">View All Features</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-reminder-email function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { type, featureId, featureTitle, assignees, dueDate, status, message, summary, category, releaseVersion }: ReminderRequest = await req.json();

    console.log("Processing reminder:", { type, featureTitle, assignees });

    // Get team member emails from the database
    const { data: teamMembers, error: teamError } = await supabaseClient
      .from("team_members")
      .select("name, email")
      .in("name", assignees);

    if (teamError) {
      console.error("Error fetching team members:", teamError);
      throw new Error("Failed to fetch team member emails");
    }

    if (!teamMembers || teamMembers.length === 0) {
      console.log("No team members found for assignees:", assignees);
      return new Response(
        JSON.stringify({ success: false, message: "No team members found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emails = teamMembers.map((tm) => tm.email);
    console.log("Sending emails to:", emails);

    let subject = "";
    let htmlContent = "";
    const metadata = { status, dueDate, summary, category, releaseVersion };

    switch (type) {
      case "due_date":
        subject = `📅 Due Soon: "${featureTitle}"`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "Due Date Reminder",
            message: `This feature is approaching its due date. Please ensure all tasks are on track for timely completion.`,
            details: "Review the feature progress and update the status if needed."
          },
          metadata
        );
        break;

      case "overdue":
        subject = `🚨 OVERDUE: "${featureTitle}" needs attention`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "Feature Overdue",
            message: `This feature has passed its due date and requires immediate attention.`,
            details: "Please review the blockers and update stakeholders on the revised timeline."
          },
          metadata
        );
        break;

      case "status_change":
        subject = `🔄 Status Update: "${featureTitle}" → ${status}`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "Status Changed",
            message: `The status of this feature has been updated. Review the changes and take any necessary follow-up actions.`,
            details: message
          },
          metadata
        );
        break;

      case "assignment":
        subject = `👋 You've been assigned: "${featureTitle}"`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "New Assignment",
            message: `You have been assigned to work on this feature. Please review the requirements and reach out to your team if you have questions.`,
          },
          metadata
        );
        break;

      case "stakeholder_assignment":
        subject = `📋 Stakeholder: "${featureTitle}"`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "Added as Stakeholder",
            message: `You have been added as a stakeholder for this feature. You'll receive updates on its progress and can provide feedback as needed.`,
          },
          metadata
        );
        break;

      default:
        subject = `📋 Update: "${featureTitle}"`;
        htmlContent = generateEmailHtml(
          type,
          featureId,
          featureTitle,
          {
            heading: "Feature Update",
            message: message || `There's an update on this feature that may require your attention.`,
          },
          metadata
        );
    }

    const emailResponse = await resend.emails.send({
      from: "HireClix Roadmap <noreply@product.hireclix.com>",
      to: emails,
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-reminder-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
