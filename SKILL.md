---
name: project-memory-init
description: >-
  初始化或升级工作区的跨会话文件记忆体系：生成 AGENTS.md 与 docs/PROGRESS.md、
  KNOWN-ISSUES.md、DECISIONS.md，并按工作区类型追加 RUNBOOK.md（运维）或
  NOTES.md（知识学习）。当用户说「初始化项目 / 初始化工作区 / 建立项目记忆 /
  生成 AGENTS.md / 记忆规范 / 新目录开工」，或在一个没有记忆文件的新目录开始
  长期工作时使用。自动识别开发/运维/知识三类场景；不覆盖已有文件，不写密钥，
  不编造命令。
---

# 项目记忆初始化

把空白或半空白的工作区，变成「新会话一进来就知道上下文」的文件记忆工作区。
只写显式 Markdown 文件，不建数据库、不装依赖、不引入自动记忆。

## 先读参考（按需渐进加载）

| 文件 | 何时读 |
|---|---|
| `reference/SPEC.zh.md` | 开始前至少读 §1、§3、§10；生成后按 §11 自检 |
| `templates/AGENTS.base.md` + 对应类型文件 | 生成 AGENTS.md 时 |
| `templates/PROGRESS.md` 等文档模板 | 生成 docs/ 时 |
| `scripts/verify-memory.mjs` | 生成后必须运行 |

所有相对路径都相对于本技能目录（技能加载时会给出 base directory）。

## 输出矩阵

| 工作区类型 | AGENTS.md 专属节 | 必建文件 |
|---|---|---|
| 开发 `dev` | 技术栈 / 常用命令 / 项目结构 | AGENTS.md、docs/PROGRESS.md、docs/KNOWN-ISSUES.md、docs/DECISIONS.md |
| 运维 `ops` | 管理对象 / 环境与访问 / 危险操作红线 / 常用操作 | 同上 + docs/RUNBOOK.md |
| 知识 `knowledge` | 学习范围 / 知识约定 / 当前关注 | 同上 + docs/NOTES.md |

混合场景（有代码又有部署）：主类型取 `dev`，额外生成 `docs/RUNBOOK.md`，并在 AGENTS.md 的「记忆文件」节加一行指针。
旧项目已有 AGENTS.md 时：只补缺失文件与缺失节，绝不覆盖、绝不改写已有「必须保留本节原文」的节。

## 已有文件时怎么处理

1. **AGENTS.md 已存在**：先 `read`。只追加缺失的类型专属节/指针节；已有节不改；两个保护节原样保留。类型以文件头部「> 类型:」为准，冲突时问用户一次。
2. **docs 文件已存在**：不覆盖。PROGRESS 只在内容为空/仅模板时补初始化条目，否则跳过并在汇报里说明；其余文件同理。
3. **部分存在、部分缺失**：只补缺；生成后仍跑校验，把「已存在跳过」和「新建」分开列表。
4. **用户要求重建**：先说明会丢失哪些内容，得到确认后再做；默认不重建。

## 可选：全局偏好

只有用户明确说「初始化全局偏好 / 个人全局约定」时，才生成 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`），
使用 `templates/AGENTS.global.md`，≤ 20 行；先确认再写，已存在则不覆盖。项目内容绝不写进全局文件。


## 执行流程

### 第 1 步：侦察（只读，不写文件）

1. 确认会话工作目录 `pwd`；若在子目录，向上找 `.git`，没有 `.git` 就把当前目录当工作区根目录。
2. 检查已存在的记忆文件：`AGENTS.md`、`CLAUDE.md`、`docs/PROGRESS.md`、`docs/KNOWN-ISSUES.md`、`docs/DECISIONS.md`、`docs/RUNBOOK.md`、`docs/NOTES.md`。
3. 收集类型信号（见下表）。用 `read` 读 README、manifest、已有文档；**不要执行项目命令，不要安装依赖**。

| 类型 | 强信号 | 弱信号 |
|---|---|---|
| dev | `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `pom.xml` / `*.csproj` / `src/` | Makefile、测试目录、`.github/workflows/`、git 里有代码提交 |
| ops | `docker-compose.y*ml` / `ansible.cfg` / `inventory*` / `*.tf` / k8s 清单 / 服务器清单 / 已有 RUNBOOK | README 写「部署/运维/服务器」、目录名含 deploy/ops/infra |
| knowledge | 无代码 manifest，主体是 Markdown/PDF/资料 | 目录名含 notes/学习/调研/knowledge、用户说「学习/调研/资料整理」 |

### 第 2 步：判定类型与采集事实

**类型**：按上表判定。若同时有代码和部署文件 → `dev` + RUNBOOK。若目录为空且用户消息也没给信息 → 默认 `dev`，不要为此单独发问。
**提问策略**：最多问 **一轮**，最多 3 个问题（用 `ask_user_question`），且只在「类型无法判定」或「项目名/一句话说明完全无法推断」时问；用户说「直接生成 / 不用问 / 快速」时一律不问。能从文件推断的绝不问。

