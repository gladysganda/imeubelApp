// Web stub: never crash, exports safe no-ops
export const BluetoothManager = {
  enableBluetooth: async () => [],
  isBluetoothEnabled: async () => false,
  connect: async () => {},
  unpaire: async () => {},
};

export const BluetoothTscPrinter = {
  printLabel: async () => {},
  DIRECTION: { FORWARD: 0, BACKWARD: 1 },
  TEAR: { ON: 1, OFF: 0 },
};
