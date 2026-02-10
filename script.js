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

let RAPIDAPI_HOST = "";
try {
    if (JUDGE0_BASE_URL.includes('://')) {
        RAPIDAPI_HOST = new URL(JUDGE0_BASE_URL).host;
    } else {
        RAPIDAPI_HOST = JUDGE0_BASE_URL.split('/')[0];
    }
} catch (e) {
    RAPIDAPI_HOST = "ce.judge0.com";
}

const MONACO_MODES = {
    'python': 'python',
    'javascript': 'javascript',
    'cpp': 'cpp',
    'c': 'c',
    'java': 'java',
    'php': 'php',
    'sql': 'sql'
};

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

    const startResizing = (clientY) => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');
    };

    const stopResizing = () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            document.body.classList.remove('resizing');
            if (editor) editor.layout();
        }
    };

    const handleResizing = (clientY) => {
        if (!isResizing) return;

        const container = document.querySelector('.editor-container');
        const containerRect = container.getBoundingClientRect();
        const relativeY = clientY - containerRect.top;

        // Calculate new height for output panel
        const newHeight = containerRect.height - relativeY - resizer.offsetHeight;

        // Minimum heights for both parts
        const minOutputHeight = 60;
        const maxOutputHeight = containerRect.height - 120;

        if (newHeight >= minOutputHeight && newHeight <= maxOutputHeight) {
            outputPanel.style.height = `${newHeight}px`;
            if (editor) editor.layout(); // Refresh Monaco
        }
    };

    // Mouse Events
    resizer.addEventListener('mousedown', (e) => startResizing(e.clientY));
    window.addEventListener('mousemove', (e) => handleResizing(e.clientY));
    window.addEventListener('mouseup', stopResizing);

    // Touch Events (Mobile Support)
    resizer.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) startResizing(e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isResizing && e.touches.length > 0) {
            handleResizing(e.touches[0].clientY);
            // Prevent scroll while resizing
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('touchend', stopResizing);
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

    // Fetch announcements if section is shown
    if (id === 'announcements' && typeof fetchAnnouncements !== 'undefined') {
        fetchAnnouncements();
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
    math2: {
        title: "رياضيات 2",
        chapters: [
            { name: "Chapter 1", file: "رياضيات 2/Math_2.pdf" },
            { name: "Chapter 2" },
            { name: "Chapter 3" },
            { name: "Chapter 4" },
            { name: "Chapter 5" }
        ],
        playlists: [
            { name: "Playlist 1 (رياضيات 2)", url: "https://youtube.com/playlist?list=PLsQO4gY4v8bmFCTEOzYcXP5itgwboSw4y&si=JtNIIBRvah_-q9zV" }
        ],
        tasks: []
    },
    prog2: { title: "برمجة 2", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] },
    discrete: {
        title: "تراكيب محددة",
        chapters: [
            { name: "Chapter 1", file: "تراكيب محددة/Chapter 1 Set theory.pdf" },
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
    reports: {
        title: "كتابة التقارير",
        chapters: [
            { name: "Chapter 1", file: "كتابة تقارير/Report Writing and Presentation skills 2025.pdf" },
            { name: "Chapter 2" },
            { name: "Chapter 3" },
            { name: "Chapter 4" },
            { name: "Chapter 5" }
        ],
        playlists: [
            { name: "Playlist 1 (كتابة التقارير)", url: "https://www.youtube.com/watch?v=mdjyeHaWCgU&list=PLMzaNeHCFdm_kDzoxwO8t2wVcypqOhXCt" }
        ],
        tasks: []
    },
    datacom: { title: "تراسل البيانات", chapters: [{ name: "Chapter 1" }, { name: "Chapter 2" }, { name: "Chapter 3" }, { name: "Chapter 4" }, { name: "Chapter 5" }], playlists: [], tasks: [] }
};

async function loadMaterials() {
    try {
        const response = await fetch('data/materials.json?v=1.8');
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
            SUBJECT_DATA = data;
        }
    } catch (err) { console.error("Failed to load materials from JSON, using code defaults."); }
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
                <button class="btn-xs download" onclick="${ch.file ? `window.open('${escapeHTML(ch.file)}', '_blank')` : "alert('📚 لم يتم رفع هذا الفصل حتى الآن\\n\\nسيتم رفع الملف قريباً إن شاء الله')"}">Open</button>
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

/* =========================================
   CYBERHUB ANNOUNCEMENTS & PUSH LOGIC
   ========================================= */

// Instructions: Replace these placeholders with your actual Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase if configured
if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('YOUR_')) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();

    // 1. Fetch & Display Announcements
    window.fetchAnnouncements = () => {
        const feed = document.getElementById('announcementFeed');
        const adminFeed = document.getElementById('adminFeedList');

        db.ref('announcements').orderByChild('timestamp').on('value', (snapshot) => {
            const data = snapshot.val();
            let items = [];
            if (data) {
                items = Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse();
            }

            if (feed) {
                if (items.length === 0) {
                    feed.innerHTML = `<div class="empty-state"><i class="fas fa-info-circle"></i><p>No announcements yet.</p></div>`;
                } else {
                    feed.innerHTML = items.map(item => `
                        <div class="announcement-card">
                            <div class="announcement-header">
                                <span class="announcement-badge">${escapeHTML(item.category || 'Update')}</span>
                                <span class="announcement-date">${new Date(item.timestamp).toLocaleDateString()}</span>
                            </div>
                            <h3>${escapeHTML(item.title)}</h3>
                            <p>${escapeHTML(item.body)}</p>
                            ${item.link ? `<a href="${escapeHTML(item.link)}" target="_blank" class="btn-announcement">Read More <i class="fas fa-arrow-right"></i></a>` : ''}
                        </div>
                    `).join('');
                }
            }

            if (adminFeed) {
                adminFeed.innerHTML = items.map(item => `
                    <div class="admin-feed-item">
                        <div class="admin-feed-info">
                            <h4>${escapeHTML(item.title)}</h4>
                            <p>${new Date(item.timestamp).toLocaleString()}</p>
                        </div>
                        <button class="btn-delete" onclick="deleteAnnouncement('${item.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('');
            }
        });
    };

    window.deleteAnnouncement = (id) => {
        if (confirm("Are you sure you want to delete this?")) {
            db.ref('announcements/' + id).remove();
        }
    };
} else {
    window.fetchAnnouncements = () => {
        const feed = document.getElementById('announcementFeed');
        if (feed) feed.innerHTML = `<div class="empty-state"><i class="fas fa-plug"></i><p>Firebase not configured. Please add config in script.js.</p></div>`;
    };
}

// 1. Admin Login Logic
window.verifyAdmin = () => {
    const pass = document.getElementById('adminPassInput').value;
    if (pass === "CyberHub@2026") {
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        localStorage.setItem('cyberhub_admin', 'true');
        if (typeof fetchAnnouncements !== 'undefined') fetchAnnouncements();
    } else {
        document.getElementById('loginError').innerText = "Incorrect Password!";
    }
};

window.logoutAdmin = () => {
    localStorage.removeItem('cyberhub_admin');
    location.reload();
};

// 2. OneSignal Integration
window.OneSignal = window.OneSignal || [];
const ONESIGNAL_APP_ID = "7120fe27-c5b8-4b22-8c2f-64b18f99f83b";
const ONESIGNAL_REST_API_KEY = "os_v2_app_oeqp4j6fxbecfdbpmsyy7gpyhniussvrcaiusenafhxutm2ipju2zedu2lrsjcfknjhi5hyft6uxlcyfbyzjploia5gvft4ir7ivyqi";

if (ONESIGNAL_APP_ID && !ONESIGNAL_APP_ID.includes('YOUR_')) {
    OneSignal.push(function () {
        OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            notifyButton: {
                enable: true,
                text: { 'tip.state.unsubscribed': 'Subscribe for Notifications 🔔' }
            }
        });
    });
}

window.postAnnouncement = async () => {
    const title = document.getElementById('notifTitle').value;
    const body = document.getElementById('notifBody').value;
    const link = document.getElementById('notifLink').value;
    const sendPush = true; // Always send push for now if you want them together

    if (!title || !body) return alert("Title and Message are required!");

    const btn = document.getElementById('postBtn');
    btn.disabled = true;
    const oldHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // Save to Firebase if initialized
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            const db = firebase.database();
            const newRef = db.ref('announcements').push();
            await newRef.set({
                title, body, link,
                timestamp: Date.now(),
                category: "Announcement"
            });
        }

        // Send Push via OneSignal
        if (sendPush && !ONESIGNAL_REST_API_KEY.includes('YOUR_')) {
            await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    included_segments: ["All"],
                    headings: { "en": title },
                    contents: { "en": body },
                    url: link || window.location.origin
                })
            });
        }

        alert("Success! Announcement posted and notification sent.");
        document.getElementById('notifTitle').value = "";
        document.getElementById('notifBody').value = "";
        document.getElementById('notifLink').value = "";
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHTML;
    }
};

// Auto-login check for admin page
window.addEventListener('load', () => {
    if (window.is_admin_view) {
        if (localStorage.getItem('cyberhub_admin') === 'true') {
            const overlay = document.getElementById('adminLoginOverlay');
            const content = document.getElementById('adminContent');
            if (overlay) overlay.style.display = 'none';
            if (content) content.style.display = 'block';
            if (typeof fetchAnnouncements !== 'undefined') fetchAnnouncements();
        }
    }
});
