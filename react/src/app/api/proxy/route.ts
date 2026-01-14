// API proxy route to bypass CORS issues with Google Apps Script
// This server-side route forwards requests to Google Apps Script

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering (required for API routes)
export const dynamic = 'force-dynamic';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    const url = `${GOOGLE_SCRIPT_URL}?${queryString}`;
    console.log('Proxy GET: Fetching from', url);
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    // Get response as text first to check if it's JSON
    const text = await response.text();
    
    // Check if response looks like HTML (starts with <)
    if (text.trim().startsWith('<')) {
      console.error('Proxy GET: Received HTML instead of JSON. Status:', response.status);
      console.error('Proxy GET: Response preview:', text.substring(0, 500));
      return NextResponse.json(
        { 
          success: false, 
          error: `API returned HTML error page (status ${response.status}). Check your Google Apps Script deployment URL.` 
        },
        { status: 500 }
      );
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Proxy GET: Failed to parse JSON. Response:', text.substring(0, 500));
      return NextResponse.json(
        { 
          success: false, 
          error: `API returned invalid JSON. Response: ${text.substring(0, 100)}...` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Proxy request failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    const queryString = searchParams.toString();
    
    const url = `${GOOGLE_SCRIPT_URL}?${queryString}`;
    console.log('Proxy POST: Fetching from', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    // Get response as text first to check if it's JSON
    const text = await response.text();
    
    // Check if response looks like HTML (starts with <)
    if (text.trim().startsWith('<')) {
      console.error('Proxy POST: Received HTML instead of JSON. Status:', response.status);
      console.error('Proxy POST: Response preview:', text.substring(0, 500));
      return NextResponse.json(
        { 
          success: false, 
          error: `API returned HTML error page (status ${response.status}). Check your Google Apps Script deployment URL.` 
        },
        { status: 500 }
      );
    }

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Proxy POST: Failed to parse JSON. Response:', text.substring(0, 500));
      return NextResponse.json(
        { 
          success: false, 
          error: `API returned invalid JSON. Response: ${text.substring(0, 100)}...` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Proxy request failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


