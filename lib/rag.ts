import { chatCompletionJSON, isAIConfigured } from "./ai";
import { prisma } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractedSkill = {
  skill: string;
  requiredLevel: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  context: string;
};

export type DocumentAnalysis = {
  documentName: string;
  documentType: string;
  projectName: string;
  skills: ExtractedSkill[];
  timeline: string;
  candidateCount: number;
  summary: string;
};

// ─── RAG Document Ingestion ───────────────────────────────────────────────────

const RAG_PROMPT = `You are the Maverick Certification Hub Document Intelligence engine.
Analyze the uploaded document and extract certification-relevant information.

Given document text content, produce a JSON response:
{
  "documentName": "filename or document title",
  "documentType": "RFP|SOW|JobDescription|Requirements|Other",
  "projectName": "extracted project name or 'Unknown'",
  "skills": [
    {
      "skill": "skill/certification name",
      "requiredLevel": "Beginner|Intermediate|Advanced|Expert",
      "priority": "Critical|High|Medium|Low",
      "context": "relevant quote or context from document"
    }
  ],
  "timeline": "extracted timeline or 'Not specified'",
  "candidateCount": <estimated number of people needed or 0>,
  "summary": "2-3 sentence summary of certification needs"
}

Focus on:
- Technical skills mentioned (cloud, AI, security, etc.)
- Certification requirements explicitly stated
- Role descriptions that imply certification needs
- Timeline and staffing requirements
- Budget or数量 indicators

Return an empty skills array if no certification-relevant content found.
Always return valid JSON.`;

export async function analyzeDocument(
  fileName: string,
  fileContent: string
): Promise<DocumentAnalysis> {
  if (isAIConfigured()) {
    return analyzeWithAI(fileName, fileContent);
  }
  return analyzeWithFallback(fileName, fileContent);
}

async function analyzeWithAI(
  fileName: string,
  fileContent: string
): Promise<DocumentAnalysis> {
  // Truncate very long documents to fit context window
  const truncated = fileContent.length > 8000
    ? fileContent.substring(0, 8000) + "\n\n[Document truncated...]"
    : fileContent;

  const result = await chatCompletionJSON<DocumentAnalysis>({
    system: RAG_PROMPT,
    user: `Analyze this document for certification requirements:\n\nDocument: ${fileName}\n\nContent:\n${truncated}`,
    temperature: 0.2,
    maxTokens: 2048,
  });

  return result;
}

