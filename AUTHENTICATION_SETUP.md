# Authentication Setup Guide

This guide explains how to set up authentication and league management for The 586 Dynasty app.

## Overview

The authentication system allows users to:
1. Register with email/password or sign in with Google
2. Link their Sleeper.com account (one Sleeper account per app account)
3. Discover their Sleeper leagues
4. Convert unregistered leagues to Salary Cap leagues (becoming commissioner)
5. Join existing Salary Cap leagues
6. Access their teams and manage rosters

## Database Setup

### 1. Run the Authentication Migration

```bash
cd backend
psql $DATABASE_URL < src/db/migrations/add_authentication.sql
```

This creates:
- `users` table - stores user accounts and credentials
- `sleeper_accounts` table - links users to their Sleeper accounts
- `user_league_associations` table - tracks which leagues users have joined
- Updates `leagues` table to track salary cap league status

### 2. Environment Variables

Update your `.env` file with the following:

```bash
# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# Email (for password reset - optional)
EMAIL_FROM=noreply@the586dynasty.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (for password reset links)
FRONTEND_URL=https://your-app-domain.com
```

### 3. Google OAuth Setup (Optional)

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - For development: `http://localhost:8081`
   - For production: `https://your-app-domain.com`
6. Copy the Client ID to your `.env` file

For mobile apps, you'll also need to:
- Add your app's bundle ID (iOS) and package name (Android)
- Configure OAuth consent screen
- Add test users during development

## Backend API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "display_name": "John Doe" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "John Doe",
      "has_sleeper_account": false
    },
    "token": "jwt-token"
  }
}
```

#### POST `/api/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

#### POST `/api/auth/google`
Login or register with Google OAuth.

**Request:**
```json
{
  "idToken": "google-id-token"
}
```

#### POST `/api/auth/link-sleeper`
Link a Sleeper account to the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "username": "sleeper-username"
}
```

#### GET `/api/auth/me`
Get current user information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### League Discovery & Management

#### GET `/api/user-leagues/discover`
Discover Sleeper leagues for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "season": "2025",
    "sleeper_user_id": "user-id",
    "leagues": [
      {
        "sleeper_league_id": "league-id",
        "name": "My League",
        "season": "2025",
        "total_rosters": 12,
        "is_registered": true,
        "is_salary_cap_league": true,
        "user_status": "joined",
        "action": "already_joined" // or "join_league" or "convert_to_salary_cap"
      }
    ]
  }
}
```

#### POST `/api/user-leagues/convert`
Convert a Sleeper league to a Salary Cap league.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "sleeper_league_id": "league-id"
}
```

#### POST `/api/user-leagues/join`
Join an existing Salary Cap league.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "sleeper_league_id": "league-id"
}
```

## Mobile App Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

This installs:
- `expo-auth-session` - OAuth flow handling
- `expo-web-browser` - Browser for OAuth
- `expo-secure-store` - Secure token storage

### 2. Update API URL

Set your API URL in the environment:

Create `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Or for production:
```
EXPO_PUBLIC_API_URL=https://your-api-domain.com/api
```

### 3. User Flow

1. **First Launch**: User sees login screen
2. **Registration**: User can create account with email/password or Google
3. **Link Sleeper**: After login, user is prompted to link Sleeper account
4. **Discover Leagues**: User sees all their Sleeper leagues
5. **Convert/Join**: User can convert leagues or join existing ones
6. **Access App**: User can now access their teams and features

## Security Considerations

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

### JWT Tokens
- Tokens expire after 30 days
- Stored securely in device keychain (mobile)
- Included in Authorization header for protected routes

### Sleeper Account Linking
- One Sleeper account per app user (enforced by unique constraint)
- Verified against Sleeper API before linking
- Cannot link an account already associated with another user

### Commissioner Permissions
- First user to convert a league becomes commissioner
- Additional commissioners can be added later
- Commissioner can manage league settings, contracts, and trades

## Testing

### Test Authentication Flow

```bash
# Start the backend
cd backend
npm run dev

# In another terminal, test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "display_name": "Test User"
  }'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Test Mobile App

```bash
cd mobile
npm start
```

Then:
1. Open Expo Go on your device
2. Scan the QR code
3. Test the registration flow
4. Link a Sleeper account
5. Discover and convert/join leagues

## Troubleshooting

### "User not found" error
- Ensure the Sleeper username is correct
- Check that the Sleeper API is accessible

### "Already linked" error
- This Sleeper account is already associated with another user
- Only one app account can be linked to each Sleeper account

### Token expired
- User needs to log in again
- Tokens expire after 30 days

### Cannot convert league
- Verify you're a member of the league on Sleeper
- Check that the league hasn't already been converted by someone else

## Migration for Existing Data

If you have existing leagues and teams in your database, you may need to:

1. Create user accounts for existing team owners
2. Link their Sleeper accounts
3. Associate them with their teams via `user_league_associations`
4. Mark existing leagues as salary cap leagues

This can be done manually or with a migration script based on your needs.

## Next Steps

- Configure email service for password resets
- Set up Google OAuth for production
- Add additional social login providers (Apple, Facebook)
- Implement two-factor authentication
- Add email verification flow
