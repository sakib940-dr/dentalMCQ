// Supabase Edge Function: admin-reset-password
//
// WHY THIS EXISTS: setting another user's password requires the Admin API
// (auth.admin.updateUserById), which needs the service role key — same
// reasoning as delete-user. This is the only place that key is used here.
//
// AUTHORIZATION: re-checks server-side that the caller is signed in AND
// has role = 'super_admin', mirroring UserManagementPage.jsx.
//
// Also updates the plain-text `user_credentials` shadow row directly
// (this function already holds admin privileges, so there's no need to
// separately call the save_credential_shadow RPC).
//
// DEPLOY: paste this file's contents into Supabase Dashboard → Edge
// Functions → Create a new function named "admin-reset-password" →
// Deploy. No extra secrets needed — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are automatically available to every Edge
// Function.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function fail(error: string) {
  return ok({ success: false, error });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('Missing authorization header.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) return fail('Not authenticated.');

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'super_admin') {
      return fail('Only the Super Admin can reset another user\'s password.');
    }

    const { target_user_id, new_password } = await req.json();
    if (!target_user_id) return fail('target_user_id is required.');
    if (!new_password || new_password.length < 6) return fail('New password must be at least 6 characters.');

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, {
      password: new_password,
    });
    if (updateError) return fail(`Failed to reset password: ${updateError.message}`);

    // Keep the plain-text shadow copy in sync so it still shows correctly
    // in User Management.
    const { error: shadowError } = await adminClient
      .from('user_credentials')
      .upsert({ user_id: target_user_id, plain_password: new_password }, { onConflict: 'user_id' });
    if (shadowError) {
      // The actual password WAS changed successfully — this is a
      // secondary/display concern, so it's reported but not treated as
      // an overall failure.
      return ok({ success: true, warning: `Password reset, but the visible copy could not be updated: ${shadowError.message}` });
    }

    return ok({ success: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
});
