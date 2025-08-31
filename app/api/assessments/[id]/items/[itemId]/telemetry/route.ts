import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/postgres';
import { getAuthFromRequest } from '@/lib/auth/auth';
import logger from '@/lib/logger';

interface TelemetryData {
  trialIndex: number;
  stimulus?: string;
  response?: any;
  responseTime?: number;
  correct?: boolean;
  timestamp: number;
  gameState?: any;
}

interface IntegrityEvent {
  type: 'visibilitychange' | 'blur' | 'focus' | 'fullscreenchange' | 'tab_switch' | 'window_resize';
  visible: boolean;
  timestamp: number;
  details?: any;
}

interface IntegrityFlags {
  events: any[];
  summary: {
    tabSwitches: number;
    focusLoss: number;
    visibilityChanges: number;
    fullscreenExits: number;
    suspiciousActivity: boolean;
  };
}

interface MetricsData {
  trials: any[];
  integrityEvents?: IntegrityEvent[];
  [key: string]: any;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assessmentId = params.id;
    const itemId = params.itemId;
    const requestData = await request.json();

    // Check if this is telemetry data or integrity event
    if (requestData.type && ['visibilitychange', 'blur', 'focus', 'fullscreenchange', 'tab_switch', 'window_resize'].includes(requestData.type)) {
      // Handle integrity event
      return await handleIntegrityEvent(auth, assessmentId, itemId, requestData as IntegrityEvent);
    } else {
      // Handle telemetry data
      return await handleTelemetryData(auth, assessmentId, itemId, requestData as TelemetryData);
    }

  } catch (error) {
    logger.error('Error in telemetry endpoint', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to process telemetry data' },
      { status: 500 }
    );
  }
}

