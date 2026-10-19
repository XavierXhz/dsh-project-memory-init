#!/usr/bin/env node
/**
 * verify-memory.mjs — 只读校验工作区的文件记忆体系。
 *
 * 用法:
 *   node verify-memory.mjs [工作区目录] [--profile=dev|ops|knowledge] [--json]
 *
 * 退出码: 0 = 无 ERROR（可有 WARN）；1 = 有 ERROR；2 = 用法/读取错误。
 * 依赖: Node.js 内置模块，无网络、无写入。
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(SCRIPT_DIR, '..', 'templates');

const PROFILE_LABELS = { dev: '开发', ops: '运维', knowledge: '知识' };
const SPEC_VERSION = '2.1';
const AGENTS_REQUIRED = ['工作约定', '边界与红线', '记忆文件'];
const PROTECTED = [
  '进度衔接（必须保留本节原文）',
  '自维护触发器（必须保留本节原文）',
];
const PROFILE_AGENTS_SECTIONS = {
  dev: ['定位与边界', '技术栈', '常用命令', '项目结构'],
  ops: ['管理对象', '环境与访问', '危险操作红线', '常用操作'],
  knowledge: ['学习范围', '知识约定', '当前关注'],
};
const CORE_DOCS = ['PROGRESS.md', 'KNOWN-ISSUES.md', 'DECISIONS.md'];
const DOC_HEADINGS = {
  'PROGRESS.md': ['当前状态', '已完成', '下一步'],
  'KNOWN-ISSUES.md': ['坑列表（新坑放最上）', '已修复'],
  'DECISIONS.md': ['决策列表（新决策放最上）'],
  'RUNBOOK.md': ['管理对象', '日常操作', '故障排查', '备份与恢复', '变更与回滚'],
  'NOTES.md': ['主题索引', '笔记（新笔记放最上）'],
};
const LINE_BUDGET = {
  'AGENTS.md': 60,
  'docs/PROGRESS.md': 120,
  'docs/KNOWN-ISSUES.md': 120,
  'docs/DECISIONS.md': 300,
  'docs/RUNBOOK.md': 300,
  'docs/NOTES.md': 300,
};
const SECRET_PATTERNS = [
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, name: '私钥块' },
  { re: /\bsk-[A-Za-z0-9_-]{16,}\b/, name: 'sk- 形式密钥' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, name: 'AWS Access Key' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/, name: 'GitHub token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, name: 'Slack token' },
  { re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/, name: 'Bearer token' },
];
const CREDENTIAL_KEY_VALUE =
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[:=]\s*['"]?([^\s'"#]+)/gi;

/** 只把「像真实凭据」的键值对当错误；指向位置的中文/变量/占位符不算。 */
function findCredentialValue(text) {
  for (const match of text.matchAll(CREDENTIAL_KEY_VALUE)) {
    const value = match[1] ?? '';
    if (!value) continue;
    if (/[\u4e00-\u9fa5]/.test(value)) continue;
    if (/^\$\{?[A-Za-z_]/.test(value)) continue;
    if (/^[*x]+$/i.test(value)) continue;
    if (/^(?:见|参见|指向|todo|tbd|none|null|n\/a)$/i.test(value)) continue;
    if (value.length >= 6 && /[A-Za-z0-9]/.test(value)) return match[0];
  }
  return null;
}

function usage(msg) {
  if (msg) process.stderr.write(`错误: ${msg}\n\n`);
  process.stderr.write(
    '用法: node verify-memory.mjs [工作区目录] [--profile=dev|ops|knowledge] [--json]\n',
  );
  process.exit(2);
}

function parseArgs(argv) {
  let dir = '.';
  let profile = undefined;
  let json = false;
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg.startsWith('--profile=')) {
      const v = arg.slice('--profile='.length);
      if (!Object.hasOwn(PROFILE_LABELS, v)) usage(`未知类型: ${v}`);
      profile = v;
    } else if (arg === '--help' || arg === '-h') usage();
    else if (arg.startsWith('-')) usage(`未知参数: ${arg}`);
    else dir = arg;
  }
  return { dir: resolve(dir), profile, json };
}

function rel(root, path) {
  return relative(root, path) || '.';
}

function readText(root, relPath) {
  const path = join(root, relPath);
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return readFileSync(path, 'utf8');
}

function detectProfile(root, agentsText) {
  const header = agentsText?.match(/^>\s*类型\s*[:：]\s*(\S+)/m)?.[1];
  if (header) {
    if (/运维|ops/i.test(header)) return 'ops';
    if (/知识|学习|knowledge/i.test(header)) return 'knowledge';
    if (/开发|dev/i.test(header)) return 'dev';
  }
  if (existsSync(join(root, 'docs', 'RUNBOOK.md'))) return 'ops';
  if (existsSync(join(root, 'docs', 'NOTES.md'))) return 'knowledge';
  return 'dev';
}

