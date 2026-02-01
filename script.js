/* =========================================
   CYBERHUB SMART IDE - CORE LOGIC
   ========================================= */

let editor;
let currentLanguage = 'python';
let currentUIText = 'ar';
let pyodide = null;
let isPyodideLoading = false;
let activeTab = 'console';

const LANGUAGE_IDS = {
    python: 71, javascript: 63, cpp: 54, c: 50, java: 62, php: 68, sql: 82
};

// --- JUDGE0 CONFIG ---
let RAPIDAPI_KEY = localStorage.getItem('judge0_api_key') || "";
let JUDGE0_BASE_URL = localStorage.getItem('judge0_base_url') || "https://ce.judge0.com";
const RAPIDAPI_HOST = new URL(JUDGE0_BASE_URL).host;

const MONACO_MODES = {
    python: 'python', javascript: 'javascript', cpp: 'cpp', c: 'c', java: 'java', php: 'php', sql: 'sql'
};

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

window.addEventListener('load', () => {
    // Theme sync - index.html already adds the class, so we just sync internal state
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
    }

    const activeSection = localStorage.getItem('activeSection') || 'home';
    showSection(activeSection);

    require(['vs/editor/editor.main'], function () {
        const isLight = document.documentElement.classList.contains('light-mode');
        editor = monaco.editor.create(document.getElementById('monacoEditor'), {
            value: getCodeTemplate('python'),
            language: 'python',
            theme: isLight ? 'vs' : 'vs-dark',
            automaticLayout: true,
            fontSize: 14, fontFamily: "'JetBrains Mono', monospace", lineHeight: 22,
            minimap: { enabled: false }, padding: { top: 20 }, roundedSelection: true,
            scrollBeyondLastLine: false, cursorBlinking: "smooth", cursorSmoothCaretAnimation: "on",
            accessibilitySupport: 'off',
            accessibilityStrategy: 'off'
        });
        editor.onDidChangeModelContent(() => {
            const code = editor.getValue();
            localStorage.setItem(`code_${currentLanguage}`, code);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            document.getElementById('runBtn').click();
        });
    });
    setupEventListeners();

    // Fail-safe: Periodically kill any remaining accessibility widgets (especially for mobile)
    setInterval(() => {
        const icons = document.querySelectorAll('.accessibility-widget, [aria-label*="Accessibility"], [title*="Keyboard"]');
        icons.forEach(icon => icon.remove());
    }, 1000);
});

function setupEventListeners() {
    const runBtn = document.getElementById('runBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const languageSelector = document.getElementById('languageSelector');
    const clearOutput = document.getElementById('clearOutput');

    document.querySelectorAll('.output-tab').forEach(tab => {
        tab.addEventListener('click', () => switchOutputTab(tab.getAttribute('data-tab')));
    });

    // Navigation Logic
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            const section = li.getAttribute('data-section');
            if (section) showSection(section);
        });
    });

    languageSelector.addEventListener('change', () => {
        const lang = languageSelector.value;
        currentLanguage = lang;
        if (editor) {
            monaco.editor.setModelLanguage(editor.getModel(), MONACO_MODES[lang]);
            editor.setValue(localStorage.getItem(`code_${lang}`) || getCodeTemplate(lang));
        }
    });

    runBtn.addEventListener('click', executeCode);
    clearBtn.addEventListener('click', () => { editor.setValue(""); showToast("Cleared"); });
    copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(editor.getValue()).then(() => showToast("Copied!")); });
    document.getElementById('btnAr').addEventListener('click', () => { currentUIText = 'ar'; updateUILanguage(); analyzeErrors("", editor.getValue()); });
    document.getElementById('btnEn').addEventListener('click', () => { currentUIText = 'en'; updateUILanguage(); analyzeErrors("", editor.getValue()); });
    clearOutput.addEventListener('click', () => {
        document.getElementById('outputConsole').innerHTML = ">";
        document.getElementById('errorCount').innerText = "0";
        document.getElementById('smartFixContainer').innerHTML = `<div class="empty-state">✅ Healthy Code!</div>`;
    });

    // --- Panel Resizer Logic ---
    const resizer = document.getElementById('editorResizer');
    const outputPanel = document.getElementById('editorOutput');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const container = document.querySelector('.editor-container');
        const containerRect = container.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;

        // Calculate new height for output panel
        // container height - relativeY - resizer height
        const newHeight = containerRect.height - relativeY - resizer.offsetHeight;

        if (newHeight > 80 && newHeight < containerRect.height * 0.8) {
            outputPanel.style.height = `${newHeight}px`;
            if (editor) editor.layout(); // Refresh Monaco
        }
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });
}

function switchOutputTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.output-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `${tabId}Panel`));
}

function getCodeTemplate(lang) {
    const templates = {
        python: `# Welcome to CyberHub!\nprint("Welcome to CyberHub!")`,
        javascript: `// Welcome to CyberHub!\nconsole.log("Welcome to CyberHub!");`,
        cpp: `#include <iostream>\nusing namespace std;\n\n// Welcome to CyberHub!\nint main() {\n    cout << "Welcome to CyberHub!" << endl;\n    return 0;\n}`,
        c: `#include <stdio.h>\n\n// Welcome to CyberHub!\nint main() {\n    printf("Welcome to CyberHub!\\n");\n    return 0;\n}`,
        java: `// Welcome to CyberHub!\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Welcome to CyberHub!");\n    }\n}`,
        php: `<?php\n// Welcome to CyberHub!\necho "Welcome to CyberHub!";\n?>`,
        sql: `-- Welcome to CyberHub!\nSELECT 'Welcome to CyberHub!' AS Message;`
    };
    return templates[lang] || "";
}

// --- REVOLUTIONARY SIMULATION ENGINES (Variables + Math Support) ---
function runAdvancedSimulation(code, lang) {
    if (validateSyntaxIntegrity(code, lang)) return null;

    let output = "";
    const variables = {};
    const lines = code.split('\n');

    try {
        lines.forEach(line => {
            const t = line.trim();
            if (!t || t.startsWith('//') || t.startsWith('#')) return;

            // 1. Variable Assignment (int x = 5; or x += 10;)
            // Stricter regex to avoid matching cout/printf
            const varMatch = t.match(/(?:int|float|double|var|let)?\s*([a-zA-Z_]\w*)\s*(\+=|-=|\*=| \/=|=)\s*([^;]+)/);
            if (varMatch) {
                const varName = varMatch[1].trim();
                const operator = varName === 'cout' || varName === 'printf' ? null : varMatch[2].trim();
                if (operator) {
                    let expression = varMatch[3].trim();

                    Object.keys(variables).forEach(v => {
                        const regex = new RegExp(`\\b${v}\\b`, 'g');
                        expression = expression.replace(regex, variables[v]);
                    });

                    const newVal = safeEvalMath(expression);

                    if (operator === '+=' && variables[varName] !== undefined) variables[varName] += newVal;
                    else if (operator === '-=' && variables[varName] !== undefined) variables[varName] -= newVal;
                    else if (operator === '*=' && variables[varName] !== undefined) variables[varName] *= newVal;
                    else if (operator === '/=' && variables[varName] !== undefined) variables[varName] /= newVal;
                    else variables[varName] = newVal; // Default assignment
                    return;
                }
            }

            // 2. Output Logic (Language Specific)
            if (lang === 'cpp') {
                const coutMatch = t.match(/cout\s*<<\s*([^;]+)/);
                if (coutMatch) {
                    let parts = coutMatch[1].split('<<');
                    parts.forEach(p => {
                        let val = p.trim();
                        if (val === 'endl') output += '\n';
                        else if (val.startsWith('"') && val.endsWith('"')) output += val.slice(1, -1);
                        else {
                            // Replace variables
                            Object.keys(variables).forEach(v => {
                                const regex = new RegExp(`\\b${v}\\b`, 'g');
                                val = val.replace(regex, variables[v]);
                            });
                            output += safeEvalMath(val);
                        }
                    });
                }
            } else if (lang === 'c') {
                const printfMatch = t.match(/printf\s*\("([^"]+)"\s*(?:,\s*([^)]+))?\)/);
                if (printfMatch) {
                    let fmt = printfMatch[1];
                    let args = printfMatch[2] ? printfMatch[2].split(',') : [];
                    args = args.map(arg => {
                        let val = arg.trim();
                        Object.keys(variables).forEach(v => {
                            const regex = new RegExp(`\\b${v}\\b`, 'g');
                            val = val.replace(regex, variables[v]);
                        });
                        return safeEvalMath(val);
                    });

                    let result = fmt.replace(/%d|%f|%i|%s/g, () => args.shift() || "");
                    output += result.replace('\\n', '\n');
                }
            } else if (lang === 'java') {
                const printlnMatch = t.match(/System\.out\.print(?:ln)?\s*\(([^)]+)\)/);
                if (printlnMatch) {
                    let val = printlnMatch[1].trim();
                    if (val.startsWith('"') && val.endsWith('"')) {
                        output += val.slice(1, -1) + (t.includes('println') ? '\n' : '');
                    } else {
                        Object.keys(variables).forEach(v => {
                            const regex = new RegExp(`\\b${v}\\b`, 'g');
                            val = val.replace(regex, variables[v]);
                        });
                        output += safeEvalMath(val) + (t.includes('println') ? '\n' : '');
                    }
                }
            }
        });
        return output ? { stdout: output, stderr: "" } : null;
    } catch (e) {
        return { stdout: "", stderr: "Simulation Error: " + e.message };
    }
}

