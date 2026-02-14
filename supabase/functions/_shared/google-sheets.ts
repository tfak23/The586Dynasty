// Google Sheets API v4 client for Deno Edge Functions
// Uses Service Account JWT auth (RS256) — no external libraries needed

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig() {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const spreadsheetId = Deno.env.get('GOOGLE_SPREADSHEET_ID');

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error('Missing Google Sheets config. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SPREADSHEET_ID secrets.');
  }

  return { email, privateKey, spreadsheetId };
}

// Import PEM private key for RS256 signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Handle both PEM format and raw base64 format
  // Also handle escaped \n from env vars
  const normalized = pem.replace(/\\n/g, '\n');
  const pemContents = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/[\n\r\s]/g, '')
    .trim();

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// Base64url encode (no padding)
function base64url(data: Uint8Array | string): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create a signed JWT for Google Service Account auth
async function createJWT(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

// Get OAuth2 access token (cached for 50 minutes)
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const { email, privateKey } = getConfig();
  const jwt = await createJWT(email, privateKey);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${err}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000, // cache for 50 min (expires in 60)
  };

  return cachedToken.token;
}

function getSpreadsheetId(): string {
  return getConfig().spreadsheetId;
}

// Read a range of cells — returns 2D array of strings
export async function readRange(range: string): Promise<string[][]> {
  const token = await getAccessToken();
  const id = getSpreadsheetId();
  const encodedRange = encodeURIComponent(range);

  const response = await fetch(
    `${SHEETS_BASE}/${id}/values/${encodedRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets read failed for "${range}": ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.values || [];
}

// Write values to a single range
export async function writeRange(range: string, values: (string | number)[][]): Promise<void> {
  const token = await getAccessToken();
  const id = getSpreadsheetId();
  const encodedRange = encodeURIComponent(range);

  const response = await fetch(
    `${SHEETS_BASE}/${id}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, values }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets write failed for "${range}": ${response.status} ${err}`);
  }
}

// Batch update multiple ranges in one API call
export async function batchUpdate(
  updates: { range: string; values: (string | number)[][] }[]
): Promise<void> {
  const token = await getAccessToken();
  const id = getSpreadsheetId();

  const response = await fetch(
    `${SHEETS_BASE}/${id}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updates,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets batchUpdate failed: ${response.status} ${err}`);
  }
}

// Clear a range of cells
export async function clearRange(range: string): Promise<void> {
  const token = await getAccessToken();
  const id = getSpreadsheetId();
  const encodedRange = encodeURIComponent(range);

  const response = await fetch(
    `${SHEETS_BASE}/${id}/values/${encodedRange}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets clear failed for "${range}": ${response.status} ${err}`);
  }
}

// Find row number of a value in a specific column of a sheet
// Returns 1-indexed row number, or -1 if not found
export async function findRowByValue(
  sheetName: string,
  column: string,
  searchValue: string
): Promise<number> {
  const range = `'${sheetName}'!${column}:${column}`;
  const values = await readRange(range);

  for (let i = 0; i < values.length; i++) {
    if (values[i][0]?.trim().toLowerCase() === searchValue.trim().toLowerCase()) {
      return i + 1; // 1-indexed
    }
  }

  return -1;
}

// Find the next empty row in a column within a specific range
export async function findNextEmptyRow(
  sheetName: string,
  column: string,
  startRow: number,
  endRow: number
): Promise<number> {
  const range = `'${sheetName}'!${column}${startRow}:${column}${endRow}`;
  const values = await readRange(range);

  for (let i = 0; i < values.length; i++) {
    if (!values[i] || !values[i][0] || values[i][0].trim() === '') {
      return startRow + i;
    }
  }

  return -1; // No empty row found in range
}

// Append rows to the end of existing data in a sheet
export async function appendRows(
  sheetName: string,
  range: string,
  values: (string | number)[][]
): Promise<void> {
  const token = await getAccessToken();
  const id = getSpreadsheetId();
  const fullRange = `'${sheetName}'!${range}`;
  const encodedRange = encodeURIComponent(fullRange);

  const response = await fetch(
    `${SHEETS_BASE}/${id}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets append failed for "${fullRange}": ${response.status} ${err}`);
  }
}
