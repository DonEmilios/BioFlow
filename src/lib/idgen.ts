let counter = 0;
export function v4Fallback(): string {
  counter++;
  return `node_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}