function safeEvalMath(expr) {
    try {
        // Clean expression
        let clean = expr.replace(/[fLd]$/i, '').replace(/f/g, '');
        // Support common C++ operators if they leak
        clean = clean.replace(/endl/g, '""');
        return Function(`"use strict"; return (${clean})`)();
    } catch (e) {
        return expr;
    }
}

function runSqlSimulation(code) {
    const t = code.trim().toLowerCase();
    if (t.startsWith("select")) {
        const mathMatch = code.match(/select\s+([^;as\n]+)/i);
        if (mathMatch && !mathMatch[1].includes("'") && !mathMatch[1].includes('"')) {
            return { stdout: safeEvalMath(mathMatch[1]).toString(), stderr: "" };
        }
        return { stdout: "ID | Message\n---|------------------\n1  | Welcome to CyberHub!\n(Simulated SQL Result)", stderr: "" };
    }
    return null;
}

function runPhpSimulation(code) {
    const echoMatch = code.match(/echo\s+([^;]+)/);
    if (echoMatch) {
        let val = echoMatch[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            return { stdout: val.slice(1, -1), stderr: "" };
        }
        return { stdout: safeEvalMath(val).toString(), stderr: "" };
    }
    return null;
}

function validateSyntaxIntegrity(code, lang) {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if ((line.includes('printf(') || line.includes('cout <<') || line.includes('System.out')) && !line.includes(';') && !line.includes('{')) {
            // Look ahead 1 line to see if it continues
            if (i + 1 < lines.length && !lines[i + 1].trim().startsWith(';') && !lines[i + 1].trim().endsWith(';')) return true; // Likely broken
        }
        // Basic Quote matching per line
        const quotes = (line.match(/"/g) || []).length;
        if (quotes % 2 !== 0 && !line.includes("'")) return true; // Unclosed quote on line
    }
    return false;
}

// --- PYTHON ENGINE (Robust Load) ---
async function initPyodide() {
    if (pyodide) return true;
    if (isPyodideLoading) return new Promise(resolve => {
        const check = setInterval(() => { if (pyodide) { clearInterval(check); resolve(true); } }, 100);
    });
    isPyodideLoading = true;
    const outputConsole = document.getElementById('outputConsole');
    outputConsole.innerHTML += `<span class="info">> Initializing Python 3.10 engine... (Please wait)</span><br>`;
    try {
        if (typeof loadPyodide === 'undefined') {
            throw new Error("Pyodide script failed to load. This usually happens due to a slow internet connection or an ad-blocker blocking the CDN. Please refresh the page.");
        }
        pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
        isPyodideLoading = false;
        outputConsole.innerHTML += `<span class="success">> Python Engine Ready!</span><br>`;
        return true;
    } catch (e) {
        outputConsole.innerHTML += `<span class="error">> Python Load Fail: ${e.message}</span><br>`;
        isPyodideLoading = false; return false;
    }
}

async function runLocalPython(code) {
    const success = await initPyodide();
    if (!success) throw new Error("Python failure.");
    let output = "";
    pyodide.setStdout({ batched: (s) => output += s + "\n" });
    pyodide.setStderr({ batched: (s) => output += `<span class="error">${s}</span>\n` });
    try {
        await pyodide.runPythonAsync(code);
        return { stdout: output, stderr: "" };
    } catch (e) {
        return { stdout: output, stderr: e.message };
    }
}

function runLocalJS(code) {
    let output = "";
    const oldLog = console.log;
    console.log = (...args) => output += args.join(' ') + "\n";
    try {
        eval(code);
        console.log = oldLog;
        return { stdout: output, stderr: "" };
    } catch (e) {
        console.log = oldLog;
        return { stdout: output, stderr: e.message };
    }
}

async function executeCode() {
    const code = editor.getValue();
    const runBtn = document.getElementById('runBtn');
    if (!code.trim()) return;

    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> RUNNING...';
    // 1. Run Static Analysis (Smart Fix) IMMEDIATELY
    // This shows errors (like missing semicolons) even if the server is not configured.
    analyzeErrors("", code);

    const preFindings = runRuleEngine("", code, currentLanguage);
    if (preFindings.length > 0) {
        outputConsole.innerHTML += `<span class="error">> Possible logic/syntax issues found by Smart Fix.</span><br>`;
    }

    try {
        // 2. Attempt Server Execution
        const url = `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`;

        const headers = { 'content-type': 'application/json' };
        if (RAPIDAPI_KEY) {
            headers['x-rapidapi-key'] = RAPIDAPI_KEY;
            headers['x-rapidapi-host'] = RAPIDAPI_HOST;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                language_id: LANGUAGE_IDS[currentLanguage],
                source_code: code
            })
        });

        if (!response.ok) throw new Error(`Server Response: ${response.statusText}`);

        const result = await response.json();

        let html = "";
        if (result?.compile_output) html += `<span class="error">${result.compile_output}</span>\n`;
        if (result?.stdout) html += `<span class="output">${result.stdout}</span>\n`;
        if (result?.stderr) html += `<span class="error">${result.stderr}</span>\n`;

        outputConsole.innerHTML = `> ${html.replace(/\n/g, '<br>') || '<span class="info">(No output)</span>'}`;

        // Analyze actual server results with Smart Fix
        analyzeErrors(result ? (result.compile_output || result.stderr || "") : "", code);

    } catch (err) {
        console.error("Execution Error:", err);
        outputConsole.innerHTML += `<span class="error">> ❌ Server Integration Error: ${err.message}</span><br>`;
        outputConsole.innerHTML += `<span class="info">💡 Site is currently in 'Admin Review' mode. Please ensure Judge0 is configured (Ctrl+Shift+S) to see real-time output. Static Smart Fix is still active above.</span>`;
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = currentUIText === 'ar' ? '<i class="fas fa-play"></i> تشغيل' : '<i class="fas fa-play"></i> RUN';
    }
}

