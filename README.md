# The586Dynasty

A comprehensive fantasy football dynasty league management system with salary cap tracking, multi-year contracts, and Sleeper.com integration.

## Features

### Authentication & User Management
- **Email/Password Registration** - Create accounts with secure password requirements
- **Google OAuth** - Quick sign-in with Google accounts
- **Password Reset** - Secure password recovery via email
- **Sleeper Account Linking** - Connect your Sleeper.com account (one per user)

### League Discovery & Management
- **Discover Leagues** - Automatically find all your Sleeper leagues
- **Convert to Salary Cap** - Transform any Sleeper league into a salary cap league
- **Join Existing Leagues** - Join salary cap leagues created by others
- **Commissioner Control** - First converter becomes commissioner, can add others

### Salary Cap Features
- **$500 Hard Cap** per team
- **Multi-Year Contracts** (1-5 years)
- **Contract Year Limits** (Min 45 / Max 75 per team)
- **Franchise Tags** with position-based calculations
- **Dead Money Tracking** for released players
- **Cap Projections** with 5-year forward view

### Trade Management
- **Trade Proposals** with expirations (1hr, 24hr, 2d, 1wk)
- **Multiple Approval Modes** - Auto, commissioner, or league vote
- **Trade History** with complete audit trail
- **Cap Impact** preview before approval

## Getting Started

See [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) for detailed setup instructions.

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/tfak23/The586Dynasty.git
cd The586Dynasty
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials and secrets
npm run db:migrate
npm run dev
```

3. **Setup Mobile App**
```bash
cd mobile
npm install
npm start
```

## Technology Stack

- **Backend**: Node.js, Express, PostgreSQL, TypeScript
- **Mobile**: React Native, Expo, TypeScript
- **Authentication**: JWT, bcrypt, Google OAuth
- **External APIs**: Sleeper API for league and player data
- **Deployment**: Google Cloud Platform (Cloud Run, Cloud SQL)

## Documentation

- [Authentication Setup Guide](./AUTHENTICATION_SETUP.md)
- [App Design Document](./APP_DESIGN_DOCUMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)

## License

Private - All Rights Reserved