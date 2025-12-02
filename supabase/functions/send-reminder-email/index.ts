import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
}

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

    const { type, featureId, featureTitle, assignees, dueDate, status, message, summary }: ReminderRequest = await req.json();

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

    switch (type) {
      case "due_date":
        subject = `📅 Reminder: "${featureTitle}" is due soon`;
        htmlContent = `
          <h2>Feature Due Date Reminder</h2>
          <p>The feature <strong>"${featureTitle}"</strong> is due on <strong>${dueDate}</strong>.</p>
          <p>Current status: ${status || "Unknown"}</p>
          <p>Please ensure this feature is on track for completion.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated reminder from HireClix Product Roadmap.</p>
        `;
        break;

      case "overdue":
        subject = `⚠️ OVERDUE: "${featureTitle}" has passed its due date`;
        htmlContent = `
          <h2 style="color: #dc2626;">Feature Overdue Alert</h2>
          <p>The feature <strong>"${featureTitle}"</strong> was due on <strong>${dueDate}</strong> and is now overdue.</p>
          <p>Current status: ${status || "Unknown"}</p>
          <p><strong>Immediate attention required.</strong></p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated alert from HireClix Product Roadmap.</p>
        `;
        break;

      case "status_change":
        subject = `🔄 Status Update: "${featureTitle}"`;
        htmlContent = `
          <h2>Feature Status Changed</h2>
          <p>The status of <strong>"${featureTitle}"</strong> has been updated to <strong>${status}</strong>.</p>
          ${dueDate ? `<p>Due date: ${dueDate}</p>` : ""}
          ${message ? `<p>${message}</p>` : ""}
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from HireClix Product Roadmap.</p>
        `;
        break;

      case "assignment":
        subject = `👋 You've been assigned to: "${featureTitle}"`;
        htmlContent = `
          <h2>New Feature Assignment</h2>
          <p>You have been assigned to the feature <strong>"${featureTitle}"</strong>.</p>
          ${summary ? `<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;"><strong>Summary:</strong><br/>${summary}</div>` : ""}
          ${status ? `<p><strong>Current status:</strong> ${status}</p>` : ""}
          ${dueDate ? `<p><strong>Due date:</strong> ${dueDate}</p>` : ""}
          ${message ? `<p>${message}</p>` : ""}
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from HireClix Product Roadmap.</p>
        `;
        break;

      case "stakeholder_assignment":
        subject = `📋 You've been added as stakeholder to: "${featureTitle}"`;
        htmlContent = `
          <h2>Stakeholder Assignment</h2>
          <p>You have been added as a stakeholder to the feature <strong>"${featureTitle}"</strong>.</p>
          ${summary ? `<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin: 16px 0;"><strong>Summary:</strong><br/>${summary}</div>` : ""}
          ${status ? `<p><strong>Current status:</strong> ${status}</p>` : ""}
          ${dueDate ? `<p><strong>Due date:</strong> ${dueDate}</p>` : ""}
          <p>As a stakeholder, you'll be kept informed of progress on this feature.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from HireClix Product Roadmap.</p>
        `;
        break;

      default:
        subject = `📋 Update: "${featureTitle}"`;
        htmlContent = `
          <h2>Feature Update</h2>
          <p>${message || `There's an update for the feature "${featureTitle}".`}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from HireClix Product Roadmap.</p>
        `;
    }

    const emailResponse = await resend.emails.send({
      from: "HireClix Roadmap <onboarding@resend.dev>",
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
