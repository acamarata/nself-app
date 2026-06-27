import { registerRootComponent } from 'expo';
import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It ensures that whether the app is loaded in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
