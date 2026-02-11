# Secure API Key Storage - Quick Examples

This file contains quick reference examples for using secure API key storage with Supabase Edge Functions.

## Table of Contents

1. [Reading Google Docs Securely](#reading-google-docs-securely)
2. [Creating Your Own Secure Edge Function](#creating-your-own-secure-edge-function)
3. [Frontend Integration Examples](#frontend-integration-examples)
4. [Common Patterns](#common-patterns)

---

## Reading Google Docs Securely

### Basic Usage

```typescript
import { readGoogleDoc } from './lib/googleDocs';

// Read a Google Doc
async function loadLeagueData() {
  const result = await readGoogleDoc('1abc123def456...');
  
  if (result.success) {
    console.log('Document title:', result.title);
    console.log('Document body:', result.body);
    // Process the document data
  } else {
    console.error('Error:', result.error);
    // Handle error
  }
}
```

### Extract Text Only

```typescript
import { extractTextFromDoc } from './lib/googleDocs';

// Get just the text content
async function getDocumentText() {
  const text = await extractTextFromDoc('1abc123def456...');
  console.log('Text content:', text);
  return text;
}
```

### Parse Table Data

```typescript
import { parseDocAsTable } from './lib/googleDocs';

// Parse tables from a document
async function importRosterData() {
  const tableData = await parseDocAsTable('1abc123def456...');
  
  // tableData is a 2D array: string[][]
  // First row is usually headers
  const [headers, ...rows] = tableData;
  
  // Process each row
  rows.forEach(row => {
    const [playerName, position, salary, years] = row;
    console.log(`Player: ${playerName}, Position: ${position}, Salary: $${salary}`);
  });
}
```

### Check if Google Docs is Available

```typescript
import { isGoogleDocsConfigured } from './lib/googleDocs';

async function checkGoogleDocsAvailability() {
  const isAvailable = await isGoogleDocsConfigured();
  
  if (isAvailable) {
    console.log('✅ Google Docs integration is available');
    // Show import button
  } else {
    console.log('❌ Google Docs integration not configured');
    // Hide import button or show setup message
  }
}
```

---

## Creating Your Own Secure Edge Function

### Step 1: Create the Function Directory

```bash
cd supabase/functions
mkdir my-secure-api
```

### Step 2: Create index.ts

```typescript
// supabase/functions/my-secure-api/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get your API key from Supabase environment variables
    const MY_API_KEY = Deno.env.get('MY_API_KEY')
    
    if (!MY_API_KEY) {
      throw new Error('API key not configured')
    }

    // Parse request
    const { param1, param2 } = await req.json()

    // Make your API call
    const response = await fetch(`https://api.example.com/data?key=${MY_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ param1, param2 })
    })

    const data = await response.json()

    // Return success
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
```

### Step 3: Set Environment Variable

1. Go to Supabase Dashboard
2. Settings → Edge Functions → Environment Variables
3. Add: `MY_API_KEY` = your actual API key

### Step 4: Deploy

```bash
supabase functions deploy my-secure-api
```

### Step 5: Use in Frontend

```typescript
import { supabase } from './lib/supabase';

async function callMyAPI() {
  const { data, error } = await supabase.functions.invoke('my-secure-api', {
    body: {
      param1: 'value1',
      param2: 'value2'
    }
  });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Result:', data);
}
```

---

## Frontend Integration Examples

### React Component Example

```typescript
import React, { useState, useEffect } from 'react';
import { readGoogleDoc } from '../lib/googleDocs';

export function LeagueDataImporter() {
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    
    const result = await readGoogleDoc(documentId);
    
    if (result.success) {
      setData(result.data);
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div>
      <h2>Import from Google Docs</h2>
      
      <input
        type="text"
        placeholder="Enter Google Doc ID"
        value={documentId}
        onChange={(e) => setDocumentId(e.target.value)}
      />
      
      <button onClick={handleImport} disabled={loading}>
        {loading ? 'Importing...' : 'Import'}
      </button>
      
      {error && <div className="error">{error}</div>}
      {data && <div className="success">Data imported successfully!</div>}
    </div>
  );
}
```

### With Error Handling and Retry

```typescript
import { readGoogleDoc } from '../lib/googleDocs';

async function loadDocWithRetry(documentId: string, maxRetries = 3) {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries}`);
      
      const result = await readGoogleDoc(documentId);
      
      if (result.success) {
        return result.data;
      }
      
      lastError = result.error;
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (err) {
      lastError = err.message;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}
```

### Caching Results

```typescript
// Simple in-memory cache
const docCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedDoc(documentId: string) {
  const cached = docCache.get(documentId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached document');
    return cached.data;
  }
  
  console.log('Fetching fresh document');
  const result = await readGoogleDoc(documentId);
  
  if (result.success) {
    docCache.set(documentId, {
      data: result.data,
      timestamp: Date.now()
    });
    return result.data;
  }
  
  throw new Error(result.error);
}
```

---

## Common Patterns

### Pattern 1: Loading State Management

```typescript
type LoadingState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success', data: T }
  | { status: 'error', error: string };

async function loadWithState<T>(
  loadFn: () => Promise<T>,
  setState: (state: LoadingState<T>) => void
) {
  setState({ status: 'loading' });
  
  try {
    const data = await loadFn();
    setState({ status: 'success', data });
  } catch (error) {
    setState({ status: 'error', error: error.message });
  }
}

// Usage
const [state, setState] = useState<LoadingState<any>>({ status: 'idle' });

loadWithState(
  () => readGoogleDoc(documentId),
  setState
);
```

### Pattern 2: Batch Operations

```typescript
async function importMultipleDocuments(documentIds: string[]) {
  const results = await Promise.allSettled(
    documentIds.map(id => readGoogleDoc(id))
  );
  
  const successful = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map(r => r.value);
  
  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => r.reason);
  
  return { successful, failed };
}
```

### Pattern 3: Rate Limiting

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  
  constructor(private maxConcurrent: number, private minInterval: number) {}
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.running++;
    
    try {
      const result = await fn();
      await new Promise(resolve => setTimeout(resolve, this.minInterval));
      return result;
    } finally {
      this.running--;
    }
  }
}

