/**
 * Jest manual mock for @react-native-community/netinfo.
 * Default state: always connected.
 */
const NetInfo = {
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
};

module.exports = { default: NetInfo, ...NetInfo };
