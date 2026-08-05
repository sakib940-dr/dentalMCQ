// src/lib/usePushNotifications.js
// Usage: call usePushNotifications() inside any component that is mounted
// after the user is logged in (e.g. DashboardLayout). It is safe to call
// from multiple places — it short-circuits if permission is already granted
// and the subscription is already saved.

import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// The VAPID public key (Base64URL). This must match the private key stored
// in Supabase Edge Function secrets as VAPID_PRIVATE_KEY.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return; // VITE_VAPID_PUBLIC_KEY not set — silently skip

    (async () => {
      try {
        // 1. Register the service worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // 2. Check existing permission
        if (Notification.permission === 'denied') return;

        // 3. Get or create push subscription
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          if (Notification.permission !== 'granted') {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // 4. Save/upsert the subscription to Supabase
        const subJson = sub.toJSON();
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,endpoint' });

        subscribedRef.current = true;

        // 5. Listen for navigation messages from the SW (when user taps a push notif)
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data?.type === 'NAVIGATE' && e.data.link) {
            window.location.href = e.data.link;
          }
        });
      } catch (err) {
        // Push setup failures should never crash the app
        console.warn('[push] setup failed:', err?.message);
      }
    })();
  }, [user]);
}
