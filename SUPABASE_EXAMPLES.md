# Supabase API Integration Examples

This document provides practical code examples for integrating Supabase Edge Functions into The586Dynasty application.

## Table of Contents

1. [Basic Function Calls](#basic-function-calls)
2. [Google Docs Integration](#google-docs-integration)
3. [Google Sheets Integration](#google-sheets-integration)
4. [Custom API Integration](#custom-api-integration)
5. [Error Handling](#error-handling)
6. [React Native Examples](#react-native-examples)
7. [Backend Examples](#backend-examples)

---

## Basic Function Calls

### Simple GET Request

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function fetchData() {
  const result = await callSecureApiProxy({
    service: 'custom',
    endpoint: 'https://api.example.com/data',
    method: 'GET'
  });
  
  return result.data;
}
```

### POST Request with Body

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function createResource(data: any) {
  const result = await callSecureApiProxy({
    service: 'custom',
    endpoint: 'https://api.example.com/resources',
    method: 'POST',
    body: data
  });
  
  return result.data;
}
```

---

## Google Docs Integration

### Example 1: Read a Document

```typescript
import { readGoogleDoc } from '../lib/supabase';

async function loadRosterFromDoc(documentId: string) {
  try {
    const doc = await readGoogleDoc(documentId);
    
    // Extract text content
    const textContent = doc.body.content
      .filter(element => element.paragraph)
      .map(element => 
        element.paragraph.elements
          .map(e => e.textRun?.content || '')
          .join('')
      )
      .join('\n');
    
    return textContent;
  } catch (error) {
    console.error('Error reading document:', error);
    throw error;
  }
}
```

### Example 2: Create a New Document

```typescript
import { createGoogleDoc } from '../lib/supabase';

async function createSeasonReport(season: number, data: any) {
  try {
    const doc = await createGoogleDoc(
      `The 586 Dynasty - ${season} Season Report`,
      {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Season ${season} Summary\n\n`
            }
          },
          {
            insertText: {
              location: { index: 1 },
              text: JSON.stringify(data, null, 2)
            }
          }
        ]
      }
    );
    
    console.log('Created document:', doc.documentId);
    return doc.documentId;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
}
```

### Example 3: Update Document with Formatted Text

```typescript
import { updateGoogleDoc } from '../lib/supabase';

async function updateContractList(documentId: string, contracts: any[]) {
  const requests = [];
  
  // Clear existing content
  requests.push({
    deleteContentRange: {
      range: {
        startIndex: 1,
        endIndex: 100  // Adjust based on your needs
      }
    }
  });
  
  // Add title
  requests.push({
    insertText: {
      location: { index: 1 },
      text: 'Active Contracts\n\n'
    }
  });
  
  // Format title as bold
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: 1,
        endIndex: 18
      },
      textStyle: {
        bold: true,
        fontSize: {
          magnitude: 14,
          unit: 'PT'
        }
      },
      fields: 'bold,fontSize'
    }
  });
  
  // Add contract data
  contracts.forEach(contract => {
    requests.push({
      insertText: {
        location: { index: 18 },
        text: `${contract.player_name}: $${contract.salary} (${contract.years} years)\n`
      }
    });
  });
  
  const result = await updateGoogleDoc(documentId, { requests });
  return result;
}
```

---

## Google Sheets Integration

### Example 1: Read Sheet Data

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function readRosterSheet(spreadsheetId: string, range: string = 'A1:Z100') {
  const result = await callSecureApiProxy({
    service: 'google-sheets',
    endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    method: 'GET'
  });
  
  return result.data.values;
}

// Usage
const rows = await readRosterSheet('your-sheet-id', 'Roster!A1:F100');
console.log('First row:', rows[0]);
```

