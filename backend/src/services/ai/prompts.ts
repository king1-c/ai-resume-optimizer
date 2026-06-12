/**
 * AI 简历分析提示词模板
 * 针对 Agnes-2.0-Flash 模型优化
 */

export interface ResumeAnalysisPrompt {
  resumeContent: string;
  jobDescription?: string;
  targetPosition?: string;
  industry?: string;
}

/**
 * 系统提示词 - 定义 AI 的角色和行为
 */
export const SYSTEM_PROMPT = `你是一位资深的简历优化专家和职业规划顾问，拥有 10 年以上 HR 和猎头经验，熟悉各行业的招聘标准和简历筛选流程。

你的任务是对用户的简历进行专业分析，并对比目标职位要求，指出差距和需要调整的地方。

**分析维度：**

1. **结构清晰度** (20分)：简历布局、模块划分、信息层级是否合理
2. **内容完整度** (20分)：是否包含必要信息（个人信息、教育背景、工作经历、技能等）
3. **成就量化** (20分)：是否使用数据、指标来展示工作成果
4. **岗位匹配度** (20分)：与目标职位的匹配程度，关键词覆盖情况
5. **语言表达** (20分)：用词是否专业、简洁、有说服力

**输出要求：**
- 以 JSON 格式输出
- 每个维度给出 0-20 的评分和详细评价
- 重点分析：当前简历与目标职位的差距
- 指出：哪些模块需要补充、哪些内容需要调整
- 提供：针对目标职位的具体修改建议
- 给出优化后的简历内容
- 提取目标职位的关键词建议

**评分标准：**
- 18-20分：优秀，几乎无需修改
- 15-17分：良好，有小幅提升空间
- 12-14分：一般，需要明显改进
- 8-11分：较差，需要大幅修改
- 0-7分：很差，建议重写`;

/**
 * 生成分析提示词 - 重点分析职业差距
 */
export function generateAnalysisPrompt(params: ResumeAnalysisPrompt): string {
  const { resumeContent, jobDescription, targetPosition, industry } = params;

  let prompt = `请对以下简历进行专业分析，并重点分析与目标职位的差距：

=== 简历内容 ===
${resumeContent}
`;

  if (targetPosition) {
    prompt += `
=== 目标职位 ===
${targetPosition}
`;
  }

  if (industry) {
    prompt += `
=== 目标行业 ===
${industry}
`;
  }

  if (jobDescription) {
    prompt += `
=== 职位描述（JD）===
${jobDescription}
`;
  }

  prompt += `
=== 分析要求 ===
请按照以下要求进行分析：

1. **基础评分**：对 5 个维度（结构清晰度、内容完整度、成就量化、岗位匹配度、语言表达）进行评分

2. **差距分析**（重点）：
   - 当前简历与目标职位的整体匹配度
   - 已满足的要求有哪些
   - 不满足/缺失的要求有哪些
   - 技能差距分析

3. **模块调整建议**：
   - 哪些模块需要补充内容
   - 哪些模块需要删减或调整
   - 优先级排序（最紧急的改进项）

4. **具体修改建议**：
   - 针对目标职位的关键词优化建议
   - 经历描述的优化方向
   - 技能展示的改进建议

请以以下 JSON 格式输出结果：
{
  "overallScore": 总分(0-100),
  "matchScore": 岗位匹配度(0-100),
  "dimensions": [
    {
      "name": "维度名称",
      "score": 分数(0-20),
      "comment": "详细评价",
      "suggestions": ["具体建议1", "具体建议2"]
    }
  ],
  "gapAnalysis": {
    "summary": "整体差距概述",
    "metRequirements": ["已满足的要求1", "已满足的要求2"],
    "unmetRequirements": ["未满足的要求1", "未满足的要求2"],
    "skillGaps": ["技能差距1", "技能差距2"],
    "priorityFixes": ["最紧急的改进1", "最紧急的改进2"]
  },
  "moduleAdjustments": [
    {
      "module": "模块名称（如：工作经历）",
      "action": "补充|调整|删减",
      "reason": "原因说明",
      "suggestion": "具体建议"
    }
  ],
  "generalSuggestions": ["整体建议1", "整体建议2", "整体建议3"],
  "optimizedResume": "优化后的完整简历内容",
  "keywords": {
    "matched": ["已匹配的关键词1", "已匹配的关键词2"],
    "missing": ["缺失的关键词1", "缺失的关键词2"],
    "suggested": ["建议添加的关键词1", "建议添加的关键词2"]
  },
  "strengths": ["亮点1", "亮点2"],
  "weaknesses": ["不足1", "不足2"]
}`;

  return prompt;
}
