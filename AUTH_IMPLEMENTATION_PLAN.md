# Authentication & League Management Implementation Plan

## Overview
This document outlines the implementation plan for adding authentication and league management features to The 586 Dynasty app, as requested by @tfak23.

## Current Status

### ✅ Completed (Phase 1)
1. **Database Schema** - `supabase/migrations/20260211_auth_and_user_management.sql`
   - `user_profiles` table (links Supabase Auth to app users)
   - `league_members` table (maps users to leagues)
   - `league_registration` table (tracks registered leagues)
   - RLS policies for security
   - Helper functions for common operations
   - One-to-one Sleeper account constraint

2. **Edge Functions** - Serverless backend logic
   - ✅ `sleeper-link-account` - Links Sleeper username with one-to-one validation
   - ✅ `sleeper-get-leagues` - Fetches user's Sleeper leagues with registration status
   - ✅ `league-convert` - Converts league to salary cap, user becomes commissioner
   - ✅ `league-join` - Allows users to join registered leagues

### 🚧 In Progress (Phase 2 - Frontend)

#### Authentication Screens Needed:
1. **Login Screen** (`app/auth/login.tsx`)
   - Email/password login
   - Google OAuth button
   - Links to signup and password reset

2. **Signup Screen** (`app/auth/signup.tsx`)
   - Email/password registration
   - Google OAuth signup
   - Terms acceptance

3. **Forgot Password** (`app/auth/forgot-password.tsx`)
   - Password reset request
   - Email verification

4. **Password Reset** (`app/auth/reset-password.tsx`)
   - New password entry
   - Confirmation

#### Onboarding Screens Needed:
1. **Link Sleeper Account** (`app/onboarding/link-sleeper.tsx`)
   - Enter Sleeper username
   - Validate and link account
   - One-to-one constraint checking

2. **Select League** (`app/onboarding/select-league.tsx`)
   - Display user's Sleeper leagues
   - Show "Convert to Salary Cap League" button for unregistered leagues
   - Show "Join League" button for registered leagues
   - Navigate to team view after joining

#### Main App Updates:
1. **Auth Context** (`lib/AuthContext.tsx`)
   - Manage authentication state
   - Handle login/logout
   - Check onboarding status

2. **Protected Routes** (`app/_layout.tsx`)
   - Redirect unauthenticated users to login
   - Redirect incomplete onboarding to onboarding flow

3. **Team Dashboard** (Update existing)
   - Show after league selection
   - Display roster
   - Add/drop players
   - Trade functionality

## Implementation Details

### Phase 2: Frontend Implementation

#### 2.1 Authentication Infrastructure
```typescript
// lib/AuthContext.tsx
- useAuth() hook
- AuthProvider component
- Session management
- Onboarding status tracking
```

#### 2.2 Authentication Screens
- Modern, clean UI design
- Form validation
- Error handling
- Loading states
- Success feedback

#### 2.3 Onboarding Flow
```
Login/Signup → Link Sleeper Account → Select League → Team Dashboard
```

#### 2.4 League Selection Screen
Features:
- Grid/list view of leagues
- League cards with:
  - League name and avatar
  - Total rosters
  - Registration status badge
  - Action button (Convert/Join/View)
- Loading states
- Empty states
- Error handling

#### 2.5 Protected Routes
- Wrap app in AuthProvider
- Check auth status on mount
- Redirect based on status:
  - Not authenticated → Login
  - No Sleeper account → Link Sleeper
  - No league selected → Select League
  - Complete → Team Dashboard

### Phase 3: Team Features (Post-Authentication)

Once authenticated and in a league:

1. **Team Dashboard**
   - View roster with contracts
   - Salary cap summary
   - Quick actions

2. **Player Management**
   - Add/drop players
   - Contract assignment
   - Salary cap validation

3. **Trading**
   - Create trade offers
   - Review incoming trades
   - Approve/reject trades

4. **Settings**
   - Update profile
   - Change Sleeper account (with checks)
   - Logout

## Database Schema

### User Profiles
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    sleeper_username VARCHAR(100) UNIQUE,
    sleeper_user_id VARCHAR(50) UNIQUE,
    sleeper_display_name VARCHAR(100),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    -- ...
);
```

### League Members
```sql
CREATE TABLE league_members (
    id UUID PRIMARY KEY,
    league_id UUID REFERENCES leagues(id),
    user_id UUID REFERENCES user_profiles(id),
    role VARCHAR(20) DEFAULT 'member',
    can_manage_league BOOLEAN DEFAULT FALSE,
    -- ...
    UNIQUE(league_id, user_id)
);
```

### League Registration
```sql
CREATE TABLE league_registration (
    id UUID PRIMARY KEY,
    league_id UUID REFERENCES leagues(id) UNIQUE,
    registered_by UUID REFERENCES user_profiles(id),
    initial_commissioner_id UUID REFERENCES user_profiles(id),
    -- ...
);
```

## Edge Functions API

### 1. Link Sleeper Account
```typescript
POST /functions/v1/sleeper-link-account
Body: { sleeper_username: string }
Returns: { success: true, profile: UserProfile }
Errors: 
  - SLEEPER_USERNAME_TAKEN (409)
  - SLEEPER_USER_NOT_FOUND (404)
