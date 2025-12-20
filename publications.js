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

function classifyEntry(tags) {
    const venue = getVenue(tags).toLowerCase();
    const note = getNote(tags).toLowerCase();
    const arxiv = detectArxiv(tags);

    // 1️⃣ Journal Articles (highest priority)
    // Heuristics: journal field exists OR venue contains "journal"
    if (tags.journal || venue.includes("journal") || venue.includes("Journal")) {
        return "Journal";
    }

    // 2️⃣ Conference Papers
    const confHints = [
        "conference",
        "symposium",
        "workshop",
        "globecom",
        "icc",
        "infocom"
    ];
    if (venue && confHints.some(h => venue.includes(h))) {
        return "Conference";
    }

    // 3️⃣ arXiv Preprints
    if (arxiv) {
        return "arXiv";
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

function renderEntry(entry) {
    const tags = entry.entryTags || {};
    const authors = formatAuthors(tags.author || "");
    const title = escapeHTML(getTitle(tags));
    const venue = escapeHTML(getVenue(tags));
    const year = escapeHTML(getYear(tags));
    const note = escapeHTML(getNote(tags));

    const links = buildLinks(tags);

    const venueLineParts = [];
    if (venue) venueLineParts.push(`<span class="venue">${venue}</span>`);
    if (year) venueLineParts.push(year);
    if (note) venueLineParts.push(`<strong>${note}</strong>`);
    const venueLine = venueLineParts.join(", ");

    const linksHTML = links.length
        ? `<div class="pub-links">${links
            .map(l => `<a href="${l.url}" target="_blank" rel="noopener noreferrer">[${escapeHTML(l.label)}]</a>`)
            .join("")}</div>`
        : "";

    return `
    <li>
      ${authors}.<br>
      <em>${title}</em>.<br>
      ${venueLine ? `${venueLine}.` : ""}
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
      <ol class="pub-list">
        ${items}
      </ol>
    </div>
  `;
}

async function main() {
    const container = document.getElementById("pub-sections");
    if (!container) return;

    try {
        const res = await fetch("publications.bib", { cache: "no-store" });
        const text = await res.text();
        const entries = bibtexParse.toJSON(text);

        // Classify
        const buckets = {
            Accepted: [],
            Conference: [],
            arXiv: [],
            Other: []
        };

        entries.forEach(e => {
            const tags = e.entryTags || {};
            const cls = classifyEntry(tags);
            buckets[cls].push(e);
        });

        // Optional: stable ordering within each bucket
        // If year exists, sort descending; otherwise keep original order
        const sortByYearDesc = (a, b) => {
            const ya = parseInt(getYear(a.entryTags || {}), 10);
            const yb = parseInt(getYear(b.entryTags || {}), 10);
            if (Number.isNaN(ya) && Number.isNaN(yb)) return 0;
            if (Number.isNaN(ya)) return 1;
            if (Number.isNaN(yb)) return -1;
            return yb - ya;
        };

        Object.keys(buckets).forEach(k => buckets[k].sort(sortByYearDesc));

        // Render in desired order
        container.innerHTML =
            renderSection("Accepted / Published", buckets.Accepted) +
            renderSection("Conference Papers", buckets.Conference) +
            renderSection("arXiv Preprints", buckets.arXiv) +
            renderSection("Other", buckets.Other);

        // Fallback if everything empty
        if (!container.innerHTML.trim()) {
            container.innerHTML = "<p>No publications found.</p>";
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Failed to load publications.</p>";
    }
}

main();
