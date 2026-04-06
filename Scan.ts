// api/scan.ts
// Vercel serverless function — converted from Express router
// Logic is identical to governance.ts — only the handler wrapper changed
//
// WHAT CHANGED FROM governance.ts:
//   - Removed: import { Router } from 'express'
//   - Removed: const router = Router()
//   - Removed: router.post('/scan', ...) wrapper
//   - Removed: export default router
//   - Added:   export default async function handler(req, res)
//   - Added:   CORS headers (Vercel functions need these explicitly)
//   - Removed: rawResponse from result (never send raw LLM output to client)
//
// WHAT IS IDENTICAL:
//   - All parsing logic (parseResponse, parseMarkdown, lastScoreFor etc.)
//   - resolveRiskTier() safety floor
//   - clamp()
//   - The Gemma API call itself
//   - All TypeScript types
//   - Error handling

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // ── CORS — required for Vercel functions ──────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const {
    systemName, description, deployment, dataTypes,
    decisionMaker, humanOverride, industry
  } = req.body as Record<string, string | string[]>;

  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) {
    res.status(503).json({ success: false, error: 'GEMMA_API_KEY is not configured.' });
    return;
  }

  const prompt = `{
  "risk_tier": "???",
  "risk_rationale": "???",
  "readiness_score": 0,
  "scores": {"transparency":0,"accountability":0,"data_governance":0,"human_oversight":0,"risk_management":0},
  "eu_gaps": [],
  "nist_gaps": [],
  "controls": [],
  "executive_summary": "???"
}

Replace every ??? and 0 above with real values for the AI system described below.
Output ONLY the completed JSON object. Your response must start with { on the very first character and end with }. No preamble, no explanation, no markdown, no chain-of-thought.

Scoring rubric — apply EXACTLY this scale for each of the 5 dimensions (0–20 each):
  0–6   = Non-compliant: no documented controls, major regulatory gap, no evidence of effort
  7–13  = Partial: some controls exist but significant gaps remain, not fully documented
  14–20 = Substantially compliant: controls documented, tested, and operating effectively

Score each dimension by counting concrete evidence present in the system description:
- transparency (0–20): Is the AI logic explainable to end users and operators?
- accountability (0–20): Is there a named owner, audit trail, and escalation path?
- data_governance (0–20): Is training/inference data documented, bias-tested, and minimised?
- human_oversight (0–20): Can a human meaningfully intervene before a decision takes effect?
- risk_management (0–20): Is there monitoring, drift detection, and incident response?

Other rules:
- risk_tier: one of Unacceptable / High / Limited / Minimal
- Credit scoring always = High (EU AI Act Annex III 5b)
- readiness_score = exact sum of all 5 dimension scores
- eu_gaps: array of {article, description, severity}
- nist_gaps: array of {function, subcategory, description}
- controls: array of {action, priority} where priority is Critical/High/Medium
- executive_summary: max 3 sentences, plain text

System to assess:
Name: ${systemName}
Purpose: ${description}
Deployment: ${deployment}
Data processed: ${Array.isArray(dataTypes) ? dataTypes.join(', ') : dataTypes}
Decision maker: ${decisionMaker}
Human override: ${humanOverride}
Industry: ${industry}`;

  try {
    const gemmaRes = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2048 }
      })
    });

    const gemmaData = await gemmaRes.json() as Record<string, unknown>;

    if (!gemmaRes.ok) {
      console.error('Gemma API error:', JSON.stringify(gemmaData));
      const msg = (gemmaData?.error as Record<string, string>)?.message
        ?? `Gemma API error ${gemmaRes.status}`;
      res.status(502).json({ success: false, error: msg });
      return;
    }

    const candidates = (
      gemmaData as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      }
    ).candidates;
    const rawText = candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
      res.status(502).json({
        success: false,
        error: 'Gemma returned an empty response. Please try again.'
      });
      return;
    }

    const parsed = parseResponse(rawText);

    const s = parsed.scores;
    const transparency    = s.transparency;
    const accountability  = s.accountability;
    const dataGovernance  = s.data_governance;
    const humanOversight  = s.human_oversight;
    const riskManagement  = s.risk_management;
    const calculatedTotal =
      transparency + accountability + dataGovernance + humanOversight + riskManagement;

    function resolveRiskTier(parsedTier: string, total: number): string {
      const failedCount = [
        transparency, accountability, dataGovernance, humanOversight, riskManagement
      ].filter(v => v <= 7).length;
      if (total <= 35 || failedCount >= 3) return 'High';
      if (total <= 55 || failedCount >= 2) return 'Limited';
      if (total >= 75) return 'Minimal';
      const tier = (parsedTier || '').trim();
      if (tier === 'Unacceptable') return 'Unacceptable';
      if (tier === 'High') return 'High';
      if (tier === 'Minimal') return 'Minimal';
      return 'Limited';
    }

    // rawResponse deliberately excluded — never send raw LLM output to client
    const result = {
      riskTier:         resolveRiskTier(parsed.risk_tier, calculatedTotal),
      riskRationale:    parsed.risk_rationale,
      readinessScore:   calculatedTotal,
      scores: {
        transparency,
        accountability,
        dataGovernance,
        humanOversight,
        riskManagement
      },
      euGaps:           parsed.eu_gaps,
      nistGaps:         parsed.nist_gaps,
      controls:         parsed.controls,
      executiveSummary: parsed.executive_summary,
    };

    res.json({ success: true, result });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser — identical to governance.ts, untouched
