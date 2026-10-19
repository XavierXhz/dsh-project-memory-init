# project-memory-init

给 DSH 用的「工作区文件记忆体系」初始化技能：说一句 **「初始化项目」**，就能在一个新目录里生成
`AGENTS.md` + `docs/PROGRESS.md` / `KNOWN-ISSUES.md` / `DECISIONS.md`，并按工作区类型追加
`RUNBOOK.md`（运维）或 `NOTES.md`（知识学习）。

- 纯 Markdown + 一个零依赖 Node 校验脚本；不建数据库、不装包、不联网。
- 目标：**换电脑 / 换目录，一句话就能恢复同一套工作记忆规范。**
- 配套规范：`reference/SPEC.zh.md`（v2.0）；模板：`templates/`。

---

## 为什么是 Skill，不是 Plugin，也不是一段提示词

| 形态 | 适合什么 | 结论 |
|---|---|---|
| **Skill（本仓库）** | 可复用的任务指令 + 模板 + 脚本；按需加载，不进每轮上下文 | ✅ **主形态** |
| Plugin | 需要运行时能力：UI、命令、工具、自动注入、后台任务 | ❌ 本需求没有运行时行为；做插件只会增加 npm 打包与版本门禁负担 |
| Prompt | 首次安装、离线兜底、临时使用 | ✅ **只做引导/兜底**（见 `BOOTSTRAP-PROMPT.md`） |

DSH 原生支持用户级 skill 根：`~/.dsh/skills/`、`~/.agents/skills/`，新会话的技能目录会自动列出。
本技能被加载后给出「初始化项目」的触发描述，模型按目录现状生成文件——这正好是 Skill 的职责。
把它做成插件，收益只是「多一个安装入口」，代价是每次 DSH 升级都要跟着适配；不划算。

> 如果你以后想要「一条 `dsh plugin add` 就装好」的体验，可以把本目录包成一个只注册 skill provider 的
> 小插件（类似官方 `dsh-skill-badge` 的做法）；但日常维护仍然是这套 Markdown，插件只是外壳。

---

## 安装

### 方式 1：克隆到用户级 skill 根（推荐，跨机器最省事）

```bash
git clone <YOUR_REPO_URL> ~/.dsh/skills/project-memory-init
# 或跨工具共享根：
# git clone <YOUR_REPO_URL> ~/.agents/skills/project-memory-init
```

克隆完即可用；更新时 `git -C ~/.dsh/skills/project-memory-init pull`。

### 方式 2：复制目录 + 安装脚本（U 盘 / 网盘 / 内网传输）

```bash
node scripts/install.mjs                 # 装到 ~/.dsh/skills/project-memory-init
node scripts/install.mjs --root=agents   # 装到 ~/.agents/skills/project-memory-init
node scripts/install.mjs --link          # 开发期：符号链接到当前目录
node scripts/install.mjs --force         # 覆盖已有安装
```

Windows 同样用 `node scripts/install.mjs`；无需 PowerShell 脚本。

### 方式 3：完全空白、暂时没有本仓库

把 `BOOTSTRAP-PROMPT.md` 里「场景 B」整段粘贴给新机器上的 DSH，让它在当前目录直接生成最小可用版本；
等能访问仓库后，再用方式 1/2 补装完整技能。

安装完成后：**新开一个会话**（或等技能目录 watcher 刷新），说「初始化项目」或输入 `/project-memory-init`。

---

## 使用

在一个新目录的会话里：

```text
初始化项目
```

技能会：

1. 侦察当前目录（`package.json` / `pyproject.toml` / `docker-compose.yml` / 已有文档……）；
2. 判定类型（开发 / 运维 / 知识），能从文件推断的不问；
3. 生成 `AGENTS.md` 与对应 `docs/` 文件，未知项标 `（待补充）`，不编造；
4. 跑 `scripts/verify-memory.mjs` 自检（保护节、占位符、密钥、行数）；
5. 汇报文件清单与待补项，建议是否 `git commit`。

可选说法：

| 说法 | 效果 |
|---|---|
| `初始化项目` | 自动判定类型并生成 |
| `初始化一个运维工作区` | 强制 `ops`，生成 `RUNBOOK.md` |
| `初始化学习工作区` | 强制 `knowledge`，生成 `NOTES.md` |
| `升级记忆规范` | 对已有项目补缺节/补文件，不覆盖旧内容 |
| `初始化全局偏好` | 生成 `~/.dsh/AGENTS.md`（≤20 行，先确认） |

