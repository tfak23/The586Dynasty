import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase configuration from environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

/**
 * Call a Supabase Edge Function
 * @param functionName - Name of the Edge Function to call
 * @param body - Request body to send to the function
 */
export async function callSupabaseFunction<T = any>(
  functionName: string,
  body: any
): Promise<T> {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client.functions.invoke(functionName, {
      body: JSON.stringify(body),
    });

    if (error) {
      throw new Error(`Supabase function error: ${error.message}`);
    }

    return data as T;
  } catch (error) {
    console.error(`Error calling Supabase function ${functionName}:`, error);
    throw error;
  }
}

/**
 * Call Google Docs API through Supabase Edge Function
 * This keeps API keys secure on the backend
 */
export async function callGoogleDocsApi(params: {
  action: 'read' | 'write' | 'create' | 'update';
  documentId?: string;
  content?: any;
  title?: string;
}): Promise<any> {
  return callSupabaseFunction('google-docs-api', params);
}

/**
 * Call secure API proxy through Supabase Edge Function
 * This provides a generic way to call any API through Supabase without exposing keys
 */
export async function callSecureApiProxy(params: {
  service: 'google-docs' | 'google-sheets' | 'sleeper' | 'custom';
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}): Promise<any> {
  return callSupabaseFunction('secure-api-proxy', params);
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Example: Read a Google Doc
 */
export async function readGoogleDoc(documentId: string): Promise<any> {
  return callGoogleDocsApi({
    action: 'read',
    documentId,
  });
}

/**
 * Example: Update a Google Doc
 */
export async function updateGoogleDoc(documentId: string, content: any): Promise<any> {
  return callGoogleDocsApi({
    action: 'update',
    documentId,
    content,
  });
}

/**
 * Example: Create a new Google Doc
 */
export async function createGoogleDoc(title: string, content?: any): Promise<any> {
  return callGoogleDocsApi({
    action: 'create',
    title,
    content,
  });
}
