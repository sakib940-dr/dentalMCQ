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
// NOTE ON STATUS CODES: every response here is HTTP 200, even for
// "expected" failures (wrong role, FK constraint, etc.) — only the JSON
// body's `success`/`error` fields signal the real outcome. This is
// deliberate: supabase-js's functions.invoke() wraps any non-2xx response
// in a generic FunctionsHttpError, and re-reading that error's body on the
// client can silently fail ("body stream already read"), which is exactly
// what produced the unhelpful "Edge Function returned a non-2xx status
// code" message. Always-200 sidesteps that entirely — the client just
// reads `data.error` directly, no ambiguity.
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

    // Scoped to the CALLER's own JWT — used only to verify who's calling
    // and their role. Never used to perform the actual deletion.
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
      return fail('Only the Super Admin can delete users.');
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) return fail('target_user_id is required.');
    if (target_user_id === callerUser.id) return fail('You cannot delete your own account from here.');

    // The ONLY client in this function that holds the service role key.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', target_user_id)
      .single();

    if (targetProfile?.role === 'super_admin') {
      return fail('The Super Admin account cannot be deleted.');
    }

    // 1) Delete the profile row — the same step the app already did.
    // If any other table has a non-cascading FK to profiles.id, THIS is
    // where it will fail, with the real Postgres error message returned
    // below (e.g. "violates foreign key constraint ... still referenced
    // from table \"exam_attempts\"") — that tells us exactly which table
    // needs its foreign key behavior decided (cascade vs. set null).
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', target_user_id);
    if (profileDeleteError) {
      return fail(`Failed to delete profile: ${profileDeleteError.message}`);
    }

    // 2) Delete the actual Auth login account — the step that was missing.
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (authDeleteError) {
      return fail(`Profile was deleted, but removing the login account failed: ${authDeleteError.message}`);
    }

    return ok({ success: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
});
