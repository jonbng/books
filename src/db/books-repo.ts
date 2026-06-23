/**
 * Books on the user's shelves — CRUD, shelf moves, progress, and finishing.
 *
 * Shelf moves carry deliberate side effects (DESIGN.md §10):
 *  - moving to "reading" stamps `started_at` (once),
 *  - finishing stamps `finished_at` and snaps progress to the last page.
 */

import type { Shelf } from '@/lib/books';

import { getDb } from './database.ts';

export interface Book {
  id: number;
  openLibraryKey: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  totalPages: number | null;
  currentPage: number;
  shelf: Shelf;
  startedAt: string | null;
  finishedAt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface NewBook {
  openLibraryKey?: string | null;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  coverWidth?: number | null;
  coverHeight?: number | null;
  totalPages?: number | null;
  shelf?: Shelf;
}

interface BookRow {
  id: number;
  open_library_key: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  total_pages: number | null;
  current_page: number;
  shelf: Shelf;
  started_at: string | null;
  finished_at: string | null;
  sort_order: number;
  created_at: string;
}

function fromRow(r: BookRow): Book {
  return {
    id: r.id,
    openLibraryKey: r.open_library_key,
    title: r.title,
    author: r.author,
    coverUrl: r.cover_url,
    coverWidth: r.cover_width,
    coverHeight: r.cover_height,
    totalPages: r.total_pages,
    currentPage: r.current_page,
    shelf: r.shelf,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

const SELECT = `SELECT id, open_library_key, title, author, cover_url, cover_width, cover_height,
  total_pages, current_page, shelf, started_at, finished_at, sort_order, created_at FROM books`;

/** All books, optionally filtered to one shelf, ordered for display. */
export async function listBooks(shelf?: Shelf): Promise<Book[]> {
  const db = await getDb();
  const rows = shelf
    ? await db.getAllAsync<BookRow>(
        `${SELECT} WHERE shelf = ? ORDER BY sort_order, created_at DESC;`,
        [shelf]
      )
    : await db.getAllAsync<BookRow>(`${SELECT} ORDER BY sort_order, created_at DESC;`);
  return rows.map(fromRow);
}

export async function getBook(id: number): Promise<Book | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BookRow>(`${SELECT} WHERE id = ?;`, [id]);
  return row ? fromRow(row) : null;
}

/** Find a book already on a shelf by its Open Library key, or null. */
export async function findByOpenLibraryKey(key: string): Promise<Book | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<BookRow>(`${SELECT} WHERE open_library_key = ?;`, [key]);
  return row ? fromRow(row) : null;
}

/**
 * Add a book (e.g. from an Open Library search result). Returns the new row —
 * or, if a book with the same Open Library key is already shelved, that existing
 * row unchanged. This makes adding idempotent: a library never holds the same
 * title twice, whichever path (search, trending, scan) reached it.
 */
export async function addBook(input: NewBook): Promise<Book> {
  const db = await getDb();
  if (input.openLibraryKey) {
    const existing = await findByOpenLibraryKey(input.openLibraryKey);
    if (existing) return existing;
  }
  const shelf: Shelf = input.shelf ?? 'want_to_read';
  const startedAt = shelf === 'reading' ? new Date().toISOString() : null;
  const result = await db.runAsync(
    `INSERT INTO books
       (open_library_key, title, author, cover_url, cover_width, cover_height,
        total_pages, current_page, shelf, started_at, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?);`,
    [
      input.openLibraryKey ?? null,
      input.title,
      input.author ?? null,
      input.coverUrl ?? null,
      input.coverWidth ?? null,
      input.coverHeight ?? null,
      input.totalPages ?? null,
      shelf,
      startedAt,
      new Date().toISOString(),
    ]
  );
  const book = await getBook(result.lastInsertRowId);
  if (!book) throw new Error('Failed to insert book');
  return book;
}

/** Update the current page (clamped to >= 0). */
export async function setCurrentPage(id: number, page: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE books SET current_page = ? WHERE id = ?;', [Math.max(0, page), id]);
}

/** Update the known total page count. */
export async function setTotalPages(id: number, totalPages: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE books SET total_pages = ? WHERE id = ?;', [totalPages, id]);
}

/**
 * Move a book to a shelf, applying the shelf's side effects:
 *  - "reading": set started_at if not already set.
 *  - "finished": stamp finished_at and snap current_page to total_pages.
 */
export async function moveToShelf(id: number, shelf: Shelf): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  if (shelf === 'reading') {
    await db.runAsync(
      `UPDATE books SET shelf = 'reading', started_at = COALESCE(started_at, ?) WHERE id = ?;`,
      [now, id]
    );
  } else if (shelf === 'finished') {
    await db.runAsync(
      `UPDATE books
         SET shelf = 'finished',
             finished_at = ?,
             started_at = COALESCE(started_at, ?),
             current_page = COALESCE(total_pages, current_page)
       WHERE id = ?;`,
      [now, now, id]
    );
  } else {
    await db.runAsync(`UPDATE books SET shelf = 'want_to_read' WHERE id = ?;`, [id]);
  }
}

/** Deliberate "mark as finished" (DESIGN.md §10) — moves to the Finished shelf. */
export async function markFinished(id: number): Promise<void> {
  await moveToShelf(id, 'finished');
}

export async function deleteBook(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM books WHERE id = ?;', [id]);
}
