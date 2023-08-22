export function cachedFactory<A, K, R>(getKey: (args: A) => K, factory: (args: A) => R): (args: A) => R {
    const cache = new Map<K, R>();
    return (args: A) => {
        const key = getKey(args);
        if (!cache.has(key)) {
            cache.set(key, factory(args));
        }
        return cache.get(key) as R;
    };
}
