// Read-only migration audit probe. No writes. SELECT queries only.
// Run: node --env-file=.env.local scripts/migration-audit-probe.mjs

import { PrismaClient } from '@prisma/client';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('ERR: neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });

async function tableExists(t) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS present`,
    t
  );
  return r[0].present;
}
async function columnExists(t, c) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS present`,
    t, c
  );
  return r[0].present;
}
async function enumHasValue(e, v) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_enum eu JOIN pg_type t ON t.oid = eu.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='public' AND t.typname=$1 AND eu.enumlabel=$2) AS present`,
    e, v
  );
  return r[0].present;
}
async function enumExists(e) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname=$1 AND t.typtype='e') AS present`,
    e
  );
  return r[0].present;
}

// Signature specs: one probe per migration. Each returns {present, detail}
const probes = [
  // ---------- CATEGORY A (27 folders) ----------
  { cat:'A', name:'20250101000000_remove_homeowner_enum', desc:'Role has INDIVIDUAL', run:()=>enumHasValue('Role','INDIVIDUAL') },
  { cat:'A', name:'20250119_add_display_order_to_project_images', desc:'project_images.displayOrder', run:()=>columnExists('project_images','displayOrder') },
  { cat:'A', name:'20251104143437_add_project_post', desc:'table project_posts', run:()=>tableExists('project_posts') },
  { cat:'A', name:'20260106171829_add_aesthetic_profile_fields', desc:'users.aestheticProfile', run:()=>columnExists('users','aestheticProfile') },
  { cat:'A', name:'20260108000000_add_account_approval_system', desc:'table impersonation_logs', run:()=>tableExists('impersonation_logs') },
  { cat:'A', name:'20260116000000_add_architect_builder_types', desc:'users.architectLicenseNumber', run:()=>columnExists('users','architectLicenseNumber') },
  { cat:'A', name:'20260119_designer_reasoning_profile', desc:'table designer_reasoning_profiles', run:()=>tableExists('designer_reasoning_profiles') },
  { cat:'A', name:'20260119_presale_infrastructure', desc:'table developments', run:()=>tableExists('developments') },
  { cat:'A', name:'20260119000000_add_import_session_tables', desc:'table import_sessions', run:()=>tableExists('import_sessions') },
  { cat:'A', name:'20260119000000_add_legal_consent_fields', desc:'users.tosAcceptedAt', run:()=>columnExists('users','tosAcceptedAt') },
  { cat:'A', name:'20260214000000_add_question_text_to_interview_answers', desc:'editorial_interview_answers.question_text', run:()=>columnExists('editorial_interview_answers','question_text') },
  { cat:'A', name:'20260226000000_add_supplemental_quotes_table', desc:'table supplemental_quotes', run:()=>tableExists('supplemental_quotes') },
  { cat:'A', name:'20260303000000_add_instagram_exports', desc:'table instagram_exports', run:()=>tableExists('instagram_exports') },
  { cat:'A', name:'20260305_add_room_pacing_fields', desc:'editorial_interview_answers.room_id', run:()=>columnExists('editorial_interview_answers','room_id') },
  { cat:'A', name:'20260311000000_add_designer_bio_and_profile_qa', desc:'table designer_bios', run:()=>tableExists('designer_bios') },
  { cat:'A', name:'20260312000000_add_publication_other_recognition_types', desc:'RecognitionType has PUBLICATION', run:()=>enumHasValue('RecognitionType','PUBLICATION') },
  { cat:'A', name:'20260319000000_add_user_relationship_graph', desc:'table user_relationships', run:()=>tableExists('user_relationships') },
  { cat:'A', name:'20260319000000_interview_first_profile', desc:'users.interviewProfileExtractedAt', run:()=>columnExists('users','interviewProfileExtractedAt') },
  { cat:'A', name:'20260319100000_bio_import', desc:'table interview_question_coverage', run:()=>tableExists('interview_question_coverage') },
  { cat:'A', name:'20260320000000_messaging_system', desc:'table conversations', run:()=>tableExists('conversations') },
  { cat:'A', name:'20260401000000_split_directory_sourcebook', desc:'table sourcebook_entries', run:()=>tableExists('sourcebook_entries') },
  { cat:'A', name:'20260401100000_phase2_communication_layer', desc:'table pending_actions', run:()=>tableExists('pending_actions') },
  { cat:'A', name:'20260401200000_phase3_project_actions', desc:'table project_product_pricing', run:()=>tableExists('project_product_pricing') },
  { cat:'A', name:'20260401300000_phase4_shadow_profiles', desc:'table rep_shadow_profiles', run:()=>tableExists('rep_shadow_profiles') },
  { cat:'A', name:'20260401400000_phase5_commerce_ranking', desc:'messaging_preferences.emailOnSampleRequest', run:()=>columnExists('messaging_preferences','emailOnSampleRequest') },
  { cat:'A', name:'20260401500000_email_contact_integration', desc:'table email_threads', run:()=>tableExists('email_threads') },
  { cat:'A', name:'20260409000000_add_product_scene_preset', desc:'products.scenePresetId', run:()=>columnExists('products','scenePresetId') },

  // ---------- CATEGORY B (DB rows, no folder) ----------
  { cat:'B', name:'add_ai_compiled_flag_to_project_module', desc:'project_modules.isAiCompiled', run:()=>columnExists('project_modules','isAiCompiled') },
  { cat:'B', name:'add_designer_brand_profile', desc:'table designer_brand_profiles', run:()=>tableExists('designer_brand_profiles') },
  { cat:'B', name:'add_display_order_to_project_images', desc:'project_images.displayOrder (same signature as Cat A twin)', run:()=>columnExists('project_images','displayOrder') },
  { cat:'B', name:'rep_mode_alt_b', desc:'(ambiguous) users.repMode or similar', run: async ()=>{
      // Try a few plausible columns
      const cands = [['users','repMode'],['users','repModeVariant'],['organizations','repMode'],['users','repModeAltB'],['users','rep_mode']];
      for (const [t,c] of cands) { if (await columnExists(t,c)) return {present:true, detail:`${t}.${c}`}; }
      return {present:false, detail:'no repMode-* column in users/organizations — unconfirmed'};
    } },
  { cat:'B', name:'add_product_vendor_preview_models', desc:'(ambiguous) product_vendor_previews or vendor_presentation_views', run: async ()=>{
      const cands = ['product_vendor_previews','product_previews','vendor_previews','vendor_presentation_views'];
      for (const t of cands) { if (await tableExists(t)) return {present:true, detail:`table ${t}`}; }
      return {present:false, detail:'no preview table — unconfirmed'};
    } },
  { cat:'B', name:'add_atelier_models', desc:'table atelier_fingerprints', run:()=>tableExists('atelier_fingerprints') },
  { cat:'B', name:'add_events_engine_models', desc:'table event_product_stats', run:()=>tableExists('event_product_stats') },
  { cat:'B', name:'add_conversation_editorial_models', desc:'(ambiguous) check editorial_interviews or conversations variants', run: async ()=>{
      const cands = ['editorial_conversations','conversation_editorials','editorial_interviews'];
      for (const t of cands) { if (await tableExists(t)) return {present:true, detail:`table ${t} (heuristic)`}; }
      return {present:false, detail:'no conversation_editorial table — unconfirmed'};
    } },
  { cat:'B', name:'add_cutout_image_url_to_product', desc:'products.cutoutImageUrl', run:()=>columnExists('products','cutoutImageUrl') },
  { cat:'B', name:'20250127000000_add_living_project_system', desc:'table skeleton_items (from docs/living-project-migration.sql)', run:()=>tableExists('skeleton_items') },
  { cat:'B', name:'20250130000000_add_vendor_invite_candidates', desc:'table vendor_invite_candidates', run:()=>tableExists('vendor_invite_candidates') },
  { cat:'B', name:'20250127000000_add_notes_attachments_action_items', desc:'table action_items', run:()=>tableExists('action_items') },
  { cat:'B', name:'20250127120000_add_recorded_reflection_system', desc:'table interview_sessions', run:()=>tableExists('interview_sessions') },
  { cat:'B', name:'20250120000000_add_project_archive_fields', desc:'projects.archivedAt', run:()=>columnExists('projects','archivedAt') },
  { cat:'B', name:'20260104220000_add_editorial_interview_models', desc:'table editorial_interviews', run:()=>tableExists('editorial_interviews') },

  // Special: prior-audit 17th forged row that's NOT in current drift list
  { cat:'B-special', name:'20250130000001_add_vendor_invite_contacts', desc:'table vendor_invite_contacts', run:()=>tableExists('vendor_invite_contacts') },
];

async function main() {
  const schemaResults = [];
  for (const p of probes) {
    try {
      const r = await p.run();
      const present = typeof r === 'boolean' ? r : r.present;
      const detail = typeof r === 'boolean' ? p.desc : (r.detail || p.desc);
      schemaResults.push({ name: p.name, cat: p.cat, present, detail });
    } catch (e) {
      schemaResults.push({ name: p.name, cat: p.cat, present: null, detail: `ERR ${e.message}` });
    }
  }

  // Pull ALL _prisma_migrations rows so we can handle duplicates (add_events_engine_models twice)
  const rows = await prisma.$queryRawUnsafe(
    `SELECT migration_name, started_at::text AS started_at, finished_at::text AS finished_at, rolled_back_at::text AS rolled_back_at, applied_steps_count, CASE WHEN checksum IS NULL OR checksum='' THEN 'forged' ELSE 'real' END AS auth FROM _prisma_migrations ORDER BY started_at`
  );

  console.log(JSON.stringify({ schemaResults, rows }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('FATAL', e); await prisma.$disconnect(); process.exit(1); });