### Example 2: Write to Sheet

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function updateRosterSheet(spreadsheetId: string, data: any[][]) {
  const result = await callSecureApiProxy({
    service: 'google-sheets',
    endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Roster!A1:append`,
    method: 'POST',
    body: {
      values: data,
      majorDimension: 'ROWS'
    }
  });
  
  return result.data;
}

// Usage
await updateRosterSheet('your-sheet-id', [
  ['Player Name', 'Team', 'Position', 'Salary', 'Years'],
  ['Patrick Mahomes', 'Team 1', 'QB', '50', '3']
]);
```

### Example 3: Batch Update

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function batchUpdateSheet(spreadsheetId: string, updates: any[]) {
  const result = await callSecureApiProxy({
    service: 'google-sheets',
    endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    method: 'POST',
    body: {
      valueInputOption: 'USER_ENTERED',
      data: updates
    }
  });
  
  return result.data;
}

// Usage
await batchUpdateSheet('your-sheet-id', [
  {
    range: 'Roster!A2:E2',
    values: [['Patrick Mahomes', 'Team 1', 'QB', 50, 3]]
  },
  {
    range: 'Contracts!A2:D2',
    values: [['Patrick Mahomes', 50, 3, '2026-2028']]
  }
]);
```

---

## Custom API Integration

### Example 1: Sleeper API via Supabase

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function getSleeperRoster(leagueId: string) {
  const result = await callSecureApiProxy({
    service: 'sleeper',  // No auth required for Sleeper
    endpoint: `https://api.sleeper.app/v1/league/${leagueId}/rosters`,
    method: 'GET'
  });
  
  return result.data;
}
```

### Example 2: Custom API with Authentication

```typescript
import { callSecureApiProxy } from '../lib/supabase';

async function callAuthenticatedApi(endpoint: string, data: any) {
  const result = await callSecureApiProxy({
    service: 'custom',
    endpoint: endpoint,
    method: 'POST',
    body: data,
    headers: {
      'X-Custom-Header': 'value'
    }
  });
  
  return result.data;
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import { callGoogleDocsApi } from '../lib/supabase';
import { Alert } from 'react-native';

async function safeDocumentOperation(action: string, params: any) {
  try {
    const result = await callGoogleDocsApi(params);
    return { success: true, data: result };
  } catch (error: any) {
    console.error(`Error during ${action}:`, error);
    
    // Handle specific error types
    if (error.message.includes('not configured')) {
      Alert.alert(
        'Configuration Error',
        'Supabase is not properly configured. Please check your environment variables.'
      );
    } else if (error.message.includes('not found')) {
      Alert.alert(
        'Document Not Found',
        'The requested document does not exist or you do not have access.'
      );
    } else if (error.message.includes('permission')) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to perform this action.'
      );
    } else {
      Alert.alert(
        'Error',
        `Failed to ${action}: ${error.message}`
      );
    }
    
    return { success: false, error: error.message };
  }
}

// Usage
const result = await safeDocumentOperation('read document', {
  action: 'read',
  documentId: 'your-doc-id'
});

if (result.success) {
  console.log('Document data:', result.data);
} else {
  console.error('Operation failed:', result.error);
}
```

### Retry Logic

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      console.log(`Retry ${i + 1}/${maxRetries} after error:`, error);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
const doc = await callWithRetry(() => readGoogleDoc('your-doc-id'));
```

---

## React Native Examples

### Example 1: Document Viewer Component

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { readGoogleDoc } from '../lib/supabase';

interface DocumentViewerProps {
  documentId: string;
}

export function DocumentViewer({ documentId }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const doc = await readGoogleDoc(documentId);
      
      // Extract text content
      const text = doc.body.content
        .filter((element: any) => element.paragraph)
        .map((element: any) => 
          element.paragraph.elements
            .map((e: any) => e.textRun?.content || '')
            .join('')
        )
        .join('\n');
      
      setContent(text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadDocument} />
      }
    >
      <Text style={styles.content}>{content}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});
```

### Example 2: Document Creator Hook

```typescript
import { useState } from 'react';
import { createGoogleDoc } from '../lib/supabase';

