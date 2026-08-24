import { supabase } from "@/integrations/supabase/client";
import { groupKeyForRequestType } from "@/lib/pm/requestTypes";

/** Fan out new_request notifications via SECURITY DEFINER RPC (prefs + recipient set). */
export async function fanoutNewRequestNotifications(params: {
  projectId: string;
  title: string;
  requestType?: string | null;
  clientId?: string | null;
  actorId?: string | null;
}) {
  const { error } = await supabase.rpc("fanout_new_request_notifications" as any, {
    p_project_id: params.projectId,
    p_title: params.title,
    p_group_key: groupKeyForRequestType(params.requestType),
    p_client_id: params.clientId ?? null,
    p_request_type: params.requestType ?? null,
    p_actor_id: params.actorId ?? null,
  });
  if (error) console.error("fanout_new_request_notifications", error);
}
