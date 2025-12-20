fetch("publications.bib")
    .then(res => res.text())
    .then(text => {
        const bibs = bibtexParse.toJSON(text);
        const list = document.getElementById("pub-list");
        list.innerHTML = "";

        bibs.forEach(entry => {
            const e = entry.entryTags;

            const authors = e.author
                ? e.author.replace(/ and /g, ", ")
                : "";

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
