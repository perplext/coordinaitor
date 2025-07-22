import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';
import { TaskRequest } from '@/types';
import toast from 'react-hot-toast';

export const useTasks = (filters?: { status?: string; projectId?: string }) => {
  const setTasks = useStore((state) => state.setTasks);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.getTasks(filters),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  useEffect(() => {
    if (data?.tasks) {
      setTasks(data.tasks);
    }
  }, [data, setTasks]);

  const createTaskMutation = useMutation({
    mutationFn: (task: TaskRequest) => api.createTask(task),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created successfully');
      return data;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create task');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: any }) =>
      api.updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update task');
    },
  });

  return {
    tasks: data?.tasks || [],
    isLoading,
    error,
    refetch,
    createTask: createTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
  };
};