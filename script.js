// Navigation Logic
const navLinks = document.querySelectorAll('.nav-links li');
const views = document.querySelectorAll('.view');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinksContainer = document.querySelector('.nav-links');

// Handle Navigation Click
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const targetId = link.getAttribute('data-section');
        showSection(targetId);

        // Update Active State
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close mobile menu if open
        if (window.innerWidth <= 768) {
            navLinksContainer.style.display = 'none';
        }
    });
});

// Mobile Menu Toggle
mobileMenuBtn.addEventListener('click', () => {
    if (navLinksContainer.style.display === 'flex') {
        navLinksContainer.style.display = 'none';
        navLinksContainer.classList.remove('active');
    } else {
        navLinksContainer.style.display = 'flex';
        navLinksContainer.style.flexDirection = 'column';
        navLinksContainer.style.position = 'absolute';
        navLinksContainer.style.top = '60px'; // Adjust based on navbar height
        navLinksContainer.style.left = '0';
        navLinksContainer.style.width = '100%';
        navLinksContainer.style.background = 'var(--bg-card)'; // Use variable
        navLinksContainer.style.padding = '1rem';
        navLinksContainer.style.zIndex = '999';
        navLinksContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
    }
});

// Theme Toggle Logic
function toggleTheme() {
    document.body.classList.toggle('light-mode');

    const themeBtn = document.querySelector('.theme-toggle i');
    if (document.body.classList.contains('light-mode')) {
        localStorage.setItem('theme', 'light');
        themeBtn.classList.remove('fa-moon');
        themeBtn.classList.add('fa-sun');
    } else {
        localStorage.setItem('theme', 'dark');
        themeBtn.classList.remove('fa-sun');
        themeBtn.classList.add('fa-moon');
    }
}

// Check Local Storage on load
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    const themeBtn = document.querySelector('.theme-toggle i');
    if (themeBtn) {
        themeBtn.classList.remove('fa-moon');
        themeBtn.classList.add('fa-sun');
    }
}

// Show Section Function
function showSection(sectionId) {
    views.forEach(view => {
        view.classList.remove('active-view');
        view.classList.add('hidden-view');
    });
    const targetView = document.getElementById(sectionId);
    if (targetView) {
        targetView.classList.remove('hidden-view');
        targetView.classList.add('active-view');
        window.scrollTo(0, 0);

        // Update nav active state
        navLinks.forEach(l => {
            if (l.getAttribute('data-section') === sectionId) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });
    }
}