async function handleTelemetryData(auth: any, assessmentId: string, itemId: string, telemetryData: TelemetryData) {
  // Verify assessment item belongs to candidate and is active
  const itemResult = await executeQuery(`
    SELECT
      ai.id,
      ai.assessment_id,
      ai.status,
      ai.server_started_at,
      ai.server_deadline_at,
      a.candidate_id,
      a.tenant_id
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    WHERE ai.id = :itemId AND ai.assessment_id = :assessmentId
  `, [itemId, assessmentId]);

  if (!itemResult.rows || itemResult.rows.length === 0) {
    return NextResponse.json({ error: 'Assessment item not found' }, { status: 404 });
  }

  const item = itemResult.rows[0] as any;

  if (item.CANDIDATE_ID !== auth.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (item.STATUS !== 'ACTIVE') {
    return NextResponse.json({ error: 'Item not active' }, { status: 400 });
  }

  // Validate telemetry data
  if (!telemetryData.trialIndex && telemetryData.trialIndex !== 0) {
    return NextResponse.json({ error: 'Trial index is required' }, { status: 400 });
  }

  // Get existing metrics
  const metricsResult = await executeQuery(`
    SELECT metrics_json
    FROM ASSESSMENT_ITEMS
    WHERE id = :itemId
  `, [itemId]);

  let metrics: MetricsData = { trials: [] };
  if (metricsResult.rows && metricsResult.rows[0].METRICS_JSON) {
    const parsedMetrics = JSON.parse(metricsResult.rows[0].METRICS_JSON);
    metrics = { trials: [], integrityEvents: [], ...parsedMetrics };
  }

  // Add telemetry data to metrics
  if (!metrics.trials) {
    metrics.trials = [];
  }

  // Update or add trial data
  const existingTrialIndex = metrics.trials.findIndex((t: any) => t.trialIndex === telemetryData.trialIndex);
  const trialData = {
    ...telemetryData,
    serverTimestamp: Date.now(),
    clientTimestamp: telemetryData.timestamp
  };

  if (existingTrialIndex >= 0) {
    metrics.trials[existingTrialIndex] = trialData;
  } else {
    metrics.trials.push(trialData);
  }

  // Update metrics in database
  await executeQuery(`
    UPDATE ASSESSMENT_ITEMS
    SET metrics_json = :metricsJson
    WHERE id = :itemId
  `, [JSON.stringify(metrics), itemId]);

  logger.info('Telemetry data recorded', {
    assessmentId,
    itemId,
    trialIndex: telemetryData.trialIndex,
    candidateId: auth.userId
  });

  return NextResponse.json({
    success: true,
    message: 'Telemetry data recorded'
  });
}

async function handleIntegrityEvent(auth: any, assessmentId: string, itemId: string, integrityEvent: IntegrityEvent) {
  // Verify assessment item belongs to candidate
  const itemResult = await executeQuery(`
    SELECT
      ai.id,
      ai.assessment_id,
      a.candidate_id,
      a.tenant_id
    FROM ASSESSMENT_ITEMS ai
    JOIN ASSESSMENTS a ON ai.assessment_id = a.id
    WHERE ai.id = :itemId AND ai.assessment_id = :assessmentId
  `, [itemId, assessmentId]);

  if (!itemResult.rows || itemResult.rows.length === 0) {
    return NextResponse.json({ error: 'Assessment item not found' }, { status: 404 });
  }

  const item = itemResult.rows[0] as any;

  if (item.CANDIDATE_ID !== auth.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Get existing integrity flags
  const flagsResult = await executeQuery(`
    SELECT integrity_flags
    FROM ASSESSMENTS
    WHERE id = :assessmentId
  `, [assessmentId]);

  let integrityFlags: IntegrityFlags = {
    events: [],
    summary: {
      tabSwitches: 0,
      focusLoss: 0,
      visibilityChanges: 0,
      fullscreenExits: 0,
      suspiciousActivity: false
    }
  };
  if (flagsResult.rows && flagsResult.rows[0].INTEGRITY_FLAGS) {
    const parsedFlags = JSON.parse(flagsResult.rows[0].INTEGRITY_FLAGS);
    integrityFlags = {
      events: parsedFlags.events || [],
      summary: {
        tabSwitches: parsedFlags.summary?.tabSwitches || 0,
        focusLoss: parsedFlags.summary?.focusLoss || 0,
        visibilityChanges: parsedFlags.summary?.visibilityChanges || 0,
        fullscreenExits: parsedFlags.summary?.fullscreenExits || 0,
        suspiciousActivity: parsedFlags.summary?.suspiciousActivity || false
      }
    };
  }

  // Add the integrity event
  const eventWithMetadata = {
    ...integrityEvent,
    itemId,
    serverTimestamp: Date.now()
  };
  integrityFlags.events.push(eventWithMetadata);

  // Update summary counters
  switch (integrityEvent.type) {
    case 'tab_switch':
    case 'visibilitychange':
      if (!integrityEvent.visible) {
        integrityFlags.summary.tabSwitches++;
        integrityFlags.summary.visibilityChanges++;
      }
      break;
    case 'blur':
      integrityFlags.summary.focusLoss++;
      break;
    case 'fullscreenchange':
      if (!integrityEvent.details?.fullscreen) {
        integrityFlags.summary.fullscreenExits++;
      }
      break;
  }

  // Flag suspicious activity
  if (integrityFlags.summary.tabSwitches > 3 ||
      integrityFlags.summary.focusLoss > 5 ||
      integrityFlags.summary.fullscreenExits > 1) {
    integrityFlags.summary.suspiciousActivity = true;
  }

  // Update integrity flags in database
  await executeQuery(`
    UPDATE ASSESSMENTS
    SET integrity_flags = :integrityFlags
    WHERE id = :assessmentId
  `, [JSON.stringify(integrityFlags), assessmentId]);

  logger.warn('Integrity event recorded', {
    assessmentId,
    itemId,
    eventType: integrityEvent.type,
    candidateId: auth.userId,
    suspiciousActivity: integrityFlags.summary.suspiciousActivity
  });

  return NextResponse.json({
    success: true,
    message: 'Integrity event recorded'
  });
}
