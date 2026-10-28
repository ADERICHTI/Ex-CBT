// One-time migration: move the approved-students list out of every existing
// tests/{id}.allowedUsers (readable by anyone with the test link) into the
// owner-only tests/{id}/roster/data doc, and pin restrictAccess explicitly
// for older tests that only inferred it from a non-empty list. Safe to re-run.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/migrate-rosters.mjs
//   (or, against the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-rosters.mjs)

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore(app, 'ex-cbt');

async function main() {
  const testsSnap = await db.collection('tests').get();
  console.log(`Found ${testsSnap.size} test(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const testDoc of testsSnap.docs) {
    const test = testDoc.data();
    if (!('allowedUsers' in test)) {
      skipped++;
      continue;
    }

    const allowedUsers = Array.isArray(test.allowedUsers) ? test.allowedUsers : [];
    const patch = { allowedUsers: FieldValue.delete() };
    if (test.restrictAccess === undefined) patch.restrictAccess = allowedUsers.length > 0;

    const batch = db.batch();
    batch.set(testDoc.ref.collection('roster').doc('data'), { allowedUsers, createdBy: test.createdBy ?? null });
    batch.update(testDoc.ref, patch);
    await batch.commit();

    console.log(`  ${testDoc.id}: moved ${allowedUsers.length} student(s).`);
    migrated++;
  }

  console.log(`Done. Migrated ${migrated}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
