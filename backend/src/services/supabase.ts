import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
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
  const client = getSupabaseClient();

  const { data, error } = await client.functions.invoke(functionName, {
    body: body,
  });

  if (error) {
    throw new Error(`Supabase function error: ${error.message}`);
  }

  return data as T;
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
}) {
  return callSupabaseFunction('google-docs-api', params);
}

/**
 * Call secure API proxy through Supabase Edge Function
 * This provides a generic way to call any API through Supabase
 */
export async function callSecureApiProxy(params: {
  service: 'google-docs' | 'google-sheets' | 'sleeper' | 'custom';
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}) {
  return callSupabaseFunction('secure-api-proxy', params);
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
