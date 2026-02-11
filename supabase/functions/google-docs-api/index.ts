import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleDocsRequest {
  action: 'read' | 'write' | 'create' | 'update'
  documentId?: string
  content?: any
  title?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the Google Docs API key from environment variables (set in Supabase dashboard)
    const GOOGLE_DOCS_API_KEY = Deno.env.get('GOOGLE_DOCS_API_KEY')
    const GOOGLE_DOCS_SERVICE_ACCOUNT = Deno.env.get('GOOGLE_DOCS_SERVICE_ACCOUNT')
    
    if (!GOOGLE_DOCS_API_KEY || !GOOGLE_DOCS_SERVICE_ACCOUNT) {
      throw new Error('Google Docs API credentials not configured. Please set GOOGLE_DOCS_API_KEY and GOOGLE_DOCS_SERVICE_ACCOUNT in Supabase dashboard.')
    }

    // Parse the request body
    const { action, documentId, content, title }: GoogleDocsRequest = await req.json()

    let result: any

    switch (action) {
      case 'read':
        if (!documentId) {
          throw new Error('documentId is required for read action')
        }
        result = await readGoogleDoc(documentId, GOOGLE_DOCS_API_KEY)
        break

      case 'write':
      case 'update':
        if (!documentId) {
          throw new Error('documentId is required for write/update action')
        }
        result = await updateGoogleDoc(documentId, content, GOOGLE_DOCS_API_KEY)
        break

      case 'create':
        if (!title) {
          throw new Error('title is required for create action')
        }
        result = await createGoogleDoc(title, content, GOOGLE_DOCS_API_KEY)
        break

      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in google-docs-api function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Function to read a Google Doc
async function readGoogleDoc(documentId: string, apiKey: string) {
  const url = `https://docs.googleapis.com/v1/documents/${documentId}?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to read document: ${response.statusText}`)
  }

  return await response.json()
}

// Function to update a Google Doc
async function updateGoogleDoc(documentId: string, content: any, apiKey: string) {
  const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      requests: content.requests || []
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update document: ${response.statusText}`)
  }

  return await response.json()
}

// Function to create a new Google Doc
async function createGoogleDoc(title: string, content: any, apiKey: string) {
  const url = `https://docs.googleapis.com/v1/documents?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create document: ${response.statusText}`)
  }

  const doc = await response.json()

  // If content is provided, update the document
  if (content && content.requests) {
    await updateGoogleDoc(doc.documentId, content, apiKey)
  }

  return doc
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/google-docs-api' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"action":"read","documentId":"YOUR_DOCUMENT_ID"}'

*/
