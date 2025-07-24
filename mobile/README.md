# Multi-Agent Orchestrator Mobile App

React Native mobile application for iOS and Android that provides access to the Multi-Agent Orchestrator platform.

## Features

- **Cross-Platform**: Single codebase for iOS and Android
- **Modern UI**: Material Design 3 with React Native Paper
- **Authentication**: Email/password, SSO, and biometric authentication
- **Real-time Updates**: WebSocket integration for live task updates
- **Offline Support**: Queue actions when offline, sync when connected
- **Push Notifications**: Task updates and agent alerts
- **Natural Language**: Voice and text input for task creation
- **Dark Mode**: System-aware theme switching

## Prerequisites

- Node.js >= 16
- React Native development environment set up:
  - For iOS: Xcode 14+ and CocoaPods
  - For Android: Android Studio and JDK 11
- [React Native CLI](https://reactnative.dev/docs/environment-setup)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install iOS dependencies (macOS only):
```bash
cd ios && pod install
```

## Running the App

### Development

Start Metro bundler:
```bash
npm start
```

Run on iOS:
```bash
npm run ios
```

Run on Android:
```bash
npm run android
```

### Building for Production

#### iOS
```bash
npm run build:ios
```

The build will be available in `ios/build/`.

#### Android
```bash
npm run build:android
```

The APK will be available in `android/app/build/outputs/apk/release/`.

## Project Structure

```
mobile/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── services/        # API and business logic
│   ├── contexts/        # React contexts (Auth, Theme)
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── constants/       # App constants and config
│   └── types/           # TypeScript type definitions
├── ios/                 # iOS-specific code
├── android/             # Android-specific code
└── __tests__/          # Test files
```

## Configuration

### API Endpoint

Update the API endpoint in `src/constants/config.ts`:

```typescript
export const API_BASE_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:3000/api',
      android: 'http://10.0.2.2:3000/api',
    })
  : 'https://your-api-endpoint.com/api';
```

### Push Notifications

1. iOS: Configure push notification certificates in Apple Developer Console
2. Android: Add Firebase configuration in `android/app/google-services.json`

### Deep Linking

Configure deep linking in:
- iOS: `ios/MultiAgentOrchestratorMobile/Info.plist`
- Android: `android/app/src/main/AndroidManifest.xml`

## Key Features Implementation

### Authentication Flow
- Login with email/password
- SSO integration (SAML, OAuth2)
- Biometric authentication (Touch ID/Face ID)
- Secure token storage using Keychain (iOS) and Keystore (Android)

### Task Management
- View active tasks
- Create tasks using natural language
- Real-time task status updates
- Task filtering and search

### Agent Management
- View agent list and status
- Agent performance metrics
- Install agents from marketplace

### Offline Support
- Cache API responses
- Queue actions when offline
- Automatic sync on reconnection

## Testing

Run unit tests:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## Troubleshooting

### iOS Build Issues
- Clean build folder: `cd ios && xcodebuild clean`
- Reset pods: `cd ios && pod deintegrate && pod install`

### Android Build Issues
- Clean gradle: `cd android && ./gradlew clean`
- Reset cache: `npm run clean`

### Metro Bundler Issues
- Clear cache: `npx react-native start --reset-cache`

## Release Process

1. Update version in `package.json`, `ios/Info.plist`, and `android/app/build.gradle`
2. Build release versions for both platforms
3. Test on physical devices
4. Submit to App Store and Google Play Store

## Security

- All API communications use HTTPS
- Authentication tokens stored in secure storage
- Biometric authentication for app access
- Certificate pinning for API requests
- No sensitive data stored in plain text

## Contributing

1. Create feature branch from `main`
2. Follow the coding standards
3. Write tests for new features
4. Submit pull request

## License

Proprietary - All rights reserved