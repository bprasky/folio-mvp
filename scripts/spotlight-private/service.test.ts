import assert from "node:assert/strict";
import fs from "node:fs";
import { prisma } from "../../src/lib/prisma";
import {
  runSpotlight,
  type SpotlightCommand,
} from "../../src/lib/spotlight/service";
import { stripPrivateInterviewData } from "../../src/lib/spotlight/privacy";
import { loadInterviewAnswers } from "../../src/lib/posting/loadInterviewAnswers";
import { resolveHeadlineSlots } from "../../src/lib/posting/headlineSlots";
import { gatherExtractionSources } from "../../src/lib/atelier/extractDesignerReasoning";
import { deleteProjectWithSpotlightGuard } from "../../src/lib/spotlight/deletion";
import { legacyInterviewBoundary } from "../../src/lib/spotlight/legacyBoundary";

export const actor = "00000000-0000-4000-8000-000000000001";
export const other = "00000000-0000-4000-8000-000000000002";
export const project = (n: number) =>
  `00000000-0000-4000-8000-${String(n + 100).padStart(12, "0")}`;
const tests: { name: string; result: string }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  tests.push({ name, result: "passed" });
  console.log("PASS " + name);
}
const call = (command: SpotlightCommand, p = project(0), a = actor) =>
  runSpotlight(p, a, command);
const reject = (fn: () => Promise<unknown>, code: string) =>
  assert.rejects(fn, (e: any) => e.code === code);
