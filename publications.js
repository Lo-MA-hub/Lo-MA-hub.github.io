/* publications.js
 * - Parses publications.bib (BibTeX)
 * - Formats authors as initials + last name
 * - Boldfaces ONLY your name (P. Ma / Peijie Ma)
 * - Auto-detects arXiv and generates [arXiv] link
 * - Auto-groups: Accepted / Conference / arXiv / Other
 */

function escapeHTML(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function normalizeSpaces(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function formatAuthors(authorStr) {
    if (!authorStr) return "";

    const authorList = authorStr.split(" and ").map(raw => {
        const author = normalizeSpaces(raw);

        // BibTeX canonical: "Last, First Middle"
        if (author.includes(",")) {
            const [lastRaw, firstRaw] = author.split(",").map(s => normalizeSpaces(s));
            const last = lastRaw;
            const first = firstRaw || "";
            const initials = first
                .split(" ")
                .filter(Boolean)
                .map(n => (n[0] ? n[0].toUpperCase() + "." : ""))
                .join(" ");
            return normalizeSpaces(`${initials} ${last}`).trim();
        }

        // Fallback: "First Middle Last"
        const parts = author.split(" ").filter(Boolean);
        if (parts.length >= 2) {
            const last = parts.pop();
            const initials = parts
                .map(n => (n[0] ? n[0].toUpperCase() + "." : ""))
                .join(" ");
            return normalizeSpaces(`${initials} ${last}`).trim();
        }

        return author;
    });

    const formatted = authorList.join(", ");
    return highlightMyName(formatted);
}

function highlightMyName(authorLine) {
    // Only boldface YOUR name
    // Match: "P. Ma" / "P Ma" / "Peijie Ma" (case-sensitive enough, but robust to spacing)
    let out = authorLine;

    // Bold "P. Ma" variations
    out = out.replace(/\bP\.?\s*Ma\b/g, "<strong>P. Ma</strong>");

    // Bold "Peijie Ma" (in case some entry uses full name after formatting)
    out = out.replace(/\bPeijie\s+Ma\b/g, "<strong>Peijie Ma</strong>");

    return out;
}

function getVenue(tags) {
    // Prefer journal, then booktitle (conference), then publisher, then organization
    return (
        normalizeSpaces(tags.journal) ||
        normalizeSpaces(tags.booktitle) ||
        normalizeSpaces(tags.publisher) ||
        normalizeSpaces(tags.organization) ||
        ""
    );
}

function getYear(tags) {
    const y = normalizeSpaces(tags.year);
    return y || "";
}

function getTitle(tags) {
    // BibTeX titles often have braces; keep content but trim
    return normalizeSpaces(tags.title);
}

function getNote(tags) {
    return normalizeSpaces(tags.note);
}

function detectArxiv(tags) {
    // Common patterns:
    // - eprint=2507.22027 + archivePrefix=arXiv
    // - note="arXiv preprint arXiv:2507.22027"
    // - url contains arxiv.org/abs/...
    const eprint = normalizeSpaces(tags.eprint);
    const archivePrefix = normalizeSpaces(tags.archivePrefix || tags.archiveprefix);
    const url = normalizeSpaces(tags.url);

    // 1) eprint + arXiv prefix
    if (eprint && /arxiv/i.test(archivePrefix)) {
        return { id: eprint, url: `https://arxiv.org/abs/${eprint}` };
    }

    // 2) note contains arXiv:xxxx.xxxxx
    const note = normalizeSpaces(tags.note);
    const m1 = note.match(/arXiv:\s*([0-9]{4}\.[0-9]{4,5})/i);
    if (m1) {
        const id = m1[1];
        return { id, url: `https://arxiv.org/abs/${id}` };
    }

    // 3) url already points to arXiv
    const m2 = url.match(/arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/i);
    if (m2) {
        const id = m2[1];
        return { id, url: `https://arxiv.org/abs/${id}` };
    }

    return null;
}

function isArxivJournal(tags) {
    const journal = (tags.journal || "").toLowerCase();
    return journal.includes("arxiv");
}


function classifyEntry(tags) {
    const venue = getVenue(tags).toLowerCase();

    // 1️⃣ arXiv Preprints —— 必须最先拦截
    // 情况 A：journal = "arXiv preprint arXiv:xxxx.xxxxx"
    // 情况 B：detectArxiv() 能识别
    if (isArxivJournal(tags) || detectArxiv(tags)) {
        return "arXiv";
    }

    // 2️⃣ Journal Articles（非 arXiv）
    if (tags.journal && !isArxivJournal(tags)) {
        return "Journal";
    }

    // 3️⃣ Conference Papers
    const confHints = [
        "conference",
        "icc",
        "globecom",
        "infocom",
        "symposium",
        "workshop"
    ];
    if (venue && confHints.some(h => venue.includes(h))) {
        return "Conference";
    }

    // 4️⃣ Other
    return "Other";
}




function buildLinks(tags) {
    const links = [];

    // arXiv link
    const arxiv = detectArxiv(tags);
    if (arxiv) {
        links.push({ label: "arXiv", url: arxiv.url });
    }

    // DOI link (if present)
    const doi = normalizeSpaces(tags.doi);
    if (doi) {
        links.push({ label: "DOI", url: `https://doi.org/${doi}` });
    }

    // URL link (if present and not redundant)
    const url = normalizeSpaces(tags.url);
    if (url && (!arxiv || url !== arxiv.url)) {
        links.push({ label: "Link", url });
    }

    return links;
}

/* publications.js - Part 1 stays the same... */
/* ... (Keep escapeHTML, normalizeSpaces, formatAuthors, highlightMyName, etc. exactly as you had them) ... */

// ... (Paste your helper functions here) ...
// Or just copy the Render parts below and replace your old render functions:

function renderEntry(entry) {
    const tags = entry.entryTags || {};
    const authors = formatAuthors(tags.author || "");
    const title = escapeHTML(getTitle(tags));
    const venue = escapeHTML(getVenue(tags));
    const year = escapeHTML(getYear(tags));
    const note = escapeHTML(getNote(tags));

    const links = buildLinks(tags);

    // Build Venue Line
    const venueParts = [];
    if (venue) venueParts.push(`<span class="pub-venue">${venue}</span>`);
    if (year) venueParts.push(year);
    if (note) venueParts.push(`<span>${note}</span>`);
    const venueHTML = venueParts.join(" &bull; "); // Use a bullet point separator

    // Build Links as Buttons
    const linksHTML = links.length
        ? `<div class="pub-links">${links
            .map(l => `<a href="${l.url}" class="pub-btn" target="_blank" rel="noopener noreferrer">${escapeHTML(l.label)}</a>`)
            .join("")}</div>`
        : "";

    // Return a structured DIV instead of a plain LI
    return `
    <li class="pub-entry">
      <span class="pub-title">${title}</span>
      <div class="pub-authors">${authors}</div>
      <div class="pub-meta">${venueHTML}</div>
      ${linksHTML}
    </li>
  `;
}

function renderSection(title, entries) {
    if (!entries.length) return "";
    const items = entries.map(e => renderEntry(e)).join("");
    return `
    <div class="pub-section">
      <h3>${escapeHTML(title)}</h3>
      <ul class="pub-list"> ${items}
      </ul>
    </div>
  `;
}

/* ... (Keep your main() function exactly as is) ... */
async function main() {
    const container = document.getElementById("pub-sections");
    if (!container) return;

    try {
        const res = await fetch("publications.bib", { cache: "no-store" });
        const text = await res.text();
        // Assuming bibtexParse is loaded globally from vendor script
        const entries = bibtexParse.toJSON(text);

        // ... (Keep your existing bucket sorting logic) ...
        const buckets = {
            Journal: [],
            Conference: [],
            arXiv: [],
            Other: []
        };

        // ... (Keep your classification logic) ...
        entries.forEach(e => {
            const tags = e.entryTags || {};
            const cls = classifyEntry(tags);
            buckets[cls].push(e);
        });

        const sortByYearDesc = (a, b) => {
            const ya = parseInt(getYear(a.entryTags || {}), 10);
            const yb = parseInt(getYear(b.entryTags || {}), 10);
            if (Number.isNaN(ya) && Number.isNaN(yb)) return 0;
            if (Number.isNaN(ya)) return 1;
            if (Number.isNaN(yb)) return -1;
            return yb - ya;
        };

        Object.keys(buckets).forEach(k => buckets[k].sort(sortByYearDesc));

        container.innerHTML =
            renderSection("Journal Articles", buckets.Journal) +
            renderSection("Conference Papers", buckets.Conference) +
            renderSection("arXiv Preprints", buckets.arXiv) +
            renderSection("Other", buckets.Other);

        if (!container.innerHTML.trim()) {
            container.innerHTML = "<p>No publications found.</p>";
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Failed to load publications.</p>";
    }
}

main();