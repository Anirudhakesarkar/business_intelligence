import { callSchoolLlm } from './llm';
import type { SchoolGptContext } from './types';
import type { GptRecommendation } from './types';

function worstModules(ctx: SchoolGptContext, n = 3) {
  return [...ctx.module_scores].sort((a, b) => a.score - b.score).slice(0, n);
}

function hasFact(ctx: SchoolGptContext, needle: string) {
  const n = needle.toLowerCase();
  return ctx.summary_facts.some((f) => f.text.toLowerCase().includes(n));
}

function hasEvent(ctx: SchoolGptContext, type: string) {
  return ctx.top_events.some((e) => e.eventType === type);
}

export async function generateDailyPrincipalSummary(ctx: SchoolGptContext): Promise<{
  content: string;
  citations: string[];
  model: string;
}> {
  const citations: string[] = ['overall_score'];
  const overall = ctx.overall_score ?? 0;
  const weak = worstModules(ctx, 3).filter((m) => m.score < 85);

  let biggest = 'No critical operational issue flagged in today\'s facts.';
  if (hasFact(ctx, 'dispersal') || hasFact(ctx, 'gate') || hasEvent(ctx, 'GateCongestion')) {
    biggest = 'Gate and dispersal flow need attention based on parent experience facts and gate events.';
    citations.push('parent', 'top_events');
  } else if (hasFact(ctx, 'supervision gap') || hasEvent(ctx, 'TeacherSupervisionGap')) {
    biggest = 'Teacher supervision gaps during class hours are the primary concern.';
    citations.push('teacher', 'top_events');
  } else if (hasFact(ctx, 'compliance')) {
    biggest = 'Compliance violations or camera health issues require follow-up.';
    citations.push('compliance');
  }

  const attention = weak
    .map((m) => `- **${m.label}** (${m.score}/100): ${m.drivers[0]?.label ?? 'review drivers'}`)
    .join('\n');

  weak.forEach((m) => citations.push(m.key));

  const actions: string[] = [];
  if (citations.includes('parent') || citations.includes('top_events')) {
    actions.push('Assign a floor coordinator at Gate 2 during dispersal and monitor queue length for 15 minutes.');
  }
  if (citations.includes('teacher')) {
    actions.push('Review supervision roster for affected class blocks during peak periods.');
  }
  if (!actions.length) {
    actions.push('Maintain current operating rhythm; review module scorecards in the weekly leadership meeting.');
  }

  const content = `## Daily principal summary — ${ctx.date}

**Overall school score: ${overall}/100**

Today's performance is ${overall >= 85 ? 'within target range' : 'below target'} based on prepared daily facts and weighted module scores (Safety 20%, Security 10%, plus eight operational modules).

### Modules needing attention
${attention || '- All modules are at or above 85 — no urgent module flagged.'}

### Biggest operational issue
${biggest}

### Recommended actions
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---
*Generated from Phase 4 daily summaries and Phase 5 scores only. Contract ${ctx.contract_version}.*`;

  const llm = await callSchoolLlm(ctx);
  if (llm.provider === 'openai' && llm.text) {
    return { content: llm.text, citations: [...new Set(citations)], model: llm.model };
  }
  return { content, citations: [...new Set(citations)], model: 'demo' };
}

export function generateWeeklySummary(contexts: SchoolGptContext[]): { content: string; citations: string[] } {
  if (!contexts.length) {
    return { content: 'Insufficient data for weekly summary.', citations: [] };
  }
  const scores = contexts.map((c) => c.overall_score ?? 0);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const trend = scores.length >= 2 && scores[scores.length - 1] > scores[0] ? 'improving' : 'mixed';

  let gateDays = 0;
  for (const c of contexts) {
    if (hasFact(c, 'dispersal') || hasFact(c, 'gate') || hasEvent(c, 'GateCongestion')) gateDays++;
  }

  const citations = ['weekly_aggregate'];
  const recurring =
    gateDays >= 3
      ? `Dispersal or gate congestion appeared on ${gateDays} of ${contexts.length} school days — treat as a recurring pattern.`
      : 'No single issue recurred on more than half of school days in this window.';

  const content = `## Weekly management summary

**Week starting ${contexts[0].date}** · ${contexts.length} school day(s) in scope · average overall score **${avg}/100** (${trend} trend).

### Recurring issues
${recurring}

### Wins
- Discipline and compliance modules remained stable when daily scores stayed above 80.
- Camera health inputs did not show widespread critical outages across the week.

### Leadership focus
1. Address the highest-recurrence operational theme first (gate flow if applicable).
2. Compare teacher productivity and academic operations scores across the week before changing roster policy.
3. Use module drill-downs to trace any score change to specific events (not raw signals).

---
*Weekly rollup from daily Phase 4–5 prepared data only.*`;

  if (gateDays >= 3) citations.push('parent', 'top_events');

  return { content, citations };
}

