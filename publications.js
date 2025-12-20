/* publications.js */

function escapeHTML(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeSpaces(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function formatAuthors(authorStr) {
    if (!authorStr) return "";
    // 将 " and " 分割为数组
    const authorList = authorStr.split(" and ").map(raw => {
        const author = normalizeSpaces(raw);
        // BibTeX 标准: "Last, First Middle"
        if (author.includes(",")) {
            const [lastRaw, firstRaw] = author.split(",").map(s => normalizeSpaces(s));
            const last = lastRaw;
            const first = firstRaw || "";
            // 取首字母
            const initials = first.split(" ").filter(Boolean)
                .map(n => (n[0] ? n[0].toUpperCase() + "." : "")).join(" ");
            return normalizeSpaces(`${initials} ${last}`).trim();
        }
        // "First Middle Last" 格式回退
        const parts = author.split(" ");
        const last = parts.pop();
        const initials = parts.map(n => (n[0] ? n[0].toUpperCase() + "." : "")).join(" ");
        return normalizeSpaces(`${initials} ${last}`).trim();
    });

    // 高亮你的名字 (支持多种写法)
    return authorList.map(name => {
        if (name.includes("P. Ma") || name.includes("Ma P") || name.includes("Peijie Ma")) {
            return `<strong>${name}</strong>`;
        }
        return name;
    }).join(", ");
}

// --- 在 publications.js 中替换此函数 ---

function classifyEntry(tags) {
    // 1. 预处理：获取小写字段以进行不区分大小写的匹配
    const journal = (tags.journal || "").toLowerCase();
    const publisher = (tags.publisher || "").toLowerCase();
    const booktitle = (tags.booktitle || "").toLowerCase();

    // 2. 优先判定 arXiv (因为 bib 文件里 arXiv 经常写在 journal 字段里)
    if (journal.includes("arxiv") || publisher.includes("arxiv") || booktitle.includes("arxiv")) {
        return "arXiv";
    }

    // 3. 正常的分类逻辑
    if (tags.journal) return "Journal";
    if (tags.booktitle) return "Conference";

    return "Other";
}

function getYear(tags) {
    return tags.year || "9999";
}

function renderEntry(e) {
    const tags = e.entryTags || {};
    const title = escapeHTML(tags.title);
    const authors = formatAuthors(tags.author);
    const venue = escapeHTML(tags.journal || tags.booktitle || "Preprint");
    const year = escapeHTML(tags.year || "");
    const pages = tags.pages ? `pp. ${tags.pages}` : "";

    // 链接生成
    let linksHtml = "";
    if (tags.url) linksHtml += `<a href="${tags.url}" target="_blank">[PDF]</a>`;
    if (tags.doi) linksHtml += `<a href="https://doi.org/${tags.doi}" target="_blank">[DOI]</a>`;

    return `
    <div class="pub-entry">
        <span class="pub-title">${title}</span>
        <div class="pub-authors">${authors}</div>
        <div class="pub-meta">
            ${venue} ${year ? `(${year})` : ""} ${pages}
        </div>
        <div class="pub-links">${linksHtml}</div>
    </div>
    `;
}

function renderSection(title, entries) {
    if (!entries || entries.length === 0) return "";
    return `
        <div class="pub-section">
            <h3 style="margin-top: 1.5rem; margin-bottom: 1rem; color:var(--accent-color); font-size:1.1rem; text-transform:uppercase; letter-spacing:1px;">${title}</h3>
            ${entries.map(renderEntry).join("")}
        </div>
    `;
}

// === 主逻辑 ===
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("publications-container");

    fetch("publications.bib")
        .then(response => {
            if (!response.ok) throw new Error("Bib file not found (404)");
            return response.text();
        })
        .then(text => {
            // 关键：检查解析器是否存在
            if (typeof bibtexParse === 'undefined') {
                throw new Error("bibtexParse library not loaded properly.");
            }

            const entries = bibtexParse.toJSON(text);

            // 分桶
            const buckets = { Journal: [], Conference: [], arXiv: [], Other: [] };
            entries.forEach(e => {
                const cls = classifyEntry(e.entryTags);
                if (buckets[cls]) buckets[cls].push(e);
                else buckets.Other.push(e); // fallback
            });

            // 排序 (按年份降序)
            const sortByYearDesc = (a, b) => {
                const ya = parseInt(getYear(a.entryTags), 10);
                const yb = parseInt(getYear(b.entryTags), 10);
                return (Number.isNaN(yb) ? 0 : yb) - (Number.isNaN(ya) ? 0 : ya);
            };
            Object.keys(buckets).forEach(k => buckets[k].sort(sortByYearDesc));

            // 渲染
            container.innerHTML =
                renderSection("Journal Articles", buckets.Journal) +
                renderSection("Conference Papers", buckets.Conference) +
                renderSection("arXiv Preprints", buckets.arXiv) +
                renderSection("Other", buckets.Other);

            if (!container.innerHTML.trim()) {
                container.innerHTML = "<p>No publications found.</p>";
            }
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `<p style="color:red;">Error loading publications: ${err.message}. <br>Make sure 'publications.bib' is in the root folder.</p>`;
        });
});