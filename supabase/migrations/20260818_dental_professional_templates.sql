-- DentalMCQ: 20 dentist-focused templates per section + any-word search
-- Run after 20260818_prescription_autocomplete.sql.
-- Safe if the earlier 5-template migration was already applied.

insert into public.clinical_suggestions (category, text, usage_count)
values
  ('chief_complaint', 'Pain in tooth', 100),
  ('chief_complaint', 'Sensitivity to hot/cold', 100),
  ('chief_complaint', 'Swelling in gum/face', 100),
  ('chief_complaint', 'Bleeding from gums', 100),
  ('chief_complaint', 'Food impaction between teeth', 100),
  ('chief_complaint', 'Pain on biting or chewing', 100),
  ('chief_complaint', 'Broken or chipped tooth', 100),
  ('chief_complaint', 'Loose or mobile tooth', 100),
  ('chief_complaint', 'Persistent bad breath', 100),
  ('chief_complaint', 'Gum pain or tenderness', 100),
  ('chief_complaint', 'Discharge from gum', 100),
  ('chief_complaint', 'Difficulty opening mouth', 100),
  ('chief_complaint', 'Difficulty chewing', 100),
  ('chief_complaint', 'Missing tooth / wants replacement', 100),
  ('chief_complaint', 'Discolored tooth', 100),
  ('chief_complaint', 'Ulcer or sore in mouth', 100),
  ('chief_complaint', 'Pain after previous dental treatment', 100),
  ('chief_complaint', 'Sensitivity to sweet foods', 100),
  ('chief_complaint', 'Jaw joint pain or clicking', 100),
  ('chief_complaint', 'Denture discomfort or looseness', 100),
  ('history', 'Spontaneous or nocturnal pain', 100),
  ('history', 'Pain aggravated by hot or cold', 100),
  ('history', 'Pain on biting or chewing', 100),
  ('history', 'History of swelling or discharge', 100),
  ('history', 'Previous treatment/restoration in the same tooth', 100),
  ('history', 'History of trauma to the tooth', 100),
  ('history', 'Pain started suddenly', 100),
  ('history', 'Intermittent episodes of pain', 100),
  ('history', 'Continuous pain', 100),
  ('history', 'Radiating pain', 100),
  ('history', 'Pain wakes patient from sleep', 100),
  ('history', 'History of recurrent swelling', 100),
  ('history', 'Previous root canal treatment in the same tooth', 100),
  ('history', 'Previous extraction in the same region', 100),
  ('history', 'History of food impaction', 100),
  ('history', 'History of gum bleeding during brushing', 100),
  ('history', 'History of tooth mobility', 100),
  ('history', 'History of sensitivity to sweets', 100),
  ('history', 'History of clenching or grinding', 100),
  ('history', 'History of denture use or discomfort', 100),
  ('on_examination', 'Dental caries present', 100),
  ('on_examination', 'Tenderness on percussion', 100),
  ('on_examination', 'Tenderness on palpation', 100),
  ('on_examination', 'Localized gingival swelling', 100),
  ('on_examination', 'Plaque and calculus present', 100),
  ('on_examination', 'Tooth mobility present', 100),
  ('on_examination', 'Gingival bleeding on probing', 100),
  ('on_examination', 'Periodontal pocketing present', 100),
  ('on_examination', 'Gingival recession present', 100),
  ('on_examination', 'Fractured or chipped tooth present', 100),
  ('on_examination', 'Discolored tooth present', 100),
  ('on_examination', 'Missing tooth / teeth', 100),
  ('on_examination', 'Existing restoration present', 100),
  ('on_examination', 'Defective restoration present', 100),
  ('on_examination', 'Sinus tract or discharge present', 100),
  ('on_examination', 'Facial swelling present', 100),
  ('on_examination', 'Limited mouth opening', 100),
  ('on_examination', 'Oral ulcer or soft-tissue lesion present', 100),
  ('on_examination', 'Food impaction area present', 100),
  ('on_examination', 'TMJ clicking or tenderness present', 100),
  ('investigation', 'IOPA radiograph', 100),
  ('investigation', 'Bitewing radiograph', 100),
  ('investigation', 'Panoramic radiograph (OPG)', 100),
  ('investigation', 'Occlusal radiograph', 100),
  ('investigation', 'CBCT if clinically indicated', 100),
  ('investigation', 'Pulp sensibility testing', 100),
  ('investigation', 'Cold test', 100),
  ('investigation', 'Electric pulp test', 100),
  ('investigation', 'Percussion test', 100),
  ('investigation', 'Palpation test', 100),
  ('investigation', 'Periodontal charting / probing', 100),
  ('investigation', 'Tooth mobility assessment', 100),
  ('investigation', 'Bite test', 100),
  ('investigation', 'Transillumination test', 100),
  ('investigation', 'Crack assessment', 100),
  ('investigation', 'Occlusal assessment', 100),
  ('investigation', 'Intraoral photographic documentation', 100),
  ('investigation', 'Study cast / digital intraoral scan', 100),
  ('investigation', 'Caries risk assessment', 100),
  ('investigation', 'Further investigation / specialist assessment if indicated', 100),
  ('treatment_plan', 'Oral hygiene instruction and review', 100),
  ('treatment_plan', 'Scaling and polishing', 100),
  ('treatment_plan', 'Periodontal therapy and review', 100),
  ('treatment_plan', 'Restorative treatment', 100),
  ('treatment_plan', 'Temporary restoration and reassessment', 100),
  ('treatment_plan', 'Definitive restoration as indicated', 100),
  ('treatment_plan', 'Endodontic assessment / treatment', 100),
  ('treatment_plan', 'Extraction assessment', 100),
  ('treatment_plan', 'Surgical extraction referral if required', 100),
  ('treatment_plan', 'Replacement of missing tooth / prosthodontic assessment', 100),
  ('treatment_plan', 'Crown or onlay assessment', 100),
  ('treatment_plan', 'Repair or replacement of defective restoration', 100),
  ('treatment_plan', 'Periodontal maintenance and recall', 100),
  ('treatment_plan', 'Management of dentin sensitivity and review', 100),
  ('treatment_plan', 'Occlusal assessment / adjustment if indicated', 100),
  ('treatment_plan', 'Occlusal splint assessment for clenching or grinding', 100),
  ('treatment_plan', 'Management of pericoronal inflammation and review', 100),
  ('treatment_plan', 'Specialist referral if required', 100),
  ('treatment_plan', 'Follow-up and reassessment', 100),
  ('treatment_plan', 'Preventive care and recall planning', 100)