async function executeCodeWithFallback(code) {
    let result = null;
    if (['cpp', 'c', 'java'].includes(currentLanguage)) result = runAdvancedSimulation(code, currentLanguage);
    else if (currentLanguage === 'php') result = runPhpSimulation(code);
    else if (currentLanguage === 'sql') result = runSqlSimulation(code);

    if (result) {
        let html = "";
        if (result.stdout) html += `<span class="output">${result.stdout}</span>\n`;
        document.getElementById('outputConsole').innerHTML += `<br>> <span class="info">🛡️ Fallback Simulation:</span><br>${html.replace(/\n/g, '<br>')}`;
        analyzeErrors("", code);
    }
}

function analyzeErrors(rawError, code) {
    const smartContainer = document.getElementById('smartFixContainer');
    const findings = runRuleEngine(rawError, code, currentLanguage);
    document.getElementById('errorCount').innerText = findings.length;
    smartContainer.innerHTML = "";
    if (findings.length > 0) {
        findings.forEach(f => smartContainer.appendChild(createFixCard(f)));
        document.getElementById('smartTab').classList.add('pulse');
        setTimeout(() => document.getElementById('smartTab').classList.remove('pulse'), 2000);
    } else smartContainer.innerHTML = `<div class="empty-state">✅ Healthy Code!</div>`;
}

