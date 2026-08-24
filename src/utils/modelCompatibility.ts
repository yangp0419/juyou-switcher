export function isGptModelName(modelName: string): boolean {
  return /(^|\/)gpt(?:[-_.]|$)/i.test(modelName.trim());
}