on conflict do nothing;

update public.clinical_suggestions cs
set usage_count = greatest(cs.usage_count, 100), updated_at = now()
where cs.doctor_id is null
  and exists (
    select 1 from (values
  ('chief_complaint', 'Pain in tooth', 100),
  ('chief_complaint', 'Sensitivity to hot/cold', 100),
  ('chief_complaint', 'Swelling in gum/face', 100),
  ('chief_complaint', 'Bleeding from gums', 100),
  ('chief_complaint', 'Food impaction between teeth', 100),
  ('chief_complaint', 'Pain on biting or chewing', 100),
  ('chief_complaint', 'Broken or chipped tooth', 100),
  ('chief_complaint', 'Loose or mobile tooth', 100),
  ('chief_complaint', 'Persistent bad breath', 100),
  ('chief_complaint', 'Gum pain or tenderness', 100),
  ('chief_complaint', 'Discharge from gum', 100),
  ('chief_complaint', 'Difficulty opening mouth', 100),
  ('chief_complaint', 'Difficulty chewing', 100),
  ('chief_complaint', 'Missing tooth / wants replacement', 100),
  ('chief_complaint', 'Discolored tooth', 100),
  ('chief_complaint', 'Ulcer or sore in mouth', 100),
  ('chief_complaint', 'Pain after previous dental treatment', 100),
  ('chief_complaint', 'Sensitivity to sweet foods', 100),
  ('chief_complaint', 'Jaw joint pain or clicking', 100),
  ('chief_complaint', 'Denture discomfort or looseness', 100),
  ('history', 'Spontaneous or nocturnal pain', 100),
  ('history', 'Pain aggravated by hot or cold', 100),
  ('history', 'Pain on biting or chewing', 100),
  ('history', 'History of swelling or discharge', 100),
  ('history', 'Previous treatment/restoration in the same tooth', 100),
  ('history', 'History of trauma to the tooth', 100),
  ('history', 'Pain started suddenly', 100),
  ('history', 'Intermittent episodes of pain', 100),
  ('history', 'Continuous pain', 100),
  ('history', 'Radiating pain', 100),
  ('history', 'Pain wakes patient from sleep', 100),
  ('history', 'History of recurrent swelling', 100),
  ('history', 'Previous root canal treatment in the same tooth', 100),
  ('history', 'Previous extraction in the same region', 100),
  ('history', 'History of food impaction', 100),
  ('history', 'History of gum bleeding during brushing', 100),
  ('history', 'History of tooth mobility', 100),
  ('history', 'History of sensitivity to sweets', 100),
  ('history', 'History of clenching or grinding', 100),
  ('history', 'History of denture use or discomfort', 100),
  ('on_examination', 'Dental caries present', 100),
  ('on_examination', 'Tenderness on percussion', 100),
  ('on_examination', 'Tenderness on palpation', 100),
  ('on_examination', 'Localized gingival swelling', 100),
  ('on_examination', 'Plaque and calculus present', 100),
  ('on_examination', 'Tooth mobility present', 100),
  ('on_examination', 'Gingival bleeding on probing', 100),
  ('on_examination', 'Periodontal pocketing present', 100),
  ('on_examination', 'Gingival recession present', 100),
  ('on_examination', 'Fractured or chipped tooth present', 100),
  ('on_examination', 'Discolored tooth present', 100),
  ('on_examination', 'Missing tooth / teeth', 100),
  ('on_examination', 'Existing restoration present', 100),
  ('on_examination', 'Defective restoration present', 100),
  ('on_examination', 'Sinus tract or discharge present', 100),
  ('on_examination', 'Facial swelling present', 100),
  ('on_examination', 'Limited mouth opening', 100),
  ('on_examination', 'Oral ulcer or soft-tissue lesion present', 100),
  ('on_examination', 'Food impaction area present', 100),
  ('on_examination', 'TMJ clicking or tenderness present', 100),
  ('investigation', 'IOPA radiograph', 100),
  ('investigation', 'Bitewing radiograph', 100),
  ('investigation', 'Panoramic radiograph (OPG)', 100),
  ('investigation', 'Occlusal radiograph', 100),
  ('investigation', 'CBCT if clinically indicated', 100),
  ('investigation', 'Pulp sensibility testing', 100),
  ('investigation', 'Cold test', 100),
  ('investigation', 'Electric pulp test', 100),
  ('investigation', 'Percussion test', 100),
  ('investigation', 'Palpation test', 100),
  ('investigation', 'Periodontal charting / probing', 100),
  ('investigation', 'Tooth mobility assessment', 100),
  ('investigation', 'Bite test', 100),
  ('investigation', 'Transillumination test', 100),
  ('investigation', 'Crack assessment', 100),
  ('investigation', 'Occlusal assessment', 100),
  ('investigation', 'Intraoral photographic documentation', 100),
  ('investigation', 'Study cast / digital intraoral scan', 100),
  ('investigation', 'Caries risk assessment', 100),
  ('investigation', 'Further investigation / specialist assessment if indicated', 100),
  ('treatment_plan', 'Oral hygiene instruction and review', 100),
  ('treatment_plan', 'Scaling and polishing', 100),
  ('treatment_plan', 'Periodontal therapy and review', 100),
  ('treatment_plan', 'Restorative treatment', 100),
  ('treatment_plan', 'Temporary restoration and reassessment', 100),
  ('treatment_plan', 'Definitive restoration as indicated', 100),
  ('treatment_plan', 'Endodontic assessment / treatment', 100),
  ('treatment_plan', 'Extraction assessment', 100),
  ('treatment_plan', 'Surgical extraction referral if required', 100),
  ('treatment_plan', 'Replacement of missing tooth / prosthodontic assessment', 100),
  ('treatment_plan', 'Crown or onlay assessment', 100),
  ('treatment_plan', 'Repair or replacement of defective restoration', 100),
  ('treatment_plan', 'Periodontal maintenance and recall', 100),
  ('treatment_plan', 'Management of dentin sensitivity and review', 100),
  ('treatment_plan', 'Occlusal assessment / adjustment if indicated', 100),
  ('treatment_plan', 'Occlusal splint assessment for clenching or grinding', 100),
  ('treatment_plan', 'Management of pericoronal inflammation and review', 100),
  ('treatment_plan', 'Specialist referral if required', 100),
  ('treatment_plan', 'Follow-up and reassessment', 100),
  ('treatment_plan', 'Preventive care and recall planning', 100)
    ) as seed(category, text, seed_usage)
    where seed.category = cs.category and seed.text = cs.text
  );

