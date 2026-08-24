import { 
  Customer, 
  CustomerType, 
  CustomerStatus,
  Doc, 
  DocType,
  DocAudience,
  Integration, 
  IntegrationCategory,
  IntegrationStatus,
  IntegrationHealth,
  IntegrationDirectionality,
  Activity,
  ActivityType,
  ActivityAction
} from "@/types";
import { supabase } from "@/integrations/supabase/client";

// Customers
export const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    type: row.type as CustomerType,
    status: row.status as CustomerStatus,
    go_live_date: row.go_live_date || null,
    region: row.region || null,
    segment: row.segment || null,
    owner: row.owner || null,
    site_url: row.site_url || null,
    dashboard_url: row.dashboard_url || null,
    notes: row.notes || '',
    updated_at: row.updated_at
  }));
};

export const createCustomer = async (customer: Omit<Customer, "id" | "updated_at">): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    type: data.type as CustomerType,
    status: data.status as CustomerStatus,
    go_live_date: data.go_live_date || null,
    region: data.region || null,
    segment: data.segment || null,
    owner: data.owner || null,
    site_url: data.site_url || null,
    dashboard_url: data.dashboard_url || null,
    notes: data.notes || '',
    updated_at: data.updated_at
  };
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  if (!data) throw new Error("Customer not found");
  return {
    ...data,
    type: data.type as CustomerType,
    status: data.status as CustomerStatus,
    go_live_date: data.go_live_date || null,
    region: data.region || null,
    segment: data.segment || null,
    owner: data.owner || null,
    site_url: data.site_url || null,
    dashboard_url: data.dashboard_url || null,
    notes: data.notes || '',
    updated_at: data.updated_at
  };
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Docs
export const fetchDocs = async (): Promise<Doc[]> => {
  const { data, error } = await supabase
    .from('docs')
    .select('*')
    .order('last_updated', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    type: row.type as DocType,
    audience: row.audience as DocAudience,
    owner: row.owner || null,
    tags: row.tags || []
  }));
};

export const createDoc = async (doc: Omit<Doc, "id" | "last_updated" | "views_30d">): Promise<Doc> => {
  const { data, error } = await supabase
    .from('docs')
    .insert([{ ...doc, views_30d: 0 }])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    type: data.type as DocType,
    audience: data.audience as DocAudience,
    owner: data.owner || null,
    tags: data.tags || []
  };
};

export const updateDoc = async (id: string, updates: Partial<Doc>): Promise<Doc> => {
  const { data, error } = await supabase
    .from('docs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  if (!data) throw new Error("Doc not found");
  return {
    ...data,
    type: data.type as DocType,
    audience: data.audience as DocAudience,
    owner: data.owner || null,
    tags: data.tags || []
  };
};

export const deleteDoc = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('docs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Integrations
export const fetchIntegrations = async (): Promise<Integration[]> => {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .order('last_updated', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    category: row.category as IntegrationCategory,
    status: row.status as IntegrationStatus,
    health: row.health as IntegrationHealth,
    directionality: row.directionality as IntegrationDirectionality,
    version: row.version || null,
    docs_link: row.docs_link || null,
    owner: row.owner || null,
    capabilities: row.capabilities || []
  }));
};

export const createIntegration = async (integration: Omit<Integration, "id" | "last_updated">): Promise<Integration> => {
  const { data, error } = await supabase
    .from('integrations')
    .insert([integration])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    category: data.category as IntegrationCategory,
    status: data.status as IntegrationStatus,
    health: data.health as IntegrationHealth,
    directionality: data.directionality as IntegrationDirectionality,
    version: data.version || null,
    docs_link: data.docs_link || null,
    owner: data.owner || null,
    capabilities: data.capabilities || []
  };
};

export const updateIntegration = async (id: string, updates: Partial<Integration>): Promise<Integration> => {
  const { data, error } = await supabase
    .from('integrations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  if (!data) throw new Error("Integration not found");
  return {
    ...data,
    category: data.category as IntegrationCategory,
    status: data.status as IntegrationStatus,
    health: data.health as IntegrationHealth,
    directionality: data.directionality as IntegrationDirectionality,
    version: data.version || null,
    docs_link: data.docs_link || null,
    owner: data.owner || null,
    capabilities: data.capabilities || []
  };
};

export const deleteIntegration = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Activities
export const fetchActivity = async (): Promise<Activity[]> => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    type: row.type as ActivityType,
    action: row.action as ActivityAction
  }));
};

export const createActivity = async (activity: Omit<Activity, "id" | "timestamp">): Promise<Activity> => {
  const { data, error } = await supabase
    .from('activities')
    .insert([activity])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    type: data.type as ActivityType,
    action: data.action as ActivityAction
  };
};

// Loom Videos
export const fetchLoomVideos = async (): Promise<import("@/types").LoomVideo[]> => {
  const { data, error } = await supabase
    .from('loom_videos')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('last_updated', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    thumbnail_url: row.thumbnail_url || null,
    duration: row.duration || null,
    folder: row.folder || null,
    tags: row.tags || []
  }));
};

export const createLoomVideo = async (video: Omit<import("@/types").LoomVideo, "id" | "last_updated" | "created_at">): Promise<import("@/types").LoomVideo> => {
  const { data, error } = await supabase
    .from('loom_videos')
    .insert([video])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    thumbnail_url: data.thumbnail_url || null,
    duration: data.duration || null,
    folder: data.folder || null,
    tags: data.tags || []
  };
};

export const updateLoomVideo = async (id: string, updates: Partial<import("@/types").LoomVideo>): Promise<import("@/types").LoomVideo> => {
  const { data, error } = await supabase
    .from('loom_videos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  if (!data) throw new Error("Loom video not found");
  return {
    ...data,
    thumbnail_url: data.thumbnail_url || null,
    duration: data.duration || null,
    folder: data.folder || null,
    tags: data.tags || []
  };
};

export const deleteLoomVideo = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('loom_videos')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Admin / Sync functions (stubs)
export const syncFromClickUp = async (config: { baseUrl: string; token: string }) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  void config;
  // Stub: would fetch from ClickUp API and update database
  return { success: true, message: "Sync completed (stub)" };
};
