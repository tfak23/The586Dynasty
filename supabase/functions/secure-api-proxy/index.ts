import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApiProxyRequest {
  service: 'google-docs' | 'google-sheets' | 'sleeper' | 'custom'
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const { service, endpoint, method = 'GET', body, headers = {} }: ApiProxyRequest = await req.json()

    // Get the appropriate API key based on the service
    let apiKey: string | undefined

    switch (service) {
      case 'google-docs':
        apiKey = Deno.env.get('GOOGLE_DOCS_API_KEY')
        break
      case 'google-sheets':
        apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY')
        break
      case 'custom':
        apiKey = Deno.env.get('CUSTOM_API_KEY')
        break
      case 'sleeper':
        // Sleeper API doesn't require authentication
        apiKey = undefined
        break
      default:
        throw new Error(`Unsupported service: ${service}`)
    }

    // Build the request headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    }

    // Add API key to headers or URL based on service
    let finalEndpoint = endpoint
    if (apiKey) {
      if (service.startsWith('google-')) {
        // ⚠️ SECURITY NOTE: Google APIs with API keys use query parameter (standard method)
        // This is suitable for development but API keys may appear in server logs.
        // For production applications with sensitive data, upgrade to OAuth2 Service Accounts
        // which use Authorization headers and provide better security.
        // See SUPABASE_SETUP.md "Security Considerations" section for details.
        finalEndpoint += (endpoint.includes('?') ? '&' : '?') + `key=${apiKey}`
        console.log('Using Google API key authentication (development mode)')
      } else {
        // Other APIs typically use Authorization header
        requestHeaders['Authorization'] = `Bearer ${apiKey}`
      }
    }

    // Make the proxied request
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    }

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body)
    }

    const response = await fetch(finalEndpoint, requestOptions)

    // Parse the response
    let responseData: any
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json()
    } else {
      responseData = await response.text()
    }

    // Return the response
    return new Response(
      JSON.stringify({ 
        success: response.ok,
        status: response.status,
        data: responseData 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.ok ? 200 : response.status,
      }
    )
  } catch (error) {
    console.error('Error in secure-api-proxy function:', error)
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

/* To invoke:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/secure-api-proxy' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{
      "service": "google-docs",
      "endpoint": "https://docs.googleapis.com/v1/documents/YOUR_DOC_ID",
      "method": "GET"
    }'

*/