// Usage
const limiter = new RateLimiter(2, 1000); // 2 concurrent, 1 second between

const results = await Promise.all(
  documentIds.map(id => 
    limiter.add(() => readGoogleDoc(id))
  )
);
```

### Pattern 4: Validation

```typescript
function isValidDocumentId(id: string): boolean {
  // Google Doc IDs are typically 44 characters, alphanumeric with _ and -
  return /^[a-zA-Z0-9_-]{20,}$/.test(id);
}

function extractDocIdFromUrl(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Usage
async function safeReadDoc(input: string) {
  // Extract ID if it's a URL
  let docId = extractDocIdFromUrl(input) || input;
  
  if (!isValidDocumentId(docId)) {
    throw new Error('Invalid document ID or URL');
  }
  
  return readGoogleDoc(docId);
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { readGoogleDoc } from '../lib/googleDocs';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('readGoogleDoc', () => {
  it('should successfully read a document', async () => {
    const mockData = {
      success: true,
      data: {
        title: 'Test Doc',
        body: { content: [] }
      }
    };
    
    supabase.functions.invoke.mockResolvedValue({
      data: mockData,
      error: null
    });
    
    const result = await readGoogleDoc('test-id');
    
    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Doc');
  });
  
  it('should handle errors', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('Network error')
    });
    
    const result = await readGoogleDoc('test-id');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## Additional Resources

- [Main README - Secure API Key Management](../README.md#-secure-api-key-management-guide)
- [Edge Functions Deployment Guide](../supabase/EDGE_FUNCTIONS_DEPLOYMENT.md)
- [Supabase Functions README](../supabase/functions/README.md)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