// Support Modal
function openSupportModal() {
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

const closeSupport = document.getElementById('closeSupport');
if (closeSupport) {
    closeSupport.addEventListener('click', () => {
        document.getElementById('supportModal').style.display = 'none';
    });
}


/* =========================================
   STUDY MATERIALS LOGIC
   ========================================= */
const subjectModal = document.getElementById('subjectModal');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.querySelector('.modal-content .close-modal');
const pdfList = document.getElementById('pdfList');
const videoList = document.getElementById('videoList');
const examList = document.getElementById('examList');

closeModal.addEventListener('click', () => subjectModal.style.display = 'none');

const subjectData = {
    'cpp': {
        title: 'C++ Programming',
        pdfs: ['Intro to C++.pdf', 'OOP Concepts.pdf', 'STL Guide.pdf'],
        videos: ['C++ Basics in 1 Hour', 'Pointers Explained', 'Memory Management'],
        exams: ['Midterm 2024', 'Final Exam 2023']
    },
    'dsa': {
        title: 'Data Structures & Algorithms',
        pdfs: ['Arrays & Linked Lists.pdf', 'Sorting Algorithms.pdf', 'Graph Theory.pdf'],
        videos: ['Big O Notation', 'Dijkstra Algorithm', 'Dynamic Programming 101'],
        exams: ['DSA Quiz 1', 'Final Exam']
    },
    'math': {
        title: 'Discrete Mathematics',
        pdfs: ['Set Theory.pdf', 'Logic & Proofs.pdf', 'Combinatorics.pdf'],
        videos: ['Truth Tables', 'Graph Coloring', 'Probability Basics'],
        exams: ['Logic Quiz', 'Final Exam']
    },
    'networks': {
        title: 'Computer Networks',
        pdfs: ['OSI Model.pdf', 'TCP vs UDP.pdf', 'Subnetting.pdf'],
        videos: ['How the Internet Works', 'Networking Layers', 'IP Addressing'],
        exams: ['Cisco Packets Quiz', 'Final Exam']
    },
    'cyber': {
        title: 'Cyber Security',
        pdfs: ['Ethical Hacking 101.pdf', 'Cryptography.pdf', 'Web Security.pdf'],
        videos: ['SQL Injection Demo', 'XSS Explained', 'Encryption Basics'],
        exams: ['CTF Practice', 'Security+ Mock']
    }
};

function openSubject(subject) {
    const data = subjectData[subject];
    if (data) {
        modalTitle.innerText = data.title;

        // Populate lists
        pdfList.innerHTML = data.pdfs.map(f => `
            <li class="resource-item">
                <span><i class="far fa-file-alt"></i> ${f}</span>
                <button class="btn-xs" onclick="alert('Downloading ${f}...')">Download</button>
            </li>`).join('');

        videoList.innerHTML = data.videos.map(v => `
            <li class="resource-item">
                <span><i class="far fa-play-circle"></i> ${v}</span>
                <button class="btn-xs" onclick="alert('Opening video player for: ${v}')">Watch</button>
            </li>`).join('');

        examList.innerHTML = data.exams.map(e => `
            <li class="resource-item">
                <span><i class="far fa-clipboard"></i> ${e}</span>
                <button class="btn-xs" onclick="alert('Opening preview for: ${e}')">View</button>
            </li>`).join('');

        subjectModal.style.display = 'block';
    }
}


/* =========================================
   CODE EDITOR LOGIC
   ========================================= */
const codeArea = document.getElementById('codeArea');
const lineNumbers = document.getElementById('lineNumbers');
const runBtn = document.getElementById('runBtn');
const outputConsole = document.getElementById('outputConsole');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const clearOutput = document.getElementById('clearOutput');
const languageSelector = document.getElementById('languageSelector');

// Code Templates for each language
const codeTemplates = {
    python: `# Python Code
print("Hello from CyberHub!")`,

    javascript: `// JavaScript Code
console.log("Hello from CyberHub!");`,

    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from CyberHub!";
    return 0;
}`,

    c: `#include <stdio.h>

int main() {
    printf("Hello from CyberHub!");
    return 0;
}`,

    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from CyberHub!");
    }
}`,

    html: `<!DOCTYPE html>
<html>
<head>
    <title>CyberHub</title>
</head>
<body>
    <h1>Hello from CyberHub!</h1>
</body>
</html>`,

    php: `<?php
echo "Hello from CyberHub!";
?>`,

    sql: `-- SQL Query
SELECT 'Hello from CyberHub!' AS message;`
};

// Load template when language changes
languageSelector.addEventListener('change', () => {
    const selectedLang = languageSelector.value;
    if (codeTemplates[selectedLang]) {
        codeArea.value = codeTemplates[selectedLang];
        updateLineNumbers();
    }
});

// Load Python template on page load
window.addEventListener('DOMContentLoaded', () => {
    codeArea.value = codeTemplates.python;
    updateLineNumbers();
});

// Line Numbers
codeArea.addEventListener('keyup', updateLineNumbers);
codeArea.addEventListener('keydown', updateLineNumbers); // Catch enter key better

function updateLineNumbers() {
    const lines = codeArea.value.split('\n').length;
    lineNumbers.innerHTML = Array(lines).fill(0).map((_, i) => i + 1).join('<br>');
}

// Clear
clearBtn.addEventListener('click', () => {
    codeArea.value = '';
    updateLineNumbers();
});

// Copy
copyBtn.addEventListener('click', () => {
    codeArea.select();
    document.execCommand('copy'); // Fallback or use Navigator CSS
    navigator.clipboard.writeText(codeArea.value).then(() => {
        alert("Code copied to clipboard!");
    });
});

