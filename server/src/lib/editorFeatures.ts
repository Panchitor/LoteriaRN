export const EDITOR_FEATURE_KEYS = {
  agencies: "EDITOR_SHOW_AGENCIES",
  schedule: "EDITOR_SHOW_SCHEDULE",
} as const;

export type EditorFeatureVisibility = {
  agencies: boolean;
  schedule: boolean;
};

export const EDITOR_FEATURE_DEFAULTS: EditorFeatureVisibility = {
  agencies: true,
  schedule: false,
};

export function isEditorFeatureEnabled(value: string | null | undefined, defaultValue: boolean) {
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === "true";
}

export function resolveEditorFeatures(configs: { key: string; value: string }[]): EditorFeatureVisibility {
  const valueFor = (key: string) => configs.find(config => config.key === key)?.value;
  return {
    agencies: isEditorFeatureEnabled(valueFor(EDITOR_FEATURE_KEYS.agencies), EDITOR_FEATURE_DEFAULTS.agencies),
    schedule: isEditorFeatureEnabled(valueFor(EDITOR_FEATURE_KEYS.schedule), EDITOR_FEATURE_DEFAULTS.schedule),
  };
}
