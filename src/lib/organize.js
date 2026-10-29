import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase.js'

// Each person's own stars and folders (private — see firestore.rules):
//   users/{email}/testMeta/{testId} { starred?, folderId? }
//   users/{email}/folders/{folderId} { name, createdAt }

// { meta: { [testId]: { starred, folderId } }, folders: [{ id, name }] }
export function useOrganize(email) {
  const [meta, setMeta] = useState({})
  const [folders, setFolders] = useState([])

  useEffect(() => {
    if (!email) return
    // Stars and folders are extras: if they can't load, the list still shows.
    const stopMeta = onSnapshot(
      collection(db, 'users', email, 'testMeta'),
      (snap) => setMeta(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      () => setMeta({}),
    )
    const stopFolders = onSnapshot(
      collection(db, 'users', email, 'folders'),
      (snap) =>
        setFolders(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        ),
      () => setFolders([]),
    )
    return () => {
      stopMeta()
      stopFolders()
    }
  }, [email])

  return { meta, folders }
}

const metaRef = (email, testId) => doc(db, 'users', email, 'testMeta', testId)

export function setStarred(email, testId, starred) {
  return setDoc(metaRef(email, testId), { starred }, { merge: true })
}

// folderId null = back to "My tests" (no folder).
export function moveToFolder(email, testId, folderId) {
  return setDoc(metaRef(email, testId), { folderId: folderId ?? deleteField() }, { merge: true })
}

export async function createFolder(email, name) {
  const ref = await addDoc(collection(db, 'users', email, 'folders'), {
    name: name.trim().slice(0, 80),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export function renameFolder(email, folderId, name) {
  return updateDoc(doc(db, 'users', email, 'folders', folderId), { name: name.trim().slice(0, 80) })
}

// Deleting a folder never deletes tests - they just go back to no folder.
export async function deleteFolder(email, folderId) {
  const inside = await getDocs(
    query(collection(db, 'users', email, 'testMeta'), where('folderId', '==', folderId)),
  )
  const batch = writeBatch(db)
  inside.docs.forEach((d) => batch.update(d.ref, { folderId: deleteField() }))
  batch.delete(doc(db, 'users', email, 'folders', folderId))
  await batch.commit()
}
