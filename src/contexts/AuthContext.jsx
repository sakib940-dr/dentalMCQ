import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setProfile(null);
    } else {
      setProfile(data);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // Keep the plain-text shadow copy in sync on every successful login.
    // This is also the reliable fallback for accounts created while
    // Confirm Email was on, where signUp() had no session yet to save it
    // (see the comment in signUp below) — it gets saved here instead, the
    // first time this user actually logs in.
    if (data.user) {
      const { error: credError } = await supabase.rpc('save_credential_shadow', {
        target_user_id: data.user.id,
        new_password: password,
      });
      if (credError) console.error('Failed to sync credential shadow copy on login:', credError.message);
    }
    return { data };
  };

  const signUp = async ({ email, password, fullName, username, mobileNumber }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username, mobile_number: mobileNumber },
      },
    });
    if (error) return { error };

    // The `profiles` row is created automatically by a DB trigger now
    // (see migration_profile_trigger.sql) — NOT inserted from here. A
    // direct client-side insert only worked while Confirm Email was off
    // (signUp() returns an active session immediately in that case); with
    // Confirm Email on, there's no session yet at this point, so the
    // insert would fail RLS. The trigger runs at the database level
    // regardless of session state, so it works either way.

    // Shadow-store the plain-text password for Super Admin visibility —
    // only possible here if signUp() returned an active session (i.e.
    // Confirm Email is off). If confirmation is required, there's no
    // session yet to authenticate this RPC call; signIn() above saves the
    // shadow copy instead, the first time this user actually logs in.
    if (data.user && data.session) {
      const { error: credError } = await supabase.rpc('save_credential_shadow', {
        target_user_id: data.user.id,
        new_password: password,
      });
      if (credError) {
        console.error('Failed to store credential shadow copy:', credError.message, credError);
        return { data, credentialWarning: credError.message };
      }
    }
    return { data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!session?.user?.email) return { error: { message: 'Not logged in.' } };

    // Verify the current password by re-authenticating with it.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) return { error: { message: 'Current password is incorrect.' } };

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { error: updateError };

    // Keep the plain-text shadow copy in sync for Super Admin visibility.
    const { error: credError } = await supabase.rpc('save_credential_shadow', {
      target_user_id: session.user.id,
      new_password: newPassword,
    });
    if (credError) {
      console.error('Failed to sync credential shadow copy:', credError.message);
    }

    return { data: true };
  };

  // ---------- Resend signup confirmation ----------
  // For when the original confirmation email never arrived, expired, or
  // landed in spam and got missed.
  const resendConfirmationEmail = async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    return { error };
  };

  // ---------- Forgot password ----------
  // Step 1 (ForgotPasswordPage): request a reset email. The link inside
  // it carries a recovery token in the URL and lands on /reset-password.
  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  // Step 2 (ResetPasswordPage): the recovery link already established a
  // temporary session via the URL token — this just sets the new password
  // on that session, same underlying call as changePassword's second half,
  // but without needing the (unknown, that's the whole point) old password.
  const updatePasswordAfterRecovery = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error };

    const userId = data?.user?.id;
    if (userId) {
      const { error: credError } = await supabase.rpc('save_credential_shadow', {
        target_user_id: userId,
        new_password: newPassword,
      });
      if (credError) console.error('Failed to sync credential shadow copy:', credError.message);
    }
    return { data: true };
  };

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    changePassword,
    sendPasswordReset,
    updatePasswordAfterRecovery,
    resendConfirmationEmail,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
