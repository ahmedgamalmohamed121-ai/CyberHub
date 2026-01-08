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
            navLinksContainer.classList.remove('active');
        }
    });
});

// Mobile Menu Toggle
function toggleMobileMenu() {
    navLinksContainer.classList.toggle('active');
}

// Ensure the button also works if event listener is preferred or for compatibility
if (mobileMenuBtn) {
    mobileMenuBtn.onclick = toggleMobileMenu;
}

// Theme Toggle Logic
function toggleTheme() {
    // Add temporary class to handle smooth transition
    document.body.classList.add('theme-transition');

    document.body.classList.toggle('light-mode');

    const themeBtn = document.querySelector('.theme-toggle i');
    if (document.body.classList.contains('light-mode')) {
        localStorage.setItem('theme', 'light');
        if (themeBtn) themeBtn.className = 'fas fa-sun';
    } else {
        localStorage.setItem('theme', 'dark');
        if (themeBtn) themeBtn.className = 'fas fa-moon';
    }

    // Remove the transition class after animation finishes to keep performance high
    setTimeout(() => {
        document.body.classList.remove('theme-transition');
    }, 400);
}

// Check Local Storage and Sync UI on load
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light' || document.body.classList.contains('light-mode')) {
        document.body.classList.add('light-mode');
        const themeBtn = document.querySelector('.theme-toggle i');
        if (themeBtn) {
            themeBtn.className = 'fas fa-sun';
        }
    }
});

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

