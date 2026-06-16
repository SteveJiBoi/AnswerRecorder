/* Task answering page: render Reading/Listening/Writing, grade, export Excel */
(function () {
  const name = qparam("task");
  const task = findTask(name);
  if (!task) {
    document.getElementById("app").innerHTML =
      `<div class="empty" style="margin-top:40px">未找到任务「${esc(name)}」。<br><a href="index.html">返回任务列表</a></div>`;
    document.querySelector(".submitbar").style.display = "none";
    return;
  }
  document.title = `${task.name} · 托福刷题`;
  document.getElementById("taskName").textContent = task.name;

  // ---- header: student + date ----
  const studentSel = document.getElementById("student");
  STUDENTS.forEach(s => {
    const o = document.createElement("option"); o.value = s; o.textContent = s; studentSel.appendChild(o);
  });
  document.getElementById("date").value = todayISO();

  // registries of question descriptors
  const Q = { reading: [], listening: [] };
  const writing = { sentences: [], email: null, academic: null };

  // ---------- MC + fill renderers ----------
  function mcQuestion(sec, modIdx, item, optCount, extra) {
    const q = document.createElement("div");
    q.className = "q";
    const gname = `q_${sec}_${modIdx}_${item.n}`;
    let optsHtml = "";
    for (let i = 0; i < optCount; i++) {
      const L = LETTERS[i];
      optsHtml += `<label class="opt"><input type="radio" name="${gname}" value="${L}">${L.toUpperCase()}</label>`;
    }
    q.innerHTML = `
      <div class="num">${item.n}</div>
      <div class="body">
        <div class="opts">${optsHtml}</div>
        <div class="answerline" style="display:none"></div>
        <textarea class="note" rows="1" placeholder="备注（题目是否有问题，可留空）"></textarea>
      </div>`;
    // toggle checked class
    q.querySelectorAll(".opt").forEach(lbl => {
      const input = lbl.querySelector("input");
      input.addEventListener("change", () => {
        q.querySelectorAll(".opt").forEach(o => o.classList.remove("checked"));
        if (input.checked) lbl.classList.add("checked");
      });
    });
    const desc = {
      sec, mod: modIdx, n: item.n, type: "mc",
      key: extra ? null : (item.ans || null),
      nograde: !!extra || !item.ans, extra: !!extra,
      el: q,
      getStudent: () => {
        const c = q.querySelector(`input[name="${gname}"]:checked`);
        return c ? c.value : "";
      },
      getNote: () => q.querySelector(".note").value.trim(),
    };
    Q[sec].push(desc);
    return q;
  }

  function fillQuestion(sec, modIdx, item, dubious) {
    const q = document.createElement("div");
    q.className = "q";
    q.innerHTML = `
      <div class="num">${item.n}</div>
      <div class="body">
        <input class="fill-input" type="text" placeholder="填空作答…">
        <div class="answerline" style="display:none"></div>
        <textarea class="note" rows="1" placeholder="备注（题目是否有问题，可留空）"></textarea>
      </div>`;
    const desc = {
      sec, mod: modIdx, n: item.n, type: "fill",
      key: dubious ? null : (item.ans || null),
      nograde: dubious || !item.ans, extra: false,
      el: q,
      getStudent: () => q.querySelector(".fill-input").value.trim(),
      getNote: () => q.querySelector(".note").value.trim(),
    };
    Q[sec].push(desc);
    return q;
  }

  function addMissingBtn(sec, modIdx, container, startNextN) {
    const btn = document.createElement("button");
    btn.className = "btn sm ghost";
    btn.style.marginTop = "12px";
    btn.textContent = "+ 补充缺失题目";
    btn.title = "如果答案文档缺少题目，点此添加一道选择题（仅记录，不参与自动批改）";
    let counter = { v: startNextN() };
    btn.addEventListener("click", () => {
      const n = counter.v++;
      const q = mcQuestion(sec, modIdx, { n: n, ans: null }, 4, true);
      container.insertBefore(q, btn);
    });
    container.appendChild(btn);
  }

  // ---------- Reading ----------
  function renderReading() {
    const root = document.getElementById("sec-reading");
    root.innerHTML = `<h2>Reading 阅读</h2><p class="sub">填空请直接输入答案；选择题请选择选项。每题下方可填写备注。</p>`;
    task.reading.forEach((mod, mi) => {
      const box = document.createElement("div");
      box.className = "module";
      const fills = mod.items.filter(i => i.type !== "mc");
      const mcs = mod.items.filter(i => i.type === "mc");
      box.innerHTML = `<div class="module-head"><h3>模块 ${mi + 1}</h3>
        <span class="hint">${fills.length} 填空 · ${mcs.length} 选择</span></div>`;
      if (mod.dubiousFills) {
        const b = document.createElement("div");
        b.className = "banner warn";
        b.textContent = "⚠ 该卷答案文档的填空部分不完整，填空题仅记录作答、不进行自动批改（选择题正常批改）。";
        box.appendChild(b);
      }
      const list = document.createElement("div");
      mod.items.forEach(item => {
        list.appendChild(item.type === "mc"
          ? mcQuestion("reading", mi, item, optionCount(mod.items), false)
          : fillQuestion("reading", mi, item, mod.dubiousFills));
      });
      box.appendChild(list);
      const maxN = mod.items.reduce((m, i) => Math.max(m, i.n), 0);
      addMissingBtn("reading", mi, box, () => maxN + 1 + Q.reading.filter(d => d.extra && d.mod === mi).length);
      root.appendChild(box);
    });
  }

  // ---------- Listening ----------
  function renderListening() {
    const root = document.getElementById("sec-listening");
    root.innerHTML = `<h2>Listening 听力</h2><p class="sub">全部为选择题，自上而下排列。每题下方可填写备注。</p>`;
    task.listening.forEach((mod, mi) => {
      const box = document.createElement("div");
      box.className = "module";
      box.innerHTML = `<div class="module-head"><h3>模块 ${mi + 1}</h3>
        <span class="hint">${mod.items.length} 题</span></div>`;
      const list = document.createElement("div");
      const oc = optionCount(mod.items);
      mod.items.forEach(item => list.appendChild(mcQuestion("listening", mi, item, oc, false)));
      box.appendChild(list);
      const maxN = mod.items.reduce((m, i) => Math.max(m, i.n), 0);
      addMissingBtn("listening", mi, box, () => maxN + 1 + Q.listening.filter(d => d.extra && d.mod === mi).length);
      root.appendChild(box);
    });
  }

  // ---------- Writing + timers ----------
  function makeTimer(displayEl, limitSec) {
    let elapsed = 0, iv = null;
    function fmt(s) { const m = Math.floor(s / 60), ss = s % 60; return `${m}:${String(ss).padStart(2, "0")}`; }
    function paint() {
      if (elapsed <= limitSec) {
        displayEl.classList.remove("over");
        displayEl.querySelector(".val").textContent = fmt(limitSec - elapsed);
        displayEl.querySelector(".lbl").textContent = "剩余时间";
      } else {
        displayEl.classList.add("over");
        displayEl.querySelector(".val").textContent = "+" + fmt(elapsed - limitSec);
        displayEl.querySelector(".lbl").textContent = "已超时";
      }
    }
    paint();
    return {
      start() { if (iv) return; iv = setInterval(() => { elapsed++; paint(); }, 1000); },
      pause() { if (iv) { clearInterval(iv); iv = null; } },
      reset() { this.pause(); elapsed = 0; paint(); },
      running() { return !!iv; },
    };
  }

  function timerBlock(label, limitSec) {
    const wrap = document.createElement("div");
    wrap.className = "timerbar";
    wrap.innerHTML = `
      <div class="timer"><span class="lbl"></span><span class="val"></span></div>
      <button class="btn sm primary t-start">开始</button>
      <button class="btn sm t-pause">暂停/停止</button>
      <button class="btn sm ghost t-reset">重置</button>
      <span class="muted small">${esc(label)}：${limitSec / 60} 分钟</span>`;
    const t = makeTimer(wrap.querySelector(".timer"), limitSec);
    wrap.querySelector(".t-start").addEventListener("click", () => t.start());
    wrap.querySelector(".t-pause").addEventListener("click", () => t.pause());
    wrap.querySelector(".t-reset").addEventListener("click", () => t.reset());
    return wrap;
  }

  function bigBox(placeholder) {
    const ta = document.createElement("textarea");
    ta.className = "bigbox";
    ta.placeholder = placeholder;
    const wc = document.createElement("div");
    wc.className = "wordcount";
    const update = () => {
      const t = ta.value.trim();
      wc.textContent = `字数：${t ? t.split(/\s+/).length : 0} 词 · ${ta.value.length} 字符`;
    };
    ta.addEventListener("input", update); update();
    return { ta, wc, wordCount: () => { const t = ta.value.trim(); return t ? t.split(/\s+/).length : 0; } };
  }

  function renderWriting() {
    const root = document.getElementById("sec-writing");
    root.innerHTML = `<h2>Writing 写作</h2><p class="sub">写作部分不自动批改，仅记录作答内容并导出。</p>`;

    // Module 1 — make an appropriate sentence (10)
    const m1 = document.createElement("div");
    m1.className = "module";
    m1.innerHTML = `<div class="module-head"><h3>模块 1 · Make an appropriate sentence</h3>
      <button class="btn sm ghost" id="refToggle">显示参考答案</button></div>`;
    const refBox = document.createElement("div");
    refBox.className = "banner info";
    refBox.style.display = "none";
    refBox.innerHTML = task.writing && task.writing.length
      ? "<b>参考答案：</b><br>" + task.writing.map((s, i) => `${i + 1}. ${esc(s)}`).join("<br>")
      : "该卷未解析到参考答案。";
    m1.appendChild(refBox);
    m1.querySelector("#refToggle").addEventListener("click", e => {
      const show = refBox.style.display === "none";
      refBox.style.display = show ? "block" : "none";
      e.target.textContent = show ? "隐藏参考答案" : "显示参考答案";
    });
    const list = document.createElement("div");
    for (let i = 1; i <= 10; i++) {
      const row = document.createElement("div");
      row.className = "write-row";
      row.innerHTML = `<div class="num">${i}</div>
        <div class="body">
          <input class="fill-input" style="max-width:100%" type="text" placeholder="作答…">
          <textarea class="note" rows="1" placeholder="备注（可留空）" style="margin-top:6px"></textarea>
        </div>`;
      writing.sentences.push({
        n: i,
        answer: () => row.querySelector(".fill-input").value.trim(),
        note: () => row.querySelector(".note").value.trim(),
      });
      list.appendChild(row);
    }
    m1.appendChild(list);
    root.appendChild(m1);

    // Module 2 — Write an Email (7 min)
    const m2 = document.createElement("div");
    m2.className = "module";
    m2.innerHTML = `<div class="module-head"><h3>模块 2 · Write an Email</h3></div>`;
    m2.appendChild(timerBlock("邮件写作计时", 7 * 60));
    const email = bigBox("在此撰写邮件…");
    m2.appendChild(email.ta); m2.appendChild(email.wc);
    writing.email = email;
    root.appendChild(m2);

    // Module 3 — Academic Discussion (10 min)
    const m3 = document.createElement("div");
    m3.className = "module";
    m3.innerHTML = `<div class="module-head"><h3>模块 3 · Academic Discussion</h3></div>`;
    m3.appendChild(timerBlock("学术写作计时", 10 * 60));
    const acad = bigBox("在此撰写学术讨论…");
    m3.appendChild(acad.ta); m3.appendChild(acad.wc);
    writing.academic = acad;
    root.appendChild(m3);
  }

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      ["reading", "listening", "writing"].forEach(s => {
        document.getElementById("sec-" + s).classList.toggle("hidden", s !== tab.dataset.target);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ---------- grading ----------
  function gradeSection(sec) {
    let correct = 0, gradeable = 0, answered = 0;
    const rows = [];
    Q[sec].forEach(d => {
      const stu = d.getStudent();
      if (stu) answered++;
      let result;
      if (d.extra) result = "补充题(不批改)";
      else if (!d.key) result = d.type === "fill" ? "未批改(答案缺失)" : "答案缺失(不批改)";
      else {
        gradeable++;
        const ok = d.type === "mc"
          ? stu.toLowerCase() === d.key.toLowerCase()
          : normFill(stu) === normFill(d.key);
        if (!stu) result = "未作答";
        else result = ok ? "正确" : "错误";
        if (ok) correct++;
        // visual
        const line = d.el.querySelector(".answerline");
        d.el.classList.remove("correct", "wrong");
        if (stu) d.el.classList.add(ok ? "correct" : "wrong");
        if (d.type === "mc") {
          d.el.querySelectorAll(".opt").forEach(o => {
            o.classList.remove("key", "wrongpick");
            const v = o.querySelector("input").value;
            if (v === d.key.toLowerCase()) o.classList.add("key");
            if (stu && v === stu.toLowerCase() && !ok) o.classList.add("wrongpick");
          });
          line.style.display = "block";
          line.innerHTML = stu
            ? (ok ? `<span class="ok">✓ 正确</span>` : `<span class="no">✗ 你的答案 ${stu.toUpperCase()}</span> · <span class="key">正确答案 ${d.key.toUpperCase()}</span>`)
            : `<span class="key">未作答 · 正确答案 ${d.key.toUpperCase()}</span>`;
        } else {
          line.style.display = "block";
          line.innerHTML = stu
            ? (ok ? `<span class="ok">✓ 正确</span>` : `<span class="no">✗ 你的答案「${esc(stu)}」</span> · <span class="key">参考答案「${esc(d.key)}」</span>`)
            : `<span class="key">未作答 · 参考答案「${esc(d.key)}」</span>`;
        }
      }
      rows.push({ mod: d.mod + 1, n: d.n, type: d.type === "mc" ? "选择" : "填空", student: stu, key: d.key || "", result });
    });
    return { correct, gradeable, answered, total: Q[sec].length, rows };
  }

  function grade() {
    const r = gradeSection("reading");
    const l = gradeSection("listening");
    const chips = document.getElementById("scorechips");
    chips.innerHTML =
      `<div class="scorechip">阅读 <b>${r.correct}/${r.gradeable}</b></div>` +
      `<div class="scorechip">听力 <b>${l.correct}/${l.gradeable}</b></div>` +
      `<div class="scorechip" style="background:#eef1f5;color:#55606b">合计 <b>${r.correct + l.correct}/${r.gradeable + l.gradeable}</b></div>`;
    return { r, l };
  }

  document.getElementById("gradeBtn").addEventListener("click", grade);

  // ---------- export ----------
  function exportExcel() {
    const { r, l } = grade();
    const student = studentSel.value;
    const date = document.getElementById("date").value || todayISO();
    const emailWC = writing.email.wordCount();
    const acadWC = writing.academic.wordCount();

    const wb = XLSX.utils.book_new();

    const summary = [
      ["任务", task.name],
      ["答题者", student],
      ["日期", date],
      ["阅读得分", `${r.correct}/${r.gradeable}`],
      ["听力得分", `${l.correct}/${l.gradeable}`],
      ["阅读+听力合计", `${r.correct + l.correct}/${r.gradeable + l.gradeable}`],
      ["邮件字数(词)", emailWC],
      ["学术写作字数(词)", acadWC],
      ["导出时间", new Date().toLocaleString()],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "汇总");

    const qaHeader = ["模块", "题号", "类型", "学生答案", "正确答案", "结果", "备注"];
    function qaSheet(sec) {
      const rows = [qaHeader];
      Q[sec].forEach(d => {
        const g = (sec === "reading" ? r : l).rows.find(x => x.mod === d.mod + 1 && x.n === d.n && x.type === (d.type === "mc" ? "选择" : "填空"));
        rows.push([d.mod + 1, d.n, d.type === "mc" ? "选择" : "填空", d.getStudent(), d.key || "", g ? g.result : "", d.getNote()]);
      });
      return XLSX.utils.aoa_to_sheet(rows);
    }
    XLSX.utils.book_append_sheet(wb, qaSheet("reading"), "阅读");
    XLSX.utils.book_append_sheet(wb, qaSheet("listening"), "听力");

    const w = [["写作 Writing"], [], ["模块1 · Make an appropriate sentence"], ["题号", "学生答案", "备注"]];
    writing.sentences.forEach(s => w.push([s.n, s.answer(), s.note()]));
    w.push([], ["模块2 · Write an Email", `字数: ${emailWC} 词`], [writing.email.ta.value]);
    w.push([], ["模块3 · Academic Discussion", `字数: ${acadWC} 词`], [writing.academic.ta.value]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(w), "写作");

    const safe = s => s.replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(wb, `${safe(task.name)}_${safe(student)}_${date}.xlsx`);

    // browser-local log (Excel remains the portable record)
    saveRecord({
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      task: task.name, student, date,
      reading: `${r.correct}/${r.gradeable}`, listening: `${l.correct}/${l.gradeable}`,
      emailWords: emailWC, academicWords: acadWC,
      ts: new Date().toISOString(),
    });
  }

  document.getElementById("submitBtn").addEventListener("click", () => {
    exportExcel();
    document.getElementById("submitBtn").textContent = "已导出 ✓ 再次导出";
    setTimeout(() => document.getElementById("submitBtn").textContent = "提交并导出答案 (Excel)", 2500);
  });

  // ---------- init render ----------
  renderReading();
  renderListening();
  renderWriting();
})();