```

### 2. Get Sleeper Leagues
```typescript
POST /functions/v1/sleeper-get-leagues
Body: {}
Returns: {
  success: true,
  leagues: Array<{
    sleeper_league_id: string,
    name: string,
    is_registered: boolean,
    is_member: boolean,
    action: 'convert' | 'join' | 'view'
  }>
}
```

### 3. Convert League
```typescript
POST /functions/v1/league-convert
Body: { sleeper_league_id: string }
Returns: {
  success: true,
  league: League,
  message: string
}
Errors:
  - LEAGUE_ALREADY_REGISTERED (409)
```

### 4. Join League
```typescript
POST /functions/v1/league-join
Body: { sleeper_league_id: string }
Returns: {
  success: true,
  league_id: UUID,
  team_id: UUID
}
Errors:
  - LEAGUE_NOT_REGISTERED (404)
  - ALREADY_MEMBER (409)
  - NOT_IN_SLEEPER_LEAGUE (403)
```

## Security Considerations

1. **Row Level Security (RLS)**
   - Enabled on all user-facing tables
   - Users can only read/write their own data
   - Commissioners have elevated permissions

2. **One-to-One Sleeper Constraint**
   - Database constraint prevents duplicate linking
   - Edge function validates before insert
   - Clear error messages to users

3. **Authentication**
   - Supabase Auth handles security
   - Email verification optional
   - Password requirements enforced

4. **API Key Security**
   - No Sleeper API key needed (public API)
   - Supabase service key only in Edge Functions
   - Never exposed to client

## Testing Strategy

### Unit Tests
- Edge Function logic
- Form validation
- Helper functions

### Integration Tests
- Auth flow end-to-end
- Onboarding flow
- League conversion/joining

### Manual Testing
1. Sign up with email
2. Sign up with Google
3. Link Sleeper account
4. Convert league (first user)
5. Join league (second user)
6. Access team dashboard
7. Logout and login again

## Deployment Steps

### 1. Database Migration
```bash
# Run the migration
supabase db push

# Or in SQL Editor:
# Execute: supabase/migrations/20260211_auth_and_user_management.sql
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy sleeper-link-account
supabase functions deploy sleeper-get-leagues
supabase functions deploy league-convert
supabase functions deploy league-join
```

### 3. Configure Supabase Auth
- Enable email/password provider
- Enable Google OAuth provider
- Set redirect URLs
- Configure email templates

### 4. Deploy Frontend
- Build and deploy React Native app
- Update environment variables
- Test authentication flows

## User Flows

### New User Flow
```
1. Land on app → See login screen
2. Click "Create an account"
3. Enter email & password (or use Google)
4. Verify email (if required)
5. Redirected to "Link Sleeper Account"
6. Enter Sleeper username
7. System validates and links account
8. Redirected to "Select League"
9. See list of Sleeper leagues
10. Click "Convert" on a league → Become commissioner
11. Click "Join" on registered league → Become member
12. Redirected to team dashboard
13. Start managing team!
```

### Existing User Flow
```
1. Open app → Check if logged in
2. If logged in → Check if onboarding complete
3. If onboarding complete → Load team dashboard
4. If not complete → Resume onboarding flow
```

### Commissioner Actions
- Convert league (first person)
- Transfer commissioner role
- Add co-commissioners
- Manage league settings
- Approve trades
- Advance season

### Member Actions
- Join registered league
- View team roster
- Add/drop players
- Create trades
- View league standings

## Next Steps

### Immediate
1. ✅ Complete database migration
2. ✅ Deploy Edge Functions
3. 🚧 Create authentication screens
4. 🚧 Create onboarding screens
5. 🚧 Add AuthContext and protected routes

### Short Term
6. Test authentication flows
7. Test onboarding flows
8. Fix any bugs
9. Add loading states and error handling
10. Improve UI/UX

### Medium Term
11. Add team dashboard enhancements
12. Implement player add/drop
13. Implement trading
14. Add commissioner tools

### Long Term
15. Add push notifications
16. Add league chat
17. Add advanced analytics
18. Add mobile apps (iOS/Android)

## Questions & Decisions

1. **Email Verification**: Required or optional?
   - Recommendation: Optional initially, required for production

2. **Google OAuth**: Enable other providers (Apple, Facebook)?
   - Recommendation: Start with Google, add more later

3. **Commissioner Transfer**: How to handle?
   - Recommendation: Current commissioner can assign new one

4. **Multiple Commissioners**: Allow co-commissioners?
   - Recommendation: Yes, with role-based permissions

5. **League Discovery**: Allow users to discover public leagues?
   - Recommendation: Phase 2 feature

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Sleeper API Documentation](https://docs.sleeper.app/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)

## Success Criteria

- ✅ Users can sign up with email or Google
- ✅ Users can reset forgotten passwords
- ✅ Users can link their Sleeper account (one-to-one)
- ✅ Users can see their Sleeper leagues
- ✅ Users can convert unregistered leagues and become commissioner
- ✅ Users can join already-registered leagues
- ✅ Users can access their team after joining
- ✅ All features work securely with proper validation
- ✅ UI is clean and intuitive
- ✅ Error messages are helpful

---

**Status**: Phase 1 Complete, Phase 2 In Progress
**Last Updated**: 2026-02-11
**Author**: GitHub Copilot