// ─────────────────────────────────────────────────────────────────────────────

type Scores = {
  transparency: number;
  accountability: number;
  data_governance: number;
  human_oversight: number;
  risk_management: number;
};

type Parsed = {
  risk_tier: string;
  risk_rationale: string;
  scores: Scores;
  eu_gaps: unknown[];
  nist_gaps: unknown[];
  controls: unknown[];
  executive_summary: string;
};

function parseResponse(text: string): Parsed {
  let t = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s !== -1 && e !== -1) {
    try {
      const jt = t.substring(s, e + 1)
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/[\u0000-\u001F]/g, ' ')
        .replace(/\n/g, ' ');
      const p = JSON.parse(jt) as Record<string, unknown>;
      if (p.scores || p.risk_tier) {
        const sc = (p.scores as Record<string, unknown>) ?? {};
        return {
          risk_tier:         (p.risk_tier as string) || '',
          risk_rationale:    (p.risk_rationale as string) || '',
          scores: {
            transparency:    clamp(Number(sc.transparency)    || 0),
            accountability:  clamp(Number(sc.accountability)  || 0),
            data_governance: clamp(Number(sc.data_governance) || 0),
            human_oversight: clamp(Number(sc.human_oversight) || 0),
            risk_management: clamp(Number(sc.risk_management) || 0),
          },
          eu_gaps:           (p.eu_gaps   as unknown[]) || [],
          nist_gaps:         (p.nist_gaps as unknown[]) || [],
          controls:          (p.controls  as unknown[]) || [],
          executive_summary: (p.executive_summary as string) || '',
        };
      }
    } catch { /* fall through to markdown parser */ }
  }
  return parseMarkdown(text);
}

function clamp(n: number): number { return Math.min(20, Math.max(0, n)); }

function lastScoreFor(text: string, dim: string): number {
  let last: number | null = null;
  const keyPat = dim.replace(/_/g, '[_\\s]');
  for (const m of text.matchAll(
    new RegExp(`["'\`]${keyPat}["'\`]\\s*:\\s*(\\d+)`, 'gi')
  )) last = clamp(parseInt(m[1], 10));
  if (last !== null) return last;
  const labelPat = dim
    .replace(/_/g, '[ _]')
    .replace(/\b([a-z])/g, (_, c) => `[${c}${c.toUpperCase()}]`);
  for (const m of text.matchAll(
    new RegExp(`\\b${labelPat}\\b\\s*:\\s*(\\d+)`, 'gi')
  )) last = clamp(parseInt(m[1], 10));
  if (last !== null) return last;
  for (const m of text.matchAll(
    new RegExp(`${keyPat}[^\\n]{0,120}(?:Score|say)\\s*:?\\s*(\\d+)`, 'gi')
  )) last = clamp(parseInt(m[1], 10));
  return last ?? 0;
}

