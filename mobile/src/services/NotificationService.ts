import PushNotification, { Importance } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

export interface NotificationSettings {
  enabled: boolean;
  taskUpdates: boolean;
  agentAlerts: boolean;
  systemNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

class NotificationServiceClass {
  private initialized = false;
  private deviceToken: string | null = null;

  initialize() {
    if (this.initialized) return;

    PushNotification.configure({
      onRegister: (token) => {
        console.log('TOKEN:', token);
        this.deviceToken = token.token;
        this.registerDeviceToken(token.token);
      },

      onNotification: (notification) => {
        console.log('NOTIFICATION:', notification);
        this.handleNotification(notification);

        // Required on iOS
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      onAction: (notification) => {
        console.log('ACTION:', notification.action);
        console.log('NOTIFICATION:', notification);
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (err) => {
        console.error(err.message, err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: true,
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannels();
    }

    this.initialized = true;
  }

  private createNotificationChannels() {
    PushNotification.createChannel(
      {
        channelId: 'task-updates',
        channelName: 'Task Updates',
        channelDescription: 'Notifications for task status changes',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`createChannel 'task-updates' returned '${created}'`)
    );

    PushNotification.createChannel(
      {
        channelId: 'agent-alerts',
        channelName: 'Agent Alerts',
        channelDescription: 'Notifications for agent status and errors',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`createChannel 'agent-alerts' returned '${created}'`)
    );

    PushNotification.createChannel(
      {
        channelId: 'system',
        channelName: 'System Notifications',
        channelDescription: 'System-wide notifications and updates',
        playSound: false,
        importance: Importance.DEFAULT,
        vibrate: false,
      },
      (created) => console.log(`createChannel 'system' returned '${created}'`)
    );
  }

  async getSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem(STORAGE_KEYS.notificationSettings);
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }

    // Default settings
    return {
      enabled: true,
      taskUpdates: true,
      agentAlerts: true,
      systemNotifications: true,
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }

  async updateSettings(settings: Partial<NotificationSettings>) {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(
        STORAGE_KEYS.notificationSettings,
        JSON.stringify(newSettings)
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions) => {
        if (!permissions.alert || !permissions.badge || !permissions.sound) {
          PushNotification.requestPermissions().then((granted) => {
            resolve(granted.alert || granted.badge || granted.sound);
          });
        } else {
          resolve(true);
        }
      });
    });
  }

  showLocalNotification(
    title: string,
    message: string,
    channelId: string = 'task-updates',
    data?: any
  ) {
    PushNotification.localNotification({
      channelId,
      title,
      message,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  }

  scheduleNotification(
    title: string,
    message: string,
    date: Date,
    channelId: string = 'task-updates',
    data?: any
  ) {
    PushNotification.localNotificationSchedule({
      channelId,
      title,
      message,
      date,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  }

  cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  setBadgeCount(count: number) {
    if (Platform.OS === 'ios') {
      PushNotificationIOS.setApplicationIconBadgeNumber(count);
    } else {
      PushNotification.setApplicationIconBadgeNumber(count);
    }
  }

  private async registerDeviceToken(token: string) {
    try {
      // Send token to backend
      // await api.post('/notifications/register', { token, platform: Platform.OS });
      console.log('Device token registered:', token);
    } catch (error) {
      console.error('Failed to register device token:', error);
    }
  }

  private handleNotification(notification: any) {
    // Handle incoming notification
    const { data } = notification;
    
    if (data?.type === 'task-update') {
      // Navigate to task detail
    } else if (data?.type === 'agent-alert') {
      // Navigate to agent detail
    }
  }

  private handleNotificationAction(notification: any) {
    // Handle notification action buttons
    const { action, data } = notification;
    
    switch (action) {
      case 'view':
        // Navigate to relevant screen
        break;
      case 'dismiss':
        // Mark as read
        break;
    }
  }
}

export const NotificationService = new NotificationServiceClass();