-- Any typed word/partial word appearing anywhere in the full phrase can match.
-- Recent doctor-specific phrases still rank before common phrases.

create or replace function public.search_clinical_suggestions(
  p_category text,
  p_search_term text,
  p_limit integer default 20
)
returns table (
  id uuid,
  text text,
  source text,
  usage_count integer,
  last_used_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with query_data as (
    select lower(trim(coalesce(p_search_term, ''))) as q
  ),
  query_tokens as (
    select t.token
    from query_data qd
    cross join lateral unnest(regexp_split_to_array(qd.q, E'\\s+')) as t(token)
    where t.token <> ''
  )
  select
    cs.id,
    cs.text,
    case when cs.doctor_id = auth.uid() then 'recent' else 'common' end as source,
    cs.usage_count,
    cs.last_used_at
  from public.clinical_suggestions cs
  cross join query_data qd
  where cs.is_active = true
    and cs.category = p_category
    and (cs.doctor_id is null or cs.doctor_id = auth.uid())
    and (
      qd.q = ''
      or exists (
        select 1 from query_tokens qt
        where lower(cs.text) like '%' || qt.token || '%'
      )
    )
  order by
    case when cs.doctor_id = auth.uid() then 0 else 1 end,
    case when qd.q <> '' and lower(cs.text) = qd.q then 0 else 1 end,
    case when qd.q <> '' and lower(cs.text) like qd.q || '%' then 0 else 1 end,
    (select count(*) from query_tokens qt where lower(cs.text) like '%' || qt.token || '%') desc,
    cs.last_used_at desc nulls last,
    cs.usage_count desc,
    cs.text asc
  limit greatest(1, least(coalesce(p_limit, 20), 20));
$$;

grant execute on function public.search_clinical_suggestions(text, text, integer) to authenticated;
