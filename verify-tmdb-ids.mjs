#!/usr/bin/env node
// verify-tmdb-ids.mjs — checks every tmdb_id in movies.json against the live TMDB API,
// reports mismatches, and suggests the correct ID via search.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readToken() {
  const envPath = path.join(__dirname, '.env');
  try {
    const env = fs.readFileSync(envPath, 'utf8');
    const match = env.match(/VITE_TMDB_READ_TOKEN=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

const TOKEN = readToken();
if (!TOKEN) {
  console.error('ERROR: No VITE_TMDB_READ_TOKEN found in .env');
  process.exit(1);
}

const movies = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src/data/movies.json'), 'utf8')
);

function norm(s) {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)(?:the|a|an)\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  accept: 'application/json',
};

async function fetchMovie(tmdbId) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, { headers: HEADERS });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function searchMovie(title, year) {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&year=${year}&page=1`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

function titlesMatch(expected, received) {
  // Short titles (e.g. "RRR") need an exact match — substring matching lets
  // a wrong ID slip through since a short fragment matches almost anything.
  if (expected.length <= 4 || received.length <= 4) return expected === received;
  return received.includes(expected.slice(0, 8)) || expected.includes(received.slice(0, 8));
}

async function main() {
  console.log(`Verifying ${movies.length} films against TMDB...\n`);

  const mismatches = [];
  const notFound = [];

  for (const movie of movies) {
    const details = await fetchMovie(movie.tmdb_id);

    if (!details) {
      console.log(`❌ #${String(movie.rank).padStart(3)} "${movie.title}" — tmdb_id ${movie.tmdb_id} NOT FOUND`);
      notFound.push(movie);
      await new Promise(r => setTimeout(r, 80));
      continue;
    }

    const expected = norm(movie.title);
    const received = norm(details.title ?? '');
    const match = titlesMatch(expected, received);

    if (!match) {
      process.stdout.write(`❌ #${String(movie.rank).padStart(3)} "${movie.title}" (${movie.year})`);
      process.stdout.write(` — tmdb_id ${movie.tmdb_id} returns "${details.title}" (${details.release_date?.slice(0, 4) ?? '?'})\n`);

      // Search for the correct ID
      const results = await searchMovie(movie.title, movie.year);
      await new Promise(r => setTimeout(r, 80));

      // Try exact year + normalized title match first
      const exactMatch = results.find(r => {
        const rYear = r.release_date?.slice(0, 4);
        return String(rYear) === String(movie.year) && norm(r.title) === expected;
      });

      // Fall back to fuzzy: same year, title starts with same chars
      const fuzzyMatch = !exactMatch && results.find(r => {
        const rYear = r.release_date?.slice(0, 4);
        return String(rYear) === String(movie.year) && titlesMatch(expected, norm(r.title));
      });

      const suggestion = exactMatch || fuzzyMatch || results[0];

      if (suggestion) {
        console.log(`       → Suggested fix: "tmdb_id": ${suggestion.id}   ("${suggestion.title}", ${suggestion.release_date?.slice(0, 4) ?? '?'})`);
      } else {
        console.log(`       → No suggestion found — search TMDB manually`);
      }

      mismatches.push({
        rank: movie.rank,
        title: movie.title,
        year: movie.year,
        current_id: movie.tmdb_id,
        tmdb_returns: details.title,
        suggested_id: suggestion?.id ?? null,
        suggested_title: suggestion?.title ?? null,
      });
    } else {
      console.log(`✓  #${String(movie.rank).padStart(3)} "${movie.title}"`);
    }

    await new Promise(r => setTimeout(r, 80)); // ~12 req/s, well under TMDB rate limit
  }

  console.log('\n' + '─'.repeat(60));
  if (mismatches.length === 0 && notFound.length === 0) {
    console.log('All 100 TMDB IDs verified correctly. No fixes needed.');
  } else {
    if (notFound.length) {
      console.log(`\n${notFound.length} ID(s) not found on TMDB:`);
      notFound.forEach(m => console.log(`  #${m.rank} "${m.title}" — tmdb_id ${m.tmdb_id}`));
    }
    if (mismatches.length) {
      console.log(`\n${mismatches.length} mismatch(es) to fix in movies.json:`);
      mismatches.forEach(m => {
        const fix = m.suggested_id
          ? `→ change tmdb_id to ${m.suggested_id}`
          : `→ needs manual lookup`;
        console.log(`  #${m.rank} "${m.title}" (${m.year}): ${fix}`);
      });
    }
  }

  // Write a JSON summary for easy reference
  const summary = { mismatches, notFound: notFound.map(m => ({ rank: m.rank, title: m.title, tmdb_id: m.tmdb_id })) };
  fs.writeFileSync(path.join(__dirname, 'tmdb-verify-results.json'), JSON.stringify(summary, null, 2));
  console.log('\nFull results saved to tmdb-verify-results.json');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
