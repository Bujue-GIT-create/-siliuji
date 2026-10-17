/* ============================================================
 * 真题套卷练习页（按真实试卷结构：写作→听力→阅读→翻译）
 * 数据来源：papers.js 的 examPapers
 * ============================================================ */

let paperState = null;
// { paper, answers: {题号: 字母}, revealed: {part: bool},
//   writingDraft, transDraft, scored: bool, speakTimer: [] }

const PAPER_PARTS = [
    { id: 'writing',   icon: '✍️', name: 'Part I 写作' },
    { id: 'listening', icon: '🎧', name: 'Part II 听力' },
    { id: 'reading',   icon: '📖', name: 'Part III 阅读' },
    { id: 'translation', icon: '🌐', name: 'Part IV 翻译' }
];

// ---------- 选择器 ----------
// 覆盖 app.js 中旧版"随机抽题"的同名函数：真题页现在按整套卷组织
function loadQuizQuestions() {
    if (paperState) renderPaper();
    else renderPaperPicker();
}

function renderPaperPicker() {
    const levelEl = document.getElementById('paperLevel');
    const yearEl = document.getElementById('paperYear');
    const setEl = document.getElementById('paperSet');
    if (!levelEl || typeof examPapers === 'undefined') return;

    const level = levelEl.value;

    // 优质题库模式
    if (level === 'quality') {
        yearEl.style.display = 'none';
        setEl.style.display = 'none';
        yearEl.previousElementSibling.style.display = 'none'; // 考期 label
        setEl.previousElementSibling.style.display = 'none'; // 套卷 label
        const box = document.getElementById('quizContainer');
        if (box) renderQualityHome();
        return;
    }
    yearEl.style.display = '';
    setEl.style.display = '';
    if (yearEl.previousElementSibling) yearEl.previousElementSibling.style.display = '';
    if (setEl.previousElementSibling) setEl.previousElementSibling.style.display = '';

    const years = [...new Set(examPapers.filter(p => p.level === level).map(p => p.year))];
    const curYear = yearEl.value && years.includes(yearEl.value) ? yearEl.value : years[0];
    yearEl.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearEl.value = curYear;

    const sets = examPapers.filter(p => p.level === level && p.year === curYear);
    setEl.innerHTML = sets.map(p => {
        const noLis = p.listening ? '' : '（听力同场复用另卷）';
        return `<option value="${p.set}">第 ${p.set} 套${noLis}</option>`;
    }).join('');

    // 未打开卷子时，容器显示套卷卡片
    const box = document.getElementById('quizContainer');
    if (box) renderPaperHome();
}

// ---------- 优质题库 ----------
let qualityState = null;
function renderQualityHome() {
    const box = document.getElementById('quizContainer');
    const all = getQualityBank();
    const types = [...new Set(all.map(q => q.type))];
    const typeNames = {
        vocabulary: '词汇语法', grammar: '语法', reading: '阅读理解',
        cloze: '选词填空', matching: '长篇匹配', listening: '听力',
        writing: '写作', translation: '翻译', common: '综合'
    };
    box.innerHTML = `
        <div class="paper-home-tip">
            <h3>优质题库 · 随机练习</h3>
            <p>从精选题库中随机抽题练习，覆盖词汇、语法、阅读等题型。每题做完即判对错并显示解析。</p>
            <p style="color:var(--text-light);font-size:13px;">题库来源：公共英语学习资料整理，仅供个人学习使用。</p>
        </div>
        <div class="paper-cards">
            <div class="paper-card" onclick="startQuality('all')">
                <div class="paper-card-title">全部题型</div>
                <div class="paper-card-meta">共 ${all.length} 题 · 随机抽取</div>
                <div class="paper-card-btn">开始练习 →</div>
            </div>
            ${types.map(t => {
                const cnt = all.filter(q => q.type === t).length;
                return `<div class="paper-card" onclick="startQuality('${t}')">
                    <div class="paper-card-title">${typeNames[t] || t}</div>
                    <div class="paper-card-meta">${cnt} 题</div>
                    <div class="paper-card-btn">开始练习 →</div>
                </div>`;
            }).join('')}
        </div>`;
    document.getElementById('quizProgress').textContent = `共 ${all.length} 道优质题`;
}

function getQualityBank() {
    // 合并现有题库：commonQuestions + cet4Questions，仅保留选择题
    const bank = [];
    const all = [];
    if (typeof commonQuestions !== 'undefined') all.push(...commonQuestions);
    if (typeof cet4Questions !== 'undefined') all.push(...cet4Questions);
    for (const q of all) {
        if (q.options && q.options.length >= 2 && typeof q.answer === 'number') {
            bank.push(q);
        }
    }
    return bank;
}

