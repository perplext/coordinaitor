import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import SSOLoginScreen from '../screens/auth/SSOLoginScreen';

// Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';
import CreateTaskScreen from '../screens/tasks/CreateTaskScreen';
import NaturalLanguageTaskScreen from '../screens/tasks/NaturalLanguageTaskScreen';
import AgentsScreen from '../screens/agents/AgentsScreen';
import AgentDetailScreen from '../screens/agents/AgentDetailScreen';
import MarketplaceScreen from '../screens/marketplace/MarketplaceScreen';
import MarketplaceDetailScreen from '../screens/marketplace/MarketplaceDetailScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Organization Screens
import OrganizationScreen from '../screens/organization/OrganizationScreen';
import BillingScreen from '../screens/organization/BillingScreen';
import TeamScreen from '../screens/organization/TeamScreen';

// Custom Drawer
import CustomDrawer from '../components/navigation/CustomDrawer';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  SSOLogin: { provider?: string };
  Dashboard: undefined;
  Tasks: undefined;
  TaskDetail: { taskId: string };
  CreateTask: undefined;
  NaturalLanguageTask: undefined;
  Agents: undefined;
  AgentDetail: { agentId: string };
  Marketplace: undefined;
  MarketplaceDetail: { agentId: string };
  Analytics: undefined;
  Profile: undefined;
  Settings: undefined;
  Notifications: undefined;
  Organization: undefined;
  Billing: undefined;
  Team: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const TabNavigator: React.FC = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Tasks':
              iconName = focused ? 'clipboard-check' : 'clipboard-check-outline';
              break;
            case 'Agents':
              iconName = focused ? 'robot' : 'robot-outline';
              break;
            case 'Analytics':
              iconName = focused ? 'chart-line' : 'chart-line';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surfaceVariant,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Agents" component={AgentsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const DrawerNavigator: React.FC = () => {
  const theme = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.onSurfaceVariant,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={TabNavigator}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="shopping-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Organization"
        component={OrganizationScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="office-building-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Team"
        component={TeamScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="account-group-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Billing"
        component={BillingScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="credit-card-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="bell-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="SSOLogin" component={SSOLoginScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen
            name="Main"
            component={DrawerNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{ title: 'Task Details' }}
          />
          <Stack.Screen
            name="CreateTask"
            component={CreateTaskScreen}
            options={{ title: 'Create Task' }}
          />
          <Stack.Screen
            name="NaturalLanguageTask"
            component={NaturalLanguageTaskScreen}
            options={{ title: 'Natural Language Task' }}
          />
          <Stack.Screen
            name="AgentDetail"
            component={AgentDetailScreen}
            options={{ title: 'Agent Details' }}
          />
          <Stack.Screen
            name="MarketplaceDetail"
            component={MarketplaceDetailScreen}
            options={{ title: 'Agent Details' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};