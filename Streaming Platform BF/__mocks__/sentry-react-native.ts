export const captureException = jest.fn();
export const init = jest.fn();
export const reactNavigationIntegration = jest.fn(() => ({
  registerNavigationContainer: jest.fn(),
}));
export const wrap = <T>(Component: T) => Component;
