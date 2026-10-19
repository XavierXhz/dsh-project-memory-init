# 同类项目与记忆规范对比（2026-10）

> 目的：检查开源社区/论文/官方文档里与「AI 编码 agent 的跨会话项目记忆」相关的做法，比对我们的 v2.0 组成，决定 v2.1 改什么、不改什么。
> 方法：GitHub 搜索与 README 阅读、官方文档、arXiv 摘要、HN 讨论、少量人工摘录；所有外链见 §7。
> 结论先行：**我们的方向（纯 Markdown + git + 小索引 + 动态层按需读）与主流一致；需要补的是「本机私有覆盖层」「定位/边界」「任务形状读取」「跨工具嵌套」「证据平衡」，不需要引入向量库/自动捕获。**

---

## 1. 横向项目表

| 项目 | 形态 | 核心组成 | 强项 | 对本规范的输入 |
|---|---|---|---|---|
| **AGENTS.md**（agentsmd/agents.md，25k★） | 开放格式 | 单个 Markdown；无必填字段；支持嵌套 | 跨 24+ 工具；README for agents；setup/test/security 惯例 | 入口文件保持简单；嵌套 AGENTS；跨工具优先 |
| **Claude Code memory**（官方） | 内置 | `CLAUDE.md`（人写）+ auto memory `MEMORY.md`（AI 写） | 分层、按需规则、`@` 导入、审计 | 指令是上下文不是强制；<200 行；auto memory 机器本地 |
| **Gemini CLI** | 内置 | `GEMINI.md` 层级 + 全局 + JIT + `@` 导入 | 全局/工作区/JIT 三层；可配置文件名（含 AGENTS.md） | 全局偏好与项目文件分离 |
| **Cline Memory Bank** | 方法论 | 6 文件：projectbrief / productContext / activeContext / systemPatterns / techContext / progress | 分层完整、`activeContext` 专管当前焦点 | 补「项目定位」；PROGRESS 已有 activeContext 作用 |
| **agentsge**（53★） | CLI + `.agents/` | `config.yaml`、rules、skills、mcp、knowledge（architecture/patterns/lessons/conventions/dependencies）、`_index.md` | 单一真源、机器可读配置、知识分类、索引常驻 | 知识分类与 `_index` 思路；但目录更重，暂不照搬 |
| **Operator Memory**（467★） | 插件/context engine | `.operator/`（私有）+ `.operator-shared/`（进 git）+ `~/.operator/user/`；catalog/index | 三区隔离、catalog 常驻、consult→build→update、支持 DSH | **本机私有层**与「指针索引」直接借鉴 |
| **Basic Memory**（4.3k★） | MCP + Markdown | Markdown 笔记 + SQLite/图/语义检索 | 本地优先、双向读写、知识图谱 | 验证 Markdown 真源；其检索/图谱不引入 |
| **Backlog.md**（7k★） | CLI/任务管理 | 每任务一个 Markdown（描述/验收标准/DoD/依赖） | 任务卡与验收标准、git 记录 | 可选任务台账；不纳入默认四件套 |
| **Spec Kit**（142k★） | SDD 工具包 | constitution / spec / plan / tasks / 扩展 | 流程化、模板化、可组合 | 印证「constitution（AGENTS）+ 规格」；不复制整套流程 |
| **MEMORY.md 模式**（Claude 自动记忆） | 内置 | `MEMORY.md` 索引 + 主题文件按需读；首 200 行/25KB 上限 | 索引小、按需展开、有上限 | AGENTS「记忆文件」只放指针；主题文件按需读 |
| **awesome-agent-conventions** | 索引 | 22 种约定，含 AGENTS/CLAUDE/MEMORY/Memory Bank/SKILL.md | 约定边界清晰 | 明确「AGENTS 常驻 vs SKILL 按需」 |

---

## 2. 文件组成对照

| 能力 | 我们 v2.0 | 社区对应 | v2.1 动作 |
|---|---|---|---|
| 常驻入口/索引 | `AGENTS.md`（≤60 行）+「记忆文件」指针 | AGENTS.md；MEMORY.md 索引；Operator catalog | 指针补「何时读」；保持小 |
| 项目定位（WHAT/WHY） | 只有一句话说明 | Claude 的 WHAT/WHY/HOW；Memory Bank 的 projectbrief/productContext | dev 增加「定位与边界」（是什么/给谁/不做什么） |
| 技术栈/命令/结构 | AGENTS 三节 | AGENTS.md / techContext | 明确「只写不可从 manifest/代码直接看出的内容」 |
| 当前进度 | `docs/PROGRESS.md` | Cline activeContext/progress；Claude auto memory | 保持；补「任务形状读取」 |
| 坑/故障 | `docs/KNOWN-ISSUES.md` | Cline progress 的 known issues；agentsge lessons | 保持；强化复验/归档 |
| 决策/为什么 | `docs/DECISIONS.md` | Memory Bank systemPatterns；Operator decisions | 保持；区分「事实改写」与「决策追加」 |
| 运维步骤 | `docs/RUNBOOK.md` | 少有针对 agent 的对应；Backlog/Operator 偏研发 | 保留差异化 |
| 知识笔记 | `docs/NOTES.md` | Basic Memory / Operator research / agentsge knowledge | 保留差异化；强化来源 |
| 本机私有差异 | 无 | Operator `.operator/` 私有 + `~/.operator/user/`；Claude `CLAUDE.local.md` | **新增 `AGENTS.local.md` + `docs/local/`，不进 git** |
| 任务/验收 | 无独立文件 | Backlog.md 任务卡；Spec Kit tasks | 暂不新增文件；PROGRESS「下一步」保持可执行 |
| 自动记忆/召回 | 明确不用 | Claude auto memory；kuitos 插件；Basic Memory | 不引入；只在文档里说明边界 |

