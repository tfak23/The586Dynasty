// Supabase Edge Function for Google Docs API Integration
// This function securely handles Google Docs API requests on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface RequestBody {
  documentId: string;
  operation?: 'read' | 'extractText' | 'parseTable';
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the Google Docs API key from Supabase environment variables
    const GOOGLE_DOCS_API_KEY = Deno.env.get('GOOGLE_DOCS_API_KEY')
    
    if (!GOOGLE_DOCS_API_KEY) {
      throw new Error('Google Docs API key not configured in Supabase environment variables')
    }

    // Parse request body
    const { documentId, operation = 'read' }: RequestBody = await req.json()

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'documentId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Make request to Google Docs API
    const url = `https://docs.googleapis.com/v1/documents/${documentId}?key=${GOOGLE_DOCS_API_KEY}`
    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Docs API error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch document from Google Docs API',
          details: errorText
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const document = await response.json()

    // Process based on operation type
    let result
    switch (operation) {
      case 'extractText':
        result = extractTextFromDoc(document)
        break
      case 'parseTable':
        result = parseDocAsTable(document)
        break
      default:
        result = {
          title: document.title,
          body: document.body,
          documentId: document.documentId
        }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in google-docs-read function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Extract plain text from Google Doc content
 */
function extractTextFromDoc(document: any): string {
  if (!document || !document.body || !document.body.content) {
    return ''
  }
  
  let text = ''
  
  const processContent = (content: any[]) => {
    content.forEach((element: any) => {
      if (element.paragraph) {
        element.paragraph.elements.forEach((el: any) => {
          if (el.textRun && el.textRun.content) {
            text += el.textRun.content
          }
        })
      } else if (element.table) {
        element.table.tableRows.forEach((row: any) => {
          row.tableCells.forEach((cell: any) => {
            if (cell.content) {
              processContent(cell.content)
            }
          })
        })
      }
    })
  }
  
  processContent(document.body.content)
  return text
}

/**
 * Parse Google Doc as CSV-like table data
 */
function parseDocAsTable(document: any): string[][] {
  if (!document || !document.body || !document.body.content) {
    return []
  }
  
  const rows: string[][] = []
  
  document.body.content.forEach((element: any) => {
    if (element.table) {
      element.table.tableRows.forEach((row: any) => {
        const rowData: string[] = []
        row.tableCells.forEach((cell: any) => {
          let cellText = ''
          if (cell.content) {
            cell.content.forEach((content: any) => {
              if (content.paragraph) {
                content.paragraph.elements.forEach((el: any) => {
                  if (el.textRun && el.textRun.content) {
                    cellText += el.textRun.content.trim()
                  }
                })
              }
            })
          }
          rowData.push(cellText)
        })
        rows.push(rowData)
      })
    }
  })
  
  return rows
}