生成后的示例结构：

```text
my-project/
├── AGENTS.md
└── docs/
    ├── PROGRESS.md
    ├── KNOWN-ISSUES.md
    ├── DECISIONS.md
    └── RUNBOOK.md        # ops；或 NOTES.md（knowledge）
```

---

## 三类工作区

| 类型 | 用来做什么 | AGENTS.md 专属节 | 额外文件 |
|---|---|---|---|
| `dev` | 自己开发的项目 | 技术栈 / 常用命令 / 项目结构 | — |
| `ops` | 服务器、服务、部署的日常运维 | 管理对象 / 环境与访问 / 危险操作红线 / 常用操作 | `docs/RUNBOOK.md` |
| `knowledge` | 杂项知识提问、调研、学习 | 学习范围 / 知识约定 / 当前关注 | `docs/NOTES.md` |

规则细节见 `reference/SPEC.zh.md`。核心约定：

- `AGENTS.md` ≤ 60 行，只放恒真事实；进度/坑/决策/步骤各归其文档。
- 两个「必须保留本节原文」的保护节（进度衔接、自维护触发器）不可改写。
- 每次收尾更新 `PROGRESS.md`；踩坑记 `KNOWN-ISSUES.md`；定案记 `DECISIONS.md`。
- 不写明文密钥；只写「去哪找」。
- 并行会话写前先 `read`（读-改-写）；改记忆文件用编辑工具（快照陷阱）。

---

## 跨机器同步（家里 / 公司 / 出差）

1. 把本目录（或整个技能仓）放进一个**私有 git 仓库**。
2. 每台机器只需一次：`git clone <URL> ~/.dsh/skills/project-memory-init`。
3. 更新：`git -C ~/.dsh/skills/project-memory-init pull`。
4. 不想用 git：用网盘/U 盘同步整个目录，再在新机器上 `node scripts/install.mjs`。
5. 工作区本身的记忆文件也建议进各自项目仓库（或单独的 memory 仓库），否则换机器只带走了技能、没带走记忆。

> 技能是「生成器」，工作区里的 `AGENTS.md`/`docs/` 才是「记忆」。两者都要跨机器同步。

---

## 目录结构

```text
project-memory-init/
├── SKILL.md                  # 技能入口（模型加载的指令）
├── README.md                 # 本文件（给人看）
├── BOOTSTRAP-PROMPT.md       # 空白 DSH 的一次性引导提示词
├── templates/                # 逐字模板（base + 类型差异 + 文档）
├── reference/SPEC.zh.md      # 规范正文 v2.0
├── scripts/
│   ├── verify-memory.mjs     # 只读校验
│   └── install.mjs           # 安装到用户级 skill 根
└── tests/run-tests.mjs       # 自测（生成 + 校验 + 安装）
```

---

## 维护与卸载

- 更新：`git pull`（或重新复制后 `install.mjs --force`）。
- 卸载：删除 `~/.dsh/skills/project-memory-init`。
- 自测：`node tests/run-tests.mjs`（会在临时目录生成 3 类工作区并校验）。
- 校验某个工作区：`node scripts/verify-memory.mjs <工作区目录>`。

## 设计依据（DSH 机制事实）

- 技能发现根：项目 `<root>/.dsh/skills`、`<root>/.agents/skills`；用户 `~/.dsh/skills`、`~/.agents/skills`；本技能放用户根即全局可用。
- `AGENTS.md` 由 DSH 自动加载（`.git` 向上找根；无 `.git` 时用当前目录），并支持 `AGENTS.local.md` 覆盖。
- 上下文里的 `AGENTS.md` 是快照：用编辑工具改才会刷新；bash/外部编辑器改不触发。
- 用户级 `~/.dsh/AGENTS.md` 也会自动加载：只放跨项目偏好，别放项目内容。
- 技能目录热更新：新增/修改 `SKILL.md` 会触发目录 watcher；老会话不一定立即刷新，新会话最稳。

## 版本

v2.0（2026-10-19）：三类工作区、`RUNBOOK.md`/`NOTES.md`、边界与红线、按类型触发器、拒绝写入清单、复验/归档、跨机器安装。
