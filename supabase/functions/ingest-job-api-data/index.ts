import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify API key from header
    const apiKey = req.headers.get('x-api-key')
    const expectedApiKey = Deno.env.get('AWS_API_KEY')
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid API key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const data = await req.json()

    // Generate an ID if not provided (use timestamp as unique bigint)
    const recordId = data.id || Date.now()
    
    console.log('Processing ingest with id:', recordId, 'push_id:', data.push_id)

    // Insert or update the job API log data
    const { error } = await supabaseClient
      .from('job_api_logs')
      .upsert({
        id: recordId,
        company_name: data.company_name,
        push_id: data.push_id,
        push_timestamp: data.push_timestamp,
        total_jobs_processed: data.total_jobs_processed || 0,
        jobs_created: data.jobs_created || 0,
        jobs_updated: data.jobs_updated || 0,
        jobs_deleted: data.jobs_deleted || 0,
        total_errors: data.total_errors || 0,
        push_error_details: typeof data.push_error_details === 'string' 
          ? JSON.parse(data.push_error_details) 
          : data.push_error_details,
        execution_time_seconds: data.execution_time_seconds || 0,
        push_status: data.push_status,
        push_additional_info: typeof data.push_additional_info === 'string'
          ? JSON.parse(data.push_additional_info)
          : data.push_additional_info,
        record_type: data.record_type,
        created_at: data.created_at,
      })

    if (error) {
      console.error('Error inserting job API log:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Data ingested successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error processing request:', error)
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