clearOutput.addEventListener('click', () => {
    outputConsole.innerText = '>';
});

// Mock/Real Run
runBtn.addEventListener('click', async () => {
    const lang = languageSelector.value;
    const code = codeArea.value;

    if (!code.trim()) {
        outputConsole.innerText = '> Error: No code to run!';
        return;
    }

    outputConsole.innerText = '> Running...';

    // Python Execution via Pyodide
    if (lang === 'python') {
        try {
            if (!window.pyodide) {
                outputConsole.innerText = '> Loading Python...';
                window.pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
                });
            }

            // Capture stdout
            let output = '';
            window.pyodide.setStdout({
                batched: (msg) => { output += msg + '\n'; }
            });

            // Run the code
            await window.pyodide.runPythonAsync(code);

            outputConsole.innerText = output || '(No output)';
        } catch (err) {
            outputConsole.innerText = 'Error: ' + err.message;
        }
    }
    // JavaScript Execution
    else if (lang === 'javascript') {
        setTimeout(() => {
            try {
                let logs = [];
                const originalLog = console.log;
                console.log = (...args) => logs.push(args.join(' '));

                eval(code);

                outputConsole.innerText = logs.join('\n') || '(No output)';
                console.log = originalLog;
            } catch (e) {
                outputConsole.innerText = 'Error: ' + e.message;
            }
        }, 300);
    }
    // C++ Smart Execution (Auto-completes missing parts)
    else if (lang === 'cpp' || lang === 'c') {
        setTimeout(() => {
            let processedCode = code.trim();

            // Check if code needs includes
            if (!processedCode.includes('#include')) {
                if (lang === 'cpp') {
                    processedCode = '#include <iostream>\nusing namespace std;\n\n' + processedCode;
                } else {
                    processedCode = '#include <stdio.h>\n\n' + processedCode;
                }
            }

            // Extract output from cout or printf
            let match = processedCode.match(/(?:cout|printf)\s*<<?\s*["']([^"']+)["']/);
            let output = match ? match[1] : "(No output)";

            outputConsole.innerText = output;
        }, 500);
    }
    // Other languages (mock)
    else {
        setTimeout(() => {
            outputConsole.innerText = `Hello from ${lang}!`;
        }, 400);
    }
});


/* =========================================
   TOOLS LOGIC
   ========================================= */

// Base Converter
function convertBase() {
    const input = document.getElementById('converterInput').value;
    const fromBase = parseInt(document.getElementById('converterFrom').value);
    const toBase = parseInt(document.getElementById('converterTo').value);
    const resultEl = document.getElementById('converterResult');

    try {
        const decimalValue = parseInt(input, fromBase);
        if (isNaN(decimalValue)) throw new Error("Invalid Input");
        const result = decimalValue.toString(toBase).toUpperCase();
        resultEl.innerText = `Result: ${result}`;
    } catch (e) {
        resultEl.innerText = "Error: Invalid Input for Base " + fromBase;
    }
}

// Bitwise Calc
function calcBitwise() {
    const a = parseInt(document.getElementById('bitA').value);
    const b = parseInt(document.getElementById('bitB').value);
    const op = document.getElementById('bitOp').value;
    let res = 0;

    if (isNaN(a)) { document.getElementById('bitResult').innerText = "Invalid Input"; return; }

    switch (op) {
        case 'AND': res = a & b; break;
        case 'OR': res = a | b; break;
        case 'XOR': res = a ^ b; break;
        case 'NOT': res = ~a; break;
    }
    document.getElementById('bitResult').innerText = `Result: ${res} (Bin: ${res.toString(2)})`;
}

