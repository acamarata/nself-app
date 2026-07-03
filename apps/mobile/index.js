/**
 * Purpose: RN/Expo entry point. Registers the root component from src/app/index.tsx.
 * Inputs: none.
 * Outputs: registers App as the AppRegistry root component.
 * Constraints: Required because package.json "main" points here instead of Expo's
 *   default AppEntry.js (which expects a root-level App.tsx that this project
 *   does not have — the real app root lives at src/app/index.tsx).
 * SPORT: local build entry fix, ntask apps/mobile (no SPORT row — build tooling only).
 */
import { registerRootComponent } from 'expo';

import App from './src/app/index';

registerRootComponent(App);
