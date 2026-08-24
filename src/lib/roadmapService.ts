import { supabase } from "@/integrations/supabase/client";
import type { ProductCategory, ReleaseVersion, Feature } from "@/types/roadmap";

// Product Categories
export const fetchProductCategories = async (): Promise<ProductCategory[]> => {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data || [];
};

// Release Versions
export const fetchReleaseVersions = async (): Promise<ReleaseVersion[]> => {
  const { data, error } = await supabase
    .from('release_versions')
    .select('*')
    .order('sort_order');
  
  if (error) throw error;
  return data || [];
};

// Features
export const fetchFeatures = async (): Promise<Feature[]> => {
  const { data, error } = await supabase
    .from('features')
    .select(`
      *,
      product_category:product_categories(id, name, description, color),
      release_version:release_versions(id, name, year, quarter, sort_order, is_backlog)
    `)
    .order('sort_order');
  
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    feature_level: row.feature_level as any,
    feature_type: row.feature_type as any,
    status: row.status as any,
    product_category: row.product_category ? {
      id: row.product_category.id,
      name: row.product_category.name,
      description: row.product_category.description,
      color: row.product_category.color,
      created_at: new Date().toISOString()
    } : undefined,
    release_version: row.release_version ? {
      id: row.release_version.id,
      name: row.release_version.name,
      year: row.release_version.year,
      quarter: row.release_version.quarter,
      sort_order: row.release_version.sort_order,
      is_backlog: row.release_version.is_backlog,
      created_at: new Date().toISOString()
    } : undefined
  }));
};

export const createFeature = async (feature: Omit<Feature, "id" | "created_at" | "updated_at">): Promise<Feature> => {
  const { data, error } = await supabase
    .from('features')
    .insert([feature])
    .select(`
      *,
      product_category:product_categories(id, name, description, color),
      release_version:release_versions(id, name, year, quarter, sort_order, is_backlog)
    `)
    .single();
  
  if (error) throw error;
  return {
    ...data,
    feature_level: data.feature_level as any,
    feature_type: data.feature_type as any,
    status: data.status as any,
    product_category: data.product_category ? {
      id: data.product_category.id,
      name: data.product_category.name,
      description: data.product_category.description,
      color: data.product_category.color,
      created_at: new Date().toISOString()
    } : undefined,
    release_version: data.release_version ? {
      id: data.release_version.id,
      name: data.release_version.name,
      year: data.release_version.year,
      quarter: data.release_version.quarter,
      sort_order: data.release_version.sort_order,
      is_backlog: data.release_version.is_backlog,
      created_at: new Date().toISOString()
    } : undefined
  };
};

export const updateFeature = async (id: string, updates: Partial<Feature>): Promise<Feature> => {
  const { data, error } = await supabase
    .from('features')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      product_category:product_categories(id, name, description, color),
      release_version:release_versions(id, name, year, quarter, sort_order, is_backlog)
    `)
    .single();
  
  if (error) {
    console.error('Supabase update error:', error);
    throw error;
  }
  if (!data) {
    const notFoundError = new Error("Feature not found");
    console.error('Feature not found after update');
    throw notFoundError;
  }
  
  return {
    ...data,
    feature_level: data.feature_level as any,
    feature_type: data.feature_type as any,
    status: data.status as any,
    product_category: data.product_category ? {
      id: data.product_category.id,
      name: data.product_category.name,
      description: data.product_category.description,
      color: data.product_category.color,
      created_at: new Date().toISOString()
    } : undefined,
    release_version: data.release_version ? {
      id: data.release_version.id,
      name: data.release_version.name,
      year: data.release_version.year,
      quarter: data.release_version.quarter,
      sort_order: data.release_version.sort_order,
      is_backlog: data.release_version.is_backlog,
      created_at: new Date().toISOString()
    } : undefined
  };
};

export const deleteFeature = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('features')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};
