// iOS stub: avoid crashes if someone imports it by mistake
export const BluetoothManager = {
  enableBluetooth: async () => [],
  isBluetoothEnabled: async () => false,
  connect: async () => {},
};

export const BluetoothTscPrinter = {
  printLabel: async () => {
    throw new Error("Bluetooth TSC printing not supported on iOS in this app.");
  },
  DIRECTION: { FORWARD: 0, BACKWARD: 1 },
  TEAR: { ON: 1, OFF: 0 },
};
