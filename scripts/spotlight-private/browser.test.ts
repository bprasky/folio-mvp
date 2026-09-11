import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer-core";
import { prisma } from "../../src/lib/prisma";

const f = JSON.parse(
  fs.readFileSync("tasks/spotlight-private-fixtures.json", "utf8"),
);
const base = "http://127.0.0.1:3210",
  tests: { name: string; result: string }[] = [];
let server: ChildProcess,
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  logs = "",
  modelServer: Server;
const modelInputs: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  tests.push({ name, result: "passed" });
  console.log("PASS " + name);
}
async function start() {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", "3210", "-H", "127.0.0.1"],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout!.on("data", (b) => (logs += b));
  server.stderr!.on("data", (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + "/api/projects/" + f.project + "/spotlight");
      if (r.status === 401) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error("Next server did not start: " + logs.slice(-3000));
}
async function stop() {
  if (server) {
    server.kill("SIGTERM");
    await new Promise<void>((r) => server.once("exit", () => r()));
  }
}
async function main() {
  assert.ok(process.env.FOLIO_TEST_NONCE);
  assert.ok(
    new URL(process.env.DATABASE_URL!).searchParams
      .get("host")!
      .endsWith("/socket"),
  );
  modelServer = createServer((req, res) => {
    let text = "";
    req.on("data", (b) => (text += b));
    req.on("end", () => {
      modelInputs.push(text);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "synthetic-message",
          type: "message",
          role: "assistant",
          model: "synthetic",
          content: [
            {
              type: "text",
              text: JSON.stringify([
                "The designer says, “Ordinary control makes the room work for daily life.”",
              ]),
            },
          ],
          stop_reason: "end_turn",
        }),
      );
    });
  });
  await new Promise<void>((r) => modelServer.listen(3211, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:3211";
  process.env.ANTHROPIC_API_KEY = "synthetic-local-only";
  const cookie = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: {
      id: f.actor,
      sub: f.actor,
      role: "DESIGNER",
      accountStatus: "APPROVED",
      onboardingCompletedAt: new Date().toISOString(),
    },
    maxAge: 3600,
  });
  const headers = {
    "Content-Type": "application/json",
    Cookie: `next-auth.session-token=${cookie}`,
  };
  const api = async (body: any) => {
    const r = await fetch(base + "/api/projects/" + f.project + "/spotlight", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return { status: r.status, data };
  };
  await start();
  await test("Unauthenticated API denied and invalid input rejected", async () => {
    assert.equal(
      (
        await fetch(base + "/api/projects/" + f.project + "/spotlight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"action":"resume"}',
        })
      ).status,
      401,
    );
    assert.equal(
      (await api({ action: "accept", questionId: "bad" })).status,
      400,
    );
  });
  await test("Actual tagging API ignores Shop/testimonial/outreach payload and does not select", async () => {
    const before = await Promise.all([
      prisma.shopProduct.count(),
      prisma.notification.count(),
      prisma.vendorInviteSignal.count(),
      prisma.productSpotlight.count(),
    ]);
    const r = await fetch(base + "/api/tag-product-to-image", {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: f.project,
        imageId: f.fixtures.images[0],
        productId: f.fixtures.products[0],
        x: 0.1,
        y: 0.1,
        addToShop: true,
        shopQuote: "Do not publish",
        createSelection: true,
      }),
    });
    assert.equal(r.status, 200, await r.text());
    assert.deepEqual(
      await Promise.all([
        prisma.shopProduct.count(),
        prisma.notification.count(),
        prisma.vendorInviteSignal.count(),
        prisma.productSpotlight.count(),
      ]),
      before,
    );
  });
  const chrome = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find((p) => fs.existsSync(p));
  assert.ok(chrome, "Supported local Chromium required");
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  // Next dev recompiles chunks after a process restart. Always fetch the
  // current chunks; persistence is tested in PostgreSQL, never browser caches.
  await page.setCacheEnabled(false);
  page.on("pageerror", (error) => {
    logs += `\nBROWSER ERROR: ${String(error)}`;
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(base))
      logs += `\nFAILED REQUEST: ${request.url()} ${request.failure()?.errorText}`;
  });
  await page.setViewport({ width: 1280, height: 1000 });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith(base) || u.startsWith("data:")) void r.continue();
    else void r.abort();
  });
  await page.setCookie({
    name: "next-auth.session-token",
    value: cookie,
    url: base,
  });
  const navigation = await page.goto(
    base + "/project/" + f.project + "/spotlight",
    { waitUntil: "domcontentloaded", timeout: 180000 },
  );
  assert.equal(
    navigation!.status(),
    200,
    "Private workspace must render successfully",
  );
  await page.waitForSelector(
    'section[aria-label="Spotlight selections"] input',
    { timeout: 90000 },
  );
  const clickText = async (text: string) => {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      if ((await b.evaluate((e) => e.textContent))?.trim() === text) {
        await b.click();
        return;
      }
    }
    throw Error("Missing button " + text);
  };
  await test("Browser selects two canonical pieces and receives exactly two base questions", async () => {
    const checks = await page.$$(
      'section[aria-label="Spotlight selections"] input',
    );
    assert.ok(checks.length >= 10);
    await checks[0].click();
    await page.waitForFunction(
      () =>
        ![
          ...document.querySelectorAll(
            'section[aria-label="Spotlight selections"] input',
          ),
        ].some((e) => (e as HTMLInputElement).disabled),
    );
    await checks[1].click();
    await page.waitForFunction(
      () =>
        ![
          ...document.querySelectorAll(
            'section[aria-label="Spotlight selections"] input',
          ),
        ].some((e) => (e as HTMLInputElement).disabled),
    );
    await clickText("Start or resume interview");
    await page.waitForFunction(() =>
      document.body.innerText.includes("2 selected piece questions"),
    );
    assert.equal(
      (await api({ action: "resume" })).data.questions.filter(
        (q: any) => q.kind === "BASE" && q.eligible,
      ).length,
      2,
    );
  });
  const exact = "  Browser accepted text 🪑\nkeeps these spaces.  ";
  let firstId: string;
  await test("Browser saves exact text through authenticated production route", async () => {
    const card = await page.$("article[data-question-id]");
    firstId = (await card!.evaluate((e) =>
      e.getAttribute("data-question-id"),
    ))!;
    const area = await card!.$("textarea");
    await area!.type(exact);
    const button = await card!.$("button");
    await button!.click();
    await page.waitForFunction(() =>
      document.body.innerText.includes("Saved."),
    );
    assert.equal(
      (await api({ action: "resume" })).data.questions.find(
        (q: any) => q.id === firstId,
      ).currentAnswer.acceptedText,
      exact,
    );
  });
  await test("Server restart, reload and browser resume retain stable question and answer", async () => {
    await stop();
    await start();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector(
      'section[aria-label="Spotlight selections"] input',
      { timeout: 90000 },
    );
    await clickText("Start or resume interview");
    await page.waitForSelector(
      `article[data-question-id="${firstId}"] textarea`,
    );
    assert.equal(
      await page.$eval(
        `article[data-question-id="${firstId}"] textarea`,
        (e) => (e as HTMLTextAreaElement).value,
      ),
      exact,
    );
  });
  await test("Browser previews and explicitly confirms reuse into a second question", async () => {
    const s = (await api({ action: "resume" })).data;
    const second = s.questions.find(
      (q: any) => q.kind === "BASE" && q.id !== firstId,
    );
    const selector = `article[data-question-id="${second.id}"]`;
    await (await page.$(`${selector} summary`))!.click();
    const value = await page.$eval(
      `${selector} select`,
      (el) => (el as HTMLSelectElement).options[1].value,
    );
    await page.select(`${selector} select`, value);
    assert.equal(
      await page.$eval(`${selector} blockquote`, (el) => el.textContent),
      exact,
    );
    await (await page.$(`${selector} input[type="checkbox"]`))!.click();
    await (await page.$(`${selector} button`))!.click();
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes("Saved."),
      {},
      selector,
    );
    const saved = (await api({ action: "resume" })).data.questions.find(
      (q: any) => q.id === second.id,
    ).currentAnswer;
    assert.equal(saved.acceptedText, exact);
    assert.equal(saved.acceptanceMode, "CONFIRMED_REUSE");
  });
  await test("Stale browser save retains unsaved text; retry never overwrites winner", async () => {
    const s = (await api({ action: "resume" })).data,
      q = s.questions.find((q: any) => q.id === firstId);
    assert.equal(
      (
        await api({
          action: "accept",
          questionId: q.id,
          questionVersion: q.questionVersion,
          currentAnswerNumber: q.currentAnswerNumber,
          text: "Another session won",
          requestKey: crypto.randomUUID(),
          stateVersion: q.stateVersion,
          selectionVersion: q.selectionVersion,
          inputModality: "TEXT",
        })
      ).status,
      200,
    );
    const area = await page.$(
      `article[data-question-id="${firstId}"] textarea`,
    );
    await area!.type(" still unsaved");
    const before = await area!.evaluate(
      (e) => (e as HTMLTextAreaElement).value,
    );
    await (await page.$(
      `article[data-question-id="${firstId}"] button`,
    ))!.click();
    await page.waitForFunction(() =>
      document.body.innerText.includes("changed"),
    );
    assert.equal(
      await area!.evaluate((e) => (e as HTMLTextAreaElement).value),
      before,
    );
    assert.equal(
      (await api({ action: "resume" })).data.questions.find(
        (q: any) => q.id === firstId,
      ).currentAnswer.acceptedText,
      "Another session won",
    );
  });
  await test("Enrolled legacy cached/questions, save, followup and realtime start routes reject bypass", async () => {
    for (const [url, method, body] of [
      [`/api/posting/project/${f.project}/interview/questions`, "GET", null],
      [`/api/posting/project/${f.project}/interview`, "POST", {}],
      [`/api/posting/project/${f.project}/interview/followups`, "POST", {}],
      ["/api/interview/start", "POST", { projectId: f.project }],
      ["/api/interview/realtime/session", "POST", { projectId: f.project }],
    ] as const) {
      const r = await fetch(base + url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(r.status, 409, url);
    }
  });
  // Inject adversarial projection data immediately before the real readers;
  // reconciliation may correctly have removed earlier spoofed fixtures.
  const publicPost = await prisma.projectPost.findUniqueOrThrow({
    where: { slug: f.publicSlug },
  });
  const privateQuestion = await prisma.spotlightQuestion.findFirstOrThrow({
    where: { spotlight: { projectId: publicPost.projectId } },
  });
  const publicInterview = await prisma.editorialInterview.findUniqueOrThrow({
    where: { projectId: publicPost.projectId },
  });
  await prisma.projectPost.update({
    where: { id: publicPost.id },
    data: {
      provenance: {
        interview: {
          spotlightDrafts: { secret: "PRIVATE_SUBTREE" },
          payload: {
            answers: [
              {
                questionId: privateQuestion.id,
                answer: "PRIVATE_SENTINEL",
                questionSource: "base_question",
              },
              { questionId: "ordinary-control", answer: "Ordinary control" },
            ],
          },
        },
      },
    },
  });
  await prisma.editorialInterviewAnswer.create({
    data: {
      interviewId: publicInterview.id,
      questionId: privateQuestion.id,
      answerText: "PRIVATE_SENTINEL",
      questionSource: "base_question",
      inferredPriorities: [],
      softConstraints: [],
    },
  });
  await test("Actual published-post response removes private subtree and spoofed answer", async () => {
    const r = await fetch(base + "/api/posting/" + f.publicSlug);
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.ok(
      !text.includes("PRIVATE_SENTINEL") && !text.includes("PRIVATE_SUBTREE"),
    );
    assert.ok(text.includes("Ordinary control"));
  });
  await test("Actual section regeneration model input excludes private answers and retains ordinary context", async () => {
    const post = await prisma.projectPost.findUniqueOrThrow({
      where: { slug: f.publicSlug },
    });
    const room = await prisma.room.findFirstOrThrow({
      where: { projectId: post.projectId, name: "Living room" },
    });
    const interview = await prisma.editorialInterview.findUniqueOrThrow({
      where: { projectId: post.projectId },
    });
    await prisma.projectPost.update({
      where: { id: post.id },
      data: {
        expandedBlocks: {
          galleryChapters: [
            {
              title: "Living room",
              body: ["Existing ordinary editorial paragraph."],
              imageIds: [],
            },
          ],
        },
      },
    });
    await prisma.editorialInterviewAnswer.updateMany({
      where: { interviewId: interview.id },
      data: { roomId: room.id },
    });
    await prisma.editorialInterviewAnswer.create({
      data: {
        interviewId: interview.id,
        questionId: "ordinary-reader",
        answerText: "Ordinary control makes the room work for daily life.",
        roomId: room.id,
        inferredPriorities: [],
        softConstraints: [],
      },
    });
    const before = modelInputs.length;
    const r = await fetch(
      base + `/api/posting/project/${post.projectId}/sections/0/regenerate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          feedback: "Keep the ordinary interview context.",
        }),
      },
    );
    const response = await r.text();
    assert.ok(modelInputs.length > before, response);
    const inputs = modelInputs.slice(before).join("\n");
    assert.ok(!inputs.includes("PRIVATE_SENTINEL"));
    assert.ok(inputs.includes("Ordinary control makes the room work"));
  });
  await test("Authenticated project deletion returns typed scheduled-history conflict", async () => {
    const r = await fetch(base + "/api/projects/" + f.project, {
      method: "DELETE",
      headers,
    });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, "SPOTLIGHT_HISTORY_RESTRICTS_DELETION");
  });
  await test("Force deletion and account deletion stop before cleanup with typed conflict", async () => {
    for (const url of [
      "/api/projects/" + f.project + "/force-delete",
      "/api/user/delete",
    ]) {
      const r = await fetch(base + url, { method: "DELETE", headers });
      assert.equal(r.status, 409, await r.text());
    }
    assert.ok(await prisma.project.findUnique({ where: { id: f.project } }));
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.actor } }))
        .accountStatus,
      "APPROVED",
    );
  });
  await test("Browser deselects and reselects while preserving question IDs and exact history", async () => {
    await clickText("Close interview");
    const toggle = await page.$(
      'section[aria-label="Spotlight selections"] input',
    );
    await toggle!.click();
    await page.waitForFunction(
      () =>
        !(
          document.querySelector(
            'section[aria-label="Spotlight selections"] input',
          ) as HTMLInputElement
        ).disabled,
    );
    assert.equal(
      (await api({ action: "resume" })).data.questions.find(
        (q: any) => q.id === firstId,
      ).eligible,
      false,
    );
    await toggle!.click();
    await page.waitForFunction(
      () =>
        !(
          document.querySelector(
            'section[aria-label="Spotlight selections"] input',
          ) as HTMLInputElement
        ).disabled,
    );
    await clickText("Start or resume interview");
    await page.waitForSelector(
      `article[data-question-id="${firstId}"] textarea`,
    );
    const q = (await api({ action: "resume" })).data.questions.find(
      (q: any) => q.id === firstId,
    );
    assert.equal(q.eligible, true);
    assert.equal(q.answers[0].acceptedText, exact);
    assert.equal(q.currentAnswer.acceptedText, "Another session won");
  });
  await test("Concurrent room rename and ordinary save preserve durable mirrors and ordinary text", async () => {
    const s = (await api({ action: "resume" })).data;
    const ordinary = s.ordinary[0];
    const [rename, save] = await Promise.all([
      fetch(base + `/api/projects/${f.project}/rooms/${f.fixtures.rooms[0]}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name: "Lounge" }),
      }),
      api({
        action: "ordinary",
        questionId: ordinary.id,
        text: "Concurrent room rename control",
        expectedVersion: ordinary.version || 0,
        requestKey: crypto.randomUUID(),
      }),
    ]);
    assert.equal(rename.status, 200, await rename.text());
    assert.equal(save.status, 200);
    const post = await prisma.projectPost.findUniqueOrThrow({
      where: { projectId: f.project },
    });
    const mirror = (post.provenance as any).interview.spotlightDrafts;
    assert.equal(
      mirror.answersByQuestion[firstId].answer,
      "Another session won",
    );
    assert.equal(
      mirror.ordinary[ordinary.id].text,
      "Concurrent room rename control",
    );
  });
  await page.screenshot({
    path: "tasks/spotlight-private-browser.png",
    fullPage: true,
  });
}
main()
  .then(() =>
    fs.writeFileSync(
      "tasks/spotlight-private-browser.json",
      JSON.stringify(
        {
          status: "passed",
          tests,
          mockedModelCalls: modelInputs.length,
          externalBrowserRequests: "blocked",
          liveModelEvaluation: "not run",
        },
        null,
        2,
      ),
    ),
  )
  .catch(async (e) => {
    if (browser) {
      const pages = await browser.pages();
      const page = pages[pages.length - 1];
      logs += `\nBROWSER BODY: ${await page.$eval("body", (el) => el.innerText).catch(() => "unavailable")}`;
      await page
        .screenshot({
          path: "tasks/spotlight-private-browser.png",
          fullPage: true,
        })
        .catch(() => {});
    }
    fs.writeFileSync(
      "tasks/spotlight-private-browser.json",
      JSON.stringify(
        {
          status: "failed",
          tests,
          error: String(e),
          serverLog: logs.slice(-10000),
        },
        null,
        2,
      ),
    );
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    await stop();
    if (modelServer) modelServer.close();
    await prisma.$disconnect();
  });