function startQuality(type) {
    const all = getQualityBank();
    let pool = type === 'all' ? all : all.filter(q => q.type === type);
    if (pool.length === 0) pool = all;
    // 随机打乱
    pool = [...pool].sort(() => Math.random() - 0.5);
    qualityState = {
        pool, index: 0, correct: 0, total: pool.length,
        answers: {}
    };
    renderQualityQuestion();
}

function renderQualityQuestion() {
    const box = document.getElementById('quizContainer');
    const s = qualityState;
    if (!s || s.index >= s.pool.length) {
        // 完成
        const pct = s.total ? Math.round(s.correct / s.total * 100) : 0;
        box.innerHTML = `
            <div class="paper-home-tip">
                <h3>练习完成！</h3>
                <p style="font-size:24px;margin:16px 0;">正确率：${s.correct} / ${s.total} （${pct}%）</p>
                <button class="btn btn-primary" onclick="renderQualityHome()">返回题库</button>
            </div>`;
        document.getElementById('quizProgress').textContent = `完成 ${s.total} 题`;
        return;
    }
    const q = s.pool[s.index];
    const answered = s.answers[s.index] !== undefined;
    const userAns = s.answers[s.index];
    const correct = userAns === q.answer;
    const opts = q.options.map((o, i) => {
        let cls = '';
        if (answered) {
            if (i === q.answer) cls = 'q-opt-correct';
            else if (i === userAns) cls = 'q-opt-wrong';
        }
        return `<div class="q-opt ${cls}" onclick="${answered ? '' : `answerQuality(${i})`}">${String.fromCharCode(65+i)}. ${o}</div>`;
    }).join('');
    const analysis = answered ? `<div class="q-analysis"><strong>解析：</strong>${q.analysis || '暂无解析'}</div>` : '';
    box.innerHTML = `
        <div class="q-paper">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span class="q-tag">第 ${s.index+1} / ${s.total} 题</span>
                <span style="color:var(--text-light);font-size:13px;">已答对 ${s.correct} 题</span>
            </div>
            <div class="q-stem">${q.question}</div>
            <div class="q-options">${opts}</div>
            ${analysis}
            <div style="margin-top:16px;display:flex;gap:10px;">
                <button class="btn btn-outline" onclick="renderQualityHome()">退出</button>
                ${answered ? `<button class="btn btn-primary" onclick="nextQuality()">下一题 →</button>` : ''}
            </div>
        </div>`;
    document.getElementById('quizProgress').textContent = `第 ${s.index+1}/${s.total} 题`;
}

function answerQuality(i) {
    const s = qualityState;
    if (!s || s.answers[s.index] !== undefined) return;
    s.answers[s.index] = i;
    if (i === s.pool[s.index].answer) s.correct++;
    renderQualityQuestion();
}

function nextQuality() {
    qualityState.index++;
    renderQualityQuestion();
}

function renderPaperHome() {
    const level = document.getElementById('paperLevel').value;
    const year = document.getElementById('paperYear').value;
    const sets = examPapers.filter(p => p.level === level && p.year === year);
    const box = document.getElementById('quizContainer');
    const levelName = level === 'cet4' ? '四级' : '六级';
    box.innerHTML = `
        <div class="paper-home-tip">
            <h3>${year}${levelName}真题 · 共 ${sets.length} 套</h3>
            <p>每套卷包含：写作、听力（第3套听力官方复用同场另卷）、选词填空、长篇匹配、仔细阅读、翻译，共 55 道客观题 + 写作翻译。</p>
            <p style="color:var(--danger);font-size:13px;">⚠️ 真题著作权归考试主办方及出版方所有，本平台仅供你个人本地学习使用，请勿传播或商用。</p>
        </div>
        <div class="paper-cards">
            ${sets.map(p => `
                <div class="paper-card" onclick="openPaper(${p.set})">
                    <div class="paper-card-title">${year} ${levelName} 第 ${p.set} 套</div>
                    <div class="paper-card-meta">✍️ 写作 · 🎧 ${p.listening ? '听力25题' : '听力另卷'} · 📖 阅读30题 · 🌐 翻译</div>
                    <div class="paper-card-btn">打开试卷 →</div>
                </div>`).join('')}
        </div>`;
    document.getElementById('quizProgress').textContent = '';
}