---

## 3. 证据与讨论

### 3.1 论文（结论互相补充，不能只引一边）

- **arXiv 2602.11988（2026-02，v3 2026-09）**《Evaluating AGENTS.md》：
  - 提供上下文文件**总体不提升任务成功率**，平均推理成本 **+20% 以上**；LLM 生成与开发者提交的文件都一样。
  - 文件中的**指令会被很好遵守**；但**仓库概览类内容没有帮助**。
  - 结论：上下文文件适合写**非标准实践**，任何提升都应被严格评估。
- **arXiv 2601.20404（2026-01）**《On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents》：
  - 10 个仓库、124 个 PR；有 AGENTS.md 时**中位运行时间 −28.64%**、**输出 token −16.58%**，任务完成行为相当。
  - 这是效率/成本观察，不是成功率证明；与上一篇并不矛盾（测量指标不同）。
- **arXiv 2607.27250（2026-07）**《Do Context Files Help Coding Agents? A Two-Agent Ablation Study》：
  - 2 个 agent、17 个任务、288 次运行；上下文策略**没有可测量的正确率提升**（等价检验 ≤10–15pp）。
  - 失败主要来自**实现能力**（feature design / pattern selection / wiring），不是缺仓库知识；支持「不要写仓库概览」。

**对规范的含义**：不要承诺「提升成功率」；把 AGENTS.md 定位为**非标准实践 + 命令 + 协作约定**的载体；进度/坑/决策用动态文件；不写仓库概览。

### 3.2 官方文档

- **AGENTS.md**：无必填字段；README for agents；嵌套文件、最近者优先（其他工具）；60k+ 项目；LF 托管。
- **Claude Code**：`CLAUDE.md` 与 auto memory 两套；**CLAUDE.md 只在没有 AGENTS.md 时被替代**；目标 <200 行；导入不减少上下文成本；`.claude/rules/` 按路径生效；auto memory 每个 repo 一份、机器本地、首 200 行/25KB；指令是 context 不是 enforced config。
- **Gemini CLI**：全局 `~/.gemini/GEMINI.md`、工作区层级、JIT；`context.fileName` 可配置为 AGENTS.md；`/memory show/reload`。
- **Cline Memory Bank**：6 文件 + 自定义规则；`activeContext` 最高频；文件间有依赖关系。

### 3.3 社区讨论（有分歧，需正面回应）

- **Vercel eval（HN 524pts）**：AGENTS.md 的**压缩文档索引**（约 8KB）在 Next.js API 评测中 100%，skills 最高 79%；**56% 的 eval 里 skill 根本没被调用**。含义：常驻的压缩索引比「按需加载的 skill」更可靠；**但初始化技能是显式一次性动作，不受此影响**。
- **HumanLayer《Writing a good CLAUDE.md》（HN 748pts）**：根文件 <60 行；<300 行是共识；指令数 ~150–200 上限；渐进披露；**不要把 linter 的活交给 LLM**；**不要自动生成定稿**，要逐行审。
- **liao.gg《Agents Don't Need Memory. They Need Documentation.》（HN 392pts）**：批评 RAG/自动记忆；主张结构化文档 + catalog + 新鲜度 + 纪律；对应 Operator Memory 的三区。
- **HN「Agents don't need memory」讨论**：反方指出文档也会过期、索引也可能找不到、规则需要可执行化——与我们的复验/归档、verify/CI 一致。
- **GitHub issues**：大量关于「instruction files 漂移/过期」「memory 文件可写保护」「CI lint instruction files」的讨论，说明 `verify-memory` 这类只读校验有现实需求。

---

## 4. v2.1 采纳的改进

