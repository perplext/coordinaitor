import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PlaceholderScreenProps {
  title: string;
}

export const createPlaceholderScreen = (title: string): React.FC => {
  return () => {
    const theme = useTheme();

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="headlineMedium">{title}</Text>
          <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
            Coming soon...
          </Text>
        </View>
      </SafeAreaView>
    );
  };
};