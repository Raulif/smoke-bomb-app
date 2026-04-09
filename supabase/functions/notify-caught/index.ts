import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { thrower_id, catcher_id } = await req.json();

  if (!thrower_id || !catcher_id) {
    return new Response(JSON.stringify({ error: 'Missing thrower_id or catcher_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch thrower's push token and catcher's username in parallel
  const [throwerResult, catcherResult] = await Promise.all([
    supabase.from('users').select('push_token').eq('id', thrower_id).single(),
    supabase.from('users').select('username').eq('id', catcher_id).single(),
  ]);

  const pushToken = throwerResult.data?.push_token;
  const catcherUsername = catcherResult.data?.username ?? 'Someone';

  if (!pushToken) {
    return new Response(JSON.stringify({ sent: false, reason: 'no_token' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: "🕵️ You've been caught!",
    body: `${catcherUsername} figured you out.`,
    data: { type: 'caught' },
  };

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const result = await expoResponse.json();

  return new Response(JSON.stringify({ sent: true, result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
