import React, { useState, useEffect } from 'react';
import { View, Alert, Linking } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import WebView from 'react-native-webview';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { styles } from './styles';

type SSOLoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SSOLogin'
>;

type SSOLoginScreenRouteProp = RouteProp<RootStackParamList, 'SSOLogin'>;

const SSOLoginScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<SSOLoginScreenNavigationProp>();
  const route = useRoute<SSOLoginScreenRouteProp>();
  const { loginWithSSO } = useAuth();

  const [loading, setLoading] = useState(false);
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [showWebView, setShowWebView] = useState(false);

  const provider = route.params?.provider;

  useEffect(() => {
    if (provider && provider !== 'custom') {
      initiateSSOLogin(provider);
    }
  }, [provider]);

  const initiateSSOLogin = async (ssoProvider: string) => {
    setLoading(true);
    try {
      const authUrl = await loginWithSSO(ssoProvider);
      if (authUrl) {
        setSsoUrl(authUrl);
        setShowWebView(true);
      }
    } catch (error: any) {
      Alert.alert(
        'SSO Login Failed',
        error.message || 'Failed to initiate SSO login'
      );
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSSOLogin = async () => {
    if (!customDomain.trim()) {
      Alert.alert('Error', 'Please enter your organization domain');
      return;
    }

    const domain = customDomain.trim().toLowerCase();
    await initiateSSOLogin(`saml:${domain}`);
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;

    // Check if the URL contains our success callback
    if (url.includes('/auth/callback/success')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const token = urlParams.get('token');

      if (token) {
        // Handle successful authentication
        setShowWebView(false);
        // The auth context will handle the token and navigation
      }
    } else if (url.includes('/auth/callback/error')) {
      setShowWebView(false);
      Alert.alert(
        'Authentication Failed',
        'Failed to authenticate with your organization'
      );
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16 }}>Initiating SSO login...</Text>
      </SafeAreaView>
    );
  }

  if (showWebView && ssoUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: 16, 
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.surfaceVariant,
          }}>
            <Button
              mode="text"
              onPress={() => {
                setShowWebView(false);
                navigation.goBack();
              }}
            >
              Cancel
            </Button>
            <Text style={{ flex: 1, textAlign: 'center' }} variant="titleMedium">
              Sign in to your organization
            </Text>
            <View style={{ width: 80 }} />
          </View>
          <WebView
            source={{ uri: ssoUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 8 }}>
          Enterprise Sign In
        </Text>
        <Text variant="bodyLarge" style={{ marginBottom: 32, color: theme.colors.onSurfaceVariant }}>
          Sign in with your organization's single sign-on
        </Text>

        <Surface style={{ padding: 24, borderRadius: 12 }} elevation={2}>
          <Text variant="titleMedium" style={{ marginBottom: 16 }}>
            Enter your organization domain
          </Text>
          <TextInput
            label="Organization Domain"
            value={customDomain}
            onChangeText={setCustomDomain}
            mode="outlined"
            placeholder="example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{ marginBottom: 24 }}
            left={<TextInput.Icon icon="domain" />}
          />
          <Button
            mode="contained"
            onPress={handleCustomSSOLogin}
            disabled={!customDomain.trim()}
          >
            Continue with SSO
          </Button>
        </Surface>

        <View style={{ marginTop: 32 }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
            Or sign in with:
          </Text>
          <Button
            mode="outlined"
            onPress={() => initiateSSOLogin('okta')}
            style={{ marginBottom: 12 }}
            icon="shield-account"
          >
            Okta
          </Button>
          <Button
            mode="outlined"
            onPress={() => initiateSSOLogin('auth0')}
            style={{ marginBottom: 12 }}
            icon="shield-lock"
          >
            Auth0
          </Button>
          <Button
            mode="outlined"
            onPress={() => initiateSSOLogin('azure-ad')}
            icon="microsoft"
          >
            Azure Active Directory
          </Button>
        </View>

        <View style={{ flex: 1 }} />
        
        <Button
          mode="text"
          onPress={() => navigation.navigate('Login')}
          style={{ marginBottom: 16 }}
        >
          Back to standard login
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default SSOLoginScreen;