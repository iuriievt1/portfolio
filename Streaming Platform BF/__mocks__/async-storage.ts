const values = new Map<string, string>();

const asyncStorage = {
  clear: async () => values.clear(),
  getItem: async (key: string) => values.get(key) ?? null,
  removeItem: async (key: string) => {
    values.delete(key);
  },
  setItem: async (key: string, value: string) => {
    values.set(key, value);
  },
};

export default asyncStorage;
