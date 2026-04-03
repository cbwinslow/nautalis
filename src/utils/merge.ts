export function merge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key];
    
    if (sourceValue === undefined) continue;
    
    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key as keyof T] = merge(targetValue, sourceValue) as T[keyof T];
    } else {
      result[key as keyof T] = sourceValue as T[keyof T];
    }
  }
  
  return result;
}