function runRuleEngine(err, code, lang) {
    const results = [];
    const lines = code.split('\n');

    // 1. Bracket Matching Check
    const stack = [];
    const pairs = { '(': ')', '{': '}', '[': ']' };
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (['(', '{', '['].includes(char)) stack.push({ char, pos: i });
        else if ([')', '}', ']'].includes(char)) {
            if (stack.length === 0) {
                results.push({
                    type: 'Brackets Error', line: getLineFromPos(code, i), part: char,
                    explanation_ar: `قفلت قوس ${char} زيادة.`, explanation_en: `Extra closing bracket '${char}'.`, suggestion: "", tip_ar: "اتأكد من توازن الأقواس."
                });
            } else {
                const last = stack.pop();
                if (pairs[last.char] !== char) {
                    results.push({
                        type: 'Brackets Error', line: getLineFromPos(code, i), part: char,
                        explanation_ar: `فتحت ${last.char} وقفلت ${char}.`, explanation_en: `Mismatched brackets.`, suggestion: "", tip_ar: "الأقواس لازم تكون أزواج متطابقة."
                    });
                }
            }
        }
    }
    stack.forEach(rem => {
        results.push({
            type: 'Brackets Error', line: getLineFromPos(code, rem.pos), part: rem.char,
            explanation_ar: `فتحت قوس ${rem.char} ومقفلتهوش.`, explanation_en: `Unclosed bracket '${rem.char}'.`, suggestion: "", tip_ar: "لازم تقفل أي قوس تفتحه."
        });
    });

    lines.forEach((l, i) => {
        const t = l.trim();
        if (!t) return;

        // 2. STDLIB / Header Typos & Missing Brackets
        if (lang === 'cpp' || lang === 'c') {
            if (t.startsWith('#include')) {
                const hasStart = t.includes('<') || t.includes('"');
                const hasEnd = t.includes('>') || (t.match(/"/g) || []).length >= 2;

                if (!hasStart || !hasEnd) {
                    results.push({
                        type: 'Include Error', line: i + 1, part: t,
                        explanation_ar: `تنسيق الـ include غلط. لازم تكون <اسم المكتبة> أو "اسم المكتبة".`,
                        explanation_en: `Malformed include directive. Use <header> or "header".`,
                        suggestion: "#include <iostream>",
                        tip_ar: "المكتبات بتتحط بين < >"
                    });
                } else {
                    const header = t.match(/<([^>]+)>/)?.[1] || t.match(/"([^"]+)"/)?.[1];
                    const validHeaders = ['iostream', 'stdio.h', 'vector', 'string', 'algorithm', 'cmath', 'stdlib.h', 'bits/stdc++.h'];
                    if (header && !validHeaders.includes(header)) {
                        if (header.includes('istre') || header.includes('iostre')) {
                            results.push({ type: 'Header Error', line: i + 1, part: header, explanation_ar: `اسم المكتبة غلط، قصدك iostream؟`, explanation_en: `Typo in header name. Did you mean <iostream>?`, suggestion: `#include <iostream>`, tip_ar: "اتأكد من كتابة اسم المكتبة صح." });
                        }
                    }
                }
            }
            if (t.includes('using') && t.includes('namespace')) {
                if (!t.includes('std')) {
                    results.push({ type: 'Namespace Error', line: i + 1, part: t, explanation_ar: `ناقصك كلمة std.`, explanation_en: `Missing 'std' in using namespace.`, suggestion: `using namespace std;`, tip_ar: "استخدم using namespace std;" });
                } else if (!t.endsWith(';')) {
                    results.push({ type: 'Missing Semicolon', line: i + 1, part: t, explanation_ar: `نسيت السيمي كولون (;) بعد الـ namespace.`, explanation_en: `Missing semicolon after namespace declaration.`, suggestion: t + ";", tip_ar: "أي سطر تعريفي لازم ينتهي بـ ;" });
                }
            }
        }

        // 3. Reserved Word Typos (Common)
        const commonTypos = {
            'prnt': 'print', 'prntf': 'printf', 'cont': 'cout', 'retun': 'return', ' स्टैटिक': 'static', 'publc': 'public', 'clas': 'class'
        };
        Object.keys(commonTypos).forEach(typo => {
            if (t.includes(typo)) {
                results.push({ type: 'Typo Detected', line: i + 1, part: typo, explanation_ar: `كاتب كلمة '${typo}' غلط، قصدك '${commonTypos[typo]}'.`, explanation_en: `Typo in keyword '${typo}'. Did you mean '${commonTypos[typo]}'?`, suggestion: l.replace(typo, commonTypos[typo]), tip_ar: "خد بالك من الحروف." });
            }
        });

        // 4. Missing Quotes
        const quotes = (t.match(/"/g) || []).length;
        if (quotes % 2 !== 0 && !t.includes("'") && !t.startsWith('//') && !t.startsWith('#')) {
            results.push({ type: 'Syntax Error', line: i + 1, part: t, explanation_ar: "علامات التنصيص مش مقفولة.", explanation_en: "Unclosed string.", suggestion: t + '"', tip_ar: "النص لازم يكون بين \"\"" });
        }

        // 5. Language Specifics (Python print() check)
        if (lang === 'python') {
            if (t.startsWith('print ') && !t.includes('(')) {
                results.push({
                    type: 'Syntax Error', line: i + 1, part: t,
                    explanation_ar: "بايثون 3 لازم تستخدم أقواس مع الـ print.",
                    explanation_en: "Python 3 needs parentheses for print().",
                    suggestion: l.replace('print ', 'print(') + ')', tip_ar: "استعمل print(\"hello\")"
                });
            }
            if ((t.startsWith('if ') || t.startsWith('for ') || t.startsWith('while ') || t.startsWith('def ')) && !t.endsWith(':')) {
                results.push({
                    type: 'Missing Colon', line: i + 1, part: t,
                    explanation_ar: "نسيت النقطتين : في آخر السطر.",
                    explanation_en: "Missing colon (:) at the end of statement.",
                    suggestion: l + ":", tip_ar: "بايثون بتطلب : بعد الـ if/for/def"
                });
            }
        }

        // 6. Semicolon check
        if (['c', 'cpp', 'java'].includes(lang)) {
            const safeStarts = ['#', '//', 'using', 'public', 'int main', '{', '}', 'if', 'for', 'while', 'void', 'class'];
            const needsSemicolon = t.startsWith('return') || t.startsWith('cout') || t.startsWith('printf') ||
                t.startsWith('System.out') || t.includes('=') || t.includes('<<') ||
                (t.length > 5 && !safeStarts.some(s => t.startsWith(s)));

            if (needsSemicolon && !t.endsWith(';') && !t.endsWith('{') && !t.endsWith('}')) {
                results.push({
                    type: 'Missing Semicolon', line: i + 1, part: t,
                    explanation_ar: "نسيت الـ ; في الآخر.",
                    explanation_en: "Missing semicolon.",
                    suggestion: l + ";", tip_ar: "كل أمر برمجي ينتهي بـ ;"
                });
            }
        }
    });

    return results;
}

function getLineFromPos(code, pos) {
    return code.substring(0, pos).split('\n').length;
}

function createFixCard(f) {
    const card = document.createElement('div'); card.className = `fix-card ${currentUIText === 'ar' ? 'ar' : ''}`;
    const h = document.createElement('div'); h.className = 'fix-header';
    h.innerHTML = `<div class="fix-title"><i class="fas fa-exclamation-triangle"></i> ${f.type}</div><div class="fix-location">Line ${f.line}</div>`;
    const e = document.createElement('div'); e.className = 'fix-explanation'; e.innerText = currentUIText === 'ar' ? f.explanation_ar : f.explanation_en;
    card.appendChild(h); card.appendChild(e);

    if (f.suggestion) {
        const s = document.createElement('div'); s.className = 'fix-suggestion';
        s.innerHTML = `<code>${f.suggestion}</code>`;

        const tip = document.createElement('div');
        tip.className = 'fix-tip';
        tip.innerHTML = `<i class="fas fa-lightbulb"></i> ${currentUIText === 'ar' ? 'صلح السطر ده زي اللي فوق عشان الكود يشتغل.' : 'Fix this line manually following the suggestion above.'}`;

        card.appendChild(s);
        card.appendChild(tip);
    }
    return card;
}

function updateUILanguage() {
    document.getElementById('btnAr').classList.toggle('active', currentUIText === 'ar');
    document.getElementById('btnEn').classList.toggle('active', currentUIText === 'en');
    const runBtn = document.getElementById('runBtn');
    runBtn.innerHTML = currentUIText === 'ar' ? '<i class="fas fa-play"></i> تشغيل' : '<i class="fas fa-play"></i> RUN';
}

function showSection(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active-view', v.id === id));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden-view', v.id !== id));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.toggle('active', li.dataset.section === id));
    localStorage.setItem('activeSection', id);
}

