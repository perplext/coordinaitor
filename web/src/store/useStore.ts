import { create } from 'zustand';
import { Agent, Task, Project } from '@/types';

interface AppState {
  // Connection status
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  // Projects
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  removeProject: (projectId: string) => void;

  // Selected items
  selectedProject: string | null;
  setSelectedProject: (projectId: string | null) => void;
  selectedTask: string | null;
  setSelectedTask: (taskId: string | null) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  createTaskDialogOpen: boolean;
  setCreateTaskDialogOpen: (open: boolean) => void;
  createProjectDialogOpen: boolean;
  setCreateProjectDialogOpen: (open: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Connection status
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, ...updates } : agent
      ),
    })),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    })),

  // Projects
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (projectId, updates) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, ...updates } : project
      ),
    })),
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
    })),

  // Selected items
  selectedProject: null,
  setSelectedProject: (projectId) => set({ selectedProject: projectId }),
  selectedTask: null,
  setSelectedTask: (taskId) => set({ selectedTask: taskId }),

  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  createTaskDialogOpen: false,
  setCreateTaskDialogOpen: (open) => set({ createTaskDialogOpen: open }),
  createProjectDialogOpen: false,
  setCreateProjectDialogOpen: (open) => set({ createProjectDialogOpen: open }),
}));