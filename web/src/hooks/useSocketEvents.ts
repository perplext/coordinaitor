import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '@/services/socket';
import { useStore } from '@/store/useStore';
import toast from 'react-hot-toast';

export const useSocketEvents = () => {
  const queryClient = useQueryClient();
  const { updateAgent, updateTask, addTask } = useStore();

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    // Agent events
    unsubscribes.push(
      socketService.on('agent:registered', (data) => {
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        toast.success(`Agent registered: ${data.agentId}`);
      })
    );

    unsubscribes.push(
      socketService.on('agent:unregistered', (data) => {
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        toast.info(`Agent unregistered: ${data.agentId}`);
      })
    );

    // Task events
    unsubscribes.push(
      socketService.on('task:created', (task) => {
        addTask(task);
        toast.success(`New task created: ${task.title}`);
      })
    );

    unsubscribes.push(
      socketService.on('task:assigned', (data) => {
        updateTask(data.task.id, { 
          status: 'assigned', 
          assignedAgent: data.agent.id 
        });
        toast.info(`Task assigned to ${data.agent.name}`);
      })
    );

    unsubscribes.push(
      socketService.on('task:started', (data) => {
        updateTask(data.taskId, { status: 'in_progress' });
      })
    );

    unsubscribes.push(
      socketService.on('task:completed', (data) => {
        updateTask(data.task.id, { 
          status: 'completed',
          completedAt: new Date(),
          actualDuration: data.response.duration
        });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast.success(`Task completed: ${data.task.title}`);
      })
    );

    unsubscribes.push(
      socketService.on('task:failed', (data) => {
        updateTask(data.task.id, { 
          status: 'failed',
          error: data.error
        });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast.error(`Task failed: ${data.task.title}`);
      })
    );

    unsubscribes.push(
      socketService.on('task:error', (data) => {
        updateTask(data.task.id, { 
          status: 'failed',
          error: data.error
        });
        toast.error(`Task error: ${data.error}`);
      })
    );

    // Project events
    unsubscribes.push(
      socketService.on('project:created', (project) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success(`Project created: ${project.name}`);
      })
    );

    // Cleanup
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [queryClient, updateAgent, updateTask, addTask]);
};