export async function answerQuestion(ctx: SchoolGptContext, question: string): Promise<{ answer: string; citations: string[]; model: string }> {
  const q = question.toLowerCase().trim();
  const citations: string[] = [];

  if (/weather|stock|politics|who is|student name/.test(q)) {
    return {
      answer:
        'I can only answer questions grounded in today\'s school intelligence summaries, scores, and events — not external topics or individual student identity.',
      citations: [],
      model: 'demo',
    };
  }

  if (q.includes('parent') || q.includes('dispersal') || q.includes('gate')) {
    const parent = ctx.module_scores.find((m) => m.key === 'parent');
    citations.push('parent', 'summary_facts', 'top_events');
    const facts = ctx.summary_facts.filter((f) => f.module === 'parent').map((f) => f.text);
    return {
      answer: `Parent Experience score is **${parent?.score ?? '—'}/100**. ${facts[0] ?? 'No parent-module facts recorded.'} ${
        hasEvent(ctx, 'GateCongestion') ? 'Gate congestion events were recorded today.' : ''
      } Recommended: add gate staffing during dispersal if congestion facts are present.`,
      citations,
      model: 'demo',
    };
  }

  if (q.includes('teacher') || q.includes('productivity') || q.includes('supervision')) {
    const teacher = ctx.module_scores.find((m) => m.key === 'teacher');
    citations.push('teacher');
    const driverText = teacher?.drivers.map((d) => `${d.label} (${d.impact})`).join('; ') ?? 'no drivers';
    return {
      answer: `Teacher Productivity score is **${teacher?.score ?? '—'}/100**. Key drivers: ${driverText}. ${
        hasEvent(ctx, 'TeacherSupervisionGap')
          ? 'Supervision gap events were logged — review roster coverage for affected periods.'
          : 'No supervision gap events in today\'s top events.'
      }`,
      citations,
      model: 'demo',
    };
  }

  if (q.includes('room') || q.includes('occupancy') || q.includes('underused')) {
    const occ = ctx.module_scores.find((m) => m.key === 'occupancy');
    citations.push('occupancy', 'summary_facts');
    const occFacts = ctx.summary_facts.filter((f) => f.module === 'occupancy').slice(0, 3);
    return {
      answer: `Student Occupancy score is **${occ?.score ?? '—'}/100**. ${occFacts.map((f) => f.text).join(' ') || 'See occupancy daily facts for room-level detail.'}`,
      citations,
      model: 'demo',
    };
  }

  if (q.includes('why') && q.includes('low')) {
    const weak = worstModules(ctx, 2);
    weak.forEach((m) => citations.push(m.key));
    return {
      answer: `Overall score is **${ctx.overall_score}/100**. Lowest modules: ${weak
        .map((m) => `${m.label} (${m.score})`)
        .join(', ')}. Review drivers: ${weak[0]?.drivers[0]?.label ?? 'n/a'}.`,
      citations,
      model: 'demo',
    };
  }

  citations.push('overall_score');
  const llm = await callSchoolLlm(ctx, question);
  if (llm.provider === 'openai' && llm.text) {
    return { answer: llm.text, citations, model: llm.model };
  }
  return {
    answer: `Overall school score today is **${ctx.overall_score}/100**. Top events: ${
      ctx.top_events.slice(0, 3).map((e) => e.summary).join('; ') || 'none flagged'
    }. Ask about a specific module (teacher, parent, discipline, compliance) for a grounded drill-down.`,
    citations,
    model: 'demo',
  };
}

export function generateRecommendations(ctx: SchoolGptContext): Omit<GptRecommendation, 'id' | 'organizationId' | 'createdAt'>[] {
  const out: Omit<GptRecommendation, 'id' | 'organizationId' | 'createdAt'>[] = [];
  const overall = ctx.overall_score ?? 100;
  const date = ctx.date;
  const siteId = ctx.site_id;

  const push = (
    priority: 'High' | 'Medium' | 'Low',
    moduleKey: string,
    title: string,
    rationale: string,
    suggestedAction: string,
    expectedImpact: string,
    citations: string[]
  ) => {
    out.push({
      siteId,
      summaryDate: date,
      priority,
      moduleKey,
      title,
      rationale,
      suggestedAction,
      expectedImpact,
      citations,
    });
  };

  const parent = ctx.module_scores.find((m) => m.key === 'parent');
  if ((parent?.score ?? 100) < 85 || hasFact(ctx, 'dispersal') || hasEvent(ctx, 'GateCongestion')) {
    push(
      'High',
      'parent',
      'Stabilize dispersal gate flow',
      'Parent experience facts or gate events indicate dispersal congestion.',
      'Open Gate 2 for overflow pickup and assign a floor coordinator for the dispersal window.',
      'Reduce dispersal congestion minutes and improve parent experience score.',
      ['parent', 'summary_facts', 'top_events']
    );
  }

  const teacher = ctx.module_scores.find((m) => m.key === 'teacher');
  if ((teacher?.score ?? 100) < 85 || hasEvent(ctx, 'TeacherSupervisionGap')) {
    push(
      'High',
      'teacher',
      'Close teacher supervision gaps',
      'Teacher productivity score or supervision gap events are below target.',
      'Audit period-by-period teacher presence against timetable for affected rooms.',
      'Improve teacher productivity and academic operations scores.',
      ['teacher', 'top_events']
    );
  }

  const compliance = ctx.module_scores.find((m) => m.key === 'compliance');
  if ((compliance?.score ?? 100) < 90 || hasEvent(ctx, 'CriticalCameraOffline')) {
    push(
      'Medium',
      'compliance',
      'Restore critical camera coverage',
      'Compliance module or camera offline events need remediation.',
      'Dispatch IT to restore offline critical cameras and verify stream health in AI Health.',
      'Lift compliance score and reduce safety blind spots.',
      ['compliance', 'top_events']
    );
  }

  if (overall < 85 && out.length < 3) {
    const weak = worstModules(ctx, 1)[0];
    if (weak) {
      push(
        'Medium',
        weak.key,
        `Improve ${weak.label}`,
        `Module score ${weak.score}/100 is pulling down the overall school score.`,
        `Review daily facts and events for ${weak.key} with module owners.`,
        'Lift overall school score toward target range.',
        [weak.key]
      );
    }
  }

  return out;
}
