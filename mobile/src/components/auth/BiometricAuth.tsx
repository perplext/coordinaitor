import React, { useEffect, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import TouchID from 'react-native-touch-id';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface BiometricAuthProps {
  onSuccess: () => void;
  style?: any;
}

const BiometricAuth: React.FC<BiometricAuthProps> = ({ onSuccess, style }) => {
  const [biometryType, setBiometryType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const biometryTypeResult = await TouchID.isSupported();
      setBiometryType(biometryTypeResult);
    } catch (error) {
      console.log('Biometric authentication not supported');
    }
  };

  const authenticateWithBiometric = async () => {
    const config = {
      title: 'Authentication Required',
      imageColor: '#3485FF',
      imageErrorColor: '#ff0000',
      sensorDescription: 'Touch sensor',
      sensorErrorDescription: 'Failed',
      cancelText: 'Cancel',
      fallbackLabel: 'Show Passcode',
      unifiedErrors: false,
      passcodeFallback: false,
    };

    try {
      await TouchID.authenticate('Authenticate to access your account', config);
      onSuccess();
    } catch (error: any) {
      if (error.code !== 'UserCancel' && error.code !== 'SystemCancel') {
        Alert.alert(
          'Authentication Failed',
          'Please try again or use your credentials'
        );
      }
    }
  };

  if (!biometryType) return null;

  const getIcon = () => {
    if (biometryType === 'FaceID') return 'face-recognition';
    if (Platform.OS === 'ios') return 'fingerprint';
    return 'fingerprint';
  };

  const getLabel = () => {
    if (biometryType === 'FaceID') return 'Sign in with Face ID';
    return 'Sign in with Touch ID';
  };

  return (
    <Button
      mode="outlined"
      onPress={authenticateWithBiometric}
      icon={() => <Icon name={getIcon()} size={24} />}
      style={[{ marginBottom: 16 }, style]}
    >
      {getLabel()}
    </Button>
  );
};

export default BiometricAuth;