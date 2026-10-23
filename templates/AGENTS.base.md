# {{PROJECT_NAME}}

> 类型: {{PROFILE_LABEL}} · 规范: project-memory-init/{{SPEC_VERSION}} · 建立: {{DATE}} · 最后核对: {{DATE}}
> {{ONE_LINE_DESC}}

{{PROFILE_SECTIONS}}

## 工作约定
- {{CONVENTION}}
- 只写对该工作区任何会话都恒真、且不能从代码或文档直接推导的内容
- 能交给 linter / formatter / CI 的规则不写进本文件，改由工具强制执行
- 删除/移动文档或代码前先 grep 引用，同步更新调用方
- 同一主题只保留一个活跃载体；旧版归档到 docs/archive/，并在新文档留指针

## 边界与红线
- 禁止把密钥/令牌/密码/账号写入任何记忆文件；只写「去哪找」（如 .env、密码管理器条目名）
- 禁止把未验证的推断写成结论；不确定时标注「待验证」
- 复述进度后，未经用户确认不得自动开始执行「下一步」
- 修改记忆文件必须用 read/write/edit 工具；并发会话先 read 再写（读-改-写）
- 推送公开仓库前先确认提交历史与文件中没有个人邮箱、密钥、本机绝对路径

## 进度衔接（必须保留本节原文）
- 每次会话开工第一步：读取 docs/PROGRESS.md，并用一句话向用户复述当前状态
- 会话结束或完成任一阶段性工作后：必须更新 docs/PROGRESS.md；
  任务未完成也必须如实修改"当前状态"，然后本次工作才算结束

{{TRIGGER_SECTION}}

## 记忆文件
- 进度 → docs/PROGRESS.md（开工必读；每次收尾必写）
- 已知坑 → docs/KNOWN-ISSUES.md（排障/踩坑时读；踩坑即记，含现象/原因/规避）
- 决策 → docs/DECISIONS.md（做方案取舍时读；定案即记，含背景/决策/备选/原因）
{{EXTRA_POINTERS}}
- 本机私有 → AGENTS.local.md / docs/local/（不提交；只写本机差异，不写密钥）
