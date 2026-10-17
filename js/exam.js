/* ============================================================
 * 全真模拟考试：写作30min → 听力(只播一遍) → 阅读40min → 翻译30min
 * 四级总125分钟 / 六级总130分钟，710分制
 * 覆盖 app.js 中旧版随机抽题的 startExam / resetExam / submitExam
 * ============================================================ */

let ex = null;
// { paper, level, inProgress, stage:0-3, stageRemaining, totalRemaining,
//   interval, answers:{}, writing, trans, listeningPlayed, submitted,
//   speakTimers:[], listeningPaper }

const EX_STAGES = [
    { key: 'writing', name: '✍️ 写作', minutes: 30, sub: '15% · 106.5分' },
    { key: 'listening', name: '🎧 听力', minutes: 0, sub: '35% · 248.5分' }, // 时长按级别
    { key: 'reading', name: '📖 阅读', minutes: 40, sub: '35% · 248.5分' },
    { key: 'translation', name: '🌐 翻译', minutes: 30, sub: '15% · 106.5分' }
];

function exStageMinutes(stageIdx, level) {
    if (stageIdx === 1) return level === 'cet4' ? 25 : 30;
    return EX_STAGES[stageIdx].minutes;
}

// ---------- 配置区 ----------
function renderExamSetOptions() {
    const sel = document.getElementById('examPaperSet');
    const level = document.getElementById('examLevel').value;
    if (!sel || typeof examPapers === 'undefined') return;
    const sets = examPapers.filter(p => p.level === level && p.year === '2024年6月');
    sel.innerHTML = sets.map(p => {
        const can = !!p.listening;
        return `<option value="${p.set}" ${can ? '' : 'disabled'}>第 ${p.set} 套${can ? '' : '（听力官方复用另卷，不能模考）'}</option>`;
    }).join('');
}

// 覆盖 app.js 的 resetExam：考试进行中切回本页时恢复考场，而不是清空
function resetExam() {
    if (ex && ex.inProgress) {
        renderExamStage();
        return;
    }
    ex = null;
    if (typeof renderExamSetOptions === 'function') renderExamSetOptions();
    document.getElementById('examContainer').innerHTML = `
        <div class="part-note" style="background:#eef2ff;border-color:#c7d2fe;color:var(--primary-dark);">
            📋 <b>考试说明</b><br>
            1. 共四个阶段，按真实顺序进行：<b>写作 30 分钟 → 听力（四级25/六级30分钟，录音只播一遍）→ 阅读 40 分钟 → 翻译 30 分钟</b>。<br>
            2. 每个阶段只能看到该阶段的试题，时间到自动进入下一阶段，不能返回。<br>
            3. 交卷后客观题（听力+阅读）自动判分，写作和翻译对照范文自评，给出 710 分制预估总分。<br>
            4. 考试期间请不要切换或刷新页面；建议戴好耳机，关闭其他声音。
        </div>`;
    document.getElementById('examResult').innerHTML = '';
    document.getElementById('examStageBar').innerHTML = '';
    document.getElementById('examConfig').style.display = 'flex';
    document.getElementById('examTimer').style.display = 'none';
    document.getElementById('startExamBtn').style.display = '';
    document.getElementById('submitExamBtn').style.display = 'none';
}

// ---------- 开始考试 ----------
function startExam() {
    const level = document.getElementById('examLevel').value;
    const setNo = parseInt(document.getElementById('examPaperSet').value, 10);
    const paper = examPapers.find(p => p.level === level && p.year === '2024年6月' && p.set === setNo);
    if (!paper || !paper.listening) { showToast('请选择第 1 套或第 2 套试卷（含完整听力）'); return; }

    const totalMin = level === 'cet4' ? 125 : 130;
    if (!confirm(`即将开始 ${level === 'cet4' ? '四级' : '六级'}全真模拟（第${setNo}套，共${totalMin}分钟）。\n\n请确认：\n• 已戴好耳机、周围安静\n• 考试中途不要刷新页面\n\n现在开始吗？`)) return;

    stopExamSpeak();
    ex = {
        paper, level, inProgress: true, stage: 0,
        stageRemaining: 30 * 60,
        totalRemaining: totalMin * 60,
        answers: {}, writing: '', trans: '',
        listeningPlayed: false, listeningFinished: false,
        submitted: false, speakTimers: []
    };
    document.getElementById('examConfig').style.display = 'none';
    document.getElementById('examTimer').style.display = '';
    document.getElementById('startExamBtn').style.display = 'none';
    document.getElementById('submitExamBtn').style.display = '';
    document.getElementById('examResult').innerHTML = '';
    renderExamStage();
    if (ex.interval) clearInterval(ex.interval);
    ex.interval = setInterval(examTick, 1000);
}