let state: Awaited<ReturnType<typeof runSpotlight>>;
let fixtures: {
  tags: string[];
  images: string[];
  products: string[];
  rooms: string[];
}[] = [];
const accept = (
  q: any,
  text: string,
  requestKey = crypto.randomUUID(),
): SpotlightCommand => ({
  action: "accept",
  questionId: q.id,
  questionVersion: q.questionVersion,
  currentAnswerNumber: q.currentAnswerNumber,
  text,
  requestKey,
  stateVersion: q.stateVersion,
  selectionVersion: q.selectionVersion,
  inputModality: "TEXT",
});

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  assert.equal(u.hostname, "localhost");
  assert.match(
    u.searchParams.get("host")!,
    /^\/tmp\/folio-private-[^/]+\/socket$/,
  );
  const [binding] = await prisma.$queryRaw<
    any[]
  >`SELECT current_database() AS db, current_setting('folio.test_nonce') AS nonce, (SELECT system_identifier::text FROM pg_control_system()) AS system, inet_server_addr() AS address`;
  assert.equal(binding.db, process.env.FOLIO_TEST_DATABASE);
  assert.equal(binding.nonce, process.env.FOLIO_TEST_NONCE);
  assert.equal(binding.system, process.env.FOLIO_TEST_SYSTEM_ID);
  assert.equal(binding.address, null);
  await test("Physical disposable target verified before synthetic writes", async () => {});
  for (const id of [actor, other])
    await prisma.user.create({
      data: {
        id,
        name: "Synthetic designer",
        email: `${id}@example.invalid`,
        passwordHash: "synthetic-not-a-login",
        specialties: [],
        desiredRooms: [],
        onboardingCompletedAt: new Date(),
      },
    });
  for (let p = 0; p < 8; p++) {
    await prisma.project.create({
      data: {
        id: project(p),
        ownerId: actor,
        designerId: actor,
        title: "Synthetic private project",
      },
    });
    const rooms = await Promise.all(
      ["Living room", "Kitchen"].map((name) =>
        prisma.room.create({ data: { projectId: project(p), name } }),
      ),
    );
    const f = {
      tags: [] as string[],
      images: [] as string[],
      products: [] as string[],
      rooms: rooms.map((r) => r.id),
    };
    for (let i = 0; i < (p === 1 ? 14 : 10); i++) {
      const product = await prisma.product.create({
        data: { name: `Synthetic piece ${i}` },
      });
      const image = await prisma.projectImage.create({
        data: {
          projectId: project(p),
          url: "http://127.0.0.1:9/synthetic.jpg",
          roomId: rooms[0].id,
        },
      });
      const tag = await prisma.productTag.create({
        data: { productId: product.id, imageId: image.id, x: 0.5, y: 0.5 },
      });
      f.tags.push(tag.id);
      f.images.push(image.id);
      f.products.push(product.id);
    }
    fixtures.push(f);
  }
  await test("Ten tags, zero implicit selections and no required product questions", async () => {
    state = await call({ action: "schedule" });
    assert.equal(state.questions.length, 0);
    assert.equal(state.ordinary.length, 3);
  });
  await test("Ten tags, exactly two explicitly selected base questions independent of vendor subscription", async () => {
    for (const tagId of fixtures[0].tags.slice(0, 2))
      await call({ action: "select", tagId, selected: true });
    state = await call({ action: "schedule" });
    assert.equal(
      state.questions.filter((q) => q.kind === "BASE" && q.eligible).length,
      2,
    );
    assert.ok(
      state.questions.every(
        (q) =>
          q.wording.includes("Synthetic piece 0") ||
          q.wording.includes("Synthetic piece 1"),
      ),
    );
  });
  const originalIds = state.questions.map((q) => q.id);
  await test("Required selected coverage exceeds optional budgets", async () => {
    for (const tagId of fixtures[1].tags)
      await call({ action: "select", tagId, selected: true }, project(1));
    const s = await call({ action: "schedule" }, project(1));
    assert.equal(
      s.questions.filter((q) => q.eligible && q.kind === "BASE").length,
      14,
    );
  });
  await test("Confirmed duplicate photos share selection and question identity", async () => {
    const tag = await prisma.productTag.create({
      data: {
        productId: fixtures[0].products[0],
        imageId: fixtures[0].images[2],
        x: 0.5,
        y: 0.5,
      },
    });
    await call({ action: "resume" });
    state = await call({ action: "schedule" });
    assert.deepEqual(
      state.questions.map((q) => q.id),
      originalIds,
    );
    assert.equal(
      state.spotlights.find((s) => s.id === state.questions[0].spotlightId)!
        .sourceCount,
      2,
    );
    await prisma.productTag.delete({ where: { id: tag.id } });
    state = await call({ action: "resume" });
    assert.equal(state.questions[0].eligible, true);
  });
  await test("Distinct rooms separate scope; unresolved room waits for explicit reconciliation", async () => {
    await prisma.projectImage.update({
      where: { id: fixtures[2].images[0] },
      data: { roomId: null },
    });
    await call(
      { action: "select", tagId: fixtures[2].tags[0], selected: true },
      project(2),
    );
    assert.equal(
      (await call({ action: "schedule" }, project(2))).questions.length,
      0,
    );
    await prisma.projectImage.update({
      where: { id: fixtures[2].images[0] },
      data: { roomId: fixtures[2].rooms[1] },
    });
    await call(
      { action: "select", tagId: fixtures[2].tags[0], selected: true },
      project(2),
    );
    assert.equal(
      (await call({ action: "schedule" }, project(2))).questions.length,
      1,
    );
    const tag = await prisma.productTag.create({
      data: {
        productId: fixtures[2].products[0],
        imageId: fixtures[2].images[1],
        x: 0.5,
        y: 0.5,
      },
    });
    await call({ action: "select", tagId: tag.id, selected: true }, project(2));
    assert.equal(
      (await call({ action: "schedule" }, project(2))).questions.length,
      2,
    );
  });
  const exact = "  Exact private answer 🪑\nsecond line.  ";
  await test("First private mutation preserves projection-only ordinary text and follow-up edges", async () => {
    const interview = await prisma.editorialInterview.findUniqueOrThrow({
      where: { projectId: project(0) },
    });
    const parent = await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId: "legacy-parent",
        answerText: "  Existing ordinary text  ",
        inferredPriorities: [],
        softConstraints: [],
      },
    });
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId: "legacy-child",
        answerText: "Existing ordinary follow-up",
        isFollowUp: true,
        parentAnswerId: parent.id,
        inferredPriorities: [],
        softConstraints: [],
      },
    });
    state = await call({ action: "rebuild" });
    const rows = await prisma.editorialInterviewAnswer.findMany({
      where: { interviewId: interview.id },
    });
    const kept = rows.find((a) => a.questionId === "legacy-parent")!;
    assert.equal(kept.answerText, "  Existing ordinary text  ");
    assert.equal(
      rows.find((a) => a.questionId === "legacy-child")!.parentAnswerId,
      kept.id,
    );
    assert.equal(
      state.ordinaryHistory.find((a) => a.questionId === "legacy-parent")!
        .answer,
      "  Existing ordinary text  ",
    );
  });
  let command = accept(state.questions[0], exact);
  await test("Exact text acceptance and identical retry receipt; conflicting payload rejected", async () => {
    const first = await call(command);
    const retry = await call(command);
    assert.deepEqual(retry.receipt, first.receipt);
    await reject(
      () => call({ ...command, text: "changed" } as SpotlightCommand),
      "RETRY_CONFLICT",
    );
    state = retry;
    assert.equal(state.questions[0].currentAnswer!.acceptedText, exact);
  });
  await test("Concurrent stale saves have one winner and append exactly once", async () => {
    const q = state.questions[0];
    const results = await Promise.allSettled([
      call(accept(q, "revision A")),
      call(accept(q, "revision B")),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    state = await call({ action: "resume" });
    assert.equal(state.questions[0].answers.length, 2);
    assert.equal(state.questions[0].answers[0].acceptedText, exact);
  });
  await test("Unconfirmed reuse rejected; explicit same-publisher reuse preserves exact source", async () => {
    const q = state.questions[1],
      source = state.questions[0].answers[0];
    const cmd = {
      ...accept(q, source.acceptedText),
      reuseRevisionId: source.id,
    } as Extract<SpotlightCommand, { action: "accept" }>;
    await reject(() => call(cmd), "CONFIRM_REUSE");
    state = await call({ ...cmd, confirmReuse: true });
    assert.equal(
      state.questions[1].currentAnswer!.acceptanceMode,
      "CONFIRMED_REUSE",
    );
  });
  await test("Shared deselection blocks saves; retry survives; reselection keeps heads and IDs", async () => {
    const q = state.questions[0],
      cmd = accept(q, "must not save");
    await call({
      action: "select",
      tagId: fixtures[0].tags[0],
      selected: false,
      expectedSelectionVersion: q.selectionVersion,
    });
    await reject(() => call(cmd), "INELIGIBLE");
    assert.ok((await call(command)).receipt);
    await reject(
      () =>
        call({ action: "select", tagId: fixtures[0].tags[0], selected: true }),
      "STALE_SELECTION",
    );
    await call({
      action: "select",
      tagId: fixtures[0].tags[0],
      selected: true,
      expectedSelectionVersion: q.selectionVersion + 1,
    });
    state = await call({ action: "schedule" });
    assert.deepEqual(
      state.questions.map((q) => q.id),
      originalIds,
    );
    assert.equal(state.questions[0].answers[0].acceptedText, exact);
  });
  await test("Follow-up requires accepted selected base; re-answer retires its parent-dependent meaning", async () => {
    state = await call({
      action: "followup",
      questionId: state.questions[0].id,
    });
    const child = state.questions.find((q) => q.kind === "FOLLOW_UP")!;
    assert.ok(child.eligible);
    state = await call(
      accept(state.questions[0], "A new authored explanation"),
    );
    assert.equal(
      state.questions.find((q) => q.id === child.id)!.eligible,
      false,
    );
  });
  await test("Concurrent ordinary/durable saves and projection rebuild preserve both stores", async () => {
    const ordinary = state.ordinary[0];
    await Promise.all([
      call(accept(state.questions[0], "durable simultaneous")),
      call({
        action: "ordinary",
        questionId: ordinary.id,
        text: "Ordinary project intention",
        expectedVersion: 0,
        requestKey: crypto.randomUUID(),
      }),
    ]);
    state = await call({ action: "rebuild" });
    assert.equal(state.ordinary[0].text, "Ordinary project intention");
    assert.equal(
      state.questions[0].currentAnswer!.acceptedText,
      "durable simultaneous",
    );
    const savedPost = await prisma.projectPost.findUniqueOrThrow({
      where: { projectId: project(0) },
    });
    const mirror = (savedPost.provenance as any).interview.spotlightDrafts;
    assert.equal(mirror.schemaVersion, 1);
    assert.equal(
      mirror.answersByQuestion[state.questions[0].id].answer,
      "durable simultaneous",
    );
    assert.equal(
      mirror.eligibilityByQuestion[state.questions[0].id].eligible,
      true,
    );
    assert.ok(
      (await loadInterviewAnswers(project(0))).some((a) =>
        JSON.stringify(a).includes("Ordinary project intention"),
      ),
    );
  });
  await test("Legacy reuse binds exact provenance digest and destination versions", async () => {
    const source = state.legacyReuseSources.find(
      (a) => a.questionId === "legacy-parent",
    )!;
    const cmd = {
      ...accept(state.questions[1], source.acceptedText),
      reuseLegacyQuestionId: source.questionId,
      reuseTextDigest: source.textDigest,
      confirmReuse: true,
    } as Extract<SpotlightCommand, { action: "accept" }>;
    await reject(
      () => call({ ...cmd, reuseTextDigest: "0".repeat(64) }),
      "STALE_REUSE",
    );
    state = await call(cmd);
    const revision = state.questions[1].currentAnswer!;
    assert.equal(revision.acceptedText, source.acceptedText);
    assert.equal(revision.reusedFromRevisionId, null);
    assert.equal(
      (revision.reuseSnapshot as any).sourceKind,
      "LEGACY_PROVENANCE",
    );
    const post = await prisma.projectPost.findUniqueOrThrow({
      where: { projectId: project(0) },
    });
    const prov = post.provenance as any;
    prov.interview.payload.answers.find(
      (a: any) => a.questionId === source.questionId,
    ).answer = "changed source";
    await prisma.projectPost.update({
      where: { id: post.id },
      data: { provenance: prov },
    });
    await reject(
      () =>
        call({ ...cmd, ...accept(state.questions[1], source.acceptedText) }),
      "STALE_REUSE",
    );
  });
  await test("Spoofed/missing projection labels and published provenance cannot leak durable IDs", async () => {
    const q = state.questions[0];
    await prisma.projectPost.update({
      where: { projectId: project(0) },
      data: {
        status: "PUBLISHED",
        provenance: {
          interview: {
            spotlightDrafts: { secret: "PRIVATE_SUBTREE" },
            payload: {
              answers: [
                {
                  questionId: q.id,
                  questionVersion: q.questionVersion,
                  currentAnswerNumber: q.currentAnswerNumber,
                  answer: "PRIVATE_SENTINEL",
                  prompt: q.wording,
                },
                {
                  questionId: "ordinary-control",
                  answer: "Ordinary control",
                  prompt: "Project intention",
                },
              ],
            },
          },
        },
      },
    });
    await prisma.project.update({
      where: { id: project(0) },
      data: { isPublic: true },
    });
    const interview = await prisma.editorialInterview.findUniqueOrThrow({
      where: { projectId: project(0) },
    });
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId: q.id,
        answerText: "PRIVATE_SENTINEL",
        questionSource: "base_question",
        inferredPriorities: [],
        softConstraints: [],
      },
    });
    const post = await prisma.projectPost.findUniqueOrThrow({
      where: { projectId: project(0) },
    });
    const publicData = await stripPrivateInterviewData(post.provenance);
    assert.ok(!JSON.stringify(publicData).includes("PRIVATE_"));
    assert.ok(JSON.stringify(publicData).includes("Ordinary control"));
    for (const data of [
      await loadInterviewAnswers(project(0)),
      await resolveHeadlineSlots(project(0)),
      await gatherExtractionSources(actor),
    ])
      assert.ok(!JSON.stringify(data).includes("PRIVATE_SENTINEL"));
  });
  await test("Last source deletion preserves history and suspends eligibility", async () => {
    await prisma.productTag.delete({ where: { id: fixtures[0].tags[0] } });
    state = await call({ action: "resume" });
    assert.equal(state.questions[0].eligible, false);
    assert.ok(state.questions[0].answers.length >= 3);
  });
  await test("Scheduling an unanswered question blocks hard deletion", async () => {
    await reject(
      () => deleteProjectWithSpotlightGuard(project(1)),
      "SPOTLIGHT_HISTORY_RESTRICTS_DELETION",
    );
    assert.ok(await prisma.project.findUnique({ where: { id: project(1) } }));
  });
  await test("Publisher changes and inactive actor reject replay and reads", async () => {
    await reject(
      () => call({ action: "resume" }, project(0), other),
      "FORBIDDEN",
    );
    await prisma.project.update({
      where: { id: project(0) },
      data: { designerId: other },
    });
    await reject(() => call(command), "FORBIDDEN");
    await prisma.project.update({
      where: { id: project(0) },
      data: { designerId: actor },
    });
    await prisma.user.update({
      where: { id: actor },
      data: { accountStatus: "REJECTED" },
    });
    await reject(() => call({ action: "resume" }), "FORBIDDEN");
    await prisma.user.update({
      where: { id: actor },
      data: { accountStatus: "APPROVED" },
    });
  });
  await test("Studio capability is rechecked after active membership revocation", async () => {
    const org = await prisma.organization.create({
      data: { name: "Synthetic studio", specialties: [] },
    });
    const membership = await prisma.organizationUser.create({
      data: { organizationId: org.id, userId: actor, role: "MEMBER" },
    });
    await prisma.project.update({
      where: { id: project(3) },
      data: { designerOrgId: org.id },
    });
    await call(
      { action: "select", tagId: fixtures[3].tags[0], selected: true },
      project(3),
    );
    const s = await call({ action: "schedule" }, project(3));
    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { isActive: false },
    });
    await reject(
      () => call(accept(s.questions[0], "revoked"), project(3)),
      "FORBIDDEN",
    );
    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { isActive: true, role: "VIEWER" },
    });
    await reject(() => call({ action: "resume" }, project(3)), "FORBIDDEN");
    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { role: "MEMBER" },
    });
    assert.equal(
      (
        await call(
          accept(s.questions[0], "authorized studio answer"),
          project(3),
        )
      ).questions[0].answers.length,
      1,
    );
  });
  await test("Selection/save race serializes without accepting a deselected version", async () => {
    const before = await call({ action: "resume" }, project(1)),
      q = before.questions[0];
    const t = before.tags.find((t) => t.spotlightId === q.spotlightId)!;
    const results = await Promise.allSettled([
      call(
        {
          action: "select",
          tagId: t.id,
          selected: false,
          expectedSelectionVersion: q.selectionVersion,
        },
        project(1),
      ),
      call(accept(q, "racing selection"), project(1)),
    ]);
    assert.equal(results[0].status, "fulfilled");
    const after = await call({ action: "resume" }, project(1));
    assert.equal(after.questions.find((x) => x.id === q.id)!.eligible, false);
    assert.ok(after.questions.find((x) => x.id === q.id)!.answers.length <= 1);
    assert.ok(after.questions.find((x) => x.id === q.id)!.retiredAt);
  });
  await test("Failure after revision insertion rolls back revision, head and provenance together", async () => {
    const s = await call({ action: "resume" }, project(3)),
      q = s.questions[0];
    const before = await prisma.projectPost.findUniqueOrThrow({
      where: { projectId: project(3) },
    });
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION public.test_reject_head() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic head failure'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_reject_head BEFORE UPDATE ON public.spotlight_questions FOR EACH ROW EXECUTE FUNCTION public.test_reject_head()`,
    );
    await assert.rejects(() => call(accept(q, "must roll back"), project(3)));
    await prisma.$executeRawUnsafe(
      "DROP TRIGGER test_reject_head ON public.spotlight_questions",
    );
    await prisma.$executeRawUnsafe("DROP FUNCTION public.test_reject_head()");
    const after = await call({ action: "resume" }, project(3));
    assert.deepEqual(after.questions[0].answers, s.questions[0].answers);
    assert.deepEqual(
      (
        await prisma.projectPost.findUniqueOrThrow({
          where: { projectId: project(3) },
        })
      ).provenance,
      before.provenance,
    );
  });
  await test("Default-off/allowlists and kill switch cannot fall back to legacy", async () => {
    process.env.SPOTLIGHT_INTERVIEW_V1 = "false";
    await reject(() => call({ action: "resume" }), "SPOTLIGHT_UNAVAILABLE");
    assert.equal(
      (await legacyInterviewBoundary(
        new Request(
          `http://localhost/api/posting/project/${project(0)}/interview/questions`,
        ),
      ))!.status,
      409,
    );
    process.env.SPOTLIGHT_INTERVIEW_V1 = "true";
    await reject(
      () => call({ action: "resume" }, "not-enrolled"),
      "SPOTLIGHT_UNAVAILABLE",
    );
  });
  // Browser uses a separate clean project with ten tags and zero selections.
  fs.writeFileSync(
    "tasks/spotlight-private-fixtures.json",
    JSON.stringify({
      actor,
      other,
      project: project(7),
      fixtures: fixtures[7],
      publicSlug: `private-${project(0)}`,
    }),
  );
}
main()
  .then(() =>
    fs.writeFileSync(
      "tasks/spotlight-private-services.json",
      JSON.stringify(
        { status: "passed", tests, liveModelEvaluation: "not run" },
        null,
        2,
      ),
    ),
  )
  .catch((e) => {
    fs.writeFileSync(
      "tasks/spotlight-private-services.json",
      JSON.stringify({ status: "failed", tests, error: String(e) }, null, 2),
    );
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
