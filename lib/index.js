import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Bundle-provided skill provider.
 *
 * The package root is also the skill root: SKILL.md, templates/, scripts/, and
 * reference/ ship beside lib/index.js. Registering a provider (instead of
 * copying files into ~/.dsh/skills) keeps installation to one plugin-manager
 * action and lets the skill's relative paths keep working.
 *
 * @module dsh-project-memory-init
 */

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKILL_PATH = join(PACKAGE_ROOT, 'SKILL.md');
const RESOURCE_BASE = { kind: 'directory', path: PACKAGE_ROOT };
const PROVIDER_NAME = 'project-memory-init';
const SKILL_NAME = 'project-memory-init';
const DESCRIPTION =
  '初始化或升级工作区的跨会话文件记忆体系：生成 AGENTS.md 与 docs/PROGRESS.md、KNOWN-ISSUES.md、DECISIONS.md，并按工作区类型追加 RUNBOOK.md（运维）或 NOTES.md（知识学习）。当用户说「初始化项目 / 初始化工作区 / 建立项目记忆 / 生成 AGENTS.md / 记忆规范 / 新目录开工」，或在一个没有记忆文件的新目录开始长期工作时使用。自动识别开发/运维/知识三类场景；不覆盖已有文件，不写密钥，不编造命令。';
const INVOCATION = { modelInvocable: true, userInvocable: true };
// Matches BUNDLED_SKILL_RANK in @deepseek-ai/dsh-skill. Hard-coded so the
// plugin has no runtime dependency on an internal package version.
const BUNDLED_RANK = 600;

const CANDIDATE = {
  name: SKILL_NAME,
  description: DESCRIPTION,
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: RESOURCE_BASE,
  rank: BUNDLED_RANK,
  locator: SKILL_PATH,
};

/** Strip YAML frontmatter before handing the body to the model. */
function skillBody(raw) {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

const provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get() {
    const raw = await readFile(SKILL_PATH, 'utf8');
    return {
      name: SKILL_NAME,
      description: DESCRIPTION,
      invocation: INVOCATION,
      provider: PROVIDER_NAME,
      source: 'bundled',
      resourceBase: RESOURCE_BASE,
      content: skillBody(raw),
    };
  },
};

/** Cordis plugin name. */
const name = 'project-memory-init';
/** Service required by the skill provider. */
const inject = ['skills'];

/** Register the bundled project-memory-init skill provider. */
function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}

export { apply, inject, name };
