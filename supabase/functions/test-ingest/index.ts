import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting test ingest...')

    // Create sample data with all required fields including id
    const testPushId = Math.floor(Date.now() / 1000); // Convert to seconds for smaller integer
    const testId = Date.now(); // Unique bigint id
    const sampleData = {
      id: testId,
      push_id: testPushId,
      company_name: "Test Company",
      push_timestamp: new Date().toISOString(),
      push_status: "SUCCESS",
      record_type: "test",
      total_jobs_processed: 5,
      jobs_created: 2,
      jobs_updated: 2,
      jobs_deleted: 1,
      execution_time_seconds: 3,
      total_errors: 0,
      push_error_details: {},
      push_additional_info: {
        test: true,
        note: "This is a test push from the Job API Monitor"
      }
    }

    console.log('Sample data created with id:', testId, 'push_id:', testPushId)

    // Get the API key from environment
    const apiKey = Deno.env.get('AWS_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    if (!apiKey) {
      throw new Error('AWS_API_KEY not configured')
    }

    console.log('Calling ingest endpoint...')

    // Call the ingest endpoint with the correct API key
    const response = await fetch(
      `${supabaseUrl}/functions/v1/ingest-job-api-data`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(sampleData)
      }
    )

    console.log('Ingest response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Ingest failed:', errorData)
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log('Test ingest successful:', result)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test data ingested successfully',
        data: sampleData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in test ingest:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
