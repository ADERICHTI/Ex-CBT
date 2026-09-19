// One-time migration: split the embedded `answer` field out of every
// existing tests/{id}.questions[] into a new tests/{id}/answerKey/data doc,
// so existing tests match the new answer-free public schema. Run this once,
// against the emulator first, before deploying the new firestore.rules
// (which make answerKey owner-only and stop the old shape from being
// readable by test-takers anyway - but the split itself has to happen
// before rules are enforced, or QuestionsEditor/TestDetail won't find any
// answers to show the owner).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/migrate-answer-keys.mjs
//   (or, against the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-answer-keys.mjs)

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore(app, 'ex-cbt');

async function main() {
  const testsSnap = await db.collection('tests').get();
  console.log(`Found ${testsSnap.size} test(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const testDoc of testsSnap.docs) {
    const test = testDoc.data();
    const questions = test.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      skipped++;
      continue;
    }
    if (!questions.some((q) => 'answer' in q)) {
      console.log(`  ${testDoc.id}: already migrated, skipping.`);
      skipped++;
      continue;
    }

    const answers = questions.map((q) => q.answer ?? '');
    const publicQuestions = questions.map(({ question, options }) => ({ question, options }));

    const batch = db.batch();
    batch.set(testDoc.ref.collection('answerKey').doc('data'), { answers });
    batch.update(testDoc.ref, { questions: publicQuestions });
    await batch.commit();

    console.log(`  ${testDoc.id}: migrated ${answers.length} answer(s).`);
    migrated++;
  }

  console.log(`Done. Migrated ${migrated}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
