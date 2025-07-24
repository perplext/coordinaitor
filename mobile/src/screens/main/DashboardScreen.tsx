import React, { useEffect } from 'react';
import { View, ScrollView, RefreshControl, Dimensions } from 'react-native';
import {
  Text,
  Card,
  Surface,
  useTheme,
  IconButton,
  ProgressBar,
  Chip,
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { RootStackParamList } from '../../navigation/AppNavigator';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Dashboard'
>;

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;

const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user } = useAuth();

  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboardData,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => theme.colors.primary,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 12,
      fill: theme.colors.onSurface,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: theme.colors.surfaceVariant,
    },
  };

  const renderStatCard = (title: string, value: string | number, icon: string, color: string) => (
    <Card style={{ flex: 1, margin: 4 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {title}
            </Text>
            <Text variant="headlineMedium" style={{ marginTop: 4, fontWeight: 'bold' }}>
              {value}
            </Text>
          </View>
          <Icon name={icon} size={32} color={color} />
        </View>
      </Card.Content>
    </Card>
  );

  const renderTaskProgress = () => {
    const progress = dashboardData?.taskProgress || { completed: 0, total: 0 };
    const percentage = progress.total > 0 ? progress.completed / progress.total : 0;

    return (
      <Card style={{ marginHorizontal: 16, marginVertical: 8 }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="titleMedium">Task Progress</Text>
            <Text variant="bodyMedium">{`${progress.completed}/${progress.total}`}</Text>
          </View>
          <ProgressBar progress={percentage} color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
            {Math.round(percentage * 100)}% Complete
          </Text>
        </Card.Content>
      </Card>
    );
  };

  const renderActiveAgents = () => {
    const agents = dashboardData?.activeAgents || [];

    return (
      <Card style={{ marginHorizontal: 16, marginVertical: 8 }}>
        <Card.Title title="Active Agents" />
        <Card.Content>
          {agents.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>No active agents</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {agents.map((agent: any) => (
                <Chip
                  key={agent.id}
                  icon={() => <Icon name="robot" size={16} />}
                  style={{ margin: 4 }}
                  onPress={() => navigation.navigate('AgentDetail', { agentId: agent.id })}
                >
                  {agent.name}
                </Chip>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPerformanceChart = () => {
    const data = dashboardData?.performanceData || {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
    };

    return (
      <Card style={{ marginHorizontal: 16, marginVertical: 8 }}>
        <Card.Title title="Weekly Performance" />
        <Card.Content>
          <LineChart
            data={data}
            width={chartWidth - 32}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </Card.Content>
      </Card>
    );
  };

  const renderAgentUtilization = () => {
    const data = dashboardData?.agentUtilization || {
      labels: ['Agent 1', 'Agent 2', 'Agent 3'],
      datasets: [{ data: [0, 0, 0] }],
    };

    return (
      <Card style={{ marginHorizontal: 16, marginVertical: 8 }}>
        <Card.Title title="Agent Utilization" />
        <Card.Content>
          <BarChart
            data={data}
            width={chartWidth - 32}
            height={200}
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            yAxisLabel=""
            yAxisSuffix="%"
          />
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ padding: 16 }}>
          <Text variant="headlineMedium" style={{ marginBottom: 4 }}>
            Welcome back, {user?.firstName}!
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
            Here's your orchestrator overview
          </Text>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
          {renderStatCard(
            'Active Tasks',
            dashboardData?.stats?.activeTasks || 0,
            'clipboard-check',
            theme.colors.primary
          )}
          {renderStatCard(
            'Running Agents',
            dashboardData?.stats?.runningAgents || 0,
            'robot',
            theme.colors.secondary
          )}
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginTop: 8 }}>
          {renderStatCard(
            'Success Rate',
            `${dashboardData?.stats?.successRate || 0}%`,
            'check-circle',
            theme.colors.tertiary
          )}
          {renderStatCard(
            'Avg. Time',
            `${dashboardData?.stats?.avgCompletionTime || 0}m`,
            'clock-fast',
            theme.colors.error
          )}
        </View>

        {renderTaskProgress()}
        {renderActiveAgents()}
        {renderPerformanceChart()}
        {renderAgentUtilization()}

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: 16,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.primary,
        }}
        onPress={() => navigation.navigate('NaturalLanguageTask')}
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;