function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    if (editor) monaco.editor.setTheme(isLight ? 'vs' : 'vs-dark');
}

function showToast(msg) {
    const t = document.createElement('div'); t.className = 'toast-notification success'; t.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(t); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 3000);
}

window.showSection = showSection; window.toggleTheme = toggleTheme; window.executeCode = executeCode;

// --- API SETTINGS LOGIC (Hidden Admin Mode) ---
window.openSettings = () => {
    document.getElementById('apiKeyInput').value = localStorage.getItem('judge0_api_key') || "";
    document.getElementById('baseUrlInput').value = localStorage.getItem('judge0_base_url') || "https://judge0-ce.p.rapidapi.com";
    document.getElementById('settingsModal').style.display = 'flex';
};

window.closeSettings = () => {
    document.getElementById('settingsModal').style.display = 'none';
};

window.saveSettings = () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const url = document.getElementById('baseUrlInput').value.trim() || "https://judge0-ce.p.rapidapi.com";
    localStorage.setItem('judge0_api_key', key);
    localStorage.setItem('judge0_base_url', url);
    RAPIDAPI_KEY = key;
    JUDGE0_BASE_URL = url;
    showToast("Settings Saved! Admin Mode Active.");
    closeSettings();
    if (editor) analyzeErrors("", editor.getValue());
};

