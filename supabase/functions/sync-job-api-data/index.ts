import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting job API data sync...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const awsEndpoint = Deno.env.get('AWS_ENDPOINT') ?? 'https://egrwew4jb9.execute-api.us-east-1.amazonaws.com/StageOne'
    const awsApiKey = Deno.env.get('AWS_API_KEY')

    console.log('Fetching data from AWS endpoint:', awsEndpoint)
    console.log('Using API key (first 10 chars):', awsApiKey ? awsApiKey.substring(0, 10) + '...' : 'No API key')

    // Try without any authentication first to test if endpoint is publicly accessible
    console.log('Attempting fetch without authentication...')
    let awsResponse = await fetch(awsEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('Response status (no auth):', awsResponse.status, awsResponse.statusText)

    // If that fails with 403, try with API key
    if (!awsResponse.ok && awsResponse.status === 403 && awsApiKey) {
      console.log('Retrying with X-Api-Key header...')
      awsResponse = await fetch(awsEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': awsApiKey,
        },
      })
      console.log('Response status (X-Api-Key):', awsResponse.status, awsResponse.statusText)
      
      // If still failing, try lowercase
      if (!awsResponse.ok && awsResponse.status === 403) {
        console.log('Retrying with x-api-key header...')
        awsResponse = await fetch(awsEndpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': awsApiKey,
          },
        })
        console.log('Response status (x-api-key):', awsResponse.status, awsResponse.statusText)
      }
    }

    if (!awsResponse.ok) {
      throw new Error(`AWS API returned ${awsResponse.status}: ${awsResponse.statusText}`)
    }

    const awsData = await awsResponse.json()
    console.log('Received data from AWS:', JSON.stringify(awsData).substring(0, 200))

    // Handle both single object and array responses
    const dataArray = Array.isArray(awsData) ? awsData : [awsData]
    
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Process each record
    for (const record of dataArray) {
      try {
        // Skip if no data or invalid structure
        if (!record || !record.id) {
          console.warn('Skipping invalid record:', record)
          continue
        }

        // Parse JSON strings if they exist
        const pushErrorDetails = typeof record.push_error_details === 'string' 
          ? JSON.parse(record.push_error_details) 
          : record.push_error_details

        const pushAdditionalInfo = typeof record.push_additional_info === 'string'
          ? JSON.parse(record.push_additional_info)
          : record.push_additional_info

        // Upsert the record
        const { error } = await supabaseClient
          .from('job_api_logs')
          .upsert({
            id: record.id,
            company_name: record.company_name,
            push_id: record.push_id,
            push_timestamp: record.push_timestamp,
            total_jobs_processed: record.total_jobs_processed || 0,
            jobs_created: record.jobs_created || 0,
            jobs_updated: record.jobs_updated || 0,
            jobs_deleted: record.jobs_deleted || 0,
            total_errors: record.total_errors || 0,
            push_error_details: pushErrorDetails,
            execution_time_seconds: record.execution_time_seconds || 0,
            push_status: record.push_status,
            push_additional_info: pushAdditionalInfo,
            record_type: record.record_type,
            created_at: record.created_at,
          })

        if (error) {
          console.error('Error upserting record:', record.id, error)
          errorCount++
          errors.push(`Record ${record.id}: ${error.message}`)
        } else {
          successCount++
        }
      } catch (recordError) {
        const errorMessage = recordError instanceof Error ? recordError.message : 'Unknown error'
        console.error('Error processing record:', errorMessage)
        errorCount++
        errors.push(`Record processing: ${errorMessage}`)
      }
    }

    console.log(`Sync completed. Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${successCount} records successfully`,
        errors: errorCount > 0 ? errors : undefined,
        stats: {
          total: dataArray.length,
          successful: successCount,
          failed: errorCount
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    console.error('Error in sync function:', errorMessage)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
