import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';

export const useAgents = () => {
  const setAgents = useStore((state) => state.setAgents);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  useEffect(() => {
    if (data?.agents) {
      setAgents(data.agents);
    }
  }, [data, setAgents]);

  return {
    agents: data?.agents || [],
    isLoading,
    error,
    refetch,
  };
};