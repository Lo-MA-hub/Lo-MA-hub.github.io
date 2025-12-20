function formatAuthors(authorStr) {
    if (!authorStr) return "";

    return authorStr.split(" and ").map(author => {
        author = author.trim();

        // Case 1: "Last, First Middle"
        if (author.includes(",")) {
            const [last, first] = author.split(",").map(s => s.trim());
            const initials = first
                .split(/\s+/)
                .map(n => n[0] + ".")
                .join(" ");
            return `${initials} ${last}`;
        }

        // Case 2: already "First Last"
        const parts = author.split(/\s+/);
        if (parts.length > 1) {
            const last = parts.pop();
            const initials = parts.map(n => n[0] + ".").join(" ");
            return `${initials} ${last}`;
        }

        return author;
    }).join(", ");
}


fetch("publications.bib")
    .then(res => res.text())
    .then(text => {
        const bibs = bibtexParse.toJSON(text);
        const list = document.getElementById("pub-list");
        list.innerHTML = "";

        bibs.forEach(entry => {
            const e = entry.entryTags;

            const authors = formatAuthors(e.author);


            const title = e.title || "";
            const venue = e.journal || e.booktitle || "";
            const note = e.note || "";

            const li = document.createElement("li");
            li.innerHTML = `
        <strong>${authors}</strong>.<br>
        <em>${title}</em>.<br>
        <span class="venue">${venue}</span>
        ${note ? `, <strong>${note}</strong>` : ""}
      `;
            list.appendChild(li);
        });
    });