// Comprehensive Code Templates for College Projects
const codeTemplates = {
    python: `# Python 3 - Mega Template
import sys
import os
import math
import random
import time
import datetime
import collections
import itertools

def main():
    """ Main entry point of the app """
    print("Welcome to CyberHub Python IDE!")
    print(f"Current Time: {datetime.datetime.now()}")
    print("---------------------------------")
    
    # Your code here
    print("Hello from CyberHub!")

if __name__ == "__main__":
    main()`,

    javascript: `// JavaScript ES6+ Template
"use strict";

// Common Utility functions
const utils = {
    now: () => new Date().toLocaleString(),
    random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
};

const main = () => {
    console.log("Welcome to CyberHub JavaScript Console");
    console.log("Time:", utils.now());
    console.log("---------------------------------");
    
    console.log("Hello from CyberHub!");
};

main();`,

    cpp: `#include <bits/stdc++.h> // Includes all standard libraries (Perfect for College/CP)

using namespace std;

/**
 * CyberHub C++ Academic Template
 * Level: FCI.ZU Graduation Standard
 */
int main() {
    // Optimization for fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    cout << "Welcome to CyberHub C++ Environment" << endl;
    cout << "---------------------------------" << endl;
    
    cout << "Hello from CyberHub!" << endl;

    return 0;
}`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <time.h>
#include <stdbool.h>

/**
 * CyberHub C Standard Template
 */
int main() {
    printf("Welcome to CyberHub C Environment\\n");
    printf("---------------------------------\\n");
    
    printf("Hello from CyberHub!\\n");
    
    return 0;
}`,

    java: `import java.util.*;
import java.io.*;
import java.math.*;
import java.text.*;

/**
 * CyberHub Java Solution Template
 */
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        System.out.println("Welcome to CyberHub Java Console");
        System.out.println("---------------------------------");
        
        System.out.println("Hello from CyberHub!");
    }
}`,

    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CyberHub Web Preview</title>
    <!-- Modern Styling -->
    <style>
        :root { --primary: #00f3ff; --bg: #0f172a; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background-color: var(--bg); 
            color: white; 
            display: flex; 
            flex-direction: column;
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
        }
        .card {
            background: rgba(255,255,255,0.05);
            padding: 2rem;
            border-radius: 15px;
            border: 1px solid var(--primary);
            box-shadow: 0 0 20px rgba(0,243,255,0.2);
        }
        h1 { color: var(--primary); margin-top: 0; }
    </style>
</head>
<body>
    <div class="card">
        <h1>CyberHub Web Editor</h1>
        <p>Live Preview is working!</p>
        <p>Edit this code to see changes.</p>
    </div>
</body>
</html>`,

    php: `<?php
/**
 * CyberHub PHP Academic Template
 */

// Error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain');

echo "Welcome to CyberHub PHP Console\\n";
echo "---------------------------------\\n";

echo "Hello from CyberHub!\\n";

// PHP Logic here
$date = date('Y-m-d H:i:s');
echo "Current Server Time: " . $date . "\\n";
?>`,

    sql: `-- CyberHub SQL Terminal Template
-- ---------------------------------
-- Use this for database queries and logic

-- Example Schema Setup
-- CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(100), gpa DECIMAL(3,2));
-- INSERT INTO students VALUES (1, 'Ahmed Gamal', 3.9);

SELECT 
    'Hello from CyberHub!' AS Message,
    'Database Ready' AS Status,
    CURRENT_TIMESTAMP AS QueryTime;`
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
    // C++ & C Multi-command execution
    else if (lang === 'cpp' || lang === 'c') {
        setTimeout(() => {
            let processedCode = code.trim();
            // Intelligent regex to capture strings or endl linked by << or printf
            const regex = /(?:cout\s*<<|printf\s*\()?\s*(?:<<\s*)?["']([^"']*)["']|(?:cout\s*<<|<<\s*)\bendl\b|\bendl\b/g;
            let matches = [...processedCode.matchAll(regex)];

            if (matches.length > 0) {
                let resultChars = [];
                for (const match of matches) {
                    // Check if it's an endl keyword
                    if (match[0].includes('endl')) {
                        resultChars.push('\n');
                    } else if (match[1] !== undefined) {
                        // Interpret \n and \t explicitly from the string
                        let text = match[1]
                            .replace(/\\n/g, '\n')
                            .replace(/\\t/g, '    ')
                            .replace(/\\r/g, '')
                            .replace(/\\"/g, '"')
                            .replace(/\\'/g, "'");
                        resultChars.push(text);
                    }
                }
                outputConsole.innerText = resultChars.join('');
            } else {
                outputConsole.innerText = "(No output detected - Use cout or printf)";
            }
        }, 500);
    }
    // Java Multi-command execution
    else if (lang === 'java') {
        setTimeout(() => {
            const regex = /System\.out\.print(?:ln)?\s*\(\s*["']([^"']+)["']\s*\)/g;
            let matches = [...code.matchAll(regex)];
            if (matches.length > 0) {
                outputConsole.innerText = matches.map(m => m[1]).join('\n');
            } else {
                outputConsole.innerText = "(No output or unsupported command)";
            }
        }, 500);
    }
    // PHP & SQL Multi-command execution
    else if (lang === 'php' || lang === 'sql') {
        setTimeout(() => {
            let regex;
            if (lang === 'php') {
                regex = /(?:echo|print)\s*(?:\()?\s*["']([^"']+)["']/g;
            } else {
                regex = /SELECT\s*["']([^"']+)["']/gi;
            }

            let matches = [...code.matchAll(regex)];
            if (matches.length > 0) {
                outputConsole.innerText = matches.map(m => m[1]).join('\n');
            } else {
                outputConsole.innerText = "Hello from " + lang.toUpperCase() + "!";
            }
        }, 400);
    }
    // Default Mock
    else {
        setTimeout(() => {
            outputConsole.innerText = `Hello from ${lang.toUpperCase()}!`;
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



// Student Grades Search Logic
const mockGradesData = {
    // Real data will be added here
};

const studentSearchInput = document.getElementById('studentSearch');
const suggestionsContainer = document.getElementById('searchSuggestions');

if (studentSearchInput) {
    studentSearchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = '';

        if (value.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        const matches = [];
        for (const id in mockGradesData) {
            const student = mockGradesData[id];
            if (id.toLowerCase().includes(value) || student.name.toLowerCase().includes(value)) {
                matches.push({ id, ...student });
            }
        }

        if (matches.length > 0) {
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                    <span>${match.name}</span>
                    <span class="suggestion-id">${match.id}</span>
                `;
                div.onclick = () => {
                    studentSearchInput.value = match.id;
                    suggestionsContainer.style.display = 'none';
                    searchGrades(match.id);
                };
                suggestionsContainer.appendChild(div);
            });
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!studentSearchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

function searchGrades(forcedId = null) {
    const input = forcedId || document.getElementById('studentSearch').value.trim().toLowerCase();
    const resultDiv = document.getElementById('gradesResult');
    const placeholder = document.getElementById('gradesPlaceholder');
    const suggestions = document.getElementById('searchSuggestions');

    if (suggestions) suggestions.style.display = 'none';

    if (!input) {
        alert("Please enter a name or Academic ID");
        return;
    }

    // Find Logic
    let data = null;
    let foundId = "";

    // Exact ID Match
    if (mockGradesData[input]) {
        data = mockGradesData[input];
        foundId = input;
    } else {
        // Search by name
        for (const id in mockGradesData) {
            if (mockGradesData[id].name.toLowerCase() === input ||
                (forcedId === null && mockGradesData[id].name.toLowerCase().includes(input))) {
                data = mockGradesData[id];
                foundId = id;
                break;
            }
        }
    }

    if (data) {
        placeholder.style.display = 'none';
        resultDiv.style.display = 'block';

        document.getElementById('resStudentName').innerText = data.name;
        document.getElementById('resStudentID').innerText = "ID: " + foundId;
        document.getElementById('resGPA').innerText = data.gpa;

        const tableBody = document.getElementById('gradesTableBody');
        tableBody.innerHTML = data.subjects.map(s => `
            <tr>
                <td data-label="Subject">${s.name}</td>
                <td data-label="Degrees">${s.degree}</td>
                <td data-label="Grade" class="${s.grade.startsWith('A') ? 'grade-a' : 'grade-b'}">${s.grade}</td>
                <td data-label="Points">${s.points}</td>
            </tr>
        `).join('');

        // Scroll to result on mobile
        if (window.innerWidth < 768) {
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        alert("No results found. Try 'Ahmed' or '2024111'.");
        resultDiv.style.display = 'none';
        placeholder.style.display = 'block';
    }
}
