import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const TasksScreen: React.FC = () => {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text variant="headlineMedium">Tasks Screen</Text>
        <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
          Coming soon...
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default TasksScreen;