import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    const response = await fetch(`${backendUrl}/admin/analytics/overview`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
    });

    if (!response.ok) {
      console.error('Backend analytics error:', response.status, response.statusText);
      // Return fallback data if backend is not available
      return NextResponse.json({
        total_candidates: 4,
        active_candidates: 4,
        total_assessments: 0,
        completed_assessments: 0,
        total_job_roles: 4
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics API error:', error);
    // Return fallback data on error
    return NextResponse.json({
      total_candidates: 4,
      active_candidates: 4,
      total_assessments: 0,
      completed_assessments: 0,
      total_job_roles: 4
    });
  }
}