/** 去掉注释、代码块、行内代码，避免占位符/密钥误报。 */
function stripNoise(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

function normalizeSection(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

function extractSection(text, heading) {
  const lines = (text ?? '').split(/\r?\n/);
  const index = lines.findIndex(
    (line) => line.replace(/^##\s+/, '').replace(/\s+$/, '') === heading,
  );
  if (index < 0) return null;
  const body = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i]) || /^\{\{[A-Z0-9_]+\}\}\s*$/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return { heading, body: normalizeSection(body.join('\n')) };
}

function expectedProtected(profile) {
  const base = readText(TEMPLATE_DIR, 'AGENTS.base.md');
  const trigger = readText(TEMPLATE_DIR, `TRIGGER.${profile}.md`);
  if (base === null || trigger === null) return null;
  return {
    [PROTECTED[0]]: extractSection(base, PROTECTED[0]),
    [PROTECTED[1]]: extractSection(trigger, PROTECTED[1]),
  };
}

function checkPlaceholders(root, relPath, text, errors) {
  const clean = stripNoise(text);
  const braces = [...clean.matchAll(/\{\{[^{}\n]*\}\}/g)];
  for (const m of braces) {
    errors.push(`${relPath}: 模板标记残留 ${m[0]}`);
  }
  const angles = [...clean.matchAll(/<[^<>\n]+>/g)];
  for (const m of angles) {
    const token = m[0];
    if (/^<https?:\/\/[^>]+>$/i.test(token) || /^<mailto:[^>]+>$/i.test(token)) continue;
    if (/^<!--/.test(token) || /^<!/.test(token)) continue;
    errors.push(`${relPath}: 角括号占位符残留 ${token}`);
  }
}

function checkSecrets(relPath, text, errors) {
  for (const { re, name } of SECRET_PATTERNS) {
    if (re.test(text)) errors.push(`${relPath}: 疑似${name}（禁止明文密钥，只写获取位置）`);
  }
  const credential = findCredentialValue(text);
  if (credential !== null) {
    errors.push(`${relPath}: 疑似键值形式的凭据「${credential}」（只写获取位置）`);
  }
}

function checkHeadings(relPath, text, headings, errors) {
  const present = new Set(
    text
      .split(/\r?\n/)
      .filter((line) => /^##\s+/.test(line))
      .map((line) => line.replace(/^##\s+/, '').replace(/\s+$/, '')),
  );
  for (const heading of headings) {
    if (!present.has(heading)) errors.push(`${relPath}: 缺少小节「## ${heading}」`);
  }
}

function checkProtected(relPath, text, profile, errors) {
  const expected = expectedProtected(profile);
  if (expected === null) {
    errors.push('校验器找不到 templates/ 下的保护节原文，无法比对');
    return;
  }
  for (const heading of PROTECTED) {
    const actual = extractSection(text, heading);
    if (actual === null) {
      errors.push(`${relPath}: 缺少保护节「${heading}」`);
      continue;
    }
    if (actual.body !== expected[heading].body) {
      errors.push(`${relPath}: 保护节「${heading}」被改写（必须逐字保留原文）`);
    }
  }
}

function checkProgressDate(relPath, text, warnings) {
  const m = text.match(/^>\s*最后更新\s*[:：]\s*(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/m);
  if (!m) {
    warnings.push(`${relPath}: 缺少「> 最后更新: YYYY-MM-DD HH:mm」`);
    return;
  }
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00`);
  if (Number.isNaN(date.getTime())) {
    warnings.push(`${relPath}: 「最后更新」时间无法解析`);
    return;
  }
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days > 7) warnings.push(`${relPath}: 「最后更新」距今 ${days} 天，收尾时核对「当前状态」`);
}

function scanTodos(root, files, warnings) {
  const items = [];
  for (const relPath of files) {
    const text = readText(root, relPath);
    if (text === null) continue;
    text.split(/\r?\n/).forEach((line, index) => {
      if (/[（(]\s*待补充/.test(line)) {
        items.push(`${relPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  if (items.length > 0) {
    warnings.push(`存在 ${items.length} 处「待补充」，汇报时必须列出，不能假装完整`);
  }
  return items;
}

function checkLineBudget(relPath, text, limit, warnings, errors) {
  const lines = text.split(/\r?\n/).length;
  if (limit === 60 && lines > 80) {
    errors.push(`${relPath}: ${lines} 行，超过硬上限 80 行（目标 ≤ 60）`);
  } else if (lines > limit) {
    warnings.push(`${relPath}: ${lines} 行，超过预算 ${limit} 行（按规范降级/归档）`);
  }
}


/** 检查 AGENTS.md 里的 docs/*.md 指针是否指向真实文件。 */
function checkPointerTargets(root, text, warnings) {
  const clean = stripNoise(text);
  const seen = new Set();
  for (const match of clean.matchAll(/→\s*(docs\/[A-Za-z0-9._-]+\.md)/g)) {
    const target = match[1];
    if (seen.has(target)) continue;
    seen.add(target);
    if (!existsSync(join(root, target))) warnings.push(`AGENTS.md: 指针指向不存在的文件 ${target}`);
  }
}

/** 本机私有文件必须被 .gitignore 覆盖。 */
function checkLocalOverlay(root, warnings, errors) {
  const gitignore = readText(root, '.gitignore') ?? '';
  const localAgents = join(root, 'AGENTS.local.md');
  const localDir = join(root, 'docs', 'local');
  if (existsSync(localAgents)) {
    if (!/AGENTS\.local\.md/.test(gitignore)) warnings.push('AGENTS.local.md: 存在但未被 .gitignore 覆盖，可能被提交');
    const text = readText(root, 'AGENTS.local.md') ?? '';
    checkSecrets('AGENTS.local.md', text, errors);
    checkPlaceholders(root, 'AGENTS.local.md', text, errors);
  }
  if (existsSync(localDir) && !/(^|\/)docs\/local\/?/m.test(gitignore) && !/(^|\/)local\/?/m.test(gitignore)) {
    warnings.push('docs/local/: 存在但未被 .gitignore 覆盖，可能被提交');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.dir;
  if (!existsSync(root) || !statSync(root).isDirectory()) usage(`目录不存在: ${root}`);

  const errors = [];
  const warnings = [];
  const stats = {};
  const agentsText = readText(root, 'AGENTS.md');
  const profile = args.profile ?? detectProfile(root, agentsText);

  if (agentsText === null) {
    errors.push('AGENTS.md: 文件不存在');
  } else {
    stats['AGENTS.md'] = agentsText.split(/\r?\n/).length;
    checkHeadings('AGENTS.md', agentsText, [...AGENTS_REQUIRED, ...PROFILE_AGENTS_SECTIONS[profile]], errors);
    checkProtected('AGENTS.md', agentsText, profile, errors);
    checkPlaceholders(root, 'AGENTS.md', agentsText, errors);
    checkSecrets('AGENTS.md', agentsText, errors);
    checkLineBudget('AGENTS.md', agentsText, 60, warnings, errors);
    const typeLine = agentsText.match(/^>\s*类型\s*[:：]\s*(.+)$/m);
    if (!typeLine) warnings.push('AGENTS.md: 缺少「> 类型: …」行（旧模板可忽略）');
    const versionLine = agentsText.match(/^>.*?规范\s*[:：]\s*project-memory-init\/([0-9.]+)/m);
    if (!versionLine) warnings.push('AGENTS.md: 缺少「> 规范: project-memory-init/2.1」行（旧模板可忽略）');
    else if (versionLine[1] !== SPEC_VERSION) warnings.push(`AGENTS.md: 规范版本 ${versionLine[1]}，当前 ${SPEC_VERSION}，建议按 §10.2 升级`);
    checkPointerTargets(root, agentsText, warnings);
    checkLocalOverlay(root, warnings, errors);
  }

  const requiredDocs = [...CORE_DOCS];
  if (profile === 'ops') requiredDocs.push('RUNBOOK.md');
  if (profile === 'knowledge') requiredDocs.push('NOTES.md');
  const memoryFiles = ['AGENTS.md'];

  for (const docName of [...CORE_DOCS, 'RUNBOOK.md', 'NOTES.md']) {
    const relPath = `docs/${docName}`;
    const text = readText(root, relPath);
    if (text === null) {
      const required = requiredDocs.includes(docName);
      if (required) errors.push(`${relPath}: ${profile} 类型必建文件不存在`);
      continue;
    }
    stats[relPath] = text.split(/\r?\n/).length;
    memoryFiles.push(relPath);
    checkHeadings(relPath, text, DOC_HEADINGS[docName], errors);
    checkPlaceholders(root, relPath, text, errors);
    checkSecrets(relPath, text, errors);
    checkLineBudget(relPath, text, LINE_BUDGET[relPath], warnings, errors);
    if (docName === 'PROGRESS.md') checkProgressDate(relPath, text, warnings);
  }

  const todos = scanTodos(root, memoryFiles, warnings);

  const result = {
    ok: errors.length === 0,
    dir: root,
    profile,
    errors,
    warnings,
    todos: { count: todos.length, items: todos },
    stats,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const label = PROFILE_LABELS[profile];
    process.stdout.write(`记忆体系校验: ${root}\n类型: ${profile} (${label})\n`);
    if (Object.keys(stats).length > 0) {
      process.stdout.write('文件:\n');
      for (const [file, lines] of Object.entries(stats)) {
        process.stdout.write(`  - ${file}: ${lines} 行\n`);
      }
    }
    if (errors.length > 0) {
      process.stdout.write(`\nERROR (${errors.length}):\n`);
      for (const item of errors) process.stdout.write(`  ✗ ${item}\n`);
    }
    if (warnings.length > 0) {
      process.stdout.write(`\nWARN (${warnings.length}):\n`);
      for (const item of warnings) process.stdout.write(`  ! ${item}\n`);
    }
    if (errors.length === 0) {
      process.stdout.write(`\n结果: 通过${warnings.length > 0 ? `（有 ${warnings.length} 条提醒）` : ''}\n`);
    } else {
      process.stdout.write(`\n结果: 未通过（${errors.length} 个 ERROR）\n`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

main();
