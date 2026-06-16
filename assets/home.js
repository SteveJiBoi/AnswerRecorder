/* Homepage: render task cards + search filter */
(function () {
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  const count = document.getElementById("count");
  const all = tasks();

  function moduleTags(t) {
    const rTotal = t.reading.reduce((s, m) => s + m.items.length, 0);
    const lTotal = t.listening.reduce((s, m) => s + m.items.length, 0);
    const tags = [
      `阅读 ${rTotal}`,
      `听力 ${lTotal}`,
      `写作`,
    ].map(x => `<span class="tag">${esc(x)}</span>`);
    if (t.reading.some(m => m.dubiousFills)) {
      tags.push(`<span class="tag warn" title="该卷填空答案文档不完整，填空将不自动批改">填空答案缺失</span>`);
    }
    return tags.join("");
  }

  function render(list) {
    grid.innerHTML = list.map(t => `
      <a class="card" href="task.html?task=${encodeURIComponent(t.name)}">
        <div class="name">${esc(t.name)}</div>
        <div class="tags">${moduleTags(t)}</div>
      </a>`).join("");
    count.textContent = `${list.length} / ${all.length} 个任务`;
    if (!list.length) grid.innerHTML = `<div class="empty">没有匹配的任务</div>`;
  }

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    render(q ? all.filter(t => t.name.toLowerCase().includes(q)) : all);
  });

  render(all);
})();
