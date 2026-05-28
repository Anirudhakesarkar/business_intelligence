import '@/lib/school-persistence/init';
import { NextRequest, NextResponse } from 'next/server';
import { buildCopilotPrompt, type CopilotContext } from '@/lib/business-intelligence/copilot-context-builder';
import { calculateAllScores, type RawMetrics } from '@/lib/business-intelligence/score-calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, siteId, dateRange = '7d', question } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Build structured context from DB (demo metrics for now)
    const metrics: RawMetrics = {
      totalAlerts: 247, criticalAlerts: 18, repeatedAlerts: 61, unacknowledgedAlerts: 9,
      avgAcknowledgeMinutes: 7.4, avgResolutionMinutes: 148, slaBreaches: 4, autoClosed: 24,
      totalCameras: 24, onlineCameras: 22, streamDropCount: 8, offlineCriticalCameras: 1,
      edgeServerUptime: 98, openIncidents: 12, unresolvedIncidentCount: 4,
      avgIncidentAgeDays: 2.1, criticalAreaAlerts: 18,
    };

    const scores = calculateAllScores(metrics);

    const dateFrom = new Date(Date.now() - (dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 7) * 86400_000)
      .toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);

    const context: CopilotContext = {
      organizationId: organizationId ?? 1,
      siteId,
      dateFrom,
      dateTo,
      scores,
      alertSummary: {
        total: metrics.totalAlerts, critical: metrics.criticalAlerts,
        repeated: metrics.repeatedAlerts, unacknowledged: metrics.unacknowledgedAlerts,
        avgAckMinutes: metrics.avgAcknowledgeMinutes, avgResolutionMinutes: metrics.avgResolutionMinutes,
        slaBreaches: metrics.slaBreaches,
      },
      cameraSummary: {
        total: metrics.totalCameras, online: metrics.onlineCameras,
        streamDrops: metrics.streamDropCount, offlineCritical: metrics.offlineCriticalCameras,
      },
      incidentSummary: {
        open: metrics.openIncidents, unresolved: metrics.unresolvedIncidentCount,
        avgAgeDays: metrics.avgIncidentAgeDays,
      },
      topRiskAreas: [
        { name: 'Main Gate', riskLevel: 'High', alertCount: 42, category: 'Entrance / Exit' },
        { name: 'Parking Area', riskLevel: 'Medium', alertCount: 18, category: 'External Zone' },
      ],
      recommendations: [
        { title: 'Improve operator acknowledgment time', priority: 'High', action: 'Review shift coverage during peak alert hours' },
        { title: 'Tune intrusion detection rule', priority: 'Medium', action: 'Create separate after-hours rule for Main Gate' },
      ],
    };

    // Generate a structured AI-style answer using context (without GPT for demo)
    const answer = generateDemoAnswer(question, context);

    // In production: store to bi_copilot_chats and call GPT with buildCopilotPrompt(context, question)
    const prompt = buildCopilotPrompt(context, question);
    void prompt; // used in production GPT call

    return NextResponse.json({
      answer,
      contextSummary: context,
      sourceMetrics: scores,
      question,
    });
  } catch (err) {
    console.error('Copilot error:', err);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}

function generateDemoAnswer(question: string, ctx: CopilotContext): string {
  const q = question.toLowerCase();

  if (q.includes('safe') || q.includes('safety')) {
    return `Safety Score: ${ctx.scores.safetyScore}/100. The site has ${ctx.alertSummary.critical} critical alerts and ${ctx.incidentSummary.unresolved} unresolved incidents. Main Gate is the highest-risk area with 42 alerts this period. Response: Review operator coverage during evening hours.`;
  }
  if (q.includes('camera') || q.includes('health')) {
    return `Camera Health Score: ${ctx.scores.cameraHealthScore}/100. ${ctx.cameraSummary.online} of ${ctx.cameraSummary.total} cameras are online. ${ctx.cameraSummary.streamDrops} stream drops recorded. ${ctx.cameraSummary.offlineCritical} critical camera is offline. Action: Dispatch maintenance to check CAM-HAN-007 in Main Gate area.`;
  }
  if (q.includes('risk')) {
    return `Operational Risk: ${ctx.scores.operationalRiskScore}/100 (${ctx.scores.riskLevel}). Highest-risk area is ${ctx.topRiskAreas[0]?.name} with ${ctx.topRiskAreas[0]?.alertCount} alerts. ${ctx.alertSummary.slaBreaches} SLA breaches detected. Action: ${ctx.recommendations[0]?.action}.`;
  }
  if (q.includes('response') || q.includes('sla') || q.includes('operator')) {
    return `Response Score: ${ctx.scores.responseScore}/100. Average acknowledgment time: ${ctx.alertSummary.avgAckMinutes.toFixed(1)} min (target: 5 min). ${ctx.alertSummary.slaBreaches} SLA breaches this period. Action: Add operator coverage during peak hours and configure escalation policies.`;
  }
  if (q.includes('improve') || q.includes('fix') || q.includes('recommend')) {
    return `Top recommendation: ${ctx.recommendations[0]?.title}. Action: ${ctx.recommendations[0]?.action}. Also consider: ${ctx.recommendations[1]?.title} — ${ctx.recommendations[1]?.action}.`;
  }
  if (q.includes('alert')) {
    return `Total alerts: ${ctx.alertSummary.total}. Critical: ${ctx.alertSummary.critical}. Repeated: ${ctx.alertSummary.repeated}. ${ctx.alertSummary.unacknowledged} unacknowledged alerts pending. Top area: ${ctx.topRiskAreas[0]?.name} (${ctx.topRiskAreas[0]?.alertCount} alerts).`;
  }

  return `Based on current data: Safety Score ${ctx.scores.safetyScore}/100, Camera Health ${ctx.scores.cameraHealthScore}/100, Response Score ${ctx.scores.responseScore}/100, Risk Level ${ctx.scores.riskLevel}. Main Gate has the highest alert volume (${ctx.topRiskAreas[0]?.alertCount} alerts). Recommended action: ${ctx.recommendations[0]?.action}.`;
}
