import { supabase } from './supabase';

/**
 * Google Docs API Integration
 * This module provides functions to read from and write to Google Docs
 * 
 * SECURITY NOTE: This implementation uses Supabase Edge Functions to securely
 * handle API keys on the server side. API keys are never exposed to the client.
 * 
 * For local development or if Edge Functions are not deployed, it can fall back
 * to direct API calls (not recommended for production).
 */

// Get API key from environment (only used as fallback for local development)
const GOOGLE_DOCS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_DOCS_API_KEY || '';

// Validate API key on module load
if (!GOOGLE_DOCS_API_KEY) {
  console.info('ℹ️ Google Docs functionality will use Supabase Edge Functions (recommended).');
} else {
  console.warn('⚠️ EXPO_PUBLIC_GOOGLE_DOCS_API_KEY is set. For production, use Supabase Edge Functions instead.');
}

/**
 * Read content from a Google Doc using Supabase Edge Function (secure)
 * @param documentId - The Google Doc ID (from the URL)
 * @returns The document content as structured data
 */
export const readGoogleDoc = async (documentId: string) => {
  try {
    // Use Supabase Edge Function for secure API key handling
    const { data, error } = await supabase.functions.invoke('google-docs-read', {
      body: { 
        documentId,
        operation: 'read'
      }
    });
    
    if (error) {
      console.error('Error reading Google Doc:', error);
      return {
        success: false,
        error: error.message || 'Failed to read Google Doc'
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to read Google Doc'
      };
    }
    
    return {
      success: true,
      data: data.data,
      title: data.data.title,
      body: data.data.body
    };
  } catch (error: any) {
    console.error('Error reading Google Doc:', error);
    return {
      success: false,
      error: error.message || 'Failed to read Google Doc'
    };
  }
};

/**
 * Extract plain text from Google Doc (via Edge Function)
 * @param documentId - The Google Doc ID
 * @returns Plain text content
 */
export const extractTextFromDoc = async (documentId: string): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-docs-read', {
      body: { 
        documentId,
        operation: 'extractText'
      }
    });
    
    if (error || !data.success) {
      console.error('Error extracting text:', error || data.error);
      return '';
    }
    
    return data.data;
  } catch (error: any) {
    console.error('Error extracting text from Google Doc:', error);
    return '';
  }
};

/**
 * Write content to a Google Doc
 * Note: Writing to Google Docs requires OAuth 2.0, not just an API key
 * This function requires a service account or OAuth token
 * @param documentId - The Google Doc ID
 * @param content - The content to write
 * @param insertIndex - Where to insert the content (default: end of document)
 */
export const writeToGoogleDoc = async (
  documentId: string,
  content: string,
  insertIndex?: number
) => {
  try {
    // Note: This requires OAuth 2.0 authentication
    // For now, we'll provide a placeholder that explains the limitation
    console.warn('Writing to Google Docs requires OAuth 2.0 authentication.');
    console.warn('Please set up OAuth credentials for full write support.');
    
    return {
      success: false,
      error: 'Writing requires OAuth 2.0 - API key authentication is read-only'
    };
  } catch (error: any) {
    console.error('Error writing to Google Doc:', error);
    return {
      success: false,
      error: error.message || 'Failed to write to Google Doc'
    };
  }
};

/**
 * Append text to the end of a Google Doc
 * @param documentId - The Google Doc ID
 * @param text - The text to append
 */
export const appendToGoogleDoc = async (documentId: string, text: string) => {
  return writeToGoogleDoc(documentId, text);
};

/**
 * Parse Google Doc as CSV-like table data (via Edge Function)
 * Useful for importing league data from a Google Sheet or table in a Doc
 * @param documentId - The Google Doc ID
 * @returns Array of rows with data
 */
export const parseDocAsTable = async (documentId: string): Promise<string[][]> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-docs-read', {
      body: { 
        documentId,
        operation: 'parseTable'
      }
    });
    
    if (error || !data.success) {
      console.error('Error parsing table:', error || data.error);
      return [];
    }
    
    return data.data;
  } catch (error: any) {
    console.error('Error parsing Google Doc table:', error);
    return [];
  }
};

/**
 * Check if Google Docs API is configured
 * @returns true if Edge Function is available
 */
export const isGoogleDocsConfigured = async (): Promise<boolean> => {
  try {
    // Check if the Edge Function is available
    const { error } = await supabase.functions.invoke('google-docs-read', {
      body: { documentId: '' }  // Will fail validation but confirms function exists
    });
    
    // If we get a validation error (not a 404), the function exists and is configured
    if (error && error.message?.includes('not found')) {
      console.warn('Google Docs Edge Function not deployed');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking Google Docs configuration:', error);
    return false;
  }
};

/**
 * Export league data to Google Doc format
 * @param leagueData - The league data to export
 * @returns Formatted text ready for Google Doc
 */
export const formatLeagueDataForDoc = (leagueData: any): string => {
  let output = `# ${leagueData.name}\n\n`;
  output += `Season: ${leagueData.current_season}\n`;
  output += `Salary Cap: $${leagueData.salary_cap}\n\n`;
  
  if (leagueData.teams) {
    output += `## Teams\n\n`;
    leagueData.teams.forEach((team: any) => {
      output += `### ${team.team_name} (${team.owner_name})\n`;
      if (team.capSummary) {
        output += `- Cap Room: $${team.capSummary.cap_room}\n`;
        output += `- Active Contracts: ${team.capSummary.active_contracts}\n`;
      }
      output += `\n`;
    });
  }
  
  return output;
};

export default {
  readGoogleDoc,
  writeToGoogleDoc,
  appendToGoogleDoc,
  extractTextFromDoc,
  parseDocAsTable,
  isGoogleDocsConfigured,
  formatLeagueDataForDoc
};
