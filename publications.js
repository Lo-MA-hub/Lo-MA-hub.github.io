/* publications.js */

// 1. Utilities
function escapeHTML(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeSpaces(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

// 2. Author Formatting
function formatAuthors(authorStr) {
    if (!authorStr) return "";

    // Split " and "
    const list = authorStr.split(" and ").map(name => {
        let cleanName = normalizeSpaces(name);

        // Handle "Last, First"
        if (cleanName.includes(",")) {
            const [last, first] = cleanName.split(",").map(s => s.trim());
            const initials = first ? first.split(" ").map(n => n[0] + ".").join(" ") : "";
            cleanName = `${initials} ${last}`;
        } else {
            // Handle "First Last" -> "F. Last"
            const parts = cleanName.split(" ");
            const last = parts.pop();
            const initials = parts.map(n => n[0] + ".").join(" ");
            cleanName = `${initials} ${last}`;
        }

        // Highlight YOUR name
        if (cleanName.includes("P. Ma") || cleanName.includes("Peijie Ma")) {
            return `<strong>${cleanName}</strong>`;
        }
        return cleanName;
    });

    return list.join(", ");
}

// 3. Rendering
function renderEntry(e) {
    const t = e.entryTags;
    const title = escapeHTML(t.title);
    const authors = formatAuthors(t.author);
    const venue = escapeHTML(t.journal || t.booktitle || "Preprint");
    const year = t.year || "";

    // Build Links
    let links = "";
    if (t.url) links += `<a href="${t.url}" target="_blank">[PDF]</a>`;
    if (t.doi) links += `<a href="https://doi.org/${t.doi}" target="_blank">[DOI]</a>`;
    if (t.arxiv) links += `<a href="https://arxiv.org/abs/${t.arxiv}" target="_blank">[arXiv]</a>`;

    return `
        <div class="pub-entry">
            <span class="pub-title">${title}</span>
            <div class="pub-meta">
                ${authors}<br>
                <span style="font-style:italic;">${venue}</span> ${year ? `(${year})` : ""}
            </div>
            <div class="pub-links">${links}</div>
        </div>
    `;
}

function renderSection(title, entries) {
    if (!entries || entries.length === 0) return "";
    return `
        <div class="pub-section">
            <h3 class="pub-section-header">${title}</h3>
            ${entries.map(renderEntry).join("")}
        </div>
    `;
}

// 4. Main Execution
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("publications-container");

    fetch("publications.bib")
        .then(res => {
            if (!res.ok) throw new Error("Bib file missing");
            return res.text();
        })
        .then(text => {
            if (typeof bibtexParse === 'undefined') {
                container.innerHTML = "Error: BibTeX parser not loaded.";
                return;
            }

            const entries = bibtexParse.toJSON(text);

            // Buckets
            const buckets = { Journal: [], Conference: [], Other: [] };

            entries.forEach(e => {
                const tags = e.entryTags;
                if (tags.journal) buckets.Journal.push(e);
                else if (tags.booktitle) buckets.Conference.push(e);
                else buckets.Other.push(e);
            });

            // Sort by Year Desc
            const sortFn = (a, b) => (b.entryTags.year || 0) - (a.entryTags.year || 0);
            Object.values(buckets).forEach(b => b.sort(sortFn));

            container.innerHTML =
                renderSection("Journal Articles", buckets.Journal) +
                renderSection("Conference Papers", buckets.Conference) +
                renderSection("Other / Preprints", buckets.Other);
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `<p>Error loading publications. Please check console.</p>`;
        });
});