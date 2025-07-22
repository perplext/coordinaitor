# Multi-Agent Orchestrator Web Interface

## Overview

The Multi-Agent Orchestrator includes a full-featured web interface built with React and TypeScript. It provides real-time monitoring and control of all agents, tasks, and projects through an intuitive dashboard.

## Features

### 1. **Dashboard**
- Real-time overview of system status
- Agent performance metrics
- Task distribution charts
- Recent activity feed
- Key statistics at a glance

### 2. **Agent Management**
- View all registered agents
- Monitor agent status (idle/busy/error/offline)
- Performance metrics per agent
- Capability overview
- Real-time status updates via WebSocket

### 3. **Task Management**
- Create new tasks with guided wizard
- Filter tasks by status, type, and priority
- Execute pending tasks
- View task details and outputs
- Real-time progress tracking

### 4. **Project Management**
- Create projects with PRD support
- Automatic task decomposition
- Project progress visualization
- Execute all pending tasks in batch
- Delete projects and associated tasks

### 5. **Real-time Updates**
- WebSocket integration for live updates
- Toast notifications for important events
- Automatic data refresh
- Connection status indicator

## Getting Started

### Development Mode

1. **Start both backend and web UI:**
   ```bash
   ./scripts/start-all.sh dev web
   ```

2. **Or use npm scripts:**
   ```bash
   # Terminal 1 - Backend
   npm run dev

   # Terminal 2 - Web UI
   cd web && npm run dev
   ```

3. **Access the interface:**
   - Web UI: http://localhost:3001
   - Backend API: http://localhost:3000
   - WebSocket: ws://localhost:4000

### Production Mode

1. **Build and run:**
   ```bash
   ./scripts/start-all.sh production web
   ```

2. **Or manually:**
   ```bash
   npm run build:all
   NODE_ENV=production npm start
   ```

3. **Access at:** http://localhost:3000

### Docker Mode

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Access at:** http://localhost

## UI Components

### Navigation
- **Sidebar**: Quick access to all major sections
- **Connection Status**: Shows WebSocket connection state
- **Responsive Design**: Works on desktop and tablet

### Creating Tasks
1. Click "Create Task" button or FAB
2. Enter task description
3. Select task type and priority
4. Add optional context (language, framework, requirements)
5. Submit to queue

### Creating Projects
1. Navigate to Projects section
2. Click "Create Project"
3. Enter project name and description
4. Optionally add a PRD for detailed decomposition
5. System automatically creates tasks

### Task Execution
- Single task: Click play button on task card
- Batch execution: Use "Execute All Pending" in project view
- Tasks are automatically assigned to best-suited agents

## Architecture

### Frontend Stack
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Material-UI**: Component library
- **React Query**: Server state management
- **Zustand**: Client state management
- **Socket.io Client**: WebSocket connection
- **Recharts**: Data visualization
- **Vite**: Build tool

### API Integration
- RESTful API for CRUD operations
- WebSocket for real-time updates
- Automatic retry and error handling
- Optimistic updates for better UX

## Configuration

### Environment Variables
Web UI respects the following environment variables:
- `VITE_API_URL`: Backend API URL (default: proxy to :3000)
- `VITE_WS_URL`: WebSocket URL (default: proxy to :4000)

### Proxy Configuration
In development, Vite proxies:
- `/api/*` → `http://localhost:3000`
- `/socket.io/*` → `http://localhost:4000`

## Customization

### Theme
Edit `src/theme.ts` to customize:
- Colors
- Typography
- Component styles
- Spacing

### Agent Integration
New agents are automatically discovered if:
1. Registered in `config/agents.yaml`
2. Implementing the standard agent interface
3. Connected to the communication hub

## Troubleshooting

### Connection Issues
1. Check backend is running on port 3000
2. Verify WebSocket server on port 4000
3. Check browser console for errors
4. Ensure CORS is configured correctly

### Build Issues
1. Clear node_modules and reinstall
2. Check Node.js version (>=18 required)
3. Ensure all TypeScript types are installed
4. Run `npm run typecheck` to find type errors

### Performance
1. Tasks are paginated automatically
2. Real-time updates are throttled
3. Use filters to reduce data load
4. Check browser performance profiler

## Security Considerations

1. **Authentication**: Currently no auth (add before production)
2. **API Keys**: Never expose in frontend code
3. **CORS**: Configured for development, restrict in production
4. **Input Validation**: All inputs sanitized
5. **XSS Protection**: React handles escaping

## Future Enhancements

- [ ] User authentication and authorization
- [ ] Role-based access control
- [ ] Task templates and saved configurations
- [ ] Advanced search and filtering
- [ ] Export functionality (CSV, JSON)
- [ ] Mobile app version
- [ ] Dark mode theme
- [ ] Internationalization
- [ ] Advanced analytics dashboard
- [ ] Integration with external tools