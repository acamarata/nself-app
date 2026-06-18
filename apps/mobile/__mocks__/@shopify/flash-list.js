/**
 * Jest manual mock for @shopify/flash-list.
 * Renders as a FlatList-compatible component in tests.
 */
const React = require('react');
const { FlatList } = require('react-native');

function FlashList(props) {
  return React.createElement(FlatList, props);
}

module.exports = { FlashList };
