import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { sampleSkillRail } from '../skills/sample-data.js';
import { buildSkillInventory } from './skill-inventory.js';

const originalEnv = {
  OPENCLAW_INSTALLED_SKILLS: process.env.OPENCLAW_INSTALLED_SKILLS,
  OPENCLAW_SKILLS_DIR: process.env.OPENCLAW_SKILLS_DIR,
  CODEX_HOME: process.env.CODEX_HOME,
};

afterEach(() => {
  process.env.OPENCLAW_INSTALLED_SKILLS = originalEnv.OPENCLAW_INSTALLED_SKILLS;
  process.env.OPENCLAW_SKILLS_DIR = originalEnv.OPENCLAW_SKILLS_DIR;
  process.env.CODEX_HOME = originalEnv.CODEX_HOME;
});

describe('buildSkillInventory', () => {
  it('preserves sample install flags when no runtime signals are available', () => {
    delete process.env.OPENCLAW_INSTALLED_SKILLS;
    delete process.env.OPENCLAW_SKILLS_DIR;
    delete process.env.CODEX_HOME;

    const inventory = buildSkillInventory(sampleSkillRail.skills);

    expect(inventory.source).toBe('sample');
    expect(inventory.skills.find((skill) => skill.id === 'skill-plan-writer')?.installed).toBe(true);
    expect(inventory.skills.find((skill) => skill.id === 'skill-plan-writer')?.enabled).toBe(true);
  });

  it('uses explicit environment override when provided', () => {
    process.env.OPENCLAW_INSTALLED_SKILLS = 'plan_writer, qa_handoff';
    delete process.env.OPENCLAW_SKILLS_DIR;

    const inventory = buildSkillInventory(sampleSkillRail.skills);

    expect(inventory.source).toBe('env');
    expect(inventory.skills.find((skill) => skill.id === 'skill-plan-writer')?.installed).toBe(true);
    expect(inventory.skills.find((skill) => skill.id === 'skill-repo-search')?.installed).toBe(false);
    expect(inventory.skills.find((skill) => skill.id === 'skill-repo-search')?.enabled).toBe(false);
  });

  it('falls back to filesystem detection when env override is missing', () => {
    delete process.env.OPENCLAW_INSTALLED_SKILLS;

    const root = mkdtempSync(join(tmpdir(), 'runtime-skills-'));
    const skillsDir = join(root, 'skills');
    mkdirSync(skillsDir);
    mkdirSync(join(skillsDir, 'repo_search'));

    process.env.OPENCLAW_SKILLS_DIR = skillsDir;

    const inventory = buildSkillInventory(sampleSkillRail.skills);

    expect(inventory.source).toBe('filesystem');
    expect(inventory.skills.find((skill) => skill.id === 'skill-repo-search')?.installed).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });
});
