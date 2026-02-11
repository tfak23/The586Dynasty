import { google } from 'googleapis';

/**
 * Google Docs API Integration
 * This module provides functions to read from and write to Google Docs using an API key
 */

// Get API key from environment
const GOOGLE_DOCS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_DOCS_API_KEY || '';

// Initialize Google Docs API client
const docs = google.docs({
  version: 'v1',
  auth: GOOGLE_DOCS_API_KEY
});

/**
 * Read content from a Google Doc
 * @param documentId - The Google Doc ID (from the URL)
 * @returns The document content as structured data
 */
export const readGoogleDoc = async (documentId: string) => {
  try {
    const response = await docs.documents.get({
      documentId,
    });
    
    return {
      success: true,
      data: response.data,
      title: response.data.title,
      body: response.data.body
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
 * Extract plain text from Google Doc content
 * @param document - The Google Doc data from readGoogleDoc
 * @returns Plain text content
 */
export const extractTextFromDoc = (document: any): string => {
  if (!document || !document.body || !document.body.content) {
    return '';
  }
  
  let text = '';
  
  const processContent = (content: any[]) => {
    content.forEach((element: any) => {
      if (element.paragraph) {
        element.paragraph.elements.forEach((el: any) => {
          if (el.textRun && el.textRun.content) {
            text += el.textRun.content;
          }
        });
      } else if (element.table) {
        element.table.tableRows.forEach((row: any) => {
          row.tableCells.forEach((cell: any) => {
            if (cell.content) {
              processContent(cell.content);
            }
          });
        });
      }
    });
  };
  
  processContent(document.body.content);
  return text;
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
 * Parse Google Doc as CSV-like table data
 * Useful for importing league data from a Google Sheet or table in a Doc
 * @param document - The Google Doc data
 * @returns Array of rows with data
 */
export const parseDocAsTable = (document: any): string[][] => {
  if (!document || !document.body || !document.body.content) {
    return [];
  }
  
  const rows: string[][] = [];
  
  document.body.content.forEach((element: any) => {
    if (element.table) {
      element.table.tableRows.forEach((row: any) => {
        const rowData: string[] = [];
        row.tableCells.forEach((cell: any) => {
          let cellText = '';
          if (cell.content) {
            cell.content.forEach((content: any) => {
              if (content.paragraph) {
                content.paragraph.elements.forEach((el: any) => {
                  if (el.textRun && el.textRun.content) {
                    cellText += el.textRun.content.trim();
                  }
                });
              }
            });
          }
          rowData.push(cellText);
        });
        rows.push(rowData);
      });
    }
  });
  
  return rows;
};

/**
 * Check if Google Docs API is configured
 * @returns true if API key is set
 */
export const isGoogleDocsConfigured = (): boolean => {
  return !!GOOGLE_DOCS_API_KEY && GOOGLE_DOCS_API_KEY.length > 0;
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