// Secret Shortcut: Ctrl + Shift + S
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode === 83) { // 83 is 'S'
        e.preventDefault();
        openSettings();
    }
});

// --- SUPPORT MODAL ---
window.openSupportModal = () => {
    document.getElementById('supportModal').style.display = 'flex';
};

window.copySupportNumber = (num, method) => {
    navigator.clipboard.writeText(num);
    const feedback = document.getElementById('support-feedback');
    feedback.innerText = `Number (${num}) copied for ${method}!`;
    setTimeout(() => feedback.innerText = "", 3000);
};

document.getElementById('closeSupport')?.addEventListener('click', () => {
    document.getElementById('supportModal').style.display = 'none';
});

// --- SCHEDULE PREVIEW ---
window.openSchedulePreview = (lvl) => {
    const modal = document.getElementById('schedulePreviewModal');
    const img = document.getElementById('scheduleImage');
    const msg = document.getElementById('noPreviewMessage');

    modal.style.display = 'flex';
    // For now, no images uploaded. Show message.
    img.style.display = 'none';
    msg.style.display = 'block';
};

document.getElementById('closeSchedulePreview')?.addEventListener('click', () => {
    document.getElementById('schedulePreviewModal').style.display = 'none';
});

// --- STUDENT GRADES SYSTEM (Mock Database) ---
const MOCK_STUDENTS = [
    {
        id: "2021001", name: "Ahmed Gamal", gpa: "3.8", grades: [
            { subject: "C++ Programming", degree: "95", grade: "A+", points: "4.0" },
            { subject: "Data Structures", degree: "88", grade: "A", points: "3.7" },
            { subject: "Discrete Math", degree: "92", grade: "A+", points: "4.0" }
        ]
    },
    {
        id: "2021002", name: "Sara Mohamed", gpa: "3.5", grades: [
            { subject: "C++ Programming", degree: "85", grade: "A-", points: "3.4" },
            { subject: "Networks", degree: "90", grade: "A", points: "3.7" }
        ]
    }
];

