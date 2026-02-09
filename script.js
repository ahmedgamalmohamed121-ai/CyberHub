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

const MONACO_MODES = { 'python': 'python', 'javascript': 'javascript', 'cpp': 'cpp', 'c': 'c', 'java': 'java', 'php': 'php', 'sql': 'sql' };

// Security: Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


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
        let analyzeTimeout;
        editor.onDidChangeModelContent(() => {
            const code = editor.getValue();
            localStorage.setItem(`code_${currentLanguage}`, code);

            // Live Smart Fix (Debounced for performance)
            clearTimeout(analyzeTimeout);
            analyzeTimeout = setTimeout(() => analyzeErrors("", code), 1000);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            document.getElementById('runBtn').click();
        });

        // CRITICAL FIX: Ensure accurate character metrics after fonts are fully loaded
        if (document.fonts) {
            document.fonts.ready.then(() => {
                setTimeout(() => {
                    monaco.editor.remeasureFonts();
                    if (editor) editor.layout();
                }, 500);
            });
        }
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
            const saved = localStorage.getItem(`code_${lang}`) || getCodeTemplate(lang);
            editor.setValue(saved);
            analyzeErrors("", saved);
        }
    });

    runBtn.addEventListener('click', executeCode);
    clearBtn.addEventListener('click', () => { editor.setValue(""); showToast("Cleared"); });
    copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(editor.getValue()).then(() => showToast("Copied!")); });
    document.getElementById('btnAr').addEventListener('click', () => { currentUIText = 'ar'; updateUILanguage(); analyzeErrors("", editor.getValue()); });
    document.getElementById('btnEn').addEventListener('click', () => { currentUIText = 'en'; updateUILanguage(); analyzeErrors("", editor.getValue()); });
    clearOutput.addEventListener('click', () => {
        document.getElementById('outputConsole').textContent = ">";
        document.getElementById('errorCount').textContent = "0";
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

// Harden safeEvalMath to prevent arbitrary JS execution
function safeEvalMath(expr) {
    try {
        if (!expr) return "";
        // Only allow math-related characters, numbers, and basic operators
        const sanitized = String(expr).replace(/[fLd]$/i, '').replace(/f/g, '').trim();
        if (/[^0-9.+\-*/% ()\s&|^<>!]/.test(sanitized)) {
            // If it contains non-math chars, return as literal string to avoid Function() abuse
            return sanitized;
        }
        return Function(`"use strict"; return (${sanitized})`)();
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
        outputConsole.innerHTML += `<span class="error">> Python Load Fail: ${escapeHTML(e.message)}</span><br>`;
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

let isExecuting = false;

async function executeCode() {
    if (isExecuting) return;
    const code = editor.getValue();
    const runBtn = document.getElementById('runBtn');
    const outputConsole = document.getElementById('outputConsole');
    if (!code.trim()) return;

    isExecuting = true;
    runBtn.disabled = true;
    const originalBtnHTML = runBtn.innerHTML;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> RUNNING...';

    // Clear previous output
    outputConsole.textContent = "> Running...";
    analyzeErrors("", code);

    try {
        // --- 1. LOCAL EXECUTION (JS/Python) ---
        if (currentLanguage === 'javascript' || currentLanguage === 'python') {
            let result;
            if (currentLanguage === 'javascript') {
                result = runLocalJS(code);
            } else {
                if (!pyodide && !isPyodideLoading) runBtn.innerHTML = '<i class="fas fa-cog fa-spin"></i> LOADING...';
                result = await runLocalPython(code);
            }

            displayExecutionResult(result);
            return;
        }

        // --- 2. CLOUD EXECUTION (Judge0) ---
        const url = `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`;
        const headers = { 'content-type': 'application/json' };
        if (RAPIDAPI_KEY) {
            headers['x-rapidapi-key'] = RAPIDAPI_KEY;
            headers['x-rapidapi-host'] = RAPIDAPI_HOST;
        }

        const response = await fetch(`${url}&request_id=${Date.now()}`, {
            method: 'POST',
            headers: { ...headers, 'Cache-Control': 'no-cache' },
            body: JSON.stringify({
                language_id: LANGUAGE_IDS[currentLanguage],
                source_code: code
            })
        });

        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const result = await response.json();
        displayExecutionResult(result);

    } catch (err) {
        console.error("Execution Error:", err);
        const errorLine = document.createElement('div');
        errorLine.className = 'error';
        errorLine.textContent = `> ❌ Server Error. Falling back to local simulation...`;
        outputConsole.appendChild(errorLine);
        await executeCodeWithFallback(code);
    } finally {
        isExecuting = false;
        runBtn.disabled = false;
        runBtn.innerHTML = originalBtnHTML;
    }
}

// Helper to safely display results across all systems
function displayExecutionResult(result) {
    const outputConsole = document.getElementById('outputConsole');
    const smartFixContainer = document.getElementById('smartFixContainer');
    const code = editor.getValue();

    outputConsole.textContent = "> ";

    const appendPart = (text, className) => {
        if (!text) return;
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        outputConsole.appendChild(span);
        outputConsole.appendChild(document.createElement('br'));
    };

    if (result.compile_output) appendPart(result.compile_output, 'error');
    if (result.stdout) appendPart(result.stdout, 'output');
    if (result.stderr) appendPart(result.stderr, 'error');

    if (!result.stdout && !result.stderr && !result.compile_output) {
        const info = document.createElement('span');
        info.className = 'info';
        info.textContent = '(No output)';
        outputConsole.appendChild(info);
    }

    // Trigger Smart Fix
    if (result.compile_output || result.stderr) {
        const isRealError = /error|exception|referenceerror|syntaxerror|typeerror|traceback|failed/i.test(result.compile_output || result.stderr);
        if (isRealError) analyzeErrors(result.compile_output || result.stderr, code);
        else smartFixContainer.innerHTML = `<div class="empty-state">✅ Healthy Code! (Minor info in stderr)</div>`;
    } else {
        smartFixContainer.innerHTML = `<div class="empty-state">✅ Healthy Code! No errors found.</div>`;
    }
}

async function executeCodeWithFallback(code) {
    let result = null;
    if (['cpp', 'c', 'java'].includes(currentLanguage)) result = runAdvancedSimulation(code, currentLanguage);
    else if (currentLanguage === 'php') result = runPhpSimulation(code);
    else if (currentLanguage === 'sql') result = runSqlSimulation(code);

    if (result) {
        const outputConsole = document.getElementById('outputConsole');
        const header = document.createElement('div');
        header.className = 'info';
        header.style.marginTop = '10px';
        header.textContent = `🛡️ Local Fallback Simulation:`;
        outputConsole.appendChild(header);

        if (result.stdout) {
            const span = document.createElement('span');
            span.className = 'output';
            span.textContent = result.stdout;
            outputConsole.appendChild(span);
        }
    }
}

function analyzeErrors(rawError, code) {
    const smartContainer = document.getElementById('smartFixContainer');
    const findings = runRuleEngine(rawError, code, currentLanguage);
    const realErrors = findings.filter(f => f.type !== 'Structure Warning'); // Optional: don't count warnings in badge
    document.getElementById('errorCount').textContent = realErrors.length;
    smartContainer.innerHTML = "";
    if (findings.length > 0) {
        findings.forEach(f => smartContainer.appendChild(createFixCard(f)));
        if (realErrors.length > 0) {
            document.getElementById('smartTab').classList.add('pulse');
            setTimeout(() => document.getElementById('smartTab').classList.remove('pulse'), 2000);
        }
    } else smartContainer.innerHTML = `<div class="empty-state">✅ Healthy Code! No errors.</div>`;
}

function translateErrorToAr(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes("expected ';'")) return "ناقصك سيمي كولون (;) في نهاية السطر.";
    if (lower.includes("unterminated string literal")) return "فتحت نص (String) ومقفلتهوش بعلامة تنصيص (Double Quotes).";
    if (lower.includes("unexpected indent")) return "في مشكلة في المسافات (Indentation) في بداية السطر. لغة Python حساسة جداً للمسافات.";
    if (lower.includes("was not declared") || lower.includes("is not defined")) return "المتغير ده مش متعرف، اتأكد من كتابة الاسم صح أو عرفه الأول.";
    if (lower.includes("expected '}'")) return "ناقصك قوس إغلاق } للكود.";
    if (lower.includes("expected identifier")) return "في حاجة غلط في تسمية المتغيرات أو الدوال هنا.";
    if (lower.includes("invalid syntax")) return "في خطأ في طريقة كتابة الكود هنا (Syntax Error).";
    return null;
}

function runRuleEngine(err, code, lang) {
    const results = [];
    const lines = code.split('\n');

    // --- 1. PARSE COMPILER ERRORS (The Absolute Source of Truth) ---
    if (err) {
        const errorLines = err.split('\n');
        // Look for line numbers in various compiler formats
        const standardRegex = /:(\d+):/i;
        const pythonRegex = /line (\d+)/i;


        errorLines.forEach(line => {
            const match = line.match(standardRegex) || line.match(pythonRegex);
            const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') ||
                line.toLowerCase().includes('exception') || line.toLowerCase().includes('traceback');

            if (match && isError) {
                const lineNum = parseInt(match[1]);
                let cleanMsg = line.replace(/.*error:\s*/i, '').replace(/.*line \d+, in .*/i, '').trim() || line;

                const translated = translateErrorToAr(cleanMsg);

                results.push({
                    type: 'Compiler Error',
                    line: lineNum,
                    part: lines[lineNum - 1] || "Error",
                    explanation_ar: translated ? `المشكلة: ${translated}` : `المترجم اكتشف خطأ: ${cleanMsg}`,
                    explanation_en: `Compiler found: ${cleanMsg}`,
                    suggestion: "",
                    tip_ar: "راجع السطر ده في كودك واتأكد من قواعد اللغة."
                });
            }
        });

        if (results.length > 0) return results; // If we found real compiler errors, STOP HERE to avoid false positives from guesses.

        if (results.length === 0 && err.trim().length > 0) {
            const noiseKeywords = ['loading', 'downloading', 'pyodide', 'success', 'warning: '];
            const isActuallyError = !noiseKeywords.some(n => err.toLowerCase().includes(n)) || err.toLowerCase().includes('failed');

            if (isActuallyError) {
                results.push({
                    type: 'Compiler Notification', line: '?', part: "Internal Message",
                    explanation_ar: `المترجم أخرج تنبيه: ${err.split('\n')[0]}`,
                    explanation_en: err,
                    suggestion: "", tip_ar: "تأكد من هيكلة الكود بشكل صحيح حسب لغة البرمجة."
                });
            }
        }
    }

    // --- 2. OPTIONAL STATIC ANALYSIS (Run ALWAYS to merge with compiler errors) ---
    const hasMain = code.includes('main') || code.includes('function') || code.includes('<?php') || lang === 'python' || lang === 'javascript';
    if (results.length === 0 && !hasMain && code.trim().length > 50) {
        results.push({
            type: 'Structure Warning', line: 1, part: "Code Structure",
            explanation_ar: "الكود بتاعك ملوش بداية واضحة (زي main).",
            explanation_en: "Entry point (like main) not found.",
            suggestion: lang === 'cpp' ? "int main() {\n  // code\n  return 0;\n}" : "",
            tip_ar: "اتأكد إن الكود محطوط جوه دالة البداية."
        });
    }

    // Bracket Matching Check (Improved to ignore comments/strings)
    const stack = [];
    const pairs = { '(': ')', '{': '}', '[': ']' };
    let inString = false;
    let quoteChar = '';

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if ((char === '"' || char === "'") && code[i - 1] !== '\\') {
            if (!inString) { inString = true; quoteChar = char; }
            else if (quoteChar === char) { inString = false; }
            continue;
        }
        if (inString) continue;

        if (['(', '{', '['].includes(char)) stack.push({ char, line: getLineFromPos(code, i) });
        else if ([')', '}', ']'].includes(char)) {
            if (stack.length === 0) {
                results.push({
                    type: 'Brackets Error', line: getLineFromPos(code, i), part: char,
                    explanation_ar: `قفلت قوس ${char} زيادة ومفيش فتح ليه.`, explanation_en: `Extra closing bracket '${char}'.`, suggestion: "", tip_ar: "امسح القوس الزيادة."
                });
            } else {
                const last = stack.pop();
                if (pairs[last.char] !== char) {
                    results.push({
                        type: 'Brackets Error', line: getLineFromPos(code, i), part: char,
                        explanation_ar: `قفلت ${char} بس كنت فاتح ${last.char}. تداخل أقواس غلط.`, explanation_en: `Mismatched brackets: ${last.char} vs ${char}.`, suggestion: "", tip_ar: "صلح ترتيب قفل الأقواس."
                    });
                }
            }
        }
    }
    stack.forEach(rem => {
        results.push({
            type: 'Brackets Error', line: rem.line, part: rem.char,
            explanation_ar: `فتحت قوس ${rem.char} ومقفلتهوش.`, explanation_en: `Unclosed bracket '${rem.char}'.`, suggestion: "", tip_ar: "لازم تقفل أي قوس تفتحه."
        });
    });

    lines.forEach((l, i) => {
        const t = l.trim();
        if (!t || t.startsWith('//') || t.startsWith('#') || t.startsWith('/*')) return;

        // Typo Detection (Only for keywords, not inside strings)
        const keywords = ['include', 'iostream', 'return', 'cout', 'printf', 'System', 'public', 'static', 'void', 'class', 'while', 'for', 'if', 'else'];
        keywords.forEach(kw => {
            const words = t.split(/\s+/);
            words.forEach(w => {
                const cleanW = w.replace(/[();{}[\]]/g, '');
                if (cleanW.length < 3) return;

                // Simple Levenshtein-like distance check for typos
                if (cleanW !== kw && cleanW.length === kw.length) {
                    let diff = 0;
                    for (let x = 0; x < kw.length; x++) if (cleanW[x] !== kw[x]) diff++;
                    if (diff === 1) {
                        results.push({
                            type: 'Typo Detected', line: i + 1, part: cleanW,
                            explanation_ar: `كلمة '${cleanW}' شكلها غلط، قصدك '${kw}'؟`,
                            explanation_en: `Keyword typo: '${cleanW}' looks like '${kw}'.`,
                            suggestion: kw, tip_ar: "صلح الكلمة المحجوزة."
                        });
                    }
                }
            });
        });

        // Semicolon check (Refined to be less aggressive)
        if (['c', 'cpp', 'java'].includes(lang)) {
            const endsWithSemicolon = t.endsWith(';');
            const startsWithSafe = ['#', '/', '{', '}', 'if', 'for', 'while', 'else', 'public', 'private', 'protected', 'class', 'void', 'int main', 'using'];
            const lineRequiresSemicolon = t.length > 2 && !startsWithSafe.some(s => t.startsWith(s)) && !t.endsWith('{') && !t.endsWith('}') && !t.endsWith(')');

            if (lineRequiresSemicolon && !endsWithSemicolon) {
                // Check if next line is a semicolon or starts with one (sometimes happens)
                const nextLine = lines[i + 1]?.trim() || "";
                if (!nextLine.startsWith(';') && !nextLine.startsWith('{')) {
                    results.push({
                        type: 'Missing Semicolon', line: i + 1, part: t,
                        explanation_ar: "نسيت السيمي كولون (;) في آخر السطر ده.",
                        explanation_en: "Missing semicolon (;)",
                        suggestion: l + ";", tip_ar: "أي أمر في لغات زي C++/Java لازم ينتهي بـ ;"
                    });
                }
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
    h.innerHTML = `<div class="fix-title"><i class="fas fa-exclamation-triangle"></i> ${escapeHTML(f.type)}</div><div class="fix-location">Line ${escapeHTML(f.line)}</div>`;
    const e = document.createElement('div'); e.className = 'fix-explanation';
    e.innerHTML = `<div class="main-explanation">${currentUIText === 'ar' ? escapeHTML(f.explanation_ar) : escapeHTML(f.explanation_en)}</div>`;

    // Always show the technical message if we have translating it, or if it's a notification
    if (f.explanation_en && currentUIText === 'ar') {
        const isTranslated = f.explanation_ar.includes("المشكلة:");
        if (isTranslated || f.type === 'Compiler Notification' || f.line === '?') {
            e.innerHTML += `<div class="technical-msg">Technical Error (English): ${escapeHTML(f.explanation_en)}</div>`;
        }
    }

    card.appendChild(h);
    card.appendChild(e);

    const actions = document.createElement('div');
    actions.className = 'fix-actions';

    if (f.suggestion) {
        const s = document.createElement('div'); s.className = 'fix-suggestion';
        s.innerHTML = `<code>${escapeHTML(f.suggestion)}</code>`;

        const tip = document.createElement('div');
        tip.className = 'fix-tip';
        tip.innerHTML = `<i class="fas fa-lightbulb"></i> ${currentUIText === 'ar' ? escapeHTML(f.tip_ar) : 'You can use the suggestion above to fix the error.'}`;

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

    // Refresh editor layout when shown
    if (id === 'editor' && editor) {
        setTimeout(() => editor.layout(), 50);
    }

    // Load announcements when entering section
    if (id === 'announcements') {
        loadAnnouncements();
    }
}

function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    if (editor) monaco.editor.setTheme(isLight ? 'vs' : 'vs-dark');
}


window.showSection = showSection; window.toggleTheme = toggleTheme; window.executeCode = executeCode;

// --- API SETTINGS LOGIC (Hidden Admin Mode) ---
window.openSettings = () => {
    document.getElementById('apiKeyInput').value = localStorage.getItem('judge0_api_key') || "";
    document.getElementById('baseUrlInput').value = localStorage.getItem('judge0_base_url') || "https://ce.judge0.com";
    document.getElementById('aiKeyInput').value = localStorage.getItem('gemini_api_key') || "";
    document.getElementById('settingsModal').style.display = 'flex';
};

window.closeSettings = () => {
    document.getElementById('settingsModal').style.display = 'none';
};

window.saveSettings = () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const url = document.getElementById('baseUrlInput').value.trim() || "https://ce.judge0.com";
    const aiKey = document.getElementById('aiKeyInput').value.trim();

    localStorage.setItem('judge0_api_key', key);
    localStorage.setItem('judge0_base_url', url);
    localStorage.setItem('gemini_api_key', aiKey);

    RAPIDAPI_KEY = key;
    JUDGE0_BASE_URL = url;

    showToast("Settings Saved!");
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

// --- STUDENT GRADES SYSTEM (Dynamic Database) ---
let STUDENT_DATA_LIST = [
    {
        id: "2021001", name: "Ahmed Gamal", gpa: "3.8", grades: [
            { subject: "رياضيات 2", degree: "95", grade: "A+", points: "4.0" },
            { subject: "برمجة 2", degree: "88", grade: "A", points: "3.7" },
            { subject: "تراكيب محددة", degree: "92", grade: "A+", points: "4.0" }
        ]
    }
];

async function fetchAllGrades() {
    try {
        const response = await fetch('/api/grades');
        const data = await response.json();
        if (data && data.length > 0) STUDENT_DATA_LIST = data;
    } catch (err) { console.error("Could not fetch grades from server."); }
}
fetchAllGrades();

window.searchGrades = () => {
    const query = document.getElementById('studentSearch').value.trim();
    const resultDiv = document.getElementById('gradesResult');
    const placeholder = document.getElementById('gradesPlaceholder');
    const tableBody = document.getElementById('gradesTableBody');

    const student = STUDENT_DATA_LIST.find(s => s.id === query || s.name.toLowerCase().includes(query.toLowerCase()));

    if (student) {
        document.getElementById('resStudentName').textContent = student.name;
        document.getElementById('resStudentID').textContent = `ID: ${student.id}`;
        document.getElementById('resGPA').textContent = student.gpa;

        tableBody.innerHTML = student.grades.map(g => `
            <tr>
                <td>${escapeHTML(g.subject)}</td>
                <td>${escapeHTML(g.degree)}</td>
                <td class="grade-${escapeHTML(g.grade.charAt(0))}">${escapeHTML(g.grade)}</td>
                <td>${escapeHTML(g.points)}</td>
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
let SUBJECT_DATA = {
    math2: { title: "رياضيات 2", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] },
    prog2: { title: "برمجة 2", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] },
    discrete: {
        title: "تراكيب محددة",
        chapters: [
            { name: "Chapter 1", file: "Chapter 1 Set theory.pdf" },
            { name: "Chapter 2" },
            { name: "Chapter 3" },
            { name: "Chapter 4" },
            { name: "Chapter 5" }
        ],
        playlists: [
            { name: "Playlist 1 (Discrete Math)", url: "https://youtube.com/playlist?list=PLntliy4I5XRzm0hS26MvTknK1RlCnlIe7&si=jpNHIlbyLjclwO29" },
            { name: "Playlist 2 (Discrete Math)", url: "https://youtube.com/playlist?list=PLZEjCjHzGS_YmzjrYeM-bBgmeYF5riV7i&si=zF7PWzOezCh6l2zT" },
            { name: "Playlist 3 (Discrete Math)", url: "https://youtube.com/playlist?list=PLtqeb2-_b-2BkG8-inm5ho_W7fZTZHrVt&si=lKzlG66ETakEtBpp" }
        ],
        tasks: [
            {
                name: "Task #1: Subset Checker",
                content: "Write a C++ program that determines whether a given small array is a subset of a larger array. The program should compare the elements of both arrays and display an appropriate message indicating whether all elements of the small array are present in the large array."
            }
        ]
    },
    social: { title: "قضايا اجتماعية", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] },
    reports: { title: "كتابة التقارير", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] },
    datacom: { title: "تراسل البيانات", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] }
};

async function loadMaterials() {
    try {
        const response = await fetch('/api/materials');
        const data = await response.json();
        // Merge with defaults if needed, or just replace
        if (Object.keys(data).length > 0) {
            SUBJECT_DATA = { ...SUBJECT_DATA, ...data };
        }
    } catch (err) { console.error("Failed to load materials from server, using local defaults."); }
}
loadMaterials();

window.openSubject = (id) => {
    const data = SUBJECT_DATA[id];
    if (!data) return;

    document.getElementById('modalTitle').innerText = data.title;

    // Inject Playlists if available
    const playlistList = document.getElementById('playlistList');
    if (playlistList) {
        if (data.playlists && data.playlists.length > 0) {
            playlistList.innerHTML = data.playlists.map((pl, index) => `
                <li class="resource-item">
                    <span><i class="fab fa-youtube"></i> ${escapeHTML(pl.name)}</span>
                    <button class="btn-xs watch" onclick="window.open('${escapeHTML(pl.url)}', '_blank')">Watch</button>
                </li>
                ${index < data.playlists.length - 1 ? '<div class="playlist-separator">OR</div>' : ''}
            `).join('');
        } else {
            playlistList.innerHTML = `<li class="resource-item" style="opacity: 0.5; justify-content: center;"><span>No items in playlist yet</span></li>`;
        }
    }

    // Inject Chapters 1-5
    const chaptersList = document.getElementById('chaptersList');
    if (chaptersList) {
        chaptersList.innerHTML = data.chapters.map(ch => `
            <li class="resource-item">
                <span><i class="fas fa-folder-open"></i> ${escapeHTML(ch.name)}</span>
                <button class="btn-xs download" onclick="${ch.file ? `window.open('${escapeHTML(ch.file)}', '_blank')` : "alert('قريباً.. الملف قيد الرفع')"}">Open</button>
            </li>
        `).join('');
    }

    // Inject Tasks
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
        if (data.tasks && data.tasks.length > 0) {
            tasksList.innerHTML = data.tasks.map((task, index) => `
                <li class="task-card">
                    <div class="task-header" onclick="toggleTask(${index})" style="cursor: pointer;">
                        <div class="task-title">
                            <i class="fas fa-terminal"></i> ${escapeHTML(task.name)}
                        </div>
                        <div class="task-actions">
                            <i id="taskChevron-${index}" class="fas fa-chevron-down task-chevron"></i>
                            ${task.content ?
                    `<button class="btn-copy-alt" onclick="event.stopPropagation(); copyToClipboard(\`${escapeHTML(task.content)}\`)">
                                    <i class="fas fa-clone"></i> Copy
                                </button>` :
                    `<button class="btn-xs download" onclick="event.stopPropagation(); window.open('${escapeHTML(task.file)}', '_blank')">
                                    <i class="fas fa-file-download"></i> Download
                                </button>`
                }
                        </div>
                    </div>
                    ${task.content ? `
                        <div id="taskContent-${index}" class="task-content-box" style="display: none;">
                            ${escapeHTML(task.content)}
                        </div>
                    ` : ''}
                </li>
            `).join('');
        } else {
            tasksList.innerHTML = `<li class="resource-item" style="opacity: 0.5; justify-content: center;"><span>No tasks available yet</span></li>`;
        }
    }

    document.getElementById('subjectModal').style.display = 'flex';
};

window.toggleTask = (index) => {
    const content = document.getElementById(`taskContent-${index}`);
    const chevron = document.getElementById(`taskChevron-${index}`);
    if (content.style.display === 'none') {
        content.style.display = 'block';
        content.style.animation = 'slideDown 0.3s ease-out';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Task copied to clipboard!");
    });
};

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> <span></span>`;
    toast.querySelector('span').textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

window.togglePlaylist = () => {
    const list = document.getElementById('playlistList');
    const icon = document.getElementById('playlistChevron');
    if (list.style.display === 'none' || !list.style.display) {
        list.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        list.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
};

// Global click handler
window.onclick = (event) => {
    // 1. Close all modals on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => {
        if (event.target == m) m.style.display = 'none';
    });

    // 2. Close mobile menu on outside click
    const navLinks = document.querySelector('.nav-links');
    const menuBtn = document.querySelector('.mobile-menu-btn');

    // If menu is open AND click is NOT on the menu AND click is NOT on the menu button
    if (navLinks.classList.contains('active') &&
        !navLinks.contains(event.target) &&
        !menuBtn.contains(event.target)) {
        navLinks.classList.remove('active');
    }
};

// --- ANNOUNCEMENTS LOGIC ---
let socket;
try {
    if (typeof io !== 'undefined') socket = io();
} catch (e) { console.warn("Socket.io not loaded"); }

if (socket) {
    socket.on('new_announcement', (announcement) => {
        addAnnouncementToFeed(announcement, true);

        // Always notify, regardless of current view
        showToast("New Announcement! 📢");

        if (window.showNativeNotification) {
            showNativeNotification("CyberHub Update 🚀", announcement.text);
        }

        // Play a subtle sound if possible (optional enhancement)
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed', e)); // Auto-play policies might block
    });
}

// Old loadAnnouncements removed, replaced by real-time listener above

function addAnnouncementToFeed(a, isNew) {
    const feed = document.getElementById('announcementFeed');
    const card = document.createElement('div');
    card.className = 'announcement-card';
    if (isNew) card.style.borderColor = 'var(--primary-green)';

    const header = document.createElement('div');
    header.className = 'announcement-header';

    const time = new Date(a.created_at).toLocaleString();
    header.innerHTML = `
        <div class="announcement-time"><i class="fas fa-clock"></i> ${time}</div>
        <div class="announcement-source"><i class="fas fa-bullhorn"></i> Official Broadcast</div>
    `;

    const body = document.createElement('div');
    body.className = 'announcement-body';
    body.textContent = a.text;

    card.appendChild(header);
    card.appendChild(body);

    if (isNew) feed.prepend(card);
    else feed.appendChild(card);
}

// --- FIREBASE CONFIGURATION & INIT ---
const firebaseConfig = {
    apiKey: "AIzaSyDQgf1j2UZvRFoymarjnvRP6CJs2kmelFM",
    authDomain: "cyberhubfcizu.firebaseapp.com",
    projectId: "cyberhubfcizu",
    storageBucket: "cyberhubfcizu.firebasestorage.app",
    messagingSenderId: "603996616273",
    appId: "1:603996616273:web:619aadbce5862b18882a70",
    measurementId: "G-401J98N9RY"
};

// Initialize Firebase (Compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();
const analytics = firebase.analytics();

// --- REAL-TIME ANNOUNCEMENTS & NOTIFICATIONS ---
function loadAnnouncements() {
    const feed = document.getElementById('announcementFeed');
    const dbRef = db.ref('announcements');

    // Initial Load & Real-time Updates (Last 20)
    dbRef.limitToLast(20).on('value', (snapshot) => {
        feed.innerHTML = "";
        const data = snapshot.val();

        if (!data) {
            feed.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>No announcements yet.</p></div>`;
            return;
        }

        // Convert object to array and reverse (Newest First)
        const list = Object.entries(data).map(([key, val]) => ({ id: key, ...val })).reverse();
        list.forEach(a => addAnnouncementToFeed(a, false));
    });

    // Listen for NEW additions separately to trigger notifications
    // We use a timestamp check to avoid notifying for old messages on reload
    const loadTime = Date.now();
    dbRef.limitToLast(1).on('child_added', (snapshot) => {
        const val = snapshot.val();
        if (new Date(val.created_at).getTime() > loadTime) {
            showToast("New Announcement! 📢");
            if (window.showNativeNotification) {
                showNativeNotification("CyberHub Update 🚀", val.text);
            }
            // Play Sound
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.connect(g); g.connect(ctx.destination);
                    osc.frequency.setValueAtTime(440, ctx.currentTime);
                    g.gain.setValueAtTime(0.1, ctx.currentTime);
                    osc.start(); osc.stop(ctx.currentTime + 0.5);
                }
            } catch (e) { }
        }
    });
}

async function setupNotifications() {
    const btn = document.getElementById('enableNotifications');
    const status = document.getElementById('notificationStatus');

    if (!("Notification" in window)) {
        status.textContent = "This browser does not support desktop notification";
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            status.textContent = "✅ Notifications enabled!";
            status.style.color = "var(--primary-green)";
            btn.style.display = 'none';
            localStorage.setItem('notificationsEnabled', 'true');

            // Show a test notification
            new Notification("CyberHub FCI.ZU", {
                body: "You will now receive live updates directly here!",
                icon: "/favicon.ico"
            });

            // If Firebase messaging is actually configured, we can still use it
            if (messaging && firebaseConfig.apiKey !== "YOUR_API_KEY") {
                try {
                    const token = await messaging.getToken({ vapidKey: firebaseConfig.vapidKey || 'YOUR_VAPID_KEY' });
                    if (token) {
                        fetch('/api/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token })
                        });
                    }
                } catch (e) { console.warn("FCM Token failed, falling back to Native Sockets", e); }
            }
        } else {
            status.textContent = "Notifications blocked. Please enable via browser settings.";
            status.style.color = "var(--primary-red)";
        }
    } catch (err) {
        console.error("Notification Setup Error:", err);
        status.textContent = "Error enabling notifications.";
    }
}

document.getElementById('enableNotifications')?.addEventListener('click', setupNotifications);

// Helper to show native notification
window.showNativeNotification = (title, body) => {
    if (!("Notification" in window)) {
        console.error("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission === 'granted') {
        try {
            const notif = new Notification(title, {
                body: body,
                silent: false,
                requireInteraction: true // Keeps notification on screen until user interacts
            });
            notif.onclick = (event) => {
                event.preventDefault();
                window.focus();
                window.location.hash = '#announcements';
                showSection('announcements');
                notif.close();
            };
        } catch (e) {
            console.error("Notification trigger failed:", e);
        }
    } else {
        console.warn("Permission denied or default");
    }
};

// Initial load check
if (window.location.hash === '#announcements') {
    showSection('announcements');
}

// Notification Persistence Check
window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('enableNotifications');
    const container = document.querySelector('.announcement-controls');

    if (Notification.permission === 'granted' || localStorage.getItem('notificationsEnabled') === 'true') {
        if (container) container.style.display = 'none';
    }
});

// --- ADMIN DASHBOARD LOGIC ---
let adminToken = localStorage.getItem('adminToken');

window.openAdminLogin = () => {
    if (adminToken) showSection('admin');
    else document.getElementById('adminLoginModal').style.display = 'flex';
};

window.submitAdminLogin = async () => {
    const password = document.getElementById('adminPasswordInput').value;
    // For simplicity in static hosting, we check password against a hardcoded hash or DB value
    // In a real app, use firebase.auth().signInWithEmailAndPassword()

    // HASH CHECK (Simple Admin Protection)
    // The password is 'admin123' (You can change this logic later)
    if (password === "admin123") {
        adminToken = "firebase-admin-session";
        localStorage.setItem('adminToken', adminToken);
        document.getElementById('adminLoginModal').style.display = 'none';
        showSection('admin');
        showToast("Welcome Admin");
        loadAdminAnnouncements(); // Refresh admin list
    } else {
        alert("❌ Incorrect Password");
    }
};

// (Redundant block removed)

window.postAdminAnnouncement = async () => {
    const text = document.getElementById('adminAnnouncementText').value;
    if (!text.trim()) return;

    try {
        // Push to Firebase Realtime Database
        await db.ref('announcements').push({
            text: text,
            created_at: new Date().toISOString(),
            source: "admin_panel"
        });

        // Success Handling
        document.getElementById('adminAnnouncementText').value = "";
        showToast("Posted & Group Notified!");

        // Immediate feedback for Admin (Sound + Notification)
        if (Notification.permission === 'granted') {
            showNativeNotification("CyberHub Admin 🛡️", "Broadcast sent successfully: " + text);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showNativeNotification("CyberHub Admin 🛡️", "Broadcast sent successfully: " + text);
                }
            });
        }

        // Play confirmation sound (Web Audio API - No external file needed)
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const audioCtx = new AudioContext();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(500, audioCtx.currentTime); // Frequency in Hz
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
                oscillator.stop(audioCtx.currentTime + 0.5);
            }
        } catch (e) {
            console.warn("Audio Context failed", e);
        }

    } catch (err) {
        showToast("Error posting announcement");
        console.error(err);
    }
};

window.deleteAnnouncement = async (id) => {
    try {
        const response = await fetch(`/api/admin/announcement/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': adminToken }
        });
        const data = await response.json();
        if (data.success) {
            showToast("Deleted");
            loadAdminAnnouncements();
            loadAnnouncements(); // Refresh public feed too
        }
    } catch (err) {
        showToast("Delete failed");
    }
};

// Modify showSection to handle admin loading
const originalShowSection = window.showSection;
window.showSection = (id) => {
    if (id === 'admin' && !adminToken) {
        window.openAdminLogin();
        return;
    }
    if (typeof originalShowSection === 'function') originalShowSection(id);
    if (id === 'admin') {
        loadAdminAnnouncements();
        loadAdminMaterials();
        toggleAdminMaterialFields();
    }
};

// --- ADMIN UX LOGIC ---
window.switchAdminTab = (tabId) => {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).style.display = 'block';
    const navItems = document.querySelectorAll('.admin-nav-item');
    if (tabId === 'announcements') navItems[0].classList.add('active');
    if (tabId === 'materials') {
        navItems[1].classList.add('active');
        toggleAdminMaterialFields();
    }
};

async function loadAdminAnnouncements() {
    const list = document.getElementById('adminAnnouncementList');
    try {
        const response = await fetch('/api/announcements');
        const announcements = await response.json();
        list.innerHTML = announcements.map(a => `
            <div class="admin-item">
                <div class="item-text">${escapeHTML(a.text)}</div>
                <button class="btn-delete-icon" onclick="deleteAnnouncement('${a.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `).join('') || '<p style="opacity:0.5;">No broadcast transmissions found.</p>';
    } catch (err) {
        list.innerHTML = "<p>Error synchronization failed.</p>";
    }
}

// --- ADMIN MATERIALS LOGIC ---
window.handleAdminFileUpload = async () => {
    const fileInput = document.getElementById('adminFileInput');
    if (!fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const status = document.getElementById('adminMatUrlLabel');
    const originalText = status.textContent;
    status.textContent = "Uploading... Please wait";
    status.style.color = "var(--primary-cyan)";

    try {
        const response = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'x-admin-token': adminToken },
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('adminMatUrl').value = data.filePath;
            status.textContent = "✅ Uploaded successfully!";
            status.style.color = "var(--primary-green)";
            showToast("File uploaded to server");
        } else {
            alert("Upload failed: " + (data.error || "Unknown error"));
            status.textContent = originalText;
            status.style.color = "";
        }
    } catch (err) {
        console.error("Upload error:", err);
        alert("Server connection error during upload");
        status.textContent = originalText;
        status.style.color = "";
    } finally {
        fileInput.value = ""; // Clear for next upload
        setTimeout(() => {
            status.textContent = originalText;
            status.style.color = "";
        }, 3000);
    }
};

window.toggleAdminMaterialFields = () => {
    const filterSubjectId = document.getElementById('adminSubjectSelect').value;
    const type = document.getElementById('adminMaterialType').value;
    const chapRow = document.getElementById('adminChapterSelectRow');
    const urlRow = document.getElementById('adminUrlRow');
    const contentRow = document.getElementById('adminContentRow');
    const nameLabel = document.getElementById('adminMatNameLabel');
    const urlLabel = document.getElementById('adminMatUrlLabel');
    const uploadBtn = document.getElementById('adminUploadBtn');
    const chapSelect = document.getElementById('adminChapterIndex');

    chapRow.style.display = 'none';
    urlRow.style.display = 'block';
    contentRow.style.display = 'none';
    uploadBtn.style.display = 'none';
    nameLabel.textContent = "Asset Title";
    urlLabel.textContent = "URL / Link";

    if (type === 'chapter') {
        chapRow.style.display = 'block';
        uploadBtn.style.display = 'inline-block';
        nameLabel.textContent = "Chapter Name (Optional)";
        urlLabel.textContent = "Direct File Link (PDF/PPT)";

        // Dynamic Chapter Dropdown
        const data = SUBJECT_DATA[filterSubjectId];
        if (data) {
            const currentChapters = data.chapters || [];
            let options = currentChapters.map((ch, i) => `<option value="${i}">${ch && ch.name ? ch.name : 'Chapter ' + (i + 1)}</option>`).join('');
            options += `<option value="${currentChapters.length}">+ New Chapter</option>`;
            chapSelect.innerHTML = options;
        }
    } else if (type === 'task') {
        contentRow.style.display = 'block';
        urlRow.style.display = 'none';
        nameLabel.textContent = "Task Name";
    }
};

window.prepareNewChapterSlot = () => {
    const filterSubjectId = document.getElementById('adminSubjectSelect').value;
    const data = SUBJECT_DATA[filterSubjectId];
    if (!data) return;

    const currentCount = (data.chapters || []).length;
    const chapSelect = document.getElementById('adminChapterIndex');

    const nextNum = currentCount + 1;

    // Update dropdown to show the new option and select it
    const currentChapters = data.chapters || [];
    let options = currentChapters.map((ch, i) => `<option value="${i}">${ch && ch.name ? ch.name : 'Chapter ' + (i + 1)}</option>`).join('');
    options += `<option value="${currentCount}" selected>+ New Chapter</option>`;
    chapSelect.innerHTML = options;

    // Pre-fill fields for the user
    document.getElementById('adminMatName').value = `Chapter ${nextNum}`;
    document.getElementById('adminMatUrl').value = "";

    showToast(`Ready for Chapter ${nextNum} 🚀`);
    document.getElementById('adminMatUrl').focus();
};

window.addMaterialToSubject = async () => {
    const subjectId = document.getElementById('adminSubjectSelect').value;
    const type = document.getElementById('adminMaterialType').value;
    const name = document.getElementById('adminMatName').value;
    const url = document.getElementById('adminMatUrl').value;
    const content = document.getElementById('adminMatContent').value;
    const chapterIndex = document.getElementById('adminChapterIndex').value;

    if (!name.trim() && type !== 'chapter') return showToast("Name is required");

    const materialData = { name: name.trim() };
    let payload = { subjectId, material: { type, data: materialData } };

    if (type === 'chapter') {
        // Allow adding chapters without immediate file links
        materialData.file = url.trim() || null;
        if (!materialData.name) materialData.name = `Chapter ${parseInt(chapterIndex) + 1}`;
        payload.material.index = parseInt(chapterIndex);
    } else if (type === 'playlist') {
        if (!url.trim()) return showToast("Playlist link is required");
        materialData.url = url;
    } else if (type === 'task') {
        if (!content.trim()) return showToast("Task content is required");
        materialData.content = content;
    }

    try {
        const response = await fetch('/api/admin/material', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': adminToken
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} synchronized!`);
            document.getElementById('adminMatName').value = "";
            document.getElementById('adminMatUrl').value = "";
            document.getElementById('adminMatContent').value = "";
            await loadMaterials();
            loadAdminMaterials();
            toggleAdminMaterialFields();
        }
    } catch (err) { showToast("Logic synchronization failed"); }
};

async function loadAdminMaterials() {
    const filterSubjectId = document.getElementById('adminSubjectSelect').value;
    const list = document.getElementById('adminMaterialsList');
    list.innerHTML = "";

    const data = SUBJECT_DATA[filterSubjectId];
    if (!data) {
        list.innerHTML = '<p style="opacity:0.5; text-align:center;">Select a subject to manage its assets.</p>';
        return;
    }

    const group = document.createElement('div');
    group.className = 'admin-subject-group';

    const chaptersHTML = (data.chapters || []).map((ch, i) => renderAdminMatItem(filterSubjectId, 'chapter', ch ? ch.name : "Chapter " + (i + 1), i)).join('');
    const playlistsHTML = (data.playlists || []).map((pl, i) => renderAdminMatItem(filterSubjectId, 'playlist', pl.name, i)).join('');
    const tasksHTML = (data.tasks || []).map((tk, i) => renderAdminMatItem(filterSubjectId, 'task', tk.name, i)).join('');

    group.innerHTML = `
        <div class="admin-subject-header">
            <i class="fas fa-folder-open"></i> Managing Materials for: ${data.title}
        </div>
        
        <div class="admin-category-section">
            <h4 class="admin-cat-title"><i class="fas fa-file-pdf"></i> Chapters / Files</h4>
            <div class="admin-subject-items">${chaptersHTML || '<p class="admin-empty-txt">No files uploaded.</p>'}</div>
        </div>

        <div class="admin-category-section" style="margin-top:1.5rem;">
            <h4 class="admin-cat-title"><i class="fas fa-video"></i> Video Playlists</h4>
            <div class="admin-subject-items">${playlistsHTML || '<p class="admin-empty-txt">No playlists added.</p>'}</div>
        </div>

        <div class="admin-category-section" style="margin-top:1.5rem;">
            <h4 class="admin-cat-title"><i class="fas fa-tasks"></i> Assignments & Tasks</h4>
            <div class="admin-subject-items">${tasksHTML || '<p class="admin-empty-txt">No tasks defined.</p>'}</div>
        </div>
    `;
    list.appendChild(group);
}

function renderAdminMatItem(subjId, type, name, index) {
    const icon = type === 'chapter' ? 'fa-file-pdf' : (type === 'playlist' ? 'fa-video' : 'fa-tasks');
    return `
        <div class="admin-item" style="margin-bottom:5px; border-left: 2px solid var(--primary-cyan);">
            <div class="item-text" style="padding-left:10px;"><i class="fas ${icon}" style="opacity: 0.5; margin-right:10px;"></i> ${escapeHTML(name || "Item")}</div>
            <button class="btn-delete-icon" onclick="deleteAdminMaterial('${subjId}', '${type}', ${index})" style="transform: scale(0.8);"><i class="fas fa-trash"></i></button>
        </div>
    `;
}

window.deleteAdminMaterial = async (subjId, type, index) => {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`/api/admin/material/${subjId}/${type}/${index}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': adminToken }
        });
        if (response.ok) {
            showToast("Deleted");
            await loadMaterials();
            loadAdminMaterials();
        }
    } catch (err) { showToast("Delete failed"); }
};
