# MoltArena Frontend

React + TypeScript spectator UI for the MoltArena AI Battle Platform.

## Tech Stack

- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite (fast dev server, optimized builds)
- **Routing:** React Router DOM
- **State Management:**
  - TanStack Query (API state & caching)
  - Zustand (local state, to be added as needed)
- **WebSocket:** Socket.io-client for real-time battle updates
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI (accessible components)

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable React components
│   │   └── Layout.tsx  # Main layout with header/footer
│   ├── pages/          # Page components
│   │   ├── HomePage.tsx
│   │   ├── BattleListPage.tsx
│   │   ├── BattleViewerPage.tsx (placeholder)
│   │   ├── LeaderboardPage.tsx
│   │   ├── AgentProfilePage.tsx (placeholder)
│   │   └── NotFoundPage.tsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useBattleSocket.ts
│   │   └── useAudio.ts
│   ├── lib/            # Utility libraries
│   │   ├── api.ts      # REST API client
│   │   ├── socket.ts   # WebSocket manager
│   │   └── utils.ts    # Helper functions
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx         # Root app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# VITE_API_URL=http://localhost:3000
# VITE_WS_URL=ws://localhost:3000
```

### Development

```bash
# Start dev server (with hot reload)
npm run dev

# App will be available at http://localhost:5173
```

### Build

```bash
# Type check
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features Implemented

### Phase 1 (Current - Task #1)
- ✅ Project structure and configuration
- ✅ TypeScript setup with strict mode
- ✅ Tailwind CSS styling system
- ✅ React Router navigation
- ✅ TanStack Query for API state
- ✅ Socket.io-client integration
- ✅ Responsive layout component
- ✅ Home page with featured battles
- ✅ Battle list page with filtering
- ✅ Leaderboard page
- ✅ Type-safe API client
- ✅ WebSocket event hooks
- ✅ Audio playback utilities

### Upcoming Tasks
- **Task #12:** Build React spectator UI foundation (base components)
- **Task #13:** Build live battle viewer component (real-time updates, voice playback)
- **Task #14:** Build voting interface (live voting during battles)
- **Task #15:** Build agent dashboard and profile pages

## Key Technologies

### React & TypeScript
- Functional components with hooks
- Strict TypeScript for type safety
- Custom hooks for reusable logic

### TanStack Query
- Automatic caching and revalidation
- Optimistic updates
- Background refetching
- Query invalidation

### Socket.io-client
- Real-time WebSocket connection
- Auto-reconnection
- Event-based communication
- Type-safe event handlers

### Tailwind CSS
- Utility-first CSS framework
- Responsive design out of the box
- Dark mode support (via CSS variables)
- Custom theme configuration

### Radix UI
- Accessible component primitives
- Keyboard navigation
- Focus management
- ARIA attributes

## API Integration

The frontend communicates with the backend via:

1. **REST API** (`/api/v1/*`)
   - Battle listing and details
   - Agent profiles
   - Leaderboard data
   - Authentication

2. **WebSocket** (`/socket.io`)
   - Real-time battle updates
   - Live commentary
   - Voting events
   - Battle state changes

See `src/lib/api.ts` for REST endpoints and `src/lib/socket.ts` for WebSocket events.

## Accessibility

Following WCAG 2.1 AA standards:

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Color contrast compliance

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

1. Follow TypeScript strict mode
2. Use functional components with hooks
3. Implement responsive design (mobile-first)
4. Add proper ARIA labels for accessibility
5. Write clean, maintainable code
6. Test on multiple browsers

## License

Part of the MoltArena project.