采集（只填可核实项，推不出的用 `（待补充：…）`）：

- **项目名**：manifest 的 `name`，否则目录 basename；去掉版本号后缀。
- **一句话说明**：用户消息 > README 第一段 > `（待补充：一句话说明）`。
- **dev**：技术栈（依赖/运行环境）、安装/开发/测试/构建命令（`package.json` scripts、Makefile、pyproject、README 命令段）、顶层目录职责。
- **ops**：管理对象（主机/服务/域名）、环境（生产/测试）、访问入口与凭据存放位置（**只写位置**）、变更窗口、常用操作、备份与回滚方式。
- **knowledge**：学习范围、当前关注主题、已有资料入口。
- **工作约定**：最多写 1～3 条能从仓库或用户消息确认的硬规矩；没有就写 `（待补充：代码风格 / 提交规范 / 必跑命令）`。

### 第 3 步：生成文件

使用 `write` 工具写文件（**不要用 bash heredoc 或 `sed` 生成**，否则当前会话拿不到指令更新）。按顺序：

1. **AGENTS.md**：`templates/AGENTS.base.md` 为主体，把 `{{PROFILE_SECTIONS}}` 换成 `templates/AGENTS.<类型>.md` 全文，把 `{{TRIGGER_SECTION}}` 换成 `templates/TRIGGER.<类型>.md` 全文，把 `{{EXTRA_POINTERS}}` 换成额外指针（RUNBOOK/NOTES，或空）。
2. **docs/PROGRESS.md**：初始「当前状态」=「刚初始化记忆体系，尚未开始实质工作。」；「已完成」保留初始化条目；「下一步」写一个具体的 `- [ ] （待补充：第一个具体任务）`。
3. **docs/KNOWN-ISSUES.md**、**docs/DECISIONS.md**：按模板；DECISIONS 保留「初始化文件记忆体系」条目。
4. **按类型追加**：`ops` → `docs/RUNBOOK.md`；`knowledge` → `docs/NOTES.md`；`dev` + 部署信号 → `docs/RUNBOOK.md`。
5. 替换所有 `{{...}}` 模板标记：`{{PROFILE_LABEL}}` 填 开发/运维/知识；`{{EXTRA_DECISION}}` 按类型填 `、RUNBOOK.md` / `、NOTES.md` / 空；`{{FILE_LIST}}` 填实际生成的文件；`{{DATETIME}}` 填当前时间。未知值写 `（待补充：…）`，**禁止**编造命令、地址、版本号。
6. 写完立即 `read` 一遍 AGENTS.md 与 PROGRESS.md，刷新当前会话的指令快照。

### 第 4 步：自检（必须）

```bash
node "<本技能目录>/scripts/verify-memory.mjs" "<工作区根目录>"
```

- 先修完全部 `ERROR`（模板标记残留、缺节、保护节被改写、疑似密钥、缺文件）。
- `WARN`（`（待补充）`、文件超预算）逐条列进汇报，不要假装没有。
- 若脚本报类型不符，可加 `--profile=dev|ops|knowledge` 重跑。

### 第 5 步：汇报

用一张表列出「文件 / 行数 / 状态」，然后：

1. 说明类型与判定依据（一句话）。
2. 列出所有 `（待补充：…）`，告诉用户最少要补哪几项。
3. 建议下一步：`git init` + commit（是否执行先问用户），然后开工。
4. 提醒：以后每次收尾更新 PROGRESS.md；踩坑记 KNOWN-ISSUES；定案记 DECISIONS。

## 硬性边界

- **不覆盖**：已存在的 AGENTS.md、docs 文件不覆盖；只补缺。需要重建时先问用户并说明会丢失什么。
- **不改保护节**：含「（必须保留本节原文）」的两节必须逐字保留，不增删改。
- **不写秘密**：任何密钥/令牌/密码/账号都不入库，只写「去哪找」。
- **不编造**：命令、地址、依赖版本、运维对象必须来自文件或用户；不确定就标 `（待补充）`。
- **不执行**：不运行项目命令、不装依赖、不 `git commit`（除非用户明确要求）。
- **不越界**：只写上面矩阵里的文件；不顺手生成 README、CI、代码骨架。
- **一轮提问**：最多问一轮、最多 3 个问题；能从上下文推断的不问。

## 跨机器说明

本技能是纯 Markdown + Node 脚本，无依赖。新电脑上把整个技能目录放到
`~/.dsh/skills/project-memory-init/`（或 `~/.agents/skills/`）即可；也可以用
`node scripts/install.mjs`。装好后新开一个会话，说「初始化项目」就会触发。
若技能不存在，用同目录的 `BOOTSTRAP-PROMPT.md` 作为一次性提示词。