function openPaper(setNo) {
    const level = document.getElementById('paperLevel').value;
    const year = document.getElementById('paperYear').value;
    const setVal = setNo || parseInt(document.getElementById('paperSet').value, 10);
    const paper = examPapers.find(p => p.level === level && p.year === year && p.set === setVal);
    if (!paper) return;
    stopPaperSpeak();
    paperState = {
        paper,
        answers: {},
        writingDraft: '',
        transDraft: '',
        shown: { writing: false, translation: false, scripts: {} },
        scored: false
    };
    loadPaperDraft();
    renderPaper();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- 草稿（刷新不丢） ----------
function paperDraftKey() {
    return 'paperDraft_' + paperState.paper.id;
}
function savePaperDraft() {
    if (!currentUserId || !paperState) return;
    saveData(paperDraftKey(), {
        answers: paperState.answers,
        writingDraft: paperState.writingDraft,
        transDraft: paperState.transDraft
    });
}
function loadPaperDraft() {
    if (!currentUserId) return;
    const d = loadData(paperDraftKey(), null);
    if (d) {
        paperState.answers = d.answers || {};
        paperState.writingDraft = d.writingDraft || '';
        paperState.transDraft = d.transDraft || '';
    }
}
function clearPaperDraft() {
    if (currentUserId) saveData(paperDraftKey(), null);
}

// ---------- 整卷渲染 ----------
function renderPaper() {
    const p = paperState.paper;
    const levelName = p.level === 'cet4' ? '四级 CET-4' : '六级 CET-6';
    const box = document.getElementById('quizContainer');
    box.innerHTML = `
        <div class="paper-anchor-bar">
            <button class="btn btn-outline" onclick="backToPaperHome()">← 返回选卷</button>
            <span class="paper-title-sm">${p.year} ${levelName} 第 ${p.set} 套</span>
            ${PAPER_PARTS.map(pt => `<a class="paper-anchor" href="#paper-part-${pt.id}">${pt.icon} ${pt.name.replace(/^Part [IV]+ /, '')}</a>`).join('')}
            <button class="btn btn-accent" onclick="scorePaper()">📊 交卷评分</button>
        </div>
        <div id="paper-part-writing">${renderWriting()}</div>
        <div id="paper-part-listening">${renderListening()}</div>
        <div id="paper-part-reading">${renderReading()}</div>
        <div id="paper-part-translation">${renderTranslation()}</div>
        <div class="paper-score-bar">
            <button class="btn btn-primary btn-lg" onclick="scorePaper()">📊 交卷评分（客观题自动判分）</button>
            <button class="btn btn-outline" onclick="resetPaperAnswers()">🔄 清空本套作答</button>
        </div>
        <div id="paperScorePanel"></div>`;
    updatePaperProgress();
}

function backToPaperHome() {
    stopPaperSpeak();
    paperState = null;
    renderPaperHome();
}

// ---------- Part I 写作 ----------
function renderWriting() {
    const w = paperState.paper.writing;
    const shown = paperState.shown.writing;
    return `
    <div class="part-block">
        <h3 class="part-title">✍️ Part I Writing（写作 · 30分钟 · 满分106.5分，占15%）</h3>
        <div class="part-directions">
            <div class="directions-head">
                <span>题目要求</span>
                <button class="btn btn-outline btn-sm" onclick="paperReadAloud('writing-prompt')">🔊 朗读题目</button>
            </div>
            <div id="writing-prompt" class="en-text">${escapeHtml(w.prompt)}</div>
        </div>
        <textarea id="writingInput" class="paper-textarea" placeholder="在这里写你的作文（建议120-180词）……"
            oninput="paperState.writingDraft=this.value;savePaperDraft()">${escapeHtml(paperState.writingDraft)}</textarea>
        <div style="margin-top:10px;">
            <button class="btn btn-outline" onclick="toggleModelEssay()">${shown ? '🙈 收起参考范文' : '👀 查看参考范文（写完再看哦）'}</button>
        </div>
        ${shown ? `
        <div class="model-box">
            <div class="model-head">
                <b>📌 参考范文</b>
                <button class="btn btn-outline btn-sm" onclick="paperReadAloud('writing-model')">🔊 朗读范文</button>
            </div>
            <div id="writing-model" class="en-text">${escapeHtml(w.model)}</div>
        </div>` : ''}
    </div>`;
}

function toggleModelEssay() {
    paperState.shown.writing = !paperState.shown.writing;
    document.getElementById('paper-part-writing').innerHTML = renderWriting();
    // 恢复已输入的草稿（重渲染会清空 textarea）
    const ta = document.getElementById('writingInput');
    if (ta) ta.value = paperState.writingDraft || '';
}

// ---------- Part II 听力 ----------
function renderListening() {
    const p = paperState.paper;
    let body;
    if (!p.listening) {
        body = `<div class="part-note">ℹ️ ${escapeHtml(p.listeningNote || '官方资料中本套听力复用同场其他套卷。')}<br><br>
        想听听力练习？请选择同一级别的<b>第 1 套或第 2 套</b>。阅读、写作和翻译部分在本套正常作答。</div>`;
    } else {
        const L = p.listening;
        body = `<p class="part-tip">🎧 练习模式：每组可以反复听。点击「连播：原文+问题」模拟考试听音顺序（原文后逐题朗读问题，问题间有停顿），也可单独播放原文、对照原文精听。</p>`;
        body += L.groups.map((g, gi) => {
            const qs = [];
            for (let n = g.from; n <= g.to; n++) qs.push(n);
            const scriptShown = paperState.shown.scripts[gi];
            return `
            <div class="listen-group">
                <div class="listen-group-head">
                    <b>${escapeHtml(g.title)}</b>（第 ${g.from}-${g.to} 题）
                    <span class="listen-btns">
                        <button class="btn btn-primary btn-sm" onclick="paperPlayGroup(${gi}, true)">▶️ 连播：原文+问题</button>
                        <button class="btn btn-outline btn-sm" onclick="paperPlayGroup(${gi}, false)">🔊 只听原文</button>
                        <button class="btn btn-outline btn-sm" onclick="toggleScript(${gi})">📖 ${scriptShown ? '收起原文' : '查看原文'}</button>
                    </span>
                </div>
                ${scriptShown ? `<div class="script-box en-text" id="listen-script-${gi}">${escapeHtml(g.script)}</div>` : ''}
                <div class="listen-questions">
                    ${qs.map(n => renderObjectiveQ('L', n, L.questions[String(n)])).join('')}
                </div>
            </div>`;
        }).join('') + `
        <div style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="stopPaperSpeak()">⏹️ 停止朗读</button></div>`;
        if (L.ocrMissingQuestions && L.ocrMissingQuestions.length) {
            body += `<p class="part-tip" style="color:var(--danger);">⚠️ 第 ${L.ocrMissingQuestions.join('、')} 题的问题文字因原资料跨页缺失，可凭选项听原文作答后对答案。</p>`;
        }
    }
    return `
    <div class="part-block">
        <h3 class="part-title">🎧 Part II Listening Comprehension（听力 · 满分248.5分，占35%）</h3>
        ${body}
    </div>`;
}

function toggleScript(gi) {
    paperState.shown.scripts[gi] = !paperState.shown.scripts[gi];
    document.getElementById('paper-part-listening').innerHTML = renderListening();
}

// ---------- Part III 阅读 ----------
function renderReading() {
    const p = paperState.paper;
    // Section A 选词填空
    const c = p.cloze;
    const bankLetters = Object.keys(c.bank).sort();
    const usedLetters = {};
    Object.keys(c.answers).forEach(n => {
        const chosen = paperState.answers[n];
        if (chosen) usedLetters[chosen] = (usedLetters[chosen] || 0) + 1;
    });
    const bankHtml = `<div class="word-bank">
        <div class="word-bank-title">词库（15选10，每词只用一次）：</div>
        <div class="word-bank-list">
            ${bankLetters.map(l => `<span class="bank-word ${usedLetters[l] ? 'used' : ''}" id="bankword-${l}">${l}. ${escapeHtml(c.bank[l])}</span>`).join('')}
        </div></div>`;

    // 文章中 {26} 替换为内联选择
    const parts = c.text.split(/\{(\d+)\}/g);
    let textHtml = '';
    parts.forEach((seg, i) => {
        if (i % 2 === 0) {
            textHtml += escapeHtml(seg);
        } else {
            textHtml += renderBlankSelect(parseInt(seg, 10), bankLetters);
        }
    });

    const sectionA = `
        <h4 class="section-title">Section A 选词填空（第26-35题，每题3.55分）</h4>
        ${bankHtml}
        <div class="passage-text">${textHtml}</div>`;

    // Section B 长篇匹配
    const m = p.matching;
    const paraLetters = Object.keys(m.paragraphs).sort();
    const sectionB = `
        <h4 class="section-title">Section B 长篇阅读匹配（第36-45题，每题7.1分）</h4>
        <details class="para-box" open>
            <summary class="para-summary">📄 文章段落（点击折叠/展开，共 ${paraLetters.length} 段）</summary>
            ${paraLetters.map(l => `<p class="para-p"><b>[${l}]</b> ${escapeHtml(m.paragraphs[l])}</p>`).join('')}
        </details>
        <div class="match-list">
            ${Object.keys(m.statements).sort((a, b) => a - b).map(n => renderMatchQ(parseInt(n, 10), m.statements[n], paraLetters)).join('')}
        </div>`;

    // Section C 仔细阅读
    const sectionC = p.careful.map((pas, pi) => `
        <h4 class="section-title">Section C 仔细阅读 ${pi + 1}（第${pas.questions[0].n}-${pas.questions[pas.questions.length - 1].n}题，每题14.2分）</h4>
        <div class="passage-text">${escapeHtml(pas.text)}</div>
        <div class="careful-list">
            ${pas.questions.map(q => renderObjectiveQ('C', q.n, q)).join('')}
        </div>`).join('');

    return `
    <div class="part-block">
        <h3 class="part-title">📖 Part III Reading Comprehension（阅读 · 40分钟 · 满分248.5分，占35%）</h3>
        ${sectionA}
        ${sectionB}
        ${sectionC}
    </div>`;
}

// 选词填空内联下拉
function renderBlankSelect(n, letters) {
    const chosen = paperState.answers[String(n)] || '';
    const correct = paperState.paper.cloze.answers[String(n)];
    let cls = '', tail = '';
    if (chosen) {
        if (chosen === correct) { cls = 'blank-correct'; tail = '<span class="mark-ok">✓</span>'; }
        else { cls = 'blank-wrong'; tail = `<span class="mark-no">✗ 应选 ${correct}</span>`; }
    }
    return `<span class="blank-wrap">
        <select class="blank-select ${cls}" onchange="answerBlank(${n}, this.value)">
            <option value=""> </option>
            ${letters.map(l => `<option value="${l}" ${chosen === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>${tail}</span>`;
}

function answerBlank(n, val) {
    if (val) paperState.answers[String(n)] = val;
    else delete paperState.answers[String(n)];
    savePaperDraft();
    // 局部刷新阅读部分（词库"已用"状态 + 判分）
    document.getElementById('paper-part-reading').innerHTML = renderReading();
    updatePaperProgress();
}

// 长篇匹配题
function renderMatchQ(n, statement, paraLetters) {
    const chosen = paperState.answers[String(n)] || '';
    const correct = paperState.paper.matching.answers[String(n)];
    let tail = '';
    if (chosen) {
        tail = chosen === correct
            ? '<span class="mark-ok">✓ 正确</span>'
            : `<span class="mark-no">✗ 应选 ${correct} 段</span>`;
    }
    const cls = chosen ? (chosen === correct ? 'match-select ok' : 'match-select no') : 'match-select';
    return `
    <div class="match-q">
        <div class="match-q-body">
            <b>${n}.</b> ${escapeHtml(statement)}
        </div>
        <div class="match-q-answer">
            <select class="${cls}" onchange="answerMatch(${n}, this.value)">
                <option value="">选择段落</option>
                ${paraLetters.map(l => `<option value="${l}" ${chosen === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            ${tail}
        </div>
    </div>`;
}

function answerMatch(n, val) {
    if (val) paperState.answers[String(n)] = val;
    else delete paperState.answers[String(n)];
    savePaperDraft();
    document.getElementById('paper-part-reading').innerHTML = renderReading();
    updatePaperProgress();
}

// 客观四选一（听力 / 仔细阅读通用）
function renderObjectiveQ(kind, n, q) {
    const chosen = paperState.answers[String(n)] || '';
    const letters = ['A', 'B', 'C', 'D'];
    let stemBlock;
    if (kind === 'L') {
        if (q.ocrMissing || !q.stem) {
            stemBlock = `<div class="q-stem"><b>${n}.</b> <span class="stem-missing">（问题文字缺失，请根据听到的内容选择）</span></div>`;
        } else if (q.zhStem) {
            stemBlock = `<div class="q-stem"><b>${n}.</b> ${escapeHtml(q.stem)} <span class="stem-zh-tag">中文题</span></div>`;
        } else {
            stemBlock = `<div class="q-stem"><b>${n}.</b> ${escapeHtml(q.stem)}</div>`;
        }
    } else {
        stemBlock = `<div class="q-stem"><b>${n}.</b> ${escapeHtml(q.stem)}</div>`;
    }
    const opts = q.options.map((opt, i) => {
        const l = letters[i];
        let cls = 'option-item';
        if (chosen) {
            if (l === q.answer) cls += ' correct';
            else if (l === chosen) cls += ' wrong';
            cls += ' disabled';
        }
        return `<div class="${cls}" onclick="answerObjective('${kind}', ${n}, '${l}')">${l}. ${escapeHtml(opt)}</div>`;
    }).join('');
    const result = chosen ? (chosen === q.answer
        ? '<div class="q-result ok">✓ 回答正确</div>'
        : `<div class="q-result no">✗ 正确答案：${q.answer}</div>`) : '';
    return `<div class="objective-q" id="q-${kind}-${n}">${stemBlock}<div class="options-list">${opts}</div>${result}</div>`;
}

function answerObjective(kind, n, letter) {
    if (paperState.answers[String(n)]) return; // 练习模式：答过即定，避免刷对
    paperState.answers[String(n)] = letter;
    savePaperDraft();
    const p = paperState.paper;
    if (kind === 'L') {
        const q = p.listening.questions[String(n)];
        document.getElementById(`q-L-${n}`).outerHTML = renderObjectiveQ('L', n, q);
    } else {
        // 仔细阅读：找到对应题
        for (const pas of p.careful) {
            const q = pas.questions.find(x => x.n === n);
            if (q) {
                document.getElementById(`q-C-${n}`).outerHTML = renderObjectiveQ('C', n, q);
                break;
            }
        }
    }
    updatePaperProgress();
    if (currentUserId) {
        const correctAns = getCorrectAnswer(p, n);
        const record = loadData('quizRecord', []);
        record.push({ type: 'paper', correct: letter === correctAns, date: new Date().toISOString() });
        saveData('quizRecord', record);
    }
}

// ---------- Part IV 翻译 ----------
function renderTranslation() {
    const t = paperState.paper.translation;
    const shown = paperState.shown.translation;
    return `
    <div class="part-block">
        <h3 class="part-title">🌐 Part IV Translation（翻译 · 30分钟 · 满分106.5分，占15%）</h3>
        <div class="part-directions cn-text">
            <div class="directions-head"><span>题目（请将下面这段中文译成英语）</span></div>
            <div>${escapeHtml(t.prompt)}</div>
        </div>
        <textarea id="transInput" class="paper-textarea" placeholder="在这里写你的英文译文……"
            oninput="paperState.transDraft=this.value;savePaperDraft()">${escapeHtml(paperState.transDraft)}</textarea>
        <div style="margin-top:10px;">
            <button class="btn btn-outline" onclick="toggleModelTrans()">${shown ? '🙈 收起参考译文' : '👀 查看参考译文（写完再看哦）'}</button>
        </div>
        ${shown ? `
        <div class="model-box">
            <div class="model-head">
                <b>📌 参考译文</b>
                <button class="btn btn-outline btn-sm" onclick="paperReadAloud('trans-model')">🔊 朗读译文</button>
            </div>
            <div id="trans-model" class="en-text">${escapeHtml(t.reference)}</div>
        </div>` : ''}
    </div>`;
}

function toggleModelTrans() {
    paperState.shown.translation = !paperState.shown.translation;
    document.getElementById('paper-part-translation').innerHTML = renderTranslation();
    const ta = document.getElementById('transInput');
    if (ta) ta.value = paperState.transDraft || '';
}

// ---------- 进度 ----------
function updatePaperProgress() {
    if (!paperState) return;
    const p = paperState.paper;
    const total = p.listening ? 55 : 30; // 第3套无听力
    const answered = Object.keys(paperState.answers).length;
    let correct = 0;
    Object.keys(paperState.answers).forEach(n => {
        const ans = getCorrectAnswer(p, n);
        if (ans && paperState.answers[n] === ans) correct++;
    });
    const el = document.getElementById('quizProgress');
    if (el) el.textContent = `已答 ${answered}/${total} 题 · 答对 ${correct} 题`;
}

function getCorrectAnswer(p, n) {
    n = String(n);
    if (p.listening && p.listening.questions[n]) return p.listening.questions[n].answer;
    if (p.cloze.answers[n]) return p.cloze.answers[n];
    if (p.matching.answers[n]) return p.matching.answers[n];
    for (const pas of p.careful) {
        const q = pas.questions.find(x => String(x.n) === n);
        if (q) return q.answer;
    }
    return null;
}

// ---------- 交卷评分 ----------
function scorePaper() {
    const p = paperState.paper;
    const groups = [
        { key: 'L', name: '听力（25题）', per: 248.5 / 25, ns: p.listening ? Array.from({ length: 25 }, (_, i) => i + 1) : [] },
        { key: 'cloze', name: '选词填空（10题）', per: 3.55, ns: Array.from({ length: 10 }, (_, i) => i + 26) },
        { key: 'match', name: '长篇匹配（10题）', per: 7.1, ns: Array.from({ length: 10 }, (_, i) => i + 36) },
        { key: 'careful', name: '仔细阅读（10题）', per: 14.2, ns: Array.from({ length: 10 }, (_, i) => i + 46) }
    ];
    let objScore = 0, totalAnswered = 0, totalCorrect = 0, totalQs = 0;
    const rows = groups.map(g => {
        let right = 0, answered = 0;
        g.ns.forEach(n => {
            if (!p.listening && g.key === 'L') return;
            totalQs++;
            const correct = getCorrectAnswer(p, n);
            const chosen = paperState.answers[String(n)];
            if (chosen) {
                answered++;
                if (chosen === correct) { right++; objScore += g.per; }
            }
        });
        totalAnswered += answered; totalCorrect += right;
        const max = g.ns.length * g.per;
        return { ...g, right, answered, max, score: right * g.per };
    });

    const panel = document.getElementById('paperScorePanel');
    const levelName = p.level === 'cet4' ? '四级' : '六级';
    panel.innerHTML = `
    <div class="score-panel" id="scorePanelInner">
        <h3>📊 ${p.year}${levelName}第${p.set}套 · 练习成绩</h3>
        <p class="part-tip">客观题（听力+阅读）已自动判分；写作和翻译请对照范文/译文后给自己估档，得到预估总分。</p>
        <table class="score-table">
            <tr><th>部分</th><th>作答</th><th>答对</th><th>得分</th><th>满分</th></tr>
            ${rows.filter(r => r.ns.length).map(r => `
            <tr><td>${r.name}</td><td>${r.answered}/${r.ns.length}</td><td>${r.right}</td>
            <td><b>${r.score.toFixed(1)}</b></td><td>${r.max.toFixed(1)}</td></tr>`).join('')}
            <tr class="score-subtotal"><td>客观题合计</td><td>${totalAnswered}/${totalQs}</td><td>${totalCorrect}</td>
            <td><b>${objScore.toFixed(1)}</b></td><td>497.0</td></tr>
        </table>
        <div class="self-rate">
            <h4>✍️ 写作自评（满分106.5）</h4>
            <p class="part-tip">对照参考范文，按切题、连贯、语言准确程度估档：</p>
            <div id="rateWriting" class="rate-btns">
                <button class="btn btn-outline" onclick="selfRate('writing',0.9)">优秀 96分</button>
                <button class="btn btn-outline" onclick="selfRate('writing',0.75)">良好 80分</button>
                <button class="btn btn-outline" onclick="selfRate('writing',0.6)">及格 64分</button>
                <button class="btn btn-outline" onclick="selfRate('writing',0.4)">需努力 43分</button>
                <button class="btn btn-outline" onclick="selfRate('writing',0)">未作答 0分</button>
            </div>
            <h4 style="margin-top:14px;">🌐 翻译自评（满分106.5）</h4>
            <div id="rateTrans" class="rate-btns">
                <button class="btn btn-outline" onclick="selfRate('trans',0.9)">优秀 96分</button>
                <button class="btn btn-outline" onclick="selfRate('trans',0.75)">良好 80分</button>
                <button class="btn btn-outline" onclick="selfRate('trans',0.6)">及格 64分</button>
                <button class="btn btn-outline" onclick="selfRate('trans',0.4)">需努力 43分</button>
                <button class="btn btn-outline" onclick="selfRate('trans',0)">未作答 0分</button>
            </div>
        </div>
        <div class="total-score" id="totalScoreBox">
            客观题已得 <b>${objScore.toFixed(1)}</b> 分，请完成写作、翻译自评查看预估总分
        </div>
        <div class="wrong-review" id="wrongReview"></div>
    </div>`;
    panel.dataset.objscore = objScore.toFixed(2);
    panel.scrollIntoView({ behavior: 'smooth' });
    renderWrongReview();
}

function selfRate(kind, ratio) {
    const box = document.getElementById(kind === 'writing' ? 'rateWriting' : 'rateTrans');
    box.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('btn-primary', [0.9, 0.75, 0.6, 0.4, 0][i] === ratio);
        b.classList.toggle('btn-outline', [0.9, 0.75, 0.6, 0.4, 0][i] !== ratio);
    });
    const panel = document.getElementById('paperScorePanel');
    const wRatio = panel.dataset.wratio !== undefined ? parseFloat(panel.dataset.wratio) : null;
    const tRatio = panel.dataset.tratio !== undefined ? parseFloat(panel.dataset.tratio) : null;
    if (kind === 'writing') panel.dataset.wratio = ratio;
    else panel.dataset.tratio = ratio;
    const w = kind === 'writing' ? ratio : wRatio;
    const t = kind === 'trans' ? ratio : tRatio;
    const obj = parseFloat(panel.dataset.objscore || '0');
    const box2 = document.getElementById('totalScoreBox');
    if (w === null || t === null) {
        box2.innerHTML = `客观题已得 <b>${obj.toFixed(1)}</b> 分，请继续完成自评`;
        return;
    }
    const wScore = w * 106.5, tScore = t * 106.5;
    const total = obj + wScore + tScore;
    const passed = total >= 425;
    box2.className = 'total-score ' + (passed ? 'pass' : 'fail');
    box2.innerHTML = `
        <div class="total-num">${total.toFixed(1)}</div>
        <div>${passed ? '🎉 预估成绩达到 425 分合格线！' : '💪 暂未达到 425 分，继续加油！'}（满分710，合格线425）</div>
        <div class="total-detail">客观题 ${obj.toFixed(1)} + 写作 ${wScore.toFixed(1)} + 翻译 ${tScore.toFixed(1)}</div>`;
}

function renderWrongReview() {
    const p = paperState.paper;
    const wrongs = [];
    Object.keys(paperState.answers).forEach(n => {
        const correct = getCorrectAnswer(p, n);
        const chosen = paperState.answers[n];
        if (chosen !== correct) wrongs.push({ n, chosen, correct });
    });
    const box = document.getElementById('wrongReview');
    if (!wrongs.length) {
        box.innerHTML = Object.keys(paperState.answers).length
            ? '<div class="all-right">🌈 已作答的客观题全部正确！</div>' : '';
        return;
    }
    box.innerHTML = `<h4>❌ 答错/未答的题（共 ${wrongs.length} 题）</h4>
        <div class="wrong-list">${wrongs.map(w => `<span class="wrong-tag">第${w.n}题 ${w.chosen ? '你选' + w.chosen : '未答'} → 正确 ${w.correct}</span>`).join('')}</div>
        <p class="part-tip">回到上方对应题目再看一遍；听力题可重新播放对应组。</p>`;
}

function resetPaperAnswers() {
    if (!confirm('确定清空本套所有作答和写作/翻译草稿吗？')) return;
    paperState.answers = {};
    paperState.writingDraft = '';
    paperState.transDraft = '';
    clearPaperDraft();
    renderPaper();
}

// ---------- 朗读队列 ----------
let paperSpeakTimers = [];
function stopPaperSpeak() {
    paperSpeakTimers.forEach(t => clearTimeout(t));
    paperSpeakTimers = [];
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakSequence(items, rate) {
    // items: [{text, pauseAfter}] 依次朗读
    stopPaperSpeak();
    if (!('speechSynthesis' in window)) {
        showToast('当前浏览器不支持语音朗读，请使用 Edge 或 Chrome');
        return;
    }
    let i = 0;
    function next() {
        if (i >= items.length) return;
        const it = items[i++];
        const u = new SpeechSynthesisUtterance(it.text);
        u.lang = 'en-US';
        u.rate = rate || 0.9;
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        if (enVoice) u.voice = enVoice;
        u.onend = () => {
            if (it.pauseAfter) {
                const t = setTimeout(next, it.pauseAfter * 1000);
                paperSpeakTimers.push(t);
            } else next();
        };
        u.onerror = () => next();
        window.speechSynthesis.speak(u);
    }
    next();
}

function paperReadAloud(elId) {
    const el = document.getElementById(elId);
    if (el) speakEnglish(el.textContent, 0.9);
}

function paperPlayGroup(gi, withQuestions) {
    const L = paperState.paper.listening;
    const g = L.groups[gi];
    if (withQuestions) {
        const items = [{ text: g.script, pauseAfter: 2 }];
        for (let n = g.from; n <= g.to; n++) {
            const q = L.questions[String(n)];
            if (q && q.stem && !q.zhStem && !q.ocrMissing) {
                items.push({ text: 'Question ' + n + '. ' + q.stem, pauseAfter: 14 });
            } else {
                items.push({ text: 'Question ' + n + '.', pauseAfter: 14 });
            }
        }
        speakSequence(items, 0.95);
        showToast('开始播放：' + g.title + '（播放中请作答）');
    } else {
        speakEnglish(g.script, 0.9);
    }
}

// ---------- 工具 ----------
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
