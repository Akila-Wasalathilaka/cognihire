import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const analytics = {
    total_candidates: 4,
    active_candidates: 4,
    total_assessments: 0,
    completed_assessments: 0,
    total_job_roles: 4
  };
  
  return NextResponse.json(analytics);
}