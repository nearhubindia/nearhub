# NearHub

**A Multi-Platform Marketplace | Mobile App · Web Admin · Backend API**

NearHub is a multi-app marketplace project built with a modern TypeScript-based technology stack. It demonstrates end-to-end product development across mobile applications, web administration, backend APIs, database persistence, and automated testing.

The repository is organized into three independently runnable applications, making development, testing, and maintenance easier across the stack.

## Project Overview

| Application | Technology | Purpose |
|---|---|---|
| Mobile App (`app/`) | Expo, React Native | Mobile marketplace experience |
| Backend API (`server/`) | Node.js, Express, TypeScript | Business logic, APIs, and database integration |
| Web Admin (`web/`) | React, Vite, TypeScript | Web-based administration interface |

## Features

- **Marketplace listings:** Listing discovery and engagement workflows.
- **Live engagement metrics:** View counts, chat counts, likes, and saves.
- **Persistent interactions:** Likes and saves stored in the database using the `listing_likes` table.
- **Mobile application:** Cross-platform mobile development using Expo and React Native.
- **Web administration:** React-based administration interface.
- **Backend API:** Modular Express and TypeScript backend.
- **Database migrations:** Managed database schema updates.
- **Automated testing:** Unit tests, coverage checks, and Playwright browser tests.
- **Code quality:** Type checking, linting, and formatting validation.

## Repository Structure

```text
NearHub/
├── app/                  # Expo React Native mobile app
├── server/               # Express + TypeScript API
├── web/                  # Vite + React admin application
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GIT_GATES.md
│   └── CICD_SETUP.md
├── package.json          # Root-level scripts
└── README.md
```

## Technology Stack

- **Mobile:** Expo, React Native
- **Frontend:** React, Vite, TypeScript
- **Backend:** Node.js, Express, TypeScript
- **Database:** Configured through the backend database setup
- **Testing:** Unit tests, coverage reporting, Playwright
- **Engineering practices:** Database migrations, type checking, linting, formatting, and CI/CD documentation

## Quick Start

### Prerequisites

Install the following before getting started:

- Node.js and npm
- A configured database supported by the backend
- Expo development prerequisites for running the mobile application
- Android Studio for local Android builds, if required

### 1. Start the Backend Server

```bash
cd server
npm install
npm run db:migrate
npm run dev
```

Configure the required environment variables before starting the server. Refer to the server documentation for database and AI moderation configuration.

### 2. Start the Mobile Application

```bash
cd app
npm install
npm run dev
```

For a native Android build and installation:

```bash
cd app
npx expo prebuild -p android
npx expo run:android
```

Follow `app/MOBILE_DEV_GUIDE.md` for additional setup instructions.

### 3. Start the Web Admin Application

```bash
cd web
npm install
npm run dev
```

Use the development URL printed by Vite to access the web application.

## Testing

Run these commands from the repository root.

### Unit Tests

```bash
npm run test:unit
```

Runs backend and web feature unit tests.

### Coverage Checks

```bash
npm run test:coverage
```

Runs feature coverage checks against the configured thresholds.

### Complete Test Suite

```bash
npm run test:all
```

Runs coverage checks and production-bundle Playwright tests.

### Browser End-to-End Tests

```bash
npm run e2e
```

Runs the web Playwright test suite.

### Test Locations

- Backend: `server/features/**/tests`
- Web: `web/src/features/**/tests`
- Browser workflows: `web/e2e`

## Quality Checks

Run the following commands within each applicable project directory.

```bash
npm run type-check
npm run lint
npm run format:check
```

These checks help maintain type safety, consistent code style, and code quality.

## Database Migrations

Database migrations must be applied before testing database-dependent features, including likes and saves.

```bash
cd server
npm run db:migrate
```

Confirm the database connection and required environment variables are configured before running migrations.

## Documentation

| Document | Description |
|---|---|
| `app/MOBILE_DEV_GUIDE.md` | Mobile development workflow |
| `server/AI_MODERATION_SETUP.md` | AI moderation configuration |
| `server/scripts/README.md` | Backend script reference |
| `docs/ARCHITECTURE.md` | System architecture overview |
| `docs/GIT_GATES.md` | Git quality gates |
| `docs/CICD_SETUP.md` | CI/CD setup and workflows |

## About the Developer

I work across product management, software architecture, and end-to-end digital product delivery, with an interest in building practical, scalable software solutions.

My development interests include:

- Business websites and web applications
- Cross-platform mobile applications
- SaaS platforms and marketplaces
- Custom administration portals and business workflows
- Backend APIs and third-party integrations

## Website & App Development Enquiries

Have an idea for a website, mobile app, marketplace, or custom software platform?

I'm open to discussing development projects, technical collaborations, and opportunities to turn business requirements into working digital products.

- **Website / Portfolio:** www.synvide.com
- **LinkedIn:** https://www.linkedin.com/in/pavan-opd365/?isSelfProfile=true
- **Email:** pavanprasadnarla@synvide.com
- **Project Enquiries:** pavanprasadnarla9@gmail.com

## Project Screenshots & Demo

Add screenshots of the mobile application, web admin interface, and key marketplace workflows here.

- **Live Demo:** www.nearhub.in
- **Mobile App Preview:** https://play.google.com/store/apps/details?id=com.synvide.nearhub&hl=en_IN


Only include publicly accessible links and screenshots that are safe to share.

## Security

- Never commit API keys, passwords, tokens, or production credentials.
- Keep environment-specific configuration in local environment files.
- Review deployment settings before exposing services publicly.
- Use sample data when demonstrating the application.

## License

Check the repository's `LICENSE` file for the applicable terms governing use, modification, and distribution. If no license is present, specify the intended license before inviting others to reuse the code.

---

**NearHub — Building practical digital experiences across mobile, web, and backend systems.**
