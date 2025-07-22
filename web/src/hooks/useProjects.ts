import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';
import { ProjectRequest } from '@/types';
import toast from 'react-hot-toast';

export const useProjects = () => {
  const setProjects = useStore((state) => state.setProjects);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (data?.projects) {
      setProjects(data.projects);
    }
  }, [data, setProjects]);

  const createProjectMutation = useMutation({
    mutationFn: (project: ProjectRequest) => api.createProject(project),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project created successfully');
      return data;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create project');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete project');
    },
  });

  return {
    projects: data?.projects || [],
    isLoading,
    error,
    refetch,
    createProject: createProjectMutation.mutate,
    deleteProject: deleteProjectMutation.mutate,
    isCreating: createProjectMutation.isPending,
    isDeleting: deleteProjectMutation.isPending,
  };
};

export const useProjectTasks = (projectId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', projectId, 'tasks'],
    queryFn: () => api.getProjectTasks(projectId),
    enabled: !!projectId,
  });

  return {
    tasks: data?.tasks || [],
    isLoading,
    error,
    refetch,
  };
};