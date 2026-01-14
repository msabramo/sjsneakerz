// Mark as static to exclude from static export (API routes don't work in static exports)
export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ 
    status: 'ok',
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

