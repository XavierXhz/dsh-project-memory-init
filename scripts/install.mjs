#!/usr/bin/env node
/**
 * install.mjs — 把本技能安装到用户级 skill 目录。
 *
 * 用法:
 *   node scripts/install.mjs [--root=dsh|agents] [--link] [--force] [--target=PATH]
 *
 * 默认目标:
 *   dsh    -> $DSH_HOME/skills/project-memory-init   (默认 ~/.dsh/skills/...)
 *   agents -> $DSH_AGENTS_HOME/skills/project-memory-init (默认 ~/.agents/skills/...)
 *
 * 选项:
 *   --link    用符号链接指向当前目录（开发用）
 *   --force   覆盖已存在的安装（只删除同名目标目录）
 *   --target  显式指定目标目录（仍要求目录名为 project-memory-init）
 *
 * 依赖: Node.js 内置模块；不联网。
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = resolve(SCRIPT_DIR, '..');
const SKILL_NAME = 'project-memory-init';
const SKIP = new Set(['.git', 'node_modules', 'dist', 'tests']);

function usage(msg) {
  if (msg) process.stderr.write(`错误: ${msg}\n\n`);
  process.stderr.write(
    '用法: node scripts/install.mjs [--root=dsh|agents] [--link] [--force] [--target=PATH]\n',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { root: 'dsh', link: false, force: false, target: undefined };
  for (const arg of argv) {
    if (arg === '--link') opts.link = true;
    else if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
      if (!['dsh', 'agents'].includes(opts.root)) usage(`未知 root: ${opts.root}`);
    } else if (arg.startsWith('--target=')) opts.target = arg.slice('--target='.length);
    else if (arg === '--help' || arg === '-h') usage();
    else usage(`未知参数: ${arg}`);
  }
  return opts;
}

function baseRoot(kind) {
  if (kind === 'dsh') return process.env.DSH_HOME || join(homedir(), '.dsh');
  return process.env.DSH_AGENTS_HOME || join(homedir(), '.agents');
}

function assertSafeTarget(target) {
  const segments = target.split(sep);
  if (segments.at(-1) !== SKILL_NAME) {
    throw new Error(`目标目录名必须是 ${SKILL_NAME}，实际是 ${target}`);
  }
  const skillsParent = resolve(target, '..');
  if (!skillsParent.endsWith(`${sep}skills`) && !target.includes(`${sep}skills${sep}`)) {
    throw new Error(`目标必须位于 skills/ 目录下: ${target}`);
  }
}

function removeTarget(target) {
  assertSafeTarget(target);
  const st = lstatSync(target);
  if (st.isSymbolicLink()) {
    rmSync(target, { force: true });
    return;
  }
  if (!st.isDirectory()) throw new Error(`目标已存在且不是目录: ${target}`);
  rmSync(target, { recursive: true, force: true });
}

function copySkill(target) {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(SOURCE_DIR, target, {
    recursive: true,
    filter: (src) => {
      const name = src.split(sep).at(-1);
      return !SKIP.has(name);
    },
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(join(SOURCE_DIR, 'SKILL.md'))) {
    usage(`找不到 SKILL.md: ${SOURCE_DIR}`);
  }
  const target = opts.target
    ? resolve(opts.target)
    : join(baseRoot(opts.root), 'skills', SKILL_NAME);
  assertSafeTarget(target);

  if (resolve(target) === SOURCE_DIR) {
    process.stdout.write(`已在本目录（无需安装）: ${target}\n`);
    return;
  }
  if (existsSync(target)) {
    if (!opts.force) {
      const current = lstatSync(target).isSymbolicLink()
        ? ` -> ${readlinkSync(target)}`
        : '';
      usage(
        `目标已存在: ${target}${current}\n如需覆盖，加 --force；开发期可用 --link`,
      );
    }
    removeTarget(target);
  }

  if (opts.link) {
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(SOURCE_DIR, target, process.platform === 'win32' ? 'junction' : 'dir');
    process.stdout.write(`已建立符号链接: ${target} -> ${SOURCE_DIR}\n`);
  } else {
    copySkill(target);
    process.stdout.write(`已安装: ${target}\n`);
  }

  process.stdout.write(
    [
      '',
      '下一步:',
      '  1. 新开一个 DSH 会话（或等待技能目录 watcher 刷新当前会话）',
      '  2. 在一个新目录里说「初始化项目」，或输入 /project-memory-init',
      `  3. 自检: node "${join(target, 'scripts', 'verify-memory.mjs')}" <工作区>`,
      '',
      '更新: 重新拉取本目录后重跑本脚本（--force）；或直接用 git pull 维护安装目录。',
      '卸载: 删除上述目标目录即可。',
    ].join('\n'),
  );
}

main();
