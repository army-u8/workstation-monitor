# 前端工程师转 AI 应用 / Agent 工程师：资料与招聘信号研究

> 研究日期：2026-08-27
>
> 用户背景：3 年前端经验、目前可全职学习、希望 1–2 个月完成方向切换
>
> 研究对象：[AgentGuide](https://github.com/adongwanai/AgentGuide)、[AIGC-Interview-Book](https://github.com/WeThinkIn/AIGC-Interview-Book)、[agent-interview-hub](https://github.com/Zchary1106/agent-interview-hub) 及中国市场公开的一手招聘信号

## 结论先行

最合适的近期目标不是“大模型算法工程师”，而是以下相邻岗位：

1. **AI 产品前端 / AI 交互工程师**：最能复用既有前端、TypeScript、产品交付和用户体验能力。
2. **AI 应用全栈工程师**：以前端为长板，补 Node.js 或 Python 服务端、RAG、Tool Calling、评测和部署。
3. **Agent 应用工程师**：再补状态管理、任务编排、权限、安全、trace、重试、成本与稳定性。

这一选择不是降格，而是利用已有三年经验做横向迁移。贵州茅台 2026 年公开招聘的“前端研发工程师”明确要求 2 年以上前端经验、React/Vue/Angular 与 TypeScript，同时接受“模型 API 集成、RAG 前端、前端 Agent”等 AI 项目经验；这几乎就是前端转 AI 的直接落点（[官方招聘附件，第 358–396 行](https://www.moutaichina.com/mtgf/2026-04/24/25dae6b7b53d4a6682482f764eba595d/2026042418071183663.pdf)）。

但如果岗位名称是“Agent 引擎开发工程师”，门槛会迅速转向后端与系统工程。百度当前社招岗位要求 3 年以上后端经验、TypeScript/Node.js、Redis/PostgreSQL/Kafka、分布式系统、安全隔离，并把 RAG、Tool Calling、Memory、监控与链路日志视为完整能力的一部分（[百度 Agent 引擎开发工程师 J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)）。因此，**“会调模型 API”只能进入赛道，不能构成 Agent 工程师的完整竞争力**。

对时间目标的现实判断：

- **1 个月可以做到**：建立 AI 应用基础，交付一个可部署、可评测、可演示的主项目，开始投递“AI 前端 / AI 应用前端 / 偏前端全栈 / 初中级 AI 应用”岗位。
- **1 个月做不到**：系统学完三个仓库、补齐成熟后端经验、掌握模型训练、达到生产级 Agent 引擎岗的全部门槛。
- **2 个月更现实**：在主项目上补 trace、eval、安全、成本、失败复盘和部署，再完成一个较小的第二项目或开源贡献，同时做目标岗位面试准备。
- **“拿到 offer”不能按学习工期承诺**：招聘周期和岗位匹配不可控。可控目标应是“第 4 周形成可投递作品集，第 5–8 周持续投递并迭代”。

上述时间判断是根据公开岗位要求与三库实际内容做出的工程推断，不是就业保证。

## 一、公开岗位揭示的真实能力模型

### 1. 岗位实际上分成三条赛道

| 赛道 | 公开岗位的一手信号 | 对当前背景的判断 |
|---|---|---|
| AI 前端 / AI 体验工程 | 茅台前端岗位保留 React/Vue/Angular、TypeScript、性能与测试要求，同时加入模型 API、Agent、RAG 界面和 AI 交互组件（[官方附件](https://www.moutaichina.com/mtgf/2026-04/24/25dae6b7b53d4a6682482f764eba595d/2026042418071183663.pdf)） | **最短路径**。不是放弃前端，而是在 AI 产品形态中升级前端能力。 |
| AI 应用 / Agent 工程 | 百度应用研发岗位强调 API/CLI/Skill、工具治理、效果评估、系统设计与真实业务落地（[J103341](https://talent.baidu.com/jobs/detail/SOCIAL/a5ff8d15-b547-4a87-ba55-a128dae953cd)）；Agent 引擎岗继续要求状态、限流、重试、trace、sandbox 与安全（[J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)） | **两个月可建立入场作品，不能假装已有生产经验**。先投偏应用和全栈岗位，再向引擎层演进。 |
| 基础模型 / Agent 算法 | 百度相关算法岗位要求 PyTorch、训练库、Transformer、SFT/RLHF/DPO/PPO/GRPO，且硕士、论文或竞赛背景明显加权（[大模型/Agent 算法实习岗 J101345](https://talent.baidu.com/jobs/detail/INTERN/1a0bfe96-f59c-4384-9525-79fdf324c67f)） | **不应作为 1–2 个月主目标**。可以理解概念，但不应把时间主要投入训练与论文复现。 |

这张表只代表公开岗位的方向性样本，不是对整个中国招聘市场的统计抽样；招聘页也可能下线或变更。它足以说明岗位分层，却不足以推算薪资、岗位数量或成功率。

### 2. 对前端工程师最关键的能力迁移

现有能力不是“归零”，而是要重新包装和补齐：

| 已有前端资产 | 在 AI 应用中的新表达 | 需要补的证据 |
|---|---|---|
| TypeScript、组件与状态管理 | 流式生成 UI、会话状态、工具调用进度、人工确认、可恢复任务 | 展示中断、重试、取消、错误态，不只展示聊天气泡 |
| API 集成 | 多模型网关、结构化输出、Tool Calling、超时与降级 | 有 schema 校验、错误处理、速率限制和失败样例 |
| 产品与交互能力 | 把不确定模型行为做成可理解、可控的人机协作 | 显示引用、执行计划、权限确认、来源与置信信息 |
| 性能与工程化 | token/延迟/成本观测、流式响应、缓存、并发控制 | 给出 P50/P95 延迟、token 成本或缓存命中率 |
| 测试意识 | prompt 回归集、检索评测、端到端任务成功率 | 至少 20–30 个固定 eval case 和失败分类 |

百度 Agent 引擎岗明确把前端列为协作方，但岗位本身要求后端、消息系统与安全能力（[J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)）；茅台 AI 工程师和 AI 后端岗位则分别要求 Python/FastAPI、向量库、消息队列、Docker/K8s，以及生产级 RAG/LLM 应用经验（[官方招聘附件，第 239–353 行](https://www.moutaichina.com/mtgf/2026-04/24/25dae6b7b53d4a6682482f764eba595d/2026042418071183663.pdf)）。由此推断，合理的语言策略是：

- **主项目先用 TypeScript/Node.js 保证交付速度**；TypeScript 本身被真实 Agent 岗接受。
- **同步补 Python 到“能写 API、数据处理、评测脚本”的程度**；暂不以训练模型为目标。
- 不要为了“像 AI 工程师”而同时学习 Go、Rust、Java、PyTorch 和多个 Agent 框架。

### 3. 招聘方要的是生产闭环，不是框架名词

多份岗位的共同交集是：

- 真实业务问题与系统抽象，而非单纯 Prompt；百度应用研发岗位明确要求把复杂业务沉淀为标准化、平台化方案（[J103341](https://talent.baidu.com/jobs/detail/SOCIAL/a5ff8d15-b547-4a87-ba55-a128dae953cd)）。
- RAG、Agent、Tool/API、状态与 Memory；百度 Agent 实习岗位还明确列出 RAG、Memory、Skill、MCP 和主流框架的实际落地经验（[J100994](https://talent.baidu.com/jobs/detail/INTERN/3ddcb5a1-63d7-4596-b7cf-d636dad39f60)）。
- 评测、稳定性、成本、延迟和用户体验；百度 Agent 全栈岗位把成功率、稳定性、token 成本、延迟列为评测目标（[J99974](https://talent.baidu.com/jobs/detail/GRADUATE/6f9c3a86-6557-409d-8fa7-e6f4c68d6765)）。
- 部署、安全和故障处理；百度 Agent 引擎岗位列出限流、重试、日志、资源隔离、prompt injection、工具滥用和人工审批（[J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)）。

因此作品集的验收标准应该是“能运行、能观测、能评测、能解释失败”，而不是“用了 LangChain/LangGraph/MCP”。

## 二、三套 GitHub 资料的当前审阅

### 1. AgentGuide：主线与工程验收表

**定位与覆盖。** README 将仓库定位为 AI Agent 工程、研究与求职知识库，主张围绕“做得出、跑得稳、测得准、讲得清”组织 Agent loop、Context/Memory、Tools/MCP、RAG、Eval、Observability、Safety、Post-training、项目和面试内容（[README](https://github.com/adongwanai/AgentGuide/blob/main/README.md)）。目录还提供 7 天入门、岗位路线、三个项目蓝图及 trace/eval/tool 模板（[docs](https://github.com/adongwanai/AgentGuide/tree/main/docs)、[examples](https://github.com/adongwanai/AgentGuide/tree/main/examples)、[projects](https://github.com/adongwanai/AgentGuide/tree/main/projects)）。

**最强用途。** 把它当作工程主线和项目验收清单，而不是教材逐页读。其“可写进简历的 Agent 项目”要求明确用户与任务、可运行入口、agent loop、工具注册、权限、trace、eval、成本/延迟与失败复盘，这与公开招聘信号高度一致（[项目交付清单](https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/05-ship-agent-project.md)）。

**缺口。** 仓库主体仍是文档；三个旗舰项目主要是设计蓝图，[examples](https://github.com/adongwanai/AgentGuide/tree/main/examples) 主要是 Markdown/JSON 模板，不等同于完整生产工程。部分 LangChain、Planning、Multi-Agent 页面内容较薄。README 中“2–3 周完成简历级项目”“8–10 周拿 Offer”等表述附近没有可验证招聘数据，不应视为承诺（[README](https://github.com/adongwanai/AgentGuide/blob/main/README.md)）。

**当前维护信号。** 当前审阅的 HEAD 为 `d4fe53f4`，最新提交日期 2026-08-25，内容是定位刷新；同日加入 2026 研究前沿（[最新提交](https://github.com/adongwanai/AgentGuide/commit/d4fe53f4a9153123b159d0e6b632117a34721a92)、[研究前沿提交](https://github.com/adongwanai/AgentGuide/commit/92c4189e7c50ed72e2780ca8bda3f73011998f03)）。[Releases](https://github.com/adongwanai/AgentGuide/releases) 为空，说明它是持续编辑的知识库，不是有稳定版本语义的软件产品。

**适用阶段。** 第 1 天选方向；第 1–4 周持续对照交付清单；第 5–8 周用安全、评测、系统设计章节加深。

### 2. AIGC-Interview-Book：按需检索的理论词典

**定位与覆盖。** README 将其定位为 AIGC/LLM/AI Agent 算法岗、开发岗和应用岗的综合学习与面试平台（[README](https://github.com/WeThinkIn/AIGC-Interview-Book/blob/main/README.md)）。当前树约 927 个文件，既包含 LLM、Agent、部署，也包含 CV、扩散、图像、视频、多模态和传统机器学习，广度远超此次转型所需。

**最强用途。** 它最适合作为遇到问题时查阅的理论词典。[开发岗转 AI 应用工程师路线](https://github.com/WeThinkIn/AIGC-Interview-Book/blob/main/%E7%83%AD%E9%97%A8AI%E5%AD%A6%E4%B9%A0%E6%A0%B8%E5%BF%83%E8%AF%BE%E7%A8%8B%E4%B8%8E%E6%95%99%E7%A8%8B/13_%E5%BC%80%E5%8F%91%E5%B2%97%E8%BD%ACAI%E5%BA%94%E7%94%A8%E5%B7%A5%E7%A8%8B%E5%B8%88%E8%B7%AF%E7%BA%BF.md) 已给出合适顺序：Python 工程入口 → Prompt/RAG/Agent/工具调用 → 部署/评测/可观测性；[AI Agent 工程岗面试路线](https://github.com/WeThinkIn/AIGC-Interview-Book/blob/main/%E7%83%AD%E9%97%A8AI%E5%AD%A6%E4%B9%A0%E6%A0%B8%E5%BF%83%E8%AF%BE%E7%A8%8B%E4%B8%8E%E6%95%99%E7%A8%8B/08_AI_Agent%E5%B7%A5%E7%A8%8B%E5%B2%97%E9%9D%A2%E8%AF%95%E8%B7%AF%E7%BA%BF.md) 则把工作流、MCP/A2A、Memory、安全评测、Harness 和企业落地串成索引。

**缺口。** 上述路线页本身主要是索引。仓库有大量并列的“完整版/精华版”内容和图片，缺少一个可 clone、可测试、可部署的完整 RAG/Agent 产品。对前端转 AI 应用而言，CV、扩散、训练和大量算法章节会产生很高的机会成本。

**当前维护信号。** 当前审阅的 HEAD 为 `17e5c8a`，最新提交日期 2026-08-26，更新的是图像创作板块（[最新提交](https://github.com/WeThinkIn/AIGC-Interview-Book/commit/17e5c8af1f5453050fb9a960233d63f7a2bc5fd8)）。近期更新频繁，但编辑活跃不代表代码项目成熟；[Releases](https://github.com/WeThinkIn/AIGC-Interview-Book/releases) 为空。

**适用阶段。** 第 1–2 周只围绕项目问题定向查阅；第 5–8 周用来补理论盲区和面试表达。不要顺序通读。

### 3. agent-interview-hub：后半程题库与面试演练

**定位与覆盖。** README 主张包含 300+ 带答案面试题、14 家公司、6 道实操题和 16 周路线，实际目录覆盖 RAG、Agent、MCP、LangGraph、系统设计、公司 JD/面经、静态站和采集脚本（[README](https://github.com/Zchary1106/agent-interview-hub/blob/main/README.md)、[目录](https://github.com/Zchary1106/agent-interview-hub/tree/main)）。

**最强用途。** 它最适合作为后半程的面试检验器。其 [12 周进阶路线](https://github.com/Zchary1106/agent-interview-hub/blob/main/%E9%80%9A%E7%94%A8%E7%9F%A5%E8%AF%86/12%E5%91%A8Agent%E5%B7%A5%E7%A8%8B%E5%B8%88%E8%BF%9B%E9%98%B6%E8%B7%AF%E7%BA%BF.md) 以 RAG、Agent、MCP、安全、可观测性和部署为周交付物，比单纯背题更有价值；[六道实操题](https://github.com/Zchary1106/agent-interview-hub/tree/main/%E9%A1%B9%E7%9B%AE%E5%AE%9E%E6%88%98/%E5%AE%9E%E6%93%8D%E8%80%83%E9%A2%98) 适合做 2–6 小时限时演练。

**缺口。** 六道实操题和三个项目主要是 Markdown 规格，不含可运行参考实现；Python 代码主要服务于静态站构建和面经采集，不是 Agent 产品代码。README 自身还有口径未同步：顶部称 14 家、简介仍称 9 家，而目录数量又不同，因此其数量宣传不应当作质量证明（[README](https://github.com/Zchary1106/agent-interview-hub/blob/main/README.md)）。

**当前维护信号。** 当前审阅的 HEAD 为 `83e37d0`，最新提交日期 2026-08-15，增加 Agent Harness 测评材料（[最新提交](https://github.com/Zchary1106/agent-interview-hub/commit/83e37d053e63e97b3833a4c6eb98fb51ded88ef3)）。[Releases](https://github.com/Zchary1106/agent-interview-hub/releases) 为空。

**适用阶段。** 第 3–4 周开始用高频题反查项目盲点；第 5–8 周做系统设计、限时题和目标公司专项。不建议第 1 周先背八股。

### 4. 三库的重叠与共同缺口

三库都大量覆盖 Agent/RAG/MCP、学习路线、项目描述和面试题，因此从头通读会重复消耗时间。推荐分工：

| 材料 | 唯一职责 | 不让它做什么 |
|---|---|---|
| AgentGuide | 工程主线、交付标准、项目 checklist | 不把蓝图当成自己的成品 |
| AIGC-Interview-Book | 项目遇阻时查概念和理论 | 不通读 CV、扩散、训练等无关章节 |
| agent-interview-hub | 项目成型后的问答、系统设计、限时演练 | 不在没有项目经验时先背标准答案 |

共同缺口是：它们不能替代亲自实现完整代码、联调真实模型与数据、处理线上式失败、做评测、部署并记录指标。三个仓库的 [Releases](https://github.com/adongwanai/AgentGuide/releases)、[Releases](https://github.com/WeThinkIn/AIGC-Interview-Book/releases)、[Releases](https://github.com/Zchary1106/agent-interview-hub/releases) 都为空，也应提醒学习者对持续变化的文档建立自己的知识快照，不要机械记忆框架细节。

## 三、1–2 个月的材料使用策略

### 必学、按需学、暂缓学

**P0：必须形成作品证据**

- LLM API、流式输出、结构化输出、Tool Calling、重试与错误处理。
- RAG 最小闭环：解析、chunk、embedding、检索、引用；能解释召回错误与生成错误。
- Agent 最小闭环：状态、工具、停止条件、权限确认、失败恢复。
- 评测与可观测性：固定 eval set、trace、延迟、token/成本、失败分类。
- 后端与部署：Node.js 或 Python API、数据库、Docker、环境变量与基本鉴权。
- AI 交互：引用来源、运行步骤、取消/重试、错误态和高风险动作确认。

这些项目要求与 AgentGuide 的[项目交付清单](https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/05-ship-agent-project.md)、百度的[应用研发岗](https://talent.baidu.com/jobs/detail/SOCIAL/a5ff8d15-b547-4a87-ba55-a128dae953cd)和[Agent 引擎岗](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)直接对应。

**P1：面试前能讲清、项目需要时再深入**

- Transformer、token、embedding、上下文窗口、temperature 的工作层理解。
- Hybrid Search、rerank、query rewrite、memory、MCP、LangGraph。
- 缓存、队列、限流、熔断、模型路由、prompt injection 与数据泄露防护。
- Python/FastAPI 与基本数据处理。

**P2：首轮转型暂缓**

- 从头训练模型、深入 PyTorch/DeepSpeed/vLLM 内核。
- SFT、DPO、RLHF/GRPO 的实操训练。
- 多 Agent 炫技、GraphRAG、复杂长期记忆，除非主项目确实需要。
- CV、扩散、视频生成、具身智能等与目标 JD 无关的分支。
- 同时学习多个 Agent 框架。

暂缓不等于这些方向没价值，而是百度算法岗的一手要求显示它们属于另一条、更长的能力路径（[J101345](https://talent.baidu.com/jobs/detail/INTERN/1a0bfe96-f59c-4384-9525-79fdf324c67f)）。

### 一个月与两个月的可验证终点

| 时间点 | 合理终点 | 不合理的自我判断 |
|---|---|---|
| 第 7 天 | 能独立调用模型、做结构化输出和 2–3 个工具；确定一个具体用户问题和项目 spec | “看懂了 Agent 原理，所以会做 Agent” |
| 第 14 天 | 主项目完成 RAG/Tool Calling 主链路，有真实数据和最小测试集 | “接了 LangChain，所以项目已经生产级” |
| 第 21 天 | 有 trace、失败分类、引用、权限确认、基本部署 | “功能能演示，所以不需要评测” |
| 第 28 天 | README、架构图、在线演示、20–30 条 eval、指标和失败复盘齐全；开始投递 | “三个仓库看完才可以投” |
| 第 5–8 周 | 主项目加固；完成小型第二作品/开源贡献；系统设计、目标公司专项、持续投递 | “必须学完模型训练才算 AI 工程师” |

如果只能选 1 个月，应把时间大致分为 **60% 编码与验证、20% 定向阅读、20% 面试与投递**。如果有 2 个月，第 5 周以后不要继续无限扩展知识面，而应围绕真实 JD、项目坏例和面试反馈补洞。

## 四、作品集应该证明什么

一个项目胜过三套资料的阅读记录。建议主项目选择有真实用户、可展示前端长板、同时需要 AI 后端的场景，例如：

- 带引用与权限控制的个人/团队知识库研究助手；
- 可追踪工具执行、允许人工接管的工作流 Agent；
- 面向开发者的代码库问答、诊断或任务协作工具。

最低证据包：

1. **可访问产物**：在线 demo 或一条命令可运行，README 无隐藏步骤。
2. **架构证据**：前端、API、模型、检索、工具、状态、日志和权限边界图。
3. **评测证据**：20–30 个固定 case，至少覆盖正常、空输入、检索失败、工具失败、prompt injection、高风险动作和长上下文；AgentGuide 也给出了同类建议（[项目交付清单](https://github.com/adongwanai/AgentGuide/blob/main/docs/03-practice/05-ship-agent-project.md)）。
4. **量化证据**：任务成功率、检索命中、P50/P95 延迟、token/成本中至少三项。
5. **工程证据**：超时、重试、限流、schema 校验、日志、测试、Docker 和基本 CI。
6. **失败证据**：保留 5–10 个 bad case，解释问题在模型、检索、工具、上下文还是业务规则，并说明修改前后差异。
7. **表达证据**：一页中文项目说明、10 分钟演示稿和三条能被追问的简历 bullet。

不要编造生产数据或写“准确率 95%”却没有评测集。公开岗位反复强调真实落地、评测、稳定性和系统设计（[百度 J103341](https://talent.baidu.com/jobs/detail/SOCIAL/a5ff8d15-b547-4a87-ba55-a128dae953cd)、[百度 J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)），可复现的失败分析比包装一个“大而全的多 Agent 平台”更可信。

## 五、求职策略判断

### 推荐检索关键词

优先：

- AI 应用前端、AI 产品前端、AI 交互工程师
- 大模型应用开发、LLM 应用工程师、RAG 工程师
- AI 应用全栈、Agent 应用工程师、智能体开发工程师
- AI 平台前端、AI Coding 产品研发、知识库应用研发

暂不作为主投：

- 大模型算法工程师、基础模型研究员、后训练工程师、推理引擎工程师
- 明确要求多年分布式后端、训练集群、CUDA 或顶会论文的岗位

### 投递节奏

- 第 1 周就收集 30–50 条目标 JD，做词频和缺口表；不要到第 8 周才看岗位。
- 第 3 周开始用半成品项目小规模投递，验证岗位标题、简历表述和面试门槛。
- 第 4 周开始正式投递，并按反馈分配学习时间。
- 同时投“AI 增强前端”和“AI 应用全栈”，避免把机会压在岗位名称尚不统一的“Agent 工程师”上。
- 简历标题应保留“3 年前端工程经验”，再强调 AI 应用工程能力；不要把自己包装成零经验算法新人。

公开岗位支持这种阶梯策略：茅台的同一招聘附件同时存在 AI 工程师、AI 后端与 AI 前端三类职位，其前端岗仍把原有工程能力作为主体，只增加 AI 应用经验（[官方招聘附件](https://www.moutaichina.com/mtgf/2026-04/24/25dae6b7b53d4a6682482f764eba595d/2026042418071183663.pdf)）；百度 Agent 引擎岗则证明 TypeScript 能进入 Agent 栈，但需要逐步补齐后端系统能力（[J103885](https://talent.baidu.com/jobs/detail/SOCIAL/d56ce9b0-296b-4615-9497-115968d4fc14)）。

## 六、最终建议

**不要以“学完三个仓库”为目标。** 这三个仓库的范围相加远超一个月，而且内容高度重叠。真正有效的目标是：

> 用 AgentGuide 定义交付，用 AIGC-Interview-Book 解决当下理论问题，用 agent-interview-hub 检验项目表达；四周内做出一个能被招聘方验证的 AI 应用，八周内用真实投递和面试反馈完成第二轮加固。

一月方案是高强度入场方案，不是完成整个 AI 知识体系；两月方案更接近“具备可投递证据”。从三年前端起步，成功率最高的身份不是“刚学 AI 的新人”，而是“已经有三年软件交付能力、现在能把 LLM/Agent 做成可靠产品的工程师”。

## 研究边界与来源说明

- 三个仓库按 2026-08-27 可见的默认分支内容与提交记录审阅；它们持续变化，文件数和内容会更新。
- 未使用 Star 数作为能力价值判断，也未用 commit 数推断内容正确性。
- 招聘信号优先使用企业官方招聘页或企业官网附件。它们是方向性样本，不代表全市场统计，岗位也可能过期或下线。
- 对“一个月/两个月能达到什么”的判断是基于材料规模、工程交付范围和公开 JD 的推断，不是三方仓库或招聘公司的承诺。