function parseJsonArray(
  block: string,
  requiredKey: string
): Record<string, string>[] {
  if (!block) return [];
  const s = block.indexOf('[');
  const e = block.lastIndexOf(']');
  if (s !== -1 && e !== -1) {
    try {
      const arr = JSON.parse(
        block.slice(s, e + 1)
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/[\u0000-\u001F]/g, ' ')
      ) as Record<string, string>[];
      if (Array.isArray(arr) && arr.length && arr[0][requiredKey]) return arr;
    } catch { /* fall through */ }
  }
  const results: Record<string, string>[] = [];
  for (const m of block.matchAll(/\{([^{}]+)\}/g)) {
    try {
      const obj = JSON.parse(
        `{${m[1].replace(/,(\s*[}\]])/g, '$1')}}`
      ) as Record<string, string>;
      if (obj[requiredKey]) results.push(obj);
    } catch { /* skip */ }
  }
  return results;
}

function parseBulletEuGaps(
  text: string
): { article: string; description: string; severity: string }[] {
  const results: { article: string; description: string; severity: string }[] = [];
  for (const m of text.matchAll(
    /[*-]\s+(Article\s+\d+[^:]*?):\s*([^(\n]{10,}?)(?:\s*\(([A-Za-z]+)\))?\s*$/gim
  )) results.push({
    article:     m[1].trim(),
    description: m[2].trim(),
    severity:    m[3] ?? 'High'
  });
  return results;
}

function parseBulletNistGaps(
  text: string
): { function: string; subcategory: string; description: string }[] {
  const results: { function: string; subcategory: string; description: string }[] = [];
  for (const m of text.matchAll(
    /[*-]\s+(Govern|Measure|Manage|Map)\s*(?:\(([^)]+)\))?:\s*(.{10,})/gim
  )) results.push({
    function:    m[1].trim(),
    subcategory: m[2]?.trim() ?? '',
    description: m[3].trim()
  });
  return results;
}

