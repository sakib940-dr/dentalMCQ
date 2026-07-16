import { supabase } from './supabaseClient';

// Strip everything except digits and a leading '+' so "017 123-4567" and
// "01712345678" match as the same patient.
export function normalizePhone(raw) {
  return (raw || '').trim().replace(/[^\d+]/g, '');
}

// Finds an existing patient for this doctor by phone number, or creates
// one. Returns the patient id, or null if no phone number was given (a
// prescription can still be saved without a linked patient — phone is
// how we link, not a hard requirement to generate a prescription at all).
export async function findOrCreatePatient(ownerId, { name, phone, age, address }) {
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) return null;

  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('phone_number', phoneNorm)
    .maybeSingle();

  if (existing) {
    // Keep the patient record reasonably fresh, but never blank out a
    // previously-saved field just because this prescription left it empty.
    const updates = { updated_at: new Date().toISOString() };
    if (name?.trim()) updates.full_name = name.trim();
    if (age?.trim()) updates.age = age.trim();
    if (address?.trim()) updates.address = address.trim();
    await supabase.from('patients').update(updates).eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('patients')
    .insert({
      owner_id: ownerId,
      full_name: name?.trim() || 'Unnamed patient',
      phone_number: phoneNorm,
      age: age?.trim() || null,
      address: address?.trim() || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create patient record:', error.message);
    return null;
  }
  return created.id;
}
