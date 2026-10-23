#!/usr/bin/env node
/**
 * run-tests.mjs — 自测：模板拼装、校验器、安装脚本。
 * 用法: node tests/run-tests.mjs
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TEST_DIR, '..');
const TEMPLATES = join(ROOT, 'templates');
const VERIFY = join(ROOT, 'scripts', 'verify-memory.mjs');
const INSTALL = join(ROOT, 'scripts', 'install.mjs');

let passed = 0;
let failed = 0;
const failures = [];

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    process.stdout.write(`  ✗ ${name}\n    ${String(error.message ?? error).split('\n')[0]}\n`);
  }
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    process.stdout.write(`  ✗ ${name}\n    ${String(error.message ?? error).split('\n')[0]}\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}（期望 ${expected}，实际 ${actual}）`);
}

function tpl(name) {
  return readFileSync(join(TEMPLATES, name), 'utf8');
}

function fill(text, facts) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (all, key) =>
    Object.hasOwn(facts, key) ? String(facts[key]) : '（待补充）',
  );
}

const PROFILE_LABEL = { dev: '开发', ops: '运维' };

function assemble(profile, dir, facts = {}) {
  const date = '2026-10-19';
  const baseFacts = {
    PROJECT_NAME: 'demo-project',
    PROFILE_LABEL: PROFILE_LABEL[profile],
    SPEC_VERSION: '2.3',
    DATE: date,
    DATETIME: `${date} 10:00`,
    ONE_LINE_DESC: '用于自测的示例工作区。',
    WHAT_WHO: '给自测用的示例工具，面向开发者。',
    NON_GOALS: '不追求性能与生产可用性。',
    CONVENTION: '提交前跑测试；测试不过不提交',
    STACK: 'Node.js 22 / 无外部依赖',
    CMD_INSTALL: 'npm install',
    CMD_DEV: 'npm run dev',
    CMD_TEST: 'npm test',
    CMD_BUILD: 'npm run build',
    STRUCTURE: '- src/    源码\n- docs/   文档',
    TARGETS: '- demo-host — 演示服务 — 入口: ssh demo',
    NON_GOALS: '不管理数据库实例。',
    ENVIRONMENTS: '测试环境（自测）',
    ACCESS_POINTER: '凭据见密码管理器条目 demo',
    CHANGE_WINDOW: '任意时间（自测）',
    OPS_ROUTINES: '- 重启: 见 docs/RUNBOOK.md',
    FOCUS: '自测',
    CURRENT_STATE: '刚初始化记忆体系，尚未开始实质工作。',
    FILE_LIST: 'AGENTS.md、docs/PROGRESS.md 等',
    NEXT_STEPS: '- [ ] （待补充：第一个具体任务）',
    EXTRA_DECISION: profile === 'ops' ? '、RUNBOOK.md' : '',
    EXTRA_POINTERS: profile === 'ops' ? '- 运维步骤 → docs/RUNBOOK.md（操作前先看）' : '',
    TOPIC: '示例主题',
    CONCLUSION: '示例结论',
    SOURCE: '自测',
    OPEN: '无',
    ...facts,
  };

  const agents = fill(
    tpl('AGENTS.base.md')
      .replace('{{PROFILE_SECTIONS}}', tpl(`AGENTS.${profile}.md`).trim())
      .replace('{{TRIGGER_SECTION}}', tpl(`TRIGGER.${profile}.md`).trim()),
    baseFacts,
  );
  writeFileSync(join(dir, 'AGENTS.md'), agents);

  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'PROGRESS.md'), fill(tpl('PROGRESS.md'), baseFacts));
  writeFileSync(join(dir, 'docs', 'KNOWN-ISSUES.md'), fill(tpl('KNOWN-ISSUES.md'), baseFacts));
  writeFileSync(join(dir, 'docs', 'DECISIONS.md'), fill(tpl('DECISIONS.md'), baseFacts));

  if (profile === 'ops') writeFileSync(join(dir, 'docs', 'RUNBOOK.md'), fill(tpl('RUNBOOK.md'), baseFacts));

  const leftovers = agents.match(/\{\{[^}]+\}\}/g);
  assert(leftovers === null, `AGENTS.md 仍有模板标记: ${leftovers?.join(', ')}`);
  return agents;
}

function runVerify(dir, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [VERIFY, dir, '--json', ...extraArgs],
    { encoding: 'utf8' },
  );
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* 保留原始输出用于断言 */
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pmi-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