function examTick() {
    if (!ex || !ex.inProgress) return;
    ex.totalRemaining--;
    ex.stageRemaining--;
    updateExamClock();
    const stageTimerEl = document.getElementById('examStageTimer');
    if (stageTimerEl) stageTimerEl.textContent = fmtTime(ex.stageRemaining);
    if (ex.stageRemaining <= 300 && stageTimerEl) stageTimerEl.classList.add('urgent');
    if (ex.totalRemaining <= 0) { submitExam(true); return; }
    if (ex.stageRemaining <= 0) advanceStage(true);
}

function fmtTime(sec) {
    sec = Math.max(0, sec);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateExamClock() {
    document.getElementById('examTime').textContent = fmtTime(ex.totalRemaining);
}

// ---------- 阶段切换 ----------
function advanceStage(auto) {
    if (ex.stage >= 3) { submitExam(true); return; }
    if (!auto) {
        const names = ['写作', '听力', '阅读'];
        if (!confirm(`确定现在结束「${names[ex.stage]}」进入下一阶段吗？\n进入后将不能返回本阶段。`)) return;
    } else {
        showToast('本阶段时间到，自动进入下一阶段');
    }
    stopExamSpeak();
    ex.stage++;
    ex.stageRemaining = exStageMinutes(ex.stage, ex.level) * 60;
    renderExamStage();
}

function renderStageBar() {
    const bar = document.getElementById('examStageBar');
    bar.innerHTML = EX_STAGES.map((s, i) => {
        const cls = i === ex.stage ? 'active' : (i < ex.stage ? 'done' : '');
        const mins = exStageMinutes(i, ex.level);
        const mark = i < ex.stage ? '✅ ' : '';
        return `<div class="exam-stage-chip ${cls}">${mark}${s.name}<div class="exam-stage-time">${mins}分钟 · ${s.sub}</div></div>`;
    }).join('');
}

function renderExamStage() {
    if (!ex) { resetExam(); return; }
    renderStageBar();
    updateExamClock();
    const box = document.getElementById('examContainer');
    const mins = exStageMinutes(ex.stage, ex.level);
    const heads = {
        0: '✍️ Part I 写作（30分钟）',
        1: '🎧 Part II 听力理解（录音只播放一遍）',
        2: '📖 Part III 阅读理解（40分钟）',
        3: '🌐 Part IV 翻译（30分钟）'
    };
    let body = '';
    if (ex.stage === 0) body = renderStageWriting();
    else if (ex.stage === 1) body = renderStageListening();
    else if (ex.stage === 2) body = renderStageReading();
    else body = renderStageTranslation();

    box.innerHTML = `
        <div class="exam-stage-box">
            <div class="exam-stage-head">
                <h3 style="color:var(--primary-dark);">${heads[ex.stage]}</h3>
                <span>本阶段剩余 <span class="exam-stage-timer" id="examStageTimer">${fmtTime(ex.stageRemaining)}</span></span>
            </div>
            ${body}
        </div>`;
    const st = document.getElementById('examStageTimer');
    if (st && ex.stageRemaining <= 300) st.classList.add('urgent');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- 阶段1：写作 ----------
function renderStageWriting() {
    const w = ex.paper.writing;
    return `
        <div class="exam-warn">⏰ 现在只能看到写作题。30 分钟内完成作文，建议先花 2-3 分钟列提纲。考试开始后不得提前翻看其他部分（本模拟允许你提前进入下一阶段，但不能返回）。</div>
        <div class="part-directions">
            <b>Directions:</b>
            <div class="en-text" style="margin-top:6px;">${esc(w.prompt)}</div>
        </div>
        <textarea class="paper-textarea" style="min-height:260px;" placeholder="Write your essay here..."
            oninput="ex.writing=this.value">${esc(ex.writing)}</textarea>
        <div class="exam-nav-btns">
            <span style="color:var(--text-light);font-size:13px;">作文会在交卷后与参考范文对照自评</span>
            <button class="btn btn-primary" onclick="advanceStage(false)">写完了，进入听力 →</button>
        </div>`;
}

// ---------- 阶段2：听力 ----------
function renderStageListening() {
    const L = ex.paper.listening;
    let ctrl;
    if (!ex.listeningPlayed) {
        ctrl = `
            <div class="exam-warn">🔊 点击下方按钮后开始播放听力。<b>录音只播放一遍</b>，与真实考试一致，请边听边在题目上选答案。播放期间本按钮消失，不能重播。</div>
            <div class="exam-listen-controls">
                <button class="btn btn-primary btn-lg" onclick="startExamListening()">🎧 开始播放听力（只此一遍）</button>
            </div>`;
    } else if (!ex.listeningFinished) {
        ctrl = `<div class="exam-warn">🎧 听力正在播放中，请集中注意力作答……<br><button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="abandonListening()">⏹️ 停止播放（视为放弃剩余录音）</button></div>`;
    } else {
        ctrl = `<div class="exam-warn" style="background:#d1fae5;border-color:#6ee7b7;color:#047857;">✅ 听力播放完毕。请快速检查答题卡，等待进入阅读阶段（也可提前进入）。</div>
        <div class="exam-listen-controls"><button class="btn btn-primary" onclick="advanceStage(false)">听力结束，进入阅读 →</button></div>`;
    }
    const qsHtml = L.groups.map(g => {
        let qs = '';
        for (let n = g.from; n <= g.to; n++) qs += renderExamChoiceQ(n, L.questions[String(n)], false);
        return `<div class="listen-group" id="ex-group-${g.from}">
            <div class="listen-group-head"><b>${esc(g.title)}</b>（第 ${g.from}-${g.to} 题）</div>
            <div class="listen-questions">${qs}</div>
        </div>`;
    }).join('');
    return ctrl + `<div style="margin-bottom:10px;color:var(--text-light);font-size:14px;">听力题（播放前可先快速浏览选项）：</div>` + qsHtml;
}

function startExamListening() {
    ex.listeningPlayed = true;
    const L = ex.paper.listening;
    const items = [];
    L.groups.forEach((g, gi) => {
        items.push({ text: g.script, pauseAfter: 2, groupFrom: g.from });
        for (let n = g.from; n <= g.to; n++) {
            const q = L.questions[String(n)];
            if (q && q.stem && !q.zhStem && !q.ocrMissing) {
                items.push({ text: 'Question ' + n + '. ' + q.stem, pauseAfter: 13 });
            } else {
                items.push({ text: 'Question ' + n + '.', pauseAfter: 13 });
            }
        }
    });
    examSpeakSequence(items, () => {
        ex.listeningFinished = true;
        if (ex.stage === 1 && ex.inProgress) renderExamStage();
    });
    renderExamStage();
    showToast('听力开始播放，请边听边作答');
}

function abandonListening() {
    if (!confirm('确定停止播放吗？剩余录音将不能再听。')) return;
    stopExamSpeak();
    ex.listeningFinished = true;
    renderExamStage();
}

// ---------- 阶段3：阅读 ----------
function renderStageReading() {
    const p = ex.paper;
    const c = p.cloze;
    const bankLetters = Object.keys(c.bank).sort();
    const parts = c.text.split(/\{(\d+)\}/g);
    let textHtml = '';
    parts.forEach((seg, i) => {
        if (i % 2 === 0) textHtml += esc(seg);
        else {
            const n = parseInt(seg, 10);
            const chosen = ex.answers[String(n)] || '';
            textHtml += `<span class="blank-wrap"><select class="blank-select" onchange="exBlank(${n},this.value)">
                <option value=""> </option>
                ${bankLetters.map(l => `<option value="${l}" ${chosen === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select></span>`;
        }
    });

    const m = p.matching;
    const paraLetters = Object.keys(m.paragraphs).sort();

    const sectionA = `
        <h4 class="section-title">Section A 选词填空（第26-35题）</h4>
        <div class="word-bank"><div class="word-bank-title">词库：</div>
            <div class="word-bank-list">${bankLetters.map(l => `<span class="bank-word">${l}. ${esc(c.bank[l])}</span>`).join('')}</div>
        </div>
        <div class="passage-text">${textHtml}</div>`;

    const sectionB = `
        <h4 class="section-title">Section B 长篇阅读匹配（第36-45题）</h4>
        <details class="para-box" open>
            <summary class="para-summary">📄 文章段落（共 ${paraLetters.length} 段）</summary>
            ${paraLetters.map(l => `<p class="para-p"><b>[${l}]</b> ${esc(m.paragraphs[l])}</p>`).join('')}
        </details>
        <div class="match-list">
            ${Object.keys(m.statements).sort((a, b) => a - b).map(n => {
                const nn = parseInt(n, 10);
                const chosen = ex.answers[String(nn)] || '';
                return `<div class="match-q">
                    <div class="match-q-body"><b>${nn}.</b> ${esc(m.statements[n])}</div>
                    <div class="match-q-answer"><select class="match-select" onchange="exMatch(${nn},this.value)">
                        <option value="">选择段落</option>
                        ${paraLetters.map(l => `<option value="${l}" ${chosen === l ? 'selected' : ''}>${l}</option>`).join('')}
                    </select></div>
                </div>`;
            }).join('')}
        </div>`;

    const sectionC = p.careful.map(pas => `
        <h4 class="section-title">Section C 仔细阅读（第${pas.questions[0].n}-${pas.questions[pas.questions.length - 1].n}题）</h4>
        <div class="passage-text">${esc(pas.text)}</div>
        <div class="careful-list">
            ${pas.questions.map(q => renderExamChoiceQ(q.n, q, true)).join('')}
        </div>`).join('');

    return `
        <div class="exam-warn">⏰ 阅读 40 分钟。建议时间分配：选词填空 7 分钟、长篇匹配 15 分钟、仔细阅读 18 分钟。</div>
        ${sectionA}${sectionB}${sectionC}
        <div class="exam-nav-btns">
            <span style="color:var(--text-light);font-size:13px;">已答客观题 ${Object.keys(ex.answers).length}/55</span>
            <button class="btn btn-primary" onclick="advanceStage(false)">阅读完成，进入翻译 →</button>
        </div>`;
}

// ---------- 阶段4：翻译 ----------
function renderStageTranslation() {
    return `
        <div class="exam-warn">⏰ 最后 30 分钟，完成翻译。注意书写工整、句子完整。</div>
        <div class="part-directions cn-text">
            <b>Directions:</b> 请将下面这段中文译成英语。
            <div style="margin-top:8px;">${esc(ex.paper.translation.prompt)}</div>
        </div>
        <textarea class="paper-textarea" style="min-height:260px;" placeholder="Write your translation here..."
            oninput="ex.trans=this.value">${esc(ex.trans)}</textarea>
        <div class="exam-nav-btns">
            <span style="color:var(--text-light);font-size:13px;">时间到会自动交卷</span>
            <button class="btn btn-danger btn-lg" onclick="submitExam(false)">✅ 交卷</button>
        </div>`;
}

// ---------- 考试中作答 ----------
function renderExamChoiceQ(n, q, isCareful) {
    const chosen = ex.answers[String(n)] || '';
    const letters = ['A', 'B', 'C', 'D'];
    const stem = (!q.stem || q.ocrMissing)
        ? `<span class="stem-missing">${isCareful ? '' : '（听力问题文字缺失，凭录音选择）'}</span>`
        : (q.zhStem ? esc(q.stem) + ' <span class="stem-zh-tag">中文题</span>' : esc(q.stem));
    return `<div class="objective-q" id="ex-q-${n}">
        <div class="q-stem"><b>${n}.</b> ${stem}</div>
        <div class="options-list">
            ${q.options.map((opt, i) => `
                <div class="option-item ${chosen === letters[i] ? 'option-selected-ex' : ''}" onclick="exAnswer(${n},'${letters[i]}')">${letters[i]}. ${esc(opt)}</div>`).join('')}
        </div>
    </div>`;
}

function exAnswer(n, letter) {
    if (!ex.inProgress) return;
    ex.answers[String(n)] = letter;
    const el = document.getElementById('ex-q-' + n);
    if (el) el.querySelectorAll('.option-item').forEach((d, i) => {
        d.classList.toggle('option-selected-ex', ['A', 'B', 'C', 'D'][i] === letter);
    });
}
function exBlank(n, v) {
    if (v) ex.answers[String(n)] = v; else delete ex.answers[String(n)];
}
function exMatch(n, v) {
    if (v) ex.answers[String(n)] = v; else delete ex.answers[String(n)];
}

// ---------- 听力朗读（只播一遍） ----------
function examSpeakSequence(items, onDone) {
    stopExamSpeak();
    if (!('speechSynthesis' in window)) {
        showToast('当前浏览器不支持语音朗读，请使用 Edge 或 Chrome');
        ex.listeningFinished = true;
        onDone && onDone();
        return;
    }
    let i = 0;
    function step() {
        if (!ex || ex.stage !== 1 || !ex.inProgress) return;
        if (i >= items.length) { onDone && onDone(); return; }
        const it = items[i++];
        if (it.groupFrom) {
            const gel = document.getElementById('ex-group-' + it.groupFrom);
            if (gel) gel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const u = new SpeechSynthesisUtterance(it.text);
        u.lang = 'en-US';
        u.rate = 0.95;
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        if (enVoice) u.voice = enVoice;
        u.onend = () => {
            if (it.pauseAfter) {
                const t = setTimeout(step, it.pauseAfter * 1000);
                ex.speakTimers.push(t);
            } else step();
        };
        u.onerror = () => step();
        window.speechSynthesis.speak(u);
    }
    step();
}
function stopExamSpeak() {
    if (ex) {
        ex.speakTimers.forEach(t => clearTimeout(t));
        ex.speakTimers = [];
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ---------- 交卷与报告 ----------
function submitExam(autoFlag) {
    if (!ex || ex.submitted) return;
    if (!autoFlag && !confirm('确定交卷吗？交卷后不能再修改答案。')) return;
    ex.submitted = true;
    ex.inProgress = false;
    stopExamSpeak();
    if (ex.interval) { clearInterval(ex.interval); ex.interval = null; }
    document.getElementById('submitExamBtn').style.display = 'none';
    document.getElementById('examTimer').style.display = 'none';
    renderExamReport();
}

function examCorrectAnswer(n) {
    const p = ex.paper;
    n = String(n);
    if (p.listening.questions[n]) return p.listening.questions[n].answer;
    if (p.cloze.answers[n]) return p.cloze.answers[n];
    if (p.matching.answers[n]) return p.matching.answers[n];
    for (const pas of p.careful) {
        const q = pas.questions.find(x => String(x.n) === n);
        if (q) return q.answer;
    }
    return null;
}

function renderExamReport() {
    const p = ex.paper;
    const groups = [
        { name: '听力理解', ns: Array.from({ length: 25 }, (_, i) => i + 1), per: 248.5 / 25, max: 248.5 },
        { name: '选词填空', ns: Array.from({ length: 10 }, (_, i) => i + 26), per: 3.55, max: 35.5 },
        { name: '长篇匹配', ns: Array.from({ length: 10 }, (_, i) => i + 36), per: 7.1, max: 71 },
        { name: '仔细阅读', ns: Array.from({ length: 10 }, (_, i) => i + 46), per: 14.2, max: 142 }
    ];
    let objScore = 0, totalRight = 0, totalAnswered = 0;
    const stats = groups.map(g => {
        let right = 0, answered = 0;
        g.ns.forEach(n => {
            const chosen = ex.answers[String(n)];
            if (chosen) {
                answered++;
                if (chosen === examCorrectAnswer(n)) { right++; objScore += g.per; }
            }
        });
        totalRight += right; totalAnswered += answered;
        return { ...g, right, answered, score: right * g.per };
    });
    const readingScore = stats[1].score + stats[2].score + stats[3].score;

    // 回顾明细
    const review = groups.map(g => {
        const items = g.ns.map(n => {
            const q = findQ(p, n);
            const chosen = ex.answers[String(n)];
            const correct = examCorrectAnswer(n);
            const cls = !chosen ? 'exam-report-q' : (chosen === correct ? 'exam-report-q right' : 'exam-report-q wrong');
            return `<div class="${cls}"><b>${n}.</b> 你的答案：${chosen || '未答'} ｜ 正确：${correct}
                <div style="color:var(--text-light);">${q && q.stem ? esc(q.stem).slice(0, 90) : ''}${q && q.stem && q.stem.length > 90 ? '…' : ''}</div></div>`;
        }).join('');
        return `<details class="exam-report-section"><summary style="cursor:pointer;font-weight:600;color:var(--primary-dark);">${g.name}（答对 ${g.ns.filter(n => ex.answers[String(n)] === examCorrectAnswer(n)).length}/${g.ns.length}）</summary>${items}</details>`;
    }).join('');

    const levelName = ex.level === 'cet4' ? '四级' : '六级';
    document.getElementById('examStageBar').innerHTML = '';
    document.getElementById('examContainer').innerHTML = '';
    document.getElementById('examResult').innerHTML = `
        <div class="score-panel">
            <h3>📊 ${p.year}${levelName}第${p.set}套 · 模考成绩报告</h3>
            <table class="score-table">
                <tr><th>部分</th><th>作答</th><th>答对</th><th>得分</th><th>满分</th></tr>
                <tr><td>🎧 听力理解</td><td>${stats[0].answered}/25</td><td>${stats[0].right}</td><td><b>${stats[0].score.toFixed(1)}</b></td><td>248.5</td></tr>
                <tr><td>📖 阅读理解（选词+匹配+细读）</td><td>${stats[1].answered + stats[2].answered + stats[3].answered}/30</td>
                    <td>${stats[1].right + stats[2].right + stats[3].right}</td><td><b>${readingScore.toFixed(1)}</b></td><td>248.5</td></tr>
                <tr class="score-subtotal"><td>客观题合计</td><td>${totalAnswered}/55</td><td>${totalRight}</td><td><b>${objScore.toFixed(1)}</b></td><td>497.0</td></tr>
            </table>
            <div class="self-rate">
                <h4>✍️ 写作自评（对照下方参考范文，满分106.5）</h4>
                <div id="exRateWriting" class="rate-btns">
                    <button class="btn btn-outline" onclick="exSelfRate('w',0.9)">优秀 96分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('w',0.75)">良好 80分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('w',0.6)">及格 64分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('w',0.4)">需努力 43分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('w',0)">未作答 0分</button>
                </div>
                <h4 style="margin-top:14px;">🌐 翻译自评（对照下方参考译文，满分106.5）</h4>
                <div id="exRateTrans" class="rate-btns">
                    <button class="btn btn-outline" onclick="exSelfRate('t',0.9)">优秀 96分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('t',0.75)">良好 80分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('t',0.6)">及格 64分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('t',0.4)">需努力 43分</button>
                    <button class="btn btn-outline" onclick="exSelfRate('t',0)">未作答 0分</button>
                </div>
            </div>
            <div class="total-score" id="exTotalBox">
                客观题已得 <b>${objScore.toFixed(1)}</b> 分（满分497）。完成写作、翻译自评后显示预估总分（710分制，425分合格）。
            </div>
            ${review}
            <details class="exam-report-section">
                <summary style="cursor:pointer;font-weight:600;color:var(--primary-dark);">✍️ 我的写作 & 参考范文</summary>
                <div class="exam-warn" style="margin-top:10px;background:white;color:var(--text);"><b>我的作文：</b><div class="en-text">${esc(ex.writing) || '（未作答）'}</div></div>
                <div class="model-box"><b>📌 参考范文</b><div class="en-text" style="margin-top:6px;">${esc(p.writing.model)}</div></div>
            </details>
            <details class="exam-report-section">
                <summary style="cursor:pointer;font-weight:600;color:var(--primary-dark);">🌐 我的翻译 & 参考译文</summary>
                <div class="exam-warn" style="margin-top:10px;background:white;color:var(--text);"><b>我的译文：</b><div class="en-text">${esc(ex.trans) || '（未作答）'}</div></div>
                <div class="model-box"><b>📌 参考译文</b><div class="en-text" style="margin-top:6px;">${esc(p.translation.reference)}</div></div>
            </details>
            <div style="text-align:center;margin-top:18px;">
                <button class="btn btn-primary" onclick="resetExam()">🔄 再考一套</button>
            </div>
        </div>`;
    document.getElementById('examResult').dataset.objscore = objScore.toFixed(2);

    // 保存考试记录（自评后更新分数）
    ex.recordScore = null;
    if (currentUserId) {
        const records = loadData('examRecords', []);
        const rec = {
            date: new Date().toLocaleString('zh-CN'),
            level: ex.level, paper: p.id,
            objScore: Math.round(objScore),
            score: Math.round(objScore),
            total: 55, correct: totalRight,
            selfRated: false
        };
        records.push(rec);
        saveData('examRecords', records);
        ex.recordScore = rec;
    }
    document.getElementById('examResult').scrollIntoView({ behavior: 'smooth' });
}

function findQ(p, n) {
    n = String(n);
    if (p.listening.questions[n]) return p.listening.questions[n];
    if (p.cloze.answers[n]) return { stem: '选词填空' };
    if (p.matching.answers[n]) return { stem: p.matching.statements[n] };
    for (const pas of p.careful) {
        const q = pas.questions.find(x => String(x.n) === n);
        if (q) return q;
    }
    return null;
}

function exSelfRate(kind, ratio) {
    const box = document.getElementById(kind === 'w' ? 'exRateWriting' : 'exRateTrans');
    const ratios = [0.9, 0.75, 0.6, 0.4, 0];
    box.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('btn-primary', ratios[i] === ratio);
        b.classList.toggle('btn-outline', ratios[i] !== ratio);
    });
    const panel = document.getElementById('examResult');
    if (kind === 'w') panel.dataset.wratio = ratio; else panel.dataset.tratio = ratio;
    const w = panel.dataset.wratio !== undefined ? parseFloat(panel.dataset.wratio) : null;
    const t = panel.dataset.tratio !== undefined ? parseFloat(panel.dataset.tratio) : null;
    const obj = parseFloat(panel.dataset.objscore || '0');
    const totalBox = document.getElementById('exTotalBox');
    if (w === null || t === null) {
        totalBox.innerHTML = `客观题已得 <b>${obj.toFixed(1)}</b> 分，请继续完成自评`;
        return;
    }
    const total = obj + w * 106.5 + t * 106.5;
    const passed = total >= 425;
    totalBox.className = 'total-score ' + (passed ? 'pass' : 'fail');
    totalBox.innerHTML = `
        <div class="total-num">${total.toFixed(1)}</div>
        <div>${passed ? '🎉 预估成绩达到 425 分合格线！' : '💪 预估暂未达到 425 分，继续加油！'}</div>
        <div class="total-detail">客观题 ${obj.toFixed(1)} + 写作 ${(w * 106.5).toFixed(1)} + 翻译 ${(t * 106.5).toFixed(1)}（满分710）</div>`;
    if (currentUserId && ex.recordScore) {
        ex.recordScore.score = Math.round(total);
        ex.recordScore.selfRated = true;
        const records = loadData('examRecords', []);
        const idx = records.lastIndexOf(ex.recordScore);
        if (idx >= 0) { records[idx] = ex.recordScore; saveData('examRecords', records); }
    }
}

function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 页面首次加载：填充套卷下拉（renderExamSetOptions 也会在 resetExam 中调用）
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('examPaperSet')) renderExamSetOptions();
});