1. **「定位与边界」**：dev 增加「是什么/给谁/不做什么」；ops/knowledge 在管理对象/学习范围里加「不做什么」。对应 Memory Bank 的 projectbrief/productContext，且不新增文件。
2. **本机私有覆盖层**：新增 `AGENTS.local.md` 与 `docs/local/` 约定（不进 git，只写本机路径/端口/工具差异，不写密钥）。对应 Operator 的 private partition 与 Claude 的 `CLAUDE.local.md`，直接服务「家里/公司/出差多台电脑」。
3. **指针带「何时读」**：`记忆文件` 节从「有什么文件」升级为「什么任务读什么文件」，配合 `§9.10 任务形状读取`，避免每次把全部 docs 塞进上下文。
4. **跨工具与嵌套**：明确 AGENTS.md 是跨工具入口；Claude Code 在无 CLAUDE.md 时直接读 AGENTS.md；monorepo 用嵌套 AGENTS（根 ≤60、子目录 ≤30），同主题只写一处；DSH 是 root→cwd 加载，不是「最近者覆盖」机制。
5. **不把 linter/CI 的活写进 AGENTS**：风格/格式交给工具；AGENTS 只写工具无法强制的约定。对应 HumanLayer 与 2602.11988。
6. **自动生成只出骨架**：技能生成的 AGENTS.md 是「已核实事实 + 待补充项」，必须人工审阅后定稿；不编造命令、不代替人做取舍。回应 HumanLayer「不要自动生成最终 CLAUDE.md」的批评。
7. **证据平衡**：同时写「成功率无显著提升/成本 +20%」「运行时间/token 下降」「正确率无显著变化」三条，不再单引负面结论。
8. **临时/探索工作区 opt-out**：`.dsh/no-project-memory` 标记或 `> 记忆: 关闭`，技能识别后不生成任何文件；default 工作区默认加标记。
9. **插件化一键安装**：保留纯 skill 安装，同时提供 bundle 插件（`package.json` + `cordis.patch.yml` + skill provider），可在 UI「添加插件」里粘贴 GitHub 仓库地址安装，Windows/Linux 通用。

---

## 5. 明确不采纳

- **向量库/RAG/自动召回/自动捕获**：社区失败模式多（相似度≠正确、过期、不可审计）；与「纯文件、可审 diff、可跨机器」定位冲突。
- **单个巨大 MEMORY.md**：Lite-edit 等示例证明可行，但会混合稳定/动态层、超出每轮成本；我们保持分层，AGENTS 只做索引。
- **完整仓库概览/目录树**：论文与社区一致认为负面收益；只写非显而易见的目录职责。
- **全自动生成最终 AGENTS.md**：高杠杆文件必须人工审阅；技能只生成骨架并列出待补项。
- **每天/每会话自动重写记忆**：会制造漂移；保持触发器 + 收尾批量更新 + 复验。
- **把 Skill 当作常驻规则载体**：常驻规则进 AGENTS.md；Skill 只做一次性初始化/升级流程（Vercel 的 56% 不触发问题不适用于显式初始化，但说明常驻索引更可靠）。

---

## 6. 仍待决定

- 是否为小项目提供 **lite 模式**（仅 AGENTS + PROGRESS，条目多了再拆）。
- 是否把 Backlog.md 式**任务卡/验收标准**纳入 dev 默认（当前只在 PROGRESS「下一步」保持可执行）。
- 是否为决策加 **ID/取代链**（当前用日期 + 状态）。
- 是否提供 git pre-commit 的**只读校验**示例（当前 verify 脚本可直接调用）。
- 是否需要 `~/.dsh/AGENTS.md` 全局偏好与项目文件的**优先级表**（当前各工具语义不同，只做降档说明）。

---

## 7. 来源

- AGENTS.md: <https://agents.md/> · <https://github.com/agentsmd/agents.md>
- Claude Code memory: <https://code.claude.com/docs/en/memory>
- Gemini CLI GEMINI.md: <https://geminicli.com/docs/cli/gemini-md.md>
- Cline Memory Bank: <https://docs.cline.bot/best-practices/memory-bank>
- awesome-agent-conventions: <https://github.com/ItamarZand88/awesome-agent-conventions>
- agentsge: <https://github.com/Daliagents-com/agentsge-1>
- Operator Memory: <https://github.com/aerovato/operator-memory> · <https://liao.gg/blog/agents-dont-need-memory>
- Basic Memory: <https://github.com/basicmachines-co/basic-memory>
- Backlog.md: <https://github.com/MrLesk/Backlog.md>
- Spec Kit: <https://github.com/github/spec-kit>
- HumanLayer: <https://www.humanlayer.dev/blog/writing-a-good-claude-md>
- Vercel eval: <https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals>
- arXiv 2602.11988: <https://arxiv.org/abs/2602.11988>
- arXiv 2601.20404: <https://arxiv.org/abs/2601.20404>
- arXiv 2607.27250: <https://arxiv.org/abs/2607.27250>
- HN 讨论：<https://news.ycombinator.com/item?id=44957443> · <https://news.ycombinator.com/item?id=49760187> · <https://news.ycombinator.com/item?id=46809708> · <https://news.ycombinator.com/item?id=46098838> · <https://news.ycombinator.com/item?id=49945933>
