export type EvidencePreset = 'Frontend Error' | 'API Failure' | 'UI Layout Issue' | 'Performance Issue';
export type EvidenceSection = 'runtime' | 'network' | 'environment' | 'screenshot' | 'reproduction';

const presets: Record<EvidencePreset, EvidenceSection[]> = {
  'Frontend Error': ['runtime', 'environment', 'screenshot', 'reproduction'],
  'API Failure': ['network', 'runtime', 'environment', 'reproduction'],
  'UI Layout Issue': ['environment', 'screenshot', 'reproduction'],
  'Performance Issue': ['network', 'environment', 'reproduction'],
};

export function sectionsForPreset(preset: EvidencePreset): EvidenceSection[] { return presets[preset]; }
