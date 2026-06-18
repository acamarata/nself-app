/**
 * Purpose: Type shims for native packages added to package.json but not yet installed
 *   (react-native-mmkv, @shopify/flash-list, @react-native-community/netinfo).
 *   These shims provide minimal typings so TypeScript can type-check without installed node_modules.
 *   Remove this file once `pnpm install` has run and proper @types or bundled types are in place.
 * SPORT: T-P3-E5-W3-S1-T01
 */

// @shopify/flash-list
declare module '@shopify/flash-list' {
  import type { FlatListProps, ViewStyle } from 'react-native';

  export interface FlashListProps<T> extends Omit<FlatListProps<T>, 'ref'> {
    estimatedItemSize: number;
    overrideItemLayout?: (
      layout: { span?: number; size?: number },
      item: T,
      index: number,
    ) => void;
    contentContainerStyle?: ViewStyle;
  }

  export class FlashList<T> extends React.Component<FlashListProps<T>> {}
}

// react-native-mmkv
declare module 'react-native-mmkv' {
  export interface MMKVConfiguration {
    id?: string;
    path?: string;
    encryptionKey?: string;
  }

  export class MMKV {
    constructor(configuration?: MMKVConfiguration);
    set(key: string, value: string | number | boolean): void;
    getString(key: string): string | undefined;
    getNumber(key: string): number | undefined;
    getBoolean(key: string): boolean | undefined;
    delete(key: string): void;
    clearAll(): void;
    getAllKeys(): string[];
  }
}

// @react-native-community/netinfo
declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    type: string;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }

  export type NetInfoChangeHandler = (state: NetInfoState) => void;

  const NetInfo: {
    addEventListener: (listener: NetInfoChangeHandler) => () => void;
    fetch: () => Promise<NetInfoState>;
  };

  export default NetInfo;
}