export function useDocumentCreator() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDocument = async (title: string, initialContent?: string) => {
    try {
      setCreating(true);
      setError(null);

      const requests = initialContent
        ? [
            {
              insertText: {
                location: { index: 1 },
                text: initialContent
              }
            }
          ]
        : undefined;

      const doc = await createGoogleDoc(title, requests ? { requests } : undefined);
      
      return doc.documentId;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return {
    createDocument,
    creating,
    error
  };
}

// Usage in component
function MyComponent() {
  const { createDocument, creating, error } = useDocumentCreator();

  const handleCreate = async () => {
    try {
      const docId = await createDocument(
        'New Contract Report',
        'This is the initial content'
      );
      console.log('Created document:', docId);
    } catch (error) {
      console.error('Failed to create document');
    }
  };

  return (
    <Button
      title={creating ? 'Creating...' : 'Create Document'}
      onPress={handleCreate}
      disabled={creating}
    />
  );
}
```

---

## Backend Examples

### Example 1: API Route with Supabase Integration

```typescript
import express from 'express';
import { callGoogleDocsApi } from '../services/supabase';

const router = express.Router();

// Sync roster to Google Doc
router.post('/sync-roster/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { documentId } = req.body;

    // Fetch roster from database
    const roster = await db.query(
      'SELECT * FROM contracts WHERE team_id = $1 AND status = $2',
      [teamId, 'active']
    );

    // Format roster data
    const rosterText = roster.rows
      .map(contract => 
        `${contract.player_name} - ${contract.position} - $${contract.salary}`
      )
      .join('\n');

    // Update Google Doc
    await callGoogleDocsApi({
      action: 'update',
      documentId,
      content: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Team ${teamId} Roster\n\n${rosterText}`
            }
          }
        ]
      }
    });

    res.json({ 
      success: true, 
      message: 'Roster synced to Google Doc',
      playerCount: roster.rows.length 
    });
  } catch (error: any) {
    console.error('Error syncing roster:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export { router as syncRoutes };
```

### Example 2: Scheduled Job

```typescript
import cron from 'node-cron';
import { callGoogleDocsApi } from './services/supabase';
import { getWeeklyStats } from './services/stats';

// Run every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('Running weekly report generation...');

  try {
    // Get stats for the week
    const stats = await getWeeklyStats();

    // Create weekly report document
    const doc = await callGoogleDocsApi({
      action: 'create',
      title: `Weekly Report - Week ${stats.week}`,
      content: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `Week ${stats.week} Summary\n\n${JSON.stringify(stats, null, 2)}`
            }
          }
        ]
      }
    });

    console.log('Weekly report created:', doc.documentId);
  } catch (error) {
    console.error('Error generating weekly report:', error);
  }
});
```

### Example 3: Middleware for Supabase Health Check

```typescript
import { Request, Response, NextFunction } from 'express';
import { isSupabaseConfigured } from './services/supabase';

export function requireSupabase(req: Request, res: Response, next: NextFunction) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: 'Supabase is not configured',
      message: 'This feature requires Supabase configuration'
    });
  }
  next();
}

// Usage
router.post('/sync-to-doc', requireSupabase, async (req, res) => {
  // Route handler
});
```

---

## Advanced Patterns

### Batch Operations

```typescript
import { callGoogleDocsApi } from '../lib/supabase';

async function batchUpdateDocuments(updates: Array<{
  documentId: string;
  content: any;
}>) {
  const results = await Promise.allSettled(
    updates.map(({ documentId, content }) =>
      callGoogleDocsApi({
        action: 'update',
        documentId,
        content
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { succeeded, failed, results };
}
```

### Caching Results

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readGoogleDoc } from '../lib/supabase';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedDocument(documentId: string) {
  const cacheKey = `doc_${documentId}`;
  const cached = await AsyncStorage.getItem(cacheKey);

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  const doc = await readGoogleDoc(documentId);
  
  await AsyncStorage.setItem(cacheKey, JSON.stringify({
    data: doc,
    timestamp: Date.now()
  }));

  return doc;
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { callGoogleDocsApi } from '../services/supabase';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    functions: {
      invoke: jest.fn().mockResolvedValue({
        data: { documentId: 'test-doc-id' },
        error: null
      })
    }
  }))
}));

describe('Google Docs API', () => {
  it('should read a document', async () => {
    const result = await callGoogleDocsApi({
      action: 'read',
      documentId: 'test-doc-id'
    });

    expect(result.documentId).toBe('test-doc-id');
  });
});
```

---

**More examples and patterns coming soon!**

For questions or contributions, please open an issue on GitHub.