process.stdout.write('project-memory-init 自测\n\n');

process.stdout.write('[1] 模板与技能元数据\n');
check('SKILL.md frontmatter 合法且描述在 500 字符内', () => {
  const text = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert(m !== null, '缺少 YAML frontmatter');
  assert(/^name:\s*project-memory-init$/m.test(m[1]), 'name 必须是 project-memory-init');
  const desc = m[1].match(/^description:\s*>-\n([\s\S]*?)(?=\n[a-z-]+:|\n*$)/m);
  assert(desc !== null, '缺少 description');
  const flatten = desc[1].replace(/\s+/g, ' ').trim();
  assert(flatten.length > 20, 'description 太短');
  assert(flatten.length <= 500, `description ${flatten.length} 字符，会被目录截断`);
});

check('开发/运维模板齐全，且知识类模板已移除', () => {
  for (const gone of ['AGENTS.knowledge.md', 'TRIGGER.knowledge.md', 'NOTES.md']) {
    assert(!existsSync(join(TEMPLATES, gone)), `知识类模板应已删除: ${gone}`);
  }
  for (const p of ['dev', 'ops']) {
    assert(existsSync(join(TEMPLATES, `AGENTS.${p}.md`)), `缺 AGENTS.${p}.md`);
    assert(existsSync(join(TEMPLATES, `TRIGGER.${p}.md`)), `缺 TRIGGER.${p}.md`);
    const trigger = tpl(`TRIGGER.${p}.md`);
    assert(/## 自维护触发器（必须保留本节原文）/.test(trigger), `TRIGGER.${p}.md 缺保护节标题`);
    assert(/## 进度衔接（必须保留本节原文）/.test(tpl('AGENTS.base.md')), 'base 缺进度衔接节');
  }
  assert(tpl('RUNBOOK.md').includes('## 变更与回滚'), 'RUNBOOK 缺回滚节');
});

check('目录与文档存在', () => {
  for (const file of ['README.md', 'BOOTSTRAP-PROMPT.md', 'reference/SPEC.zh.md', 'reference/RESEARCH-2026-10.zh.md', 'scripts/install.mjs', 'lib/index.js', 'cordis.patch.yml', 'package.json']) {
    assert(existsSync(join(ROOT, file)), `缺 ${file}`);
  }
});

check('bundle 插件元数据完整', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assertEqual(pkg.name, 'dsh-project-memory-init', '包名');
  assertEqual(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'bundle patch');
  assert(typeof pkg.engines?.dsh === 'string' && pkg.engines.dsh.length > 0, '缺 engines.dsh');
  for (const file of ['SKILL.md', 'templates', 'reference', 'scripts', 'lib/index.js']) {
    assert(pkg.files.includes(file), `files 未包含 ${file}`);
  }
  const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8');
  assert(patch.includes("name: 'dsh-project-memory-init'"), 'patch 未插入包名');
  const lib = readFileSync(join(ROOT, 'lib/index.js'), 'utf8');
  assert(!/from\s+['"]@deepseek-ai\//.test(lib), '插件不应 import 内部 @deepseek-ai 包');
});

check('本机模板不叫 AGENTS.local.md（避免被自动加载）', () => {
  assert(existsSync(join(TEMPLATES, 'AGENTS.local.template.md')), '缺本机模板');
  assert(!existsSync(join(TEMPLATES, 'AGENTS.local.md')), '模板名会被 DSH 当成真实本机指令加载');
});

check('SKILL.md 包含 opt-out 与默认工作区规则', () => {
  const text = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  assert(text.includes('.dsh/no-project-memory'), '缺 opt-out marker 规则');
  assert(text.includes('记忆: 关闭'), '缺 AGENTS 记忆关闭规则');
});

check('AGENTS 模板含三条通用规则', () => {
  const base = readFileSync(join(TEMPLATES, 'AGENTS.base.md'), 'utf8');
  assert(base.includes('删除/移动文档或代码前先 grep 引用'), '缺 grep 引用规则');
  assert(base.includes('同一主题只保留一个活跃载体'), '缺单一活跃载体规则');
  assert(base.includes('推送公开仓库前'), '缺公开仓库检查规则');
});

check('SKILL.md 声明不动用户既有文档', () => {
  const text = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  assert(text.includes('不动用户既有文档'), '缺既有文档保护边界');
  assert(text.includes('不要删、不要移动'), '缺业务文档处理指引');
});

check('SKILL.md 声明知识类目录不初始化', () => {
  const text = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  assert(text.includes('知识/学习类目录') || text.includes('知识类目录'), '缺知识类不初始化说明');
  assert(!text.includes('AGENTS.knowledge.md'), '仍引用已删除的知识模板');
  assert(!text.includes('TRIGGER.knowledge.md'), '仍引用已删除的知识触发器模板');
});

process.stdout.write('\n[2] 生成 + 校验（三类工作区）\n');
for (const profile of ['dev', 'ops']) {
  check(`${profile} 工作区生成后校验通过`, () => {
    withTemp((dir) => {
      const agents = assemble(profile, dir);
      const result = runVerify(dir);
      assertEqual(result.status, 0, `校验失败: ${result.json?.errors?.join('; ') ?? result.stderr}`);
      assertEqual(result.json.ok, true, 'ok 应为 true');
      assertEqual(result.json.profile, profile, '类型识别错误');
      const required = ['AGENTS.md', 'docs/PROGRESS.md', 'docs/KNOWN-ISSUES.md', 'docs/DECISIONS.md'];
      if (profile === 'ops') required.push('docs/RUNBOOK.md');
      for (const rel of required) assert(existsSync(join(dir, rel)), `缺 ${rel}`);
      const lines = agents.split(/\r?\n/).length;
      assert(lines <= 60, `AGENTS.md ${lines} 行，超过 60 行预算`);
      assert(result.json.todos.count >= 0, 'todos 统计缺失');
      assert(!result.json.warnings.some((w) => w.includes('规范版本') || w.includes('缺少「> 规范')), '版本行未识别');
    });
  });
}

check('ops 工作区没有 RUNBOOK 时校验失败', () => {
  withTemp((dir) => {
    assemble('ops', dir);
    rmSync(join(dir, 'docs', 'RUNBOOK.md'));
    const result = runVerify(dir);
    assertEqual(result.status, 1, '应校验失败');
    assert(result.json.errors.some((e) => e.includes('RUNBOOK.md')), '应报告缺 RUNBOOK');
  });
});

process.stdout.write('\n[3] 校验器能发现错误\n');
check('保护节被改写 → ERROR', () => {
  withTemp((dir) => {
    let agents = assemble('dev', dir);
    agents = agents.replace('必须更新 docs/PROGRESS.md', '更新 docs/PROGRESS.md');
    writeFileSync(join(dir, 'AGENTS.md'), agents);
    const result = runVerify(dir);
    assertEqual(result.status, 1, '应校验失败');
    assert(result.json.errors.some((e) => e.includes('保护节')), '应报告保护节被改写');
  });
});

check('模板标记残留 → ERROR', () => {
  withTemp((dir) => {
    const agents = `${assemble('dev', dir)}\n{{LEFTOVER}}\n`;
    writeFileSync(join(dir, 'AGENTS.md'), agents);
    const result = runVerify(dir);
    assertEqual(result.status, 1, '应校验失败');
    assert(result.json.errors.some((e) => e.includes('模板标记残留')), '应报告模板标记残留');
  });
});

check('明文凭据 → ERROR', () => {
  withTemp((dir) => {
    assemble('dev', dir);
    const progress = readFileSync(join(dir, 'docs', 'PROGRESS.md'), 'utf8');
    writeFileSync(join(dir, 'docs', 'PROGRESS.md'), `${progress}\npassword: hunter2\n`);
    const result = runVerify(dir);
    assertEqual(result.status, 1, '应校验失败');
    assert(result.json.errors.some((e) => e.includes('凭据')), '应报告疑似凭据');
  });
});

check('知识类目录 → 跳过且 exit 0（不报缺少文件）', () => {
  withTemp((dir) => {
    mkdirSync(join(dir, 'notes'), { recursive: true });
    writeFileSync(join(dir, 'README.md'), '# 学习笔记\n');
    writeFileSync(join(dir, 'notes', 'topic.md'), '# 主题\n');
    const result = runVerify(dir);
    assertEqual(result.status, 0, '知识目录不应失败');
    assertEqual(result.json.skipped, true, '应标记 skipped');
    assertEqual(result.json.reason, 'knowledge workspace is out of scope', 'reason 应为知识类');
  });
});

check('未初始化且无信号 → 跳过', () => {
  withTemp((dir) => {
    const result = runVerify(dir);
    assertEqual(result.status, 0, '空目录不应失败');
    assertEqual(result.json.skipped, true, '应标记 skipped');
  });
});

check('有开发信号但缺文件 → 仍然 ERROR', () => {
  withTemp((dir) => {
    writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
    const result = runVerify(dir);
    assertEqual(result.status, 1, '开发项目缺记忆文件应报错');
    assert(result.json.errors.length > 0, '应有 ERROR');
  });
});

check('opt-out 标记 → 跳过且 exit 0', () => {
  withTemp((dir) => {
    mkdirSync(join(dir, '.dsh'), { recursive: true });
    writeFileSync(join(dir, '.dsh', 'no-project-memory'), '');
    const result = runVerify(dir);
    assertEqual(result.status, 0, 'opt-out 不应失败');
    assertEqual(result.json.skipped, true, '应标记 skipped');
  });
});

check('缺 PROGRESS.md → ERROR', () => {
  withTemp((dir) => {
    assemble('dev', dir);
    rmSync(join(dir, 'docs', 'PROGRESS.md'));
    const result = runVerify(dir);
    assertEqual(result.status, 1, '应校验失败');
    assert(result.json.errors.some((e) => e.includes('PROGRESS.md')), '应报告缺文件');
  });
});

check('「（待补充）」只产生 WARN', () => {
  withTemp((dir) => {
    assemble('dev', dir, { CMD_TEST: '（待补充：测试命令）' });
    const result = runVerify(dir);
    assertEqual(result.status, 0, '待补充不应导致失败');
    assert(result.json.warnings.some((w) => w.includes('待补充')), '应提醒待补充');
  });
});

check('本机私有文件未 gitignore → WARN', () => {
  withTemp((dir) => {
    assemble('dev', dir);
    writeFileSync(join(dir, 'AGENTS.local.md'), '# 本机\n- 路径: /tmp\n');
    const result = runVerify(dir);
    assertEqual(result.status, 0, '不应失败');
    assert(result.json.warnings.some((w) => w.includes('AGENTS.local.md')), '应提醒未 gitignore');
  });
});

check('本机私有文件已 gitignore → 不提醒', () => {
  withTemp((dir) => {
    assemble('dev', dir);
    writeFileSync(join(dir, 'AGENTS.local.md'), '# 本机\n- 路径: /tmp\n');
    writeFileSync(join(dir, '.gitignore'), 'AGENTS.local.md\ndocs/local/\n');
    const result = runVerify(dir);
    assertEqual(result.status, 0, '不应失败');
    assert(!result.json.warnings.some((w) => w.includes('AGENTS.local.md')), '已 gitignore 不应提醒');
  });
});

check('AGENTS.md 指针指向缺失文件 → WARN', () => {
  withTemp((dir) => {
    const agents = `${assemble('dev', dir)}\n- 运维步骤 → docs/RUNBOOK.md\n`;
    writeFileSync(join(dir, 'AGENTS.md'), agents);
    const result = runVerify(dir);
    assertEqual(result.status, 0, '指针问题应为 WARN');
    assert(result.json.warnings.some((w) => w.includes('docs/RUNBOOK.md')), '应提醒缺失指针');
  });
});

process.stdout.write('\n[4] 安装脚本\n');
check('install.mjs 安装/重复安装/覆盖', () => {
  withTemp((root) => {
    const home = join(root, 'home');
    mkdirSync(home, { recursive: true });
    const env = { ...process.env, DSH_HOME: home };
    const first = spawnSync(process.execPath, [INSTALL, '--root=dsh'], { env, encoding: 'utf8' });
    assertEqual(first.status, 0, `首次安装失败: ${first.stderr}`);
    const target = join(home, 'skills', 'project-memory-init');
    assert(existsSync(join(target, 'SKILL.md')), '安装后缺 SKILL.md');
    assert(!existsSync(join(target, '.git')), '不应复制 .git');
    const second = spawnSync(process.execPath, [INSTALL, '--root=dsh'], { env, encoding: 'utf8' });
    assertEqual(second.status, 2, '重复安装应拒绝（exit 2）');
    const third = spawnSync(process.execPath, [INSTALL, '--root=dsh', '--force'], { env, encoding: 'utf8' });
    assertEqual(third.status, 0, `--force 覆盖失败: ${third.stderr}`);
  });
});

process.stdout.write('\n[5] 规范文档自洽\n');
check('SPEC 为 v2.3 且收录文档生命周期/脚手架坑', () => {
  const spec = readFileSync(join(ROOT, 'reference', 'SPEC.zh.md'), 'utf8');
  assert(spec.startsWith('# 工作区文件记忆规范 v2.3'), '版本应为 v2.3');
  assert((spec.match(/^## 进度衔接（必须保留本节原文）/gm) ?? []).length === 3, '进度衔接原文应为 3 份（结构示例 + dev + ops）');
  assert((spec.match(/^## 自维护触发器（必须保留本节原文）/gm) ?? []).length === 3, '触发器原文应为 3 份（结构示例 + dev + ops）');
  assert(spec.includes('知识/学习类目录：不初始化'), '缺知识类不初始化的设计决策节');
  assert(spec.includes('### 9.12 文档生命周期'), '缺文档生命周期节');
  assert(spec.includes('### 9.13 脚手架/生成器自身的坑'), '缺脚手架坑节');
});

process.stdout.write('\n[6] bundle 插件 provider\n');
await checkAsync('provider 注册并可加载 SKILL.md', async () => {
  const mod = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href);
  let provider;
  const ctx = { skills: { registerProvider(factory) { provider = factory(); } } };
  mod.apply(ctx);
  assert(provider !== undefined, '未注册 provider');
  const candidates = await provider.list();
  assertEqual(candidates.length, 1, '候选数量');
  assertEqual(candidates[0].name, 'project-memory-init', 'skill 名');
  assert(candidates[0].resourceBase.path.includes('project-memory-init'), 'resourceBase 路径');
  const loaded = await provider.get(candidates[0]);
  assert(loaded.content.includes('# 项目记忆初始化'), '未加载 SKILL.md 正文');
  assert(loaded.content.includes('第 1 步：侦察'), '正文不完整');
  assert(!loaded.content.startsWith('---'), '未剥离 frontmatter');
});

process.stdout.write(`\n结果: ${passed} 通过, ${failed} 失败\n`);
if (failed > 0) {
  for (const { name, error } of failures) {
    process.stdout.write(`\n[${name}]\n${error.stack ?? error}\n`);
  }
  process.exit(1);
}
