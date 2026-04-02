import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { SkillMetadata } from '../skills/sample-data.js';

export interface SkillInventory {
  detectedAt: string;
  source: 'env' | 'filesystem' | 'sample';
  skills: SkillMetadata[];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function readSkillNamesFromEnv(): Set<string> {
  const envValue = process.env.OPENCLAW_INSTALLED_SKILLS;

  if (!envValue || envValue.trim().length === 0) {
    return new Set();
  }

  const values = envValue
    .split(',')
    .map((item) => normalizeName(item))
    .filter((item) => item.length > 0);

  return new Set(values);
}

function readSkillNamesFromFilesystem(): Set<string> {
  const configuredDir = process.env.OPENCLAW_SKILLS_DIR;
  const codexHomeDir = process.env.CODEX_HOME ? join(process.env.CODEX_HOME, 'skills') : null;
  const candidateDirs = [configuredDir, codexHomeDir].filter((value): value is string => Boolean(value));
  const names = new Set<string>();

  candidateDirs.forEach((directory) => {
    try {
      const entries = readdirSync(directory, { withFileTypes: true });

      entries.forEach((entry) => {
        if (entry.isDirectory()) {
          names.add(normalizeName(entry.name));
        }
      });
    } catch {
      // Ignore inaccessible directories and continue with remaining options.
    }
  });

  return names;
}

function resolveDetectedNames(): { source: SkillInventory['source']; names: Set<string> } {
  const fromEnv = readSkillNamesFromEnv();

  if (fromEnv.size > 0) {
    return {
      source: 'env',
      names: fromEnv,
    };
  }

  const fromFilesystem = readSkillNamesFromFilesystem();

  if (fromFilesystem.size > 0) {
    return {
      source: 'filesystem',
      names: fromFilesystem,
    };
  }

  return {
    source: 'sample',
    names: new Set(),
  };
}

function skillMatchesDetectedName(skill: SkillMetadata, detectedNames: Set<string>): boolean {
  if (detectedNames.size === 0) {
    return skill.installed;
  }

  const candidates = [skill.id, skill.name, skill.displayName]
    .map((value) => normalizeName(value))
    .filter((value) => value.length > 0);

  return candidates.some((candidate) => detectedNames.has(candidate));
}

export function buildSkillInventory(baseSkills: SkillMetadata[]): SkillInventory {
  const detected = resolveDetectedNames();

  return {
    detectedAt: new Date().toISOString(),
    source: detected.source,
    skills: baseSkills.map((skill) => {
      const installed = skillMatchesDetectedName(skill, detected.names);
      return {
        ...skill,
        installed,
        enabled: installed ? skill.enabled : false,
      };
    }),
  };
}