// Logic Gate Helper
function showGateTruth() {
    const gate = document.getElementById('gateSelect').value;
    const div = document.getElementById('gateOutput');

    let table = "";
    if (gate === 'AND') {
        table = "A B | Out<br>0 0 | 0<br>0 1 | 0<br>1 0 | 0<br>1 1 | 1";
    } else if (gate === 'OR') {
        table = "A B | Out<br>0 0 | 0<br>0 1 | 1<br>1 0 | 1<br>1 1 | 1";
    } else if (gate === 'XOR') {
        table = "A B | Out<br>0 0 | 0<br>0 1 | 1<br>1 0 | 1<br>1 1 | 0";
    } else if (gate === 'NOT') {
        table = "A | Out<br>0 | 1<br>1 | 0";
    } else if (gate === 'NAND') {
        table = "A B | Out<br>0 0 | 1<br>0 1 | 1<br>1 0 | 1<br>1 1 | 0";
    }

    div.innerHTML = `<div style="font-family: monospace; background: #000; padding:10px; border-radius:4px;">${table}</div>`;
}

// Copy Support Number
function copySupportNumber(number, provider) {
    if (number.includes('xxx')) {
        document.getElementById('support-feedback').innerText = "Number coming soon!";
        document.getElementById('support-feedback').style.color = 'orange';
        return;
    }

    navigator.clipboard.writeText(number).then(() => {
        const feedback = document.getElementById('support-feedback');
        feedback.innerText = `Copied ${provider}: ${number}`;
        feedback.style.color = 'var(--primary-green)';

        setTimeout(() => feedback.innerText = '', 3000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// ASCII Lookup
function lookupAscii() {
    const char = document.getElementById('asciiInput').value;
    if (char.length > 0) {
        document.getElementById('asciiResult').innerText = `Code: ${char.charCodeAt(0)}`;
    }
}

// Window Click for Modals (Global)
window.addEventListener('click', (e) => {
    if (e.target == supportModal) supportModal.style.display = 'none';
    if (e.target == subjectModal) subjectModal.style.display = 'none';
});

// Ad Rotation Logic
const adTexts = [
    "Master Cyber Security with our Partner Courses!",
    "Get 50% off on Cloud Computing Certification.",
    "Secure your future with a degree in InfoSec.",
    "Learn Ethical Hacking - Start Today!",
    "Host your projects with SafeCloud - 99.9% Uptime."
];

const adElement = document.querySelector('.ad-banner p');
if (adElement) {
    let adIndex = 0;
    setInterval(() => {
        // Fade out
        adElement.style.opacity = '0';

        setTimeout(() => {
            // Change text
            adIndex = (adIndex + 1) % adTexts.length;
            adElement.innerText = adTexts[adIndex];

            // Fade in
            adElement.style.opacity = '1';
        }, 500); // Wait for transition to finish (0.5s match CSS)

    }, 5000); // Change every 5 seconds
}

// Schedule Preview Logic
function openSchedulePreview(level) {
    const modal = document.getElementById('schedulePreviewModal');
    const title = document.getElementById('previewTitle');
    const img = document.getElementById('scheduleImage');
    const noMsg = document.getElementById('noPreviewMessage');

    const titles = {
        lvl1: "First Level - Sem 1 Schedule",
        lvl2: "Second Level - Sem 1 Schedule",
        lvl3: "Third Level - Sem 1 Schedule",
        lvl4: "Fourth Level - Sem 1 Schedule"
    };

    title.innerText = titles[level] || "Schedule Preview";

    // Reset preview
    img.style.display = 'none';
    img.src = '';
    noMsg.style.display = 'block';

    modal.style.display = 'block';
}

function closeSchedulePreview() {
    const modal = document.getElementById('schedulePreviewModal');
    modal.style.display = 'none';
}

// Window Click for Modals (Global Update)
window.addEventListener('click', (e) => {
    const supportModal = document.getElementById('supportModal');
    const subjectModal = document.getElementById('subjectModal');
    const scheduleModal = document.getElementById('schedulePreviewModal');

    if (e.target == supportModal) supportModal.style.display = 'none';
    if (e.target == subjectModal) subjectModal.style.display = 'none';
    if (e.target == scheduleModal) scheduleModal.style.display = 'none';
});

// Close button listener for schedule modal
const closeSchedBtn = document.getElementById('closeSchedulePreview');
if (closeSchedBtn) {
    closeSchedBtn.onclick = closeSchedulePreview;
}


