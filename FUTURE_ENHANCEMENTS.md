# Future Enhancements

This document lists potential improvements and enhancements for future development.

## High Priority

### 1. Schema Flexibility for Year Columns
**Current**: The `cap_adjustments` table has hardcoded year columns (2026-2030)
**Issue**: Requires manual schema updates each season

**Recommended Solutions:**
- **Option A**: Use a JSONB column for year-amount pairs
  ```sql
  -- Replace individual year columns with:
  cap_adjustments JSONB DEFAULT '{}'
  -- Example: {"2026": 10.00, "2027": 5.00}
  ```
- **Option B**: Create a separate table
  ```sql
  CREATE TABLE cap_adjustment_years (
    id UUID PRIMARY KEY,
    cap_adjustment_id UUID REFERENCES cap_adjustments(id),
    year INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL
  );
  ```

**Benefits**: No schema changes needed as seasons progress

### 2. Lazy Initialization for Google Docs API
**Current**: API key validation occurs at module load time
**Issue**: Warning appears even when Google Docs isn't used

**Recommended Solution:**
```typescript
let docsClient: any = null;

const getDocsClient = () => {
  if (!GOOGLE_DOCS_API_KEY) {
    throw new Error('Google Docs API key not configured');
  }
  if (!docsClient) {
    docsClient = google.docs({ version: 'v1', auth: GOOGLE_DOCS_API_KEY });
  }
  return docsClient;
};
```

**Benefits**: Only validates when functionality is actually used

## Medium Priority

### 3. Supabase Edge Functions
Implement server-side logic using Edge Functions for:
- Sleeper API sync operations
- Complex cap calculations
- Trade validation and processing
- Season advancement logic

**Files to create:**
```
supabase/functions/
├── sync-sleeper/index.ts
├── calculate-cap/index.ts
├── process-trade/index.ts
└── advance-season/index.ts
```

### 4. Authentication with Supabase Auth
Add user authentication for:
- Team owner access control
- Commissioner permissions
- Personalized dashboards

**Steps:**
1. Enable Supabase Auth in dashboard
2. Update RLS policies (see `supabase/rls-policies.sql`)
3. Add login/signup UI
4. Map Sleeper users to Supabase auth

### 5. Google Docs Write Support
**Current**: Read-only with API key
**Enhancement**: Add OAuth 2.0 for write operations

**Implementation:**
1. Set up OAuth consent screen in Google Cloud Console
2. Implement OAuth flow in app
3. Use authenticated client for write operations
4. Add features:
   - Export league reports to Google Docs
   - Create weekly summaries
   - Generate trade history documents

### 6. Real-time Updates
Use Supabase Realtime for live data:
```typescript
const subscription = supabase
  .channel('trades')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'trades' },
    (payload) => {
      // Update UI with new trade
    }
  )
  .subscribe();
```

**Use cases:**
- Live trade notifications
- Real-time roster updates
- Cap space changes
- Commissioner actions

### 7. Progressive Web App (PWA)
Convert web app to PWA for:
- Offline functionality
- Push notifications
- Add to home screen
- Better mobile experience

**Implementation:**
1. Add service worker
2. Configure manifest.json
3. Implement offline storage
4. Add background sync

### 8. Improved Build Process
**Current**: Single build for all platforms
**Enhancement**: Optimize builds per platform

```json
{
  "scripts": {
    "build:web": "expo export --platform web",
    "build:web:prod": "expo export --platform web --minify",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android"
  }
}
```

## Low Priority

### 9. Automated Testing
Add test coverage:
```
mobile/
├── __tests__/
│   ├── lib/
│   │   ├── supabaseApi.test.ts
│   │   ├── googleDocs.test.ts
│   │   └── api.test.ts
│   └── components/
│       └── GoogleDocsIntegration.test.tsx
```

**Test areas:**
- API compatibility between axios and Supabase
- Google Docs parsing functions
- Component rendering
- Edge cases and error handling

### 10. Analytics and Monitoring
Add analytics for:
- Page views and user engagement
- API call monitoring
- Error tracking
- Performance metrics

**Options:**
- Google Analytics
- Supabase Analytics
- Custom event tracking

### 11. Better Error Handling
Implement global error boundary:
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to Supabase or external service
    console.error('App error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorScreen />;
    }
    return this.props.children;
  }
}
```

### 12. Data Migration Tools
Create utilities for:
- CSV import/export
- Bulk data operations
- Database backup/restore
- Migration from legacy systems

### 13. Custom Domain Setup
Document and automate:
1. Configure DNS records
2. Set up SSL certificates
3. Update environment variables
4. Test deployment

### 14. API Rate Limiting
Implement client-side rate limiting for:
- Google Docs API (300 req/min)
- Sleeper API (rate limits vary)
- Supabase (unlimited but good practice)

### 15. Improved Type Safety
- Generate Supabase types from database schema
- Add runtime type validation with Zod
- Stricter TypeScript configuration
- Better error types

### 16. Documentation Improvements
- API reference documentation
- Component storybook
- Video tutorials
- Interactive setup wizard

### 17. Mobile App Enhancements
- Deep linking support
- Share functionality
- Haptic feedback
- Native notifications
- Biometric authentication

### 18. Commissioner Tools
- Bulk contract management
- Trade approval queue
- Season management wizard
- Team comparison tools
- Historical reports

### 19. Player Analytics
- Performance trends
- Contract value analysis
- Trade impact calculator
- Salary cap projections
- Draft pick valuation

### 20. Social Features
- Team messaging
- Trade chat
- Commissioner announcements
- Activity feed
- Achievements/badges

## Implementation Priority

### Phase 1 (Next Sprint)
1. Schema flexibility for year columns
2. Lazy initialization for Google Docs
3. Basic Supabase Edge Functions

### Phase 2 (1-2 months)
4. Supabase Auth integration
5. Real-time updates
6. PWA support

### Phase 3 (3-6 months)
7. Google Docs write support
8. Automated testing
9. Analytics and monitoring

### Phase 4 (Long-term)
10. All other enhancements based on user feedback

## Contributing

If you'd like to implement any of these enhancements:

1. Create an issue describing the enhancement
2. Reference this document
3. Discuss implementation approach
4. Submit a pull request

## Notes

- All enhancements should maintain backward compatibility
- Consider mobile app impact for all changes
- Update documentation for any new features
- Add tests for new functionality
- Follow existing code style and patterns