window.searchGrades = () => {
    const query = document.getElementById('studentSearch').value.trim();
    const resultDiv = document.getElementById('gradesResult');
    const placeholder = document.getElementById('gradesPlaceholder');
    const tableBody = document.getElementById('gradesTableBody');

    const student = MOCK_STUDENTS.find(s => s.id === query || s.name.toLowerCase().includes(query.toLowerCase()));

    if (student) {
        document.getElementById('resStudentName').innerText = student.name;
        document.getElementById('resStudentID').innerText = `ID: ${student.id}`;
        document.getElementById('resGPA').innerText = student.gpa;

        tableBody.innerHTML = student.grades.map(g => `
            <tr>
                <td>${g.subject}</td>
                <td>${g.degree}</td>
                <td class="grade-${g.grade.charAt(0)}">${g.grade}</td>
                <td>${g.points}</td>
            </tr>
        `).join('');

        placeholder.style.display = 'none';
        resultDiv.style.display = 'block';
        showToast("Result Found!");
    } else {
        showToast("Student not found!");
    }
};

// --- MOBILE MENU ---
window.toggleMobileMenu = () => {
    document.querySelector('.nav-links').classList.toggle('active');
};

// --- SUBJECT MATERIALS SYSTEM ---
const SUBJECT_DATA = {
    cpp: {
        title: "C++ Programming",
        pdfs: ["Lecture 1: Basics.pdf", "Lecture 2: OOP Principles.pdf", "STL Reference.pdf"],
        videos: ["C++ Intro", "Classes & Objects", "Pointers Explained"],
        exams: ["Midterm 2023.pdf", "Final 2023.pdf"]
    },
    dsa: {
        title: "Data Structures",
        pdfs: ["Linked Lists.pdf", "Trees & Graphs.pdf", "Sorting Algorithms.pdf"],
        videos: ["DSA Intro", "Binary Trees", "Quick Sort Animation"],
        exams: ["DSA Midterm.pdf"]
    },
    math: {
        title: "Discrete Math",
        pdfs: ["Logic & Proofs.pdf", "Set Theory.pdf"],
        videos: ["Truth Tables", "Permutations"],
        exams: ["Math Sheet 1.pdf"]
    },
    networks: {
        title: "Computer Networks",
        pdfs: ["OSI Model.pdf", "IP Addressing.pdf"],
        videos: ["How Router Works", "TCP vs UDP"],
        exams: ["Quiz 1.pdf"]
    },
    cyber: {
        title: "Cyber Security",
        pdfs: ["Ethical Hacking Intro.pdf", "Cryptography.pdf"],
        videos: ["SQL Injection Demo", "Phishing Protection"],
        exams: ["Cyber Final.pdf"]
    }
};

window.openSubject = (id) => {
    const data = SUBJECT_DATA[id];
    if (!data) return;

    document.getElementById('modalTitle').innerText = data.title;

    // Inject PDFs
    document.getElementById('pdfList').innerHTML = data.pdfs.map(file => `
        <li class="resource-item">
            <span><i class="fas fa-file-pdf"></i> ${file}</span>
            <button class="btn-xs download">Download</button>
        </li>
    `).join('');

    // Inject Videos
    document.getElementById('videoList').innerHTML = data.videos.map(title => `
        <li class="resource-item">
            <span><i class="fas fa-play-circle"></i> ${title}</span>
            <button class="btn-xs watch">Watch</button>
        </li>
    `).join('');

    // Inject Exams
    document.getElementById('examList').innerHTML = data.exams.map(file => `
        <li class="resource-item">
            <span><i class="fas fa-file-alt"></i> ${file}</span>
            <button class="btn-xs download">Download</button>
        </li>
    `).join('');

    document.getElementById('subjectModal').style.display = 'flex';
};

// Close all modals on outside click
window.onclick = (event) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => {
        if (event.target == m) m.style.display = 'none';
    });
};
