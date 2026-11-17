/**
 * Database checks for the localization migrations.
 * Run: npx tsx scripts/test-frame-structure-db.ts
 *
 * Uses an in-process Postgres. It does not connect to production.
 * Two overlapping sessions are not available here; the stale result is the
 * second call after the first commit, which is what the loser must observe.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

import { PGlite } from "@electric-sql/pglite"

const root = process.cwd()
const translationsSql = readFileSync(
  path.join(root, "supabase/migrations/20261114120000_content_translations.sql"),
  "utf8"
)
const framesSql = readFileSync(
  path.join(root, "supabase/migrations/20261114120100_frame_source_ids.sql"),
  "utf8"
)

const WORK = "11111111-1111-4111-8111-111111111111"
const OTHER_WORK = "22222222-2222-4222-8222-222222222222"

function provenance(id: string, frameIndex = 0) {
  return JSON.stringify([{ sourceReviewId: id, frameIndex }])
}

async function expectFailure(run: () => Promise<unknown>) {
  let failed = false
  try {
    await run()
  } catch {
    failed = true
  }
  assert.equal(failed, true)
}

async function baseSchema(db: PGlite) {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.works (
      id uuid primary key default gen_random_uuid(),
      tsid text not null,
      title text
    );
    create table public.characters (tsid text primary key, name text, house text, description text);
    create table public.locations (tsid text primary key, name text, description text);
    create table public.scenes (
      id uuid primary key default gen_random_uuid(),
      work_id uuid,
      tsid text,
      title text,
      order_index integer,
      story_images_v2 jsonb,
      scene_contexts_v1 jsonb,
      frame_provenance_v1 jsonb not null default '[]'::jsonb
    );
    grant select, insert, update, delete on public.works, public.scenes, public.characters, public.locations
      to anon, authenticated, service_role;
  `)
}

async function testTranslations() {
  const db = new PGlite()
  await baseSchema(db)
  await db.exec(translationsSql)
  await db.exec(`
    insert into public.works (id, tsid, title) values ('${WORK}', 'work_1', 'Winterfell');
    insert into public.content_translations (
      entity_kind, entity_key, field_key, locale, text, source_hash, model, prompt_version
    ) values (
      'work', 'work_1', 'title', 'zh-CN', '临冬城', repeat('ab', 32), 'gemini-3.5-flash-lite', 'p0-zh-cn-v1'
    );
  `)

  await db.exec("set role anon")
  const visible = await db.query<{ text: string }>("select text from public.content_translations")
  assert.equal(visible.rows[0]?.text, "临冬城")
  await expectFailure(() => db.exec("insert into public.content_translations (entity_kind, entity_key, field_key, locale, text, source_hash, model, prompt_version) values ('work', 'work_1', 'description', 'zh-CN', 'x', repeat('ab', 32), 'm', 'p')"))
  await db.exec("reset role")

  await db.exec("set role authenticated")
  const authVisible = await db.query<{ n: number }>("select count(*)::int as n from public.content_translations")
  assert.equal(Number(authVisible.rows[0]?.n), 1)
  await expectFailure(() => db.exec("delete from public.content_translations"))
  await db.exec("reset role")

  await db.exec("set role service_role")
  await db.exec(`
    insert into public.content_translations (
      entity_kind, entity_key, field_key, locale, text, source_hash, model, prompt_version
    ) values (
      'work', 'work_1', 'description', 'zh-CN', '城堡', repeat('cd', 32), 'gemini-3.5-flash-lite', 'p0-zh-cn-v1'
    );
  `)
  await db.exec("reset role")
  const count = await db.query<{ n: number }>("select count(*)::int as n from public.content_translations")
  assert.equal(Number(count.rows[0]?.n), 2)
  await db.close()
}

async function testFrames() {
  const db = new PGlite()
  await baseSchema(db)
  await db.exec(translationsSql)
  await db.exec(framesSql)

  const guard = await db.query<{ prosecdef: boolean; def: string }>(`
    select prosecdef, pg_get_functiondef('public.enforce_scene_frame_identity()'::regprocedure) as def
    from pg_proc
    where proname = 'enforce_scene_frame_identity'
  `)
  assert.equal(guard.rows[0]?.prosecdef, true)
  assert.equal(guard.rows[0]?.def.includes("content_translations"), false)
  const writer = await db.query<{ prosecdef: boolean }>(`
    select prosecdef from pg_proc where proname = 'apply_scene_frame_structure'
  `)
  assert.equal(writer.rows[0]?.prosecdef, false)

  const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  await db.exec(`
    insert into public.scenes (work_id, tsid, title, order_index, story_images_v2, scene_contexts_v1, frame_provenance_v1)
    values (
      '${WORK}', 'scene_a', 'Gate', 0,
      '[{"url":"https://cdn.example/a.png","caption":"Gate"}]'::jsonb,
      '[]'::jsonb,
      '${provenance(idA)}'::jsonb
    );
  `)
  const registered = await db.query<{ source_review_id: string; scene_tsid: string }>(
    "select source_review_id, scene_tsid from public.frame_source_ids"
  )
  assert.deepEqual(registered.rows, [{ source_review_id: idA, scene_tsid: "scene_a" }])

  await db.exec("update public.scenes set title = 'Gate renamed', order_index = 3 where tsid = 'scene_a'")
  const afterTitle = await db.query<{ source_review_id: string }>("select source_review_id from public.frame_source_ids")
  assert.equal(afterTitle.rows[0]?.source_review_id, idA)
  const title = await db.query<{ title: string }>("select title from public.scenes where tsid = 'scene_a'")
  assert.equal(title.rows[0]?.title, "Gate renamed")

  await expectFailure(() =>
    db.exec(`update public.scenes set work_id = '${OTHER_WORK}' where tsid = 'scene_a'`)
  )
  const still = await db.query<{ work_id: string }>("select work_id from public.scenes where tsid = 'scene_a'")
  assert.equal(still.rows[0]?.work_id, WORK)

  await expectFailure(() =>
    db.exec(`update public.scenes set story_images_v2 = '[{"url":"https://cdn.example/b.png","caption":"Gate"}]'::jsonb where tsid = 'scene_a'`)
  )
  const url = await db.query<{ url: string }>(
    "select story_images_v2->0->>'url' as url from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(url.rows[0]?.url, "https://cdn.example/a.png")

  const expected = provenance(idA)
  const moved = JSON.stringify([
    { sourceReviewId: idB, frameIndex: 0 },
    { sourceReviewId: idA, frameIndex: 1 },
  ])
  const images = JSON.stringify([
    { url: "https://cdn.example/b.png", caption: "Yard" },
    { url: "https://cdn.example/a.png", caption: "Gate" },
  ])
  const ok = await db.query<{ status: string }>(`
    select public.apply_scene_frame_structure(
      '${WORK}'::uuid,
      'scene_a',
      '${expected}'::jsonb,
      '${images}'::jsonb,
      '[]'::jsonb,
      '${moved}'::jsonb
    )->>'status' as status
  `)
  assert.equal(ok.rows[0]?.status, "ok")
  const ids = await db.query<{ source_review_id: string }>(
    "select source_review_id from public.frame_source_ids order by source_review_id"
  )
  assert.deepEqual(ids.rows.map((row) => row.source_review_id), [idA, idB].sort())

  const stale = await db.query<{ status: string; body: string }>(`
    select
      result->>'status' as status,
      result::text as body
    from (
      select public.apply_scene_frame_structure(
        '${WORK}'::uuid,
        'scene_a',
        '${expected}'::jsonb,
        '${images}'::jsonb,
        '[]'::jsonb,
        '${moved}'::jsonb
      ) as result
    ) as call
  `)
  assert.equal(stale.rows[0]?.status, "stale_frame_structure")
  assert.equal(stale.rows[0]?.body.includes("Gate"), false)
  const afterStale = await db.query<{ caption: string }>(
    "select story_images_v2->0->>'caption' as caption from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(afterStale.rows[0]?.caption, "Yard")

  await expectFailure(() =>
    db.exec(`
      insert into public.scenes (work_id, tsid, title, story_images_v2, frame_provenance_v1)
      values (
        '${OTHER_WORK}', 'scene_b', 'Other',
        '[{"url":"u","caption":"c"}]'::jsonb,
        '${provenance(idA)}'::jsonb
      );
    `)
  )
  const sceneCount = await db.query<{ n: number }>("select count(*)::int as n from public.scenes")
  assert.equal(Number(sceneCount.rows[0]?.n), 1)

  const current = await db.query<{ frame_provenance_v1: unknown }>(
    "select frame_provenance_v1 from public.scenes where tsid = 'scene_a'"
  )
  const currentJson = JSON.stringify(current.rows[0]?.frame_provenance_v1)
  const badContext = await db.query<{ status: string }>(`
    select public.apply_scene_frame_structure(
      '${WORK}'::uuid,
      'scene_a',
      '${currentJson.replaceAll("'", "''")}'::jsonb,
      '${images}'::jsonb,
      '[{"projectsToFrameIndex":9}]'::jsonb,
      '${currentJson.replaceAll("'", "''")}'::jsonb
    )->>'status' as status
  `)
  assert.equal(badContext.rows[0]?.status, "frame_structure_invariant")
  const contextAfter = await db.query<{ scene_contexts_v1: unknown }>(
    "select scene_contexts_v1 from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(JSON.stringify(contextAfter.rows[0]?.scene_contexts_v1), "[]")

  const missing = await db.query<{ status: string; body: string }>(`
    select result->>'status' as status, result::text as body
    from (
      select public.apply_scene_frame_structure(
        '${WORK}'::uuid,
        'missing',
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb
      ) as result
    ) as call
  `)
  assert.equal(missing.rows[0]?.status, "frame_write_rejected")
  assert.equal(missing.rows[0]?.body.includes("Gate"), false)

  await db.exec("set role anon")
  await expectFailure(() =>
    db.exec(`
      select public.apply_scene_frame_structure(
        '${WORK}'::uuid, 'scene_a', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
      )
    `)
  )
  await expectFailure(() =>
    db.exec(`insert into public.frame_source_ids (source_review_id, work_id, scene_tsid) values ('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz', '${WORK}', 'scene_a')`)
  )
  await db.exec("reset role")

  await db.exec("delete from public.scenes where tsid = 'scene_a'")
  const afterDelete = await db.query<{ n: number }>("select count(*)::int as n from public.frame_source_ids")
  assert.equal(Number(afterDelete.rows[0]?.n), 0)

  await db.exec(`
    insert into public.scenes (work_id, tsid, title, story_images_v2, frame_provenance_v1)
    values ('${WORK}', 'scene_new', 'New', '[]'::jsonb, '[]'::jsonb);
  `)
  const minted = await db.query<{ status: string; id: string }>(`
    select
      result->>'status' as status,
      result->'frame_provenance_v1'->0->>'sourceReviewId' as id
    from (
      select public.apply_scene_frame_structure(
        '${WORK}'::uuid,
        'scene_new',
        '[]'::jsonb,
        '[{"url":"","caption":"Added"}]'::jsonb,
        '[]'::jsonb,
        '[{"sourceReviewId":null,"frameIndex":0}]'::jsonb
      ) as result
    ) as call
  `)
  assert.equal(minted.rows[0]?.status, "ok")
  assert.match(minted.rows[0]?.id ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.equal((minted.rows[0]?.id ?? "").startsWith("rev_"), false)
  assert.equal((minted.rows[0]?.id ?? "").startsWith("manual_"), false)

  await db.close()
}

async function testAuthenticatedNarrativeUpdate() {
  const db = new PGlite()
  await baseSchema(db)
  await db.exec(framesSql)
  const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  await db.exec(`
    insert into public.scenes (work_id, tsid, title, order_index, story_images_v2, scene_contexts_v1, frame_provenance_v1)
    values (
      '${WORK}', 'scene_a', 'Gate', 0,
      '[{"url":"https://cdn.example/a.png","caption":"Gate"}]'::jsonb,
      '[]'::jsonb,
      '${provenance(idA)}'::jsonb
    );
  `)

  await db.exec("set role authenticated")
  await db.exec("update public.scenes set title = 'Gate by reader', order_index = 4 where tsid = 'scene_a'")
  const moved = await db.query<{ status: string }>(`
    select public.apply_scene_frame_structure(
      '${WORK}'::uuid,
      'scene_a',
      '${provenance(idA)}'::jsonb,
      '[{"url":"https://cdn.example/b.png","caption":"Gate"}]'::jsonb,
      '[]'::jsonb,
      '${provenance(idA)}'::jsonb
    )->>'status' as status
  `)
  assert.equal(moved.rows[0]?.status, "ok")
  await expectFailure(() =>
    db.exec(`update public.scenes set story_images_v2 = '[{"url":"https://cdn.example/c.png","caption":"Gate"}]'::jsonb where tsid = 'scene_a'`)
  )
  await db.exec("reset role")

  const title = await db.query<{ title: string; url: string }>(
    "select title, story_images_v2->0->>'url' as url from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(title.rows[0]?.title, "Gate by reader")
  assert.equal(title.rows[0]?.url, "https://cdn.example/b.png")
  const ids = await db.query<{ source_review_id: string }>("select source_review_id from public.frame_source_ids")
  assert.deepEqual(ids.rows.map((row) => row.source_review_id), [idA])

  await expectFailure(() =>
    db.exec(`
      do $guc$
      begin
        perform set_config('app.expected_frame_provenance', 'not-json', true);
        update public.scenes
        set story_images_v2 = '[{"url":"https://cdn.example/d.png","caption":"Gate"}]'::jsonb
        where tsid = 'scene_a';
      end
      $guc$;
    `)
  )
  await expectFailure(() =>
    db.exec(`
      do $guc$
      begin
        perform set_config(
          'app.expected_frame_provenance',
          '[{"sourceReviewId":"other","frameIndex":0}]',
          true
        );
        update public.scenes
        set story_images_v2 = '[{"url":"https://cdn.example/e.png","caption":"Gate"}]'::jsonb
        where tsid = 'scene_a';
      end
      $guc$;
    `)
  )
  const afterGuc = await db.query<{ url: string }>(
    "select story_images_v2->0->>'url' as url from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(afterGuc.rows[0]?.url, "https://cdn.example/b.png")

  const current = await db.query<{ frame_provenance_v1: unknown }>(
    "select frame_provenance_v1 from public.scenes where tsid = 'scene_a'"
  )
  const expectedJson = JSON.stringify(current.rows[0]?.frame_provenance_v1).replaceAll("'", "''")
  const badIndex = await db.query<{ status: string }>(`
    select public.apply_scene_frame_structure(
      '${WORK}'::uuid,
      'scene_a',
      '${expectedJson}'::jsonb,
      '[{"url":"https://cdn.example/b.png","caption":"Gate"}]'::jsonb,
      '[]'::jsonb,
      '[{"sourceReviewId":"${idA}","frameIndex":1}]'::jsonb
    )->>'status' as status
  `)
  assert.equal(badIndex.rows[0]?.status, "frame_structure_invariant")
  const still = await db.query<{ url: string }>(
    "select story_images_v2->0->>'url' as url from public.scenes where tsid = 'scene_a'"
  )
  assert.equal(still.rows[0]?.url, "https://cdn.example/b.png")
  await db.close()
}

async function testBackfillRejectsDuplicate() {
  const db = new PGlite()
  await baseSchema(db)
  const badId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  await db.exec(`
    insert into public.scenes (work_id, tsid, title, story_images_v2, frame_provenance_v1)
    values
      (
        '${WORK}', 'scene_a', 'A',
        '[{"url":"u","caption":"a"}]'::jsonb,
        '${provenance(badId)}'::jsonb
      ),
      (
        '${OTHER_WORK}', 'scene_b', 'B',
        '[{"url":"u","caption":"b"}]'::jsonb,
        '${provenance(badId)}'::jsonb
      );
  `)
  await db.exec("begin")
  await expectFailure(async () => {
    await db.exec(framesSql)
  })
  await db.exec("rollback")
  const rows = await db.query<{ n: number }>("select count(*)::int as n from public.scenes")
  assert.equal(Number(rows.rows[0]?.n), 2)
  const titles = await db.query<{ title: string }>("select title from public.scenes order by title")
  assert.deepEqual(titles.rows.map((row) => row.title), ["A", "B"])
  const registry = await db.query<{ name: string | null }>(
    "select to_regclass('public.frame_source_ids') as name"
  )
  assert.equal(registry.rows[0]?.name, null)
  await db.close()
}

async function testBackfillRejectsPermutation() {
  const db = new PGlite()
  await baseSchema(db)
  await db.exec(`
    insert into public.scenes (work_id, tsid, title, story_images_v2, frame_provenance_v1)
    values (
      '${WORK}', 'scene_perm', 'Perm',
      '[{"url":"u","caption":"a"},{"url":"u","caption":"b"},{"url":"u","caption":"c"}]'::jsonb,
      '[
        {"sourceReviewId":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","frameIndex":0},
        {"sourceReviewId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","frameIndex":2},
        {"sourceReviewId":"ffffffff-ffff-4fff-8fff-ffffffffffff","frameIndex":1}
      ]'::jsonb
    );
  `)
  const before = await db.query("select frame_provenance_v1 from public.scenes")
  await db.exec("begin")
  await expectFailure(() => db.exec(framesSql))
  await db.exec("rollback")
  const after = await db.query("select frame_provenance_v1 from public.scenes")
  assert.deepEqual(after.rows, before.rows)
  await db.close()
}

async function main() {
  await testTranslations()
  await testFrames()
  await testAuthenticatedNarrativeUpdate()
  await testBackfillRejectsDuplicate()
  await testBackfillRejectsPermutation()
  console.log("frame structure database checks passed")
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
