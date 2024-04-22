/** @internal */
export function createProxyWithLogging<T>(obj: Object): T {
  const handler = {
    get(target: any, prop: string) {
      if (typeof target[prop] === 'function') {
        return function (...args: any[]) {
          console.log(`GL: ${prop}`, ...args);
          // eslint-disable-next-line prefer-spread
          return target[prop].apply(target, args);
        };
      }
      return target[prop];
    },
  };

  return new Proxy(obj, handler);
}
