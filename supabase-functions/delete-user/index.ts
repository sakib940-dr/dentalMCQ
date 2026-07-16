// Supabase Edge Function: delete-user
//
// WHY THIS EXISTS: the client-side "Delete" button could only ever delete
// the `profiles` row — deleting the actual Supabase Auth account
// (auth.users) requires the service role key, which must never be sent to
// a browser. This function holds that key safely on the server side and
// is the only place it's used.
//
// AUTHORIZATION: re-checks (server-side, not trusting the browser) that
// the caller is signed in AND has role = 'super_admin' — this mirrors
// UserManagementPage.jsx, which is already Super-Admin-only in the UI,
// but the UI check alone isn't a real security boundary on its own.
//
// SAFETY: refuses to delete the Super Admin account or the caller's own
// account, matching the existing "Super Admin is fixed" rule already
// enforced elsewhere (DB triggers `check_single_super_admin` /
// `protect_super_admin`) — this is a second layer, not a replacement.
//
// DEPLOY: paste this file's contents into Supabase Dashboard → Edge
// Functions → Create a new function named "delete-user" → Deploy.
// No extra secrets to configure — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are automatically available to every Edge
// Function.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Scoped to the CALLER's own JWT — used only to verify who's calling
    // and their role. Never used to perform the actual deletion.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) return json({ error: 'Not authenticated.' }, 401);

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'super_admin') {
      return json({ error: 'Only the Super Admin can delete users.' }, 403);
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) return json({ error: 'target_user_id is required.' }, 400);
    if (target_user_id === callerUser.id) return json({ error: 'You cannot delete your own account from here.' }, 400);

    // The ONLY client in this function that holds the service role key.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', target_user_id)
      .single();

    if (targetProfile?.role === 'super_admin') {
      return json({ error: 'The Super Admin account cannot be deleted.' }, 400);
    }

    // 1) Delete the profile row — the same step the app already did.
    // If any other table has a non-cascading FK to profiles.id, this is
    // where that would surface as an error, same as it always would have.
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', target_user_id);
    if (profileDeleteError) {
      return json({ error: `Failed to delete profile: ${profileDeleteError.message}` }, 500);
    }

    // 2) Delete the actual Auth login account — the step that was missing.
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (authDeleteError) {
      return json({ error: `Profile was deleted, but removing the login account failed: ${authDeleteError.message}` }, 500);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
