import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  Avatar,
  Text,
  Divider,
  Surface,
  useTheme,
  TouchableRipple,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';

const CustomDrawer: React.FC<DrawerContentComponentProps> = (props) => {
  const theme = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <Surface style={{ paddingVertical: 20, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar.Text
              size={48}
              label={`${user?.firstName?.[0]}${user?.lastName?.[0]}`}
              style={{ backgroundColor: theme.colors.primary }}
            />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text variant="titleMedium" numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
                numberOfLines={1}
              >
                {user?.email}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Organization
            </Text>
            <Text variant="bodyMedium">{user?.organizationName}</Text>
          </View>
        </Surface>

        <Divider />

        <View style={{ marginTop: 8 }}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      <View>
        <Divider />
        <TouchableRipple
          onPress={handleLogout}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon
              name="logout"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodyLarge"
              style={{ marginLeft: 32, color: theme.colors.onSurfaceVariant }}
            >
              Sign Out
            </Text>
          </View>
        </TouchableRipple>
        <Surface
          style={{
            padding: 16,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Version 1.0.0
          </Text>
        </Surface>
      </View>
    </View>
  );
};

export default CustomDrawer;