function parseBulletControls(
  text: string
): { action: string; priority: string }[] {
  const results: { action: string; priority: string }[] = [];
  for (const m of text.matchAll(
    /[*-]\s+([A-Z][^(\n]{15,}?)(?:\s*\.\s*|\s+)\(?(Critical|High|Medium)\)?\.?\s*$/gim
  )) results.push({
    action:   m[1].trim().replace(/\.$/, ''),
    priority: m[2]
  });
  if (!results.length) {
    let i = 0;
    for (const m of text.matchAll(/[*-]\s+([A-Z][^*\n]{20,})/gm)) {
      if (!/^(EU|NIST|Controls?|Executive|Risk|Readiness|Check|JSON|Score|Total|Transparency|Account|Data|Human|Risk M)/i.test(m[1]))
        results.push({
          action:   m[1].trim().replace(/\.$/, ''),
          priority: i++ < 2 ? 'Critical' : i < 4 ? 'High' : 'Medium'
        });
    }
  }
  return results;
}

function sectionBlock(text: string, startRe: RegExp, endRe: RegExp): string {
  const i = text.search(startRe);
  if (i === -1) return '';
  const rest = text.slice(i);
  const j = rest.search(endRe);
  return j === -1 ? rest : rest.slice(0, j);
}

function parseMarkdown(text: string): Parsed {
  const lastFormalIdx = Math.max(
    text.lastIndexOf('"risk_tier"'),
    text.lastIndexOf('`risk_tier`'),
    text.search(/\*{0,2}Risk Tier\*{0,2}:\s*(Unacceptable|High|Limited|Minimal)/i)
  );
  const formal = lastFormalIdx > 0 ? text.slice(lastFormalIdx) : text;

  const tierMatch =
    formal.match(/["'`]?risk_tier["'`]?\s*:?\s*["'`]?\s*(Unacceptable|High|Limited|Minimal)["'`]?/i)
    ?? text.match(/\bRisk Tier\b[^:]*:\s*(Unacceptable|High|Limited|Minimal)/i);
  const risk_tier = tierMatch?.[1] ?? '';

  const ratMatch =
    formal.match(/["'`]risk_rationale["'`]\s*:\s*"([^"]{10,})"/i)
    ?? formal.match(/["'`]risk_rationale["'`]\s*:\s*['`]([^'`\n]{10,})['`]/i)
    ?? formal.match(/\bRisk Rationale\b[^:]*:\s*(.{20,})/i);
  const risk_rationale = ratMatch?.[1]?.replace(/^["'`]|["'`]$/g, '').trim() ?? '';

  const transparency    = lastScoreFor(text, 'transparency');
  const accountability  = lastScoreFor(text, 'accountability');
  const data_governance = lastScoreFor(text, 'data_governance');
  const human_oversight = lastScoreFor(text, 'human_oversight');
  const risk_management = lastScoreFor(text, 'risk_management');

  const euStart   = formal.search(/["'`]eu_gaps["'`]\s*:|EU Gaps?\s*:/i);
  const nistStart = formal.search(/["'`]nist_gaps["'`]\s*:|NIST Gaps?\s*:/i);
  const euBlock   = euStart !== -1
    ? formal.slice(euStart, nistStart !== -1 ? nistStart : undefined)
    : '';
  let eu_gaps = parseJsonArray(euBlock, 'article')
    .map(g => ({
      article:     g.article     ?? '',
      description: g.description ?? '',
      severity:    g.severity    ?? 'High'
    }));
  if (!eu_gaps.length) {
    const bk = sectionBlock(text, /EU Gaps?\s*:/i, /NIST Gaps?\s*:|Controls?\s*:/i) || euBlock;
    eu_gaps = parseBulletEuGaps(bk);
  }

  const ctrlStart = formal.search(/["'`]controls["'`]\s*:|Controls?\s*:/i);
  const nistBlock = nistStart !== -1
    ? formal.slice(nistStart, ctrlStart !== -1 ? ctrlStart : undefined)
    : '';
  let nist_gaps = parseJsonArray(nistBlock, 'function')
    .map(g => ({
      function:    g.function    ?? '',
      subcategory: g.subcategory ?? '',
      description: g.description ?? ''
    }));
  if (!nist_gaps.length) {
    const bk = sectionBlock(text, /NIST Gaps?\s*:/i, /Controls?\s*:|Executive/i) || nistBlock;
    nist_gaps = parseBulletNistGaps(bk);
  }

  const execStart = formal.search(/["'`]executive_summary["'`]\s*:|Executive Summary\s*:/i);
  const ctrlBlock = ctrlStart !== -1
    ? formal.slice(ctrlStart, execStart !== -1 ? execStart : undefined)
    : '';
  let controls = parseJsonArray(ctrlBlock, 'action')
    .map((c, i) => ({
      action:   c.action   ?? '',
      priority: c.priority ?? (i < 2 ? 'Critical' : i < 4 ? 'High' : 'Medium')
    }));
  if (!controls.length) {
    const bk = sectionBlock(text, /Controls?\s*:/i, /Executive Summary\s*:|Check JSON/i) || ctrlBlock;
    controls = parseBulletControls(bk);
  }

  const execMatches = [...text.matchAll(/["'`]executive_summary["'`]\s*:\s*"([^"]{20,})"/gi)];
  const executive_summary =
    execMatches.at(-1)?.[1]?.trim()
    ?? ([...text.matchAll(/["'`]executive_summary["'`]\s*:\s*['`]([^'`]{20,})['`]/gi)].at(-1)?.[1]?.trim())
    ?? (text.match(/\bExecutive Summary\b[^:]*:\s*(.{30,})/i)?.[1]?.trim().split('\n')[0] ?? '');

  return {
    risk_tier,
    risk_rationale,
    scores: { transparency, accountability, data_governance, human_oversight, risk_management },
    eu_gaps,
    nist_gaps,
    controls,
    executive_summary,
  };
}
