import { LogBox } from 'react-native';

// Ignore specific warnings that are known and don't affect functionality
LogBox.ignoreLogs([
  // React Navigation warnings
  'Non-serializable values were found in the navigation state',
  
  // Async Storage warnings
  'AsyncStorage has been extracted from react-native core',
  
  // React Native Gesture Handler warnings
  'RCTBridge required dispatch_sync to load',
  
  // ViewPropTypes deprecation
  'ViewPropTypes will be removed from React Native',
  
  // Common third-party library warnings
  'Require cycle:',
  'Remote debugger is in a background tab',
  
  // React Native Paper warnings
  'Sending `onAnimatedValueUpdate` with no listeners registered',
]);

// In production, ignore all warnings
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}