function analyzeWithFallback(
  fileName: string,
  fileContent: string
): DocumentAnalysis {
  const text = fileContent.toLowerCase();
  const skills: ExtractedSkill[] = [];

  // Pattern matching for common certification-related terms
  const skillPatterns: Array<{ pattern: RegExp; skill: string; level: string }> = [
    { pattern: /azure\s*(ai|ml|data)/i, skill: "Azure AI/ML", level: "Intermediate" },
    { pattern: /azure\s*(admin|administrator)/i, skill: "Azure Administrator", level: "Intermediate" },
    { pattern: /azure\s*(developer|devops)/i, skill: "Azure Developer", level: "Intermediate" },
    { pattern: /aws\s*(solutions?\s*architect|cloud)/i, skill: "AWS Cloud Architecture", level: "Advanced" },
    { pattern: /security\s*(specialist|compliance|analysis)/i, skill: "Cybersecurity", level: "Advanced" },
    { pattern: /python/i, skill: "Python Programming", level: "Intermediate" },
    { pattern: /machine\s*learning/i, skill: "Machine Learning", level: "Advanced" },
    { pattern: /data\s*(science|analytics|engineering)/i, skill: "Data Engineering", level: "Intermediate" },
    { pattern: /kubernetes|k8s|docker|container/i, skill: "Container Orchestration", level: "Intermediate" },
    { pattern: /devops|ci\/cd|pipeline/i, skill: "DevOps Practices", level: "Intermediate" },
    { pattern: /power\s*(platform|app|automate|bi)/i, skill: "Microsoft Power Platform", level: "Intermediate" },
    { pattern: /comptia|network\+|security\+/i, skill: "CompTIA Certification", level: "Beginner" },
    { pattern: /pmp|project\s*management/i, skill: "Project Management", level: "Advanced" },
    { pattern: /sap|erp/i, skill: "SAP/ERP Systems", level: "Advanced" },
    { pattern: /sql|database|rdbms/i, skill: "Database Management", level: "Intermediate" },
    { pattern: /react|angular|vue|frontend/i, skill: "Frontend Development", level: "Intermediate" },
    { pattern: /java|spring|microservice/i, skill: "Java/Microservices", level: "Intermediate" },
    { pattern: /terraform|infrastructure.*code|iac/i, skill: "Infrastructure as Code", level: "Intermediate" },
  ];

  const found = new Set<string>();
  for (const { pattern, skill, level } of skillPatterns) {
    if (pattern.test(text) && !found.has(skill)) {
      found.add(skill);
      const match = text.match(pattern);
      skills.push({
        skill,
        requiredLevel: level,
        priority: skills.length < 2 ? "Critical" : skills.length < 5 ? "High" : "Medium",
        context: match ? fileContent.substring(Math.max(0, match.index! - 30), match.index! + match[0].length + 30).trim() : "",
      });
    }
  }

  // Extract timeline
  const timelineMatch = text.match(/(?:timeline|deadline|by|target)\s*:?\s*([^\n.,]{5,50})/i);
  const timeline = timelineMatch ? timelineMatch[1].trim() : "Not specified";

  // Extract candidate count
  const countMatch = text.match(/(\d+)\s*(?:people|candidates|engineers|developers|staff|resources)/i);
  const candidateCount = countMatch ? parseInt(countMatch[1]) : 0;

  // Determine document type
  let documentType = "Other";
  if (text.includes("request for proposal") || text.includes("rfp")) documentType = "RFP";
  else if (text.includes("statement of work") || text.includes("sow")) documentType = "SOW";
  else if (text.includes("job description") || text.includes("role:") || text.includes("responsibilities:")) documentType = "JobDescription";
  else if (text.includes("requirement") || text.includes("must have") || text.includes("qualification")) documentType = "Requirements";

  return {
    documentName: fileName,
    documentType,
    projectName: extractProjectName(fileContent),
    skills,
    timeline,
    candidateCount,
    summary: skills.length > 0
      ? `Found ${skills.length} certification-relevant skills. Top priorities: ${skills.slice(0, 3).map((s) => s.skill).join(", ")}. ${
          candidateCount > 0 ? `${candidateCount} candidates identified.` : ""
        } ${timeline !== "Not specified" ? `Timeline: ${timeline}.` : ""}`
      : "No specific certification requirements detected in this document. Consider uploading a more detailed requirements document.",
  };
}

function extractProjectName(text: string): string {
  // Try to find project name patterns
  const patterns = [
    /project\s*(?:name)?\s*[:=]\s*([^\n]{3,50})/i,
    /(?:for|on|at)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:project|initiative|program))/i,
    /^#\s+(.+)$/m,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1].trim();
  }
  return "Extracted from Document";
}

// ─── Batch document analysis ──────────────────────────────────────────────────

export async function batchAnalyzeDocuments(
  files: { name: string; content: string }[]
): Promise<DocumentAnalysis[]> {
  const results: DocumentAnalysis[] = [];
  for (const file of files) {
    const analysis = await analyzeDocument(file.name, file.content);
    results.push(analysis);
  }
  return results;
}

// ─── Merge multiple document analyses ─────────────────────────────────────────

export function mergeAnalyses(analyses: DocumentAnalysis[]): DocumentAnalysis {
  const allSkills = new Map<string, ExtractedSkill>();

  for (const analysis of analyses) {
    for (const skill of analysis.skills) {
      const existing = allSkills.get(skill.skill);
      if (!existing || priorityRank(skill.priority) < priorityRank(existing.priority)) {
        allSkills.set(skill.skill, skill);
      }
    }
  }

  const mergedSkills = Array.from(allSkills.values()).sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority)
  );

  return {
    documentName: analyses.map((a) => a.documentName).join(", "),
    documentType: "Merged",
    projectName: analyses[0]?.projectName ?? "Unknown",
    skills: mergedSkills,
    timeline: analyses.find((a) => a.timeline !== "Not specified")?.timeline ?? "Not specified",
    candidateCount: Math.max(...analyses.map((a) => a.candidateCount)),
    summary: `Merged ${analyses.length} documents. ${mergedSkills.length} unique skills identified.`,
  };
}

function priorityRank(p: string): number {
  return p === "Critical" ? 0 : p === "High" ? 1 : p === "Medium" ? 2 : 3;
}
