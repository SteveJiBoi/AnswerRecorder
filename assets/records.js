/* 做题记录 page: list browser-local submissions, export summary Excel */
(function () {
  const content = document.getElementById("content");
  const count = document.getElementById("count");

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
  }

  function render() {
    const recs = loadRecords();
    count.textContent = `${recs.length} 条记录`;
    if (!recs.length) {
      content.innerHTML = `<div class="empty">还没有记录。完成一个任务并点击「提交并导出答案」后，会在此显示。</div>`;
      return;
    }
    content.innerHTML = `
      <table class="rec-table">
        <thead><tr>
          <th>日期</th><th>任务</th><th>答题者</th><th>阅读</th><th>听力</th>
          <th>邮件(词)</th><th>学术(词)</th><th>提交时间</th><th></th>
        </tr></thead>
        <tbody>
          ${recs.map(r => `<tr>
            <td>${esc(r.date)}</td>
            <td>${esc(r.task)}</td>
            <td>${esc(r.student)}</td>
            <td>${esc(r.reading)}</td>
            <td>${esc(r.listening)}</td>
            <td>${esc(r.emailWords)}</td>
            <td>${esc(r.academicWords)}</td>
            <td class="muted small">${esc(fmtTime(r.ts))}</td>
            <td><button class="btn sm danger" data-del="${esc(r.id)}">删除</button></td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    content.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => { deleteRecord(b.dataset.del); render(); }));
  }

  document.getElementById("exportAll").addEventListener("click", () => {
    const recs = loadRecords();
    if (!recs.length) { alert("暂无记录可导出。"); return; }
    const header = ["日期", "任务", "答题者", "阅读得分", "听力得分", "邮件字数(词)", "学术写作字数(词)", "提交时间"];
    const rows = [header].concat(recs.map(r =>
      [r.date, r.task, r.student, r.reading, r.listening, r.emailWords, r.academicWords, fmtTime(r.ts)]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "做题记录");
    XLSX.writeFile(wb, `托福做题记录_${todayISO()}.xlsx`);
  });

  document.getElementById("clearAll").addEventListener("click", () => {
    if (confirm("确定清空本浏览器的全部做题记录？此操作不可撤销。")) {
      localStorage.removeItem(RECORDS_KEY); render();
    }
  });

  render();
})();
