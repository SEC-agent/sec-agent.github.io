// Agent Trajectory Viewer - Detail Page Module

// Check authentication
if (sessionStorage.getItem('trajectory_authenticated') !== 'true') {
    window.location.href = 'login.html';
}

// Get trajectory ID from URL
const urlParams = new URLSearchParams(window.location.search);
const trajectoryId = urlParams.get('id');

if (!trajectoryId) {
    window.location.href = 'index.html';
}

// State
let trajectoryMeta = null;
let steps = [];
let currentStepIndex = -1; // -1 means showing task
let currentView = 'conversation';
let isDarkTheme = true; // Default to dark theme

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('trajectory_theme');
    if (savedTheme) {
        isDarkTheme = savedTheme === 'dark';
    }
    applyTheme();
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    localStorage.setItem('trajectory_theme', isDarkTheme ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    document.body.classList.toggle('light-theme', !isDarkTheme);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.textContent = isDarkTheme ? '☀️' : '🌙';
        themeBtn.title = isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    // Switch Highlight.js theme
    const darkThemeLink = document.getElementById('hljs-dark-theme');
    const lightThemeLink = document.getElementById('hljs-light-theme');
    if (darkThemeLink && lightThemeLink) {
        darkThemeLink.disabled = !isDarkTheme;
        lightThemeLink.disabled = isDarkTheme;
    }
}

// Crypto utilities
async function deriveKey(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

async function decryptData(encryptedBase64, password) {
    try {
        const { chacha20poly1305 } = await import('https://esm.sh/@noble/ciphers@0.5.3/chacha');

        const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        const nonce = encryptedData.slice(0, 12);
        const ciphertext = encryptedData.slice(12);

        const keyBytes = await deriveKey(password);

        const aead = chacha20poly1305(keyBytes, nonce);
        const decrypted = aead.decrypt(ciphertext);

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);

    } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
    }
}

// Load steps data
async function loadSteps() {
    const password = sessionStorage.getItem('decryption_key');
    if (!password) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const response = await fetch('../data/trajectory/dataset.bins');
        if (!response.ok) {
            throw new Error(`Failed to load steps: HTTP ${response.status}`);
        }
        const encryptedData = await response.text();
        const decryptedJSON = await decryptData(encryptedData, password);
        return JSON.parse(decryptedJSON);
    } catch (error) {
        console.error('Error loading steps:', error);
        return null;
    }
}

// Format utilities
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load marked.js for markdown rendering
let markedLoaded = false;
async function loadMarked() {
    if (markedLoaded) return;
    try {
        const { marked } = await import('https://esm.sh/marked@11.0.0');
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        window.marked = marked;
        markedLoaded = true;
    } catch (e) {
        console.warn('Failed to load marked.js, using fallback');
    }
}

// Enhanced markdown to HTML converter
async function markdownToHtml(text) {
    if (!text) return '';

    // Try to use marked.js if loaded
    if (window.marked) {
        try {
            return window.marked.parse(text);
        } catch (e) {
            console.warn('Marked parse error, using fallback');
        }
    }

    // Fallback: simple markdown parser
    let html = escapeHtml(text);

    // Code blocks (must be before other transformations)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Line breaks (but not inside pre blocks)
    html = html.replace(/\n/g, '<br>');

    // Lists (basic)
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    return html;
}

// Highlight.js-based syntax highlighting
// hljs is loaded globally from CDN

/**
 * Apply syntax highlighting using Highlight.js
 * @param {string} text - The code text to highlight
 * @param {string} language - The language for highlighting
 * @returns {string} HTML string with highlighted code in a pre block
 */
function highlightCode(text, language) {
    if (!text) return '<pre class="hljs"><code></code></pre>';

    // For JSON, try to format it nicely first
    if (language === 'json') {
        try {
            const obj = JSON.parse(text);
            text = JSON.stringify(obj, null, 2);
        } catch (e) {
            // Keep original text if not valid JSON
        }
    }

    try {
        // Check if hljs is available
        if (typeof hljs !== 'undefined') {
            let result;
            if (language && language !== 'plaintext' && hljs.getLanguage(language)) {
                result = hljs.highlight(text, { language: language, ignoreIllegals: true });
            } else {
                // Auto-detect or use plaintext
                result = language === 'plaintext'
                    ? { value: escapeHtml(text) }
                    : hljs.highlightAuto(text);
            }
            return `<pre class="hljs"><code class="language-${language}">${result.value}</code></pre>`;
        }
    } catch (e) {
        console.warn('Highlight.js error:', e);
    }

    // Fallback: just escape and return
    return `<pre class="hljs"><code>${escapeHtml(text)}</code></pre>`;
}

// Apply syntax highlighting based on language using Highlight.js
function applySyntaxHighlight(text, lang) {
    if (!text) return '';

    // Map our language names to hljs language names
    const langMap = {
        'plain': 'plaintext',
        'plaintext': 'plaintext',
        'json': 'json',
        'python': 'python',
        'javascript': 'javascript',
        'bash': 'bash',
        'xml': 'xml',
        'cpp': 'cpp',
        'c': 'cpp',
        'markdown': 'markdown',
        'diff': 'diff'
    };

    const hljsLang = langMap[lang] || 'plaintext';
    return highlightCode(text, hljsLang);
}

// Current observation language
let currentObservationLang = 'plaintext';
let currentStepData = null;

// Truncate text for preview
function truncateText(text, maxLength = 80) {
    if (!text) return '';
    text = text.replace(/\n+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Format ISO timestamp to human-readable date
function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return isoString;
    }
}

// Render sidebar info
function renderTrajectoryInfo() {
    document.getElementById('trajectoryTitle').textContent = trajectoryMeta.title;
    document.getElementById('stepCount').textContent = trajectoryMeta.step_count || steps.length;
    document.getElementById('duration').textContent = formatDuration(trajectoryMeta.total_duration);

    const tokens = trajectoryMeta.total_tokens || {};
    document.getElementById('inputTokens').textContent = formatNumber(tokens.input_tokens);
    document.getElementById('outputTokens').textContent = formatNumber(tokens.output_tokens);
    document.getElementById('cachedTokens').textContent = formatNumber(tokens.cache_read_input_tokens || tokens.cached_input_tokens || 0);
    document.getElementById('totalTokens').textContent = formatNumber(tokens.total_tokens);

    // Update session date if available
    const sessionDateEl = document.getElementById('sessionDate');
    if (sessionDateEl && trajectoryMeta.session_timestamp) {
        sessionDateEl.textContent = formatDate(trajectoryMeta.session_timestamp);
    }
}

// Get tool names from step
function getToolNames(step) {
    if (!step.tool_calls || step.tool_calls.length === 0) {
        return null;
    }
    const names = step.tool_calls.map(call => {
        const funcData = call.function || {};
        return funcData.name || 'unknown';
    });
    // Return unique tool names
    return [...new Set(names)];
}

// Render step list in sidebar
function renderStepList() {
    const stepList = document.getElementById('stepList');
    stepList.innerHTML = '';

    // Add task item
    const taskItem = document.createElement('div');
    taskItem.className = 'step-item task-step' + (currentStepIndex === -1 ? ' active' : '');
    taskItem.innerHTML = `
        <div class="step-number">📋 Task</div>
        <div class="step-preview">${escapeHtml(truncateText(trajectoryMeta.title))}</div>
    `;
    taskItem.addEventListener('click', () => selectStep(-1));
    stepList.appendChild(taskItem);

    // Add step items
    steps.forEach((step, index) => {
        const stepItem = document.createElement('div');
        stepItem.className = 'step-item' + (currentStepIndex === index ? ' active' : '');

        // Determine preview text based on content
        const hasThought = !!step.thought;
        const toolNames = getToolNames(step);

        // Check for errors
        const hasError = step.error && step.error.type;

        let preview;
        if (hasError) {
            // Show error type as preview for error steps
            preview = step.error.message || step.error.type;
        } else if (hasThought) {
            preview = truncateText(step.thought);
        } else if (toolNames && toolNames.length > 0) {
            preview = toolNames.join(', ');
        } else {
            preview = 'No tool call';
        }

        const duration = step.timing?.duration || 0;
        const tokens = step.token_usage?.total_tokens || 0;

        // Build step label with indicators
        let stepLabel = `Step ${step.step_number || index + 1}`;
        const indicators = [];
        if (hasThought) indicators.push('🧠');
        if (hasError) indicators.push('⚠️');
        if (indicators.length > 0) {
            stepLabel = indicators.join('') + ' ' + stepLabel;
        }

        // Add error class if step has error
        if (hasError) {
            stepItem.classList.add('has-error');
        }

        stepItem.innerHTML = `
            <div class="step-number">${stepLabel}</div>
            <div class="step-preview">${escapeHtml(preview)}</div>
            <div class="step-meta">
                <span>⏱️ ${formatDuration(duration)}</span>
                <span>🔢 ${formatNumber(tokens)}</span>
            </div>
        `;
        stepItem.addEventListener('click', () => selectStep(index));
        stepList.appendChild(stepItem);
    });
}

// Select and display a step
async function selectStep(index) {
    currentStepIndex = index;

    // Update navigation
    updateNavigation();

    // Update step list active state
    document.querySelectorAll('.step-item').forEach((item, i) => {
        item.classList.toggle('active', i === index + 1);
    });

    // Show appropriate content
    if (index === -1) {
        await showTaskContent();
    } else {
        await showStepContent(steps[index]);
    }
}

// Update navigation buttons
function updateNavigation() {
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    const indicator = document.getElementById('stepIndicator');

    prevBtn.disabled = currentStepIndex === -1;
    nextBtn.disabled = currentStepIndex === steps.length - 1;

    if (currentStepIndex === -1) {
        indicator.textContent = 'Task Description';
    } else {
        indicator.textContent = `Step ${currentStepIndex + 1} of ${steps.length}`;
    }
}

// Show task content
async function showTaskContent() {
    document.getElementById('taskSection').style.display = 'block';
    document.getElementById('stepSection').style.display = 'none';
    document.getElementById('rawView').style.display = currentView === 'raw' ? 'block' : 'none';

    if (currentView === 'conversation') {
        document.getElementById('taskSection').style.display = 'block';
        document.getElementById('rawView').style.display = 'none';
        const taskHtml = await markdownToHtml(trajectoryMeta.task);
        document.getElementById('taskContent').innerHTML = taskHtml;
    } else {
        document.getElementById('taskSection').style.display = 'none';
        document.getElementById('rawView').style.display = 'block';
        document.getElementById('rawJson').innerHTML = highlightCode(JSON.stringify(trajectoryMeta, null, 2), 'json');
    }
}

// Show step content
async function showStepContent(step) {
    currentStepData = step;
    document.getElementById('taskSection').style.display = 'none';

    if (currentView === 'raw') {
        document.getElementById('stepSection').style.display = 'none';
        document.getElementById('rawView').style.display = 'block';
        document.getElementById('rawJson').innerHTML = highlightCode(JSON.stringify(step, null, 2), 'json');
        return;
    }

    document.getElementById('stepSection').style.display = 'block';
    document.getElementById('rawView').style.display = 'none';

    // Timing bar with detailed token info
    const duration = step.timing?.duration || 0;
    const tokenUsage = step.token_usage || {};
    const inputTokens = tokenUsage.input_tokens || 0;
    const outputTokens = tokenUsage.output_tokens || 0;
    const cachedTokens = tokenUsage.cache_read_input_tokens || tokenUsage.cached_input_tokens || 0;
    const totalTokens = tokenUsage.total_tokens || 0;

    document.getElementById('stepDuration').textContent = formatDuration(duration);
    document.getElementById('stepInputTokens').textContent = formatNumber(inputTokens);
    document.getElementById('stepOutputTokens').textContent = formatNumber(outputTokens);
    document.getElementById('stepCachedTokens').textContent = formatNumber(cachedTokens);
    document.getElementById('stepTokens').textContent = formatNumber(totalTokens);

    // Thought section with markdown rendering
    const thoughtSection = document.getElementById('thoughtSection');
    const thoughtContent = document.getElementById('thoughtContent');
    if (step.thought) {
        thoughtSection.classList.remove('hidden-section');
        const thoughtHtml = await markdownToHtml(step.thought);
        thoughtContent.innerHTML = thoughtHtml;
        thoughtContent.classList.add('markdown-content');
    } else {
        thoughtSection.classList.add('hidden-section');
    }

    // Tool calls section with JSON syntax highlighting
    const toolCallsSection = document.getElementById('toolCallsSection');
    const toolCallsList = document.getElementById('toolCallsList');
    if (step.tool_calls && step.tool_calls.length > 0) {
        toolCallsSection.classList.remove('hidden-section');
        toolCallsList.innerHTML = '';

        step.tool_calls.forEach((call, index) => {
            const callItem = document.createElement('div');
            callItem.className = 'tool-call-item';

            const funcData = call.function || {};
            const funcName = funcData.name || 'unknown';
            let funcArgs = funcData.arguments || {};

            // Parse arguments if it's a string
            if (typeof funcArgs === 'string') {
                try {
                    funcArgs = JSON.parse(funcArgs);
                } catch (e) {
                    // Keep as string
                }
            }

            const argsJson = typeof funcArgs === 'string' ? funcArgs : JSON.stringify(funcArgs, null, 2);

            callItem.innerHTML = `
                <div class="tool-call-header">
                    <span class="tool-name">${escapeHtml(funcName)}</span>
                    <span class="tool-id">${call.id || ''}</span>
                </div>
                <div class="tool-call-body">
                    <div class="tool-args">
                        ${highlightCode(argsJson, 'json')}
                    </div>
                </div>
            `;

            toolCallsList.appendChild(callItem);
        });
    } else {
        toolCallsSection.classList.add('hidden-section');
    }

    // Observations section with selectable syntax highlighting
    renderObservations(step);

    // Code action section with Python highlighting
    const codeActionSection = document.getElementById('codeActionSection');
    const codeActionContent = document.getElementById('codeActionContent');
    if (step.code_action) {
        codeActionSection.classList.remove('hidden-section');
        codeActionContent.innerHTML = `
            <div class="code-block">
                <div class="code-block-header">
                    <span class="code-block-lang">python</span>
                </div>
                <div class="code-block-body">
                    ${highlightCode(step.code_action, 'python')}
                </div>
            </div>
        `;
    } else {
        codeActionSection.classList.add('hidden-section');
    }

    // Error section - handle AgentMaxStepsError and other errors
    const errorSection = document.getElementById('errorSection');
    const errorType = document.getElementById('errorType');
    const errorContent = document.getElementById('errorContent');

    if (step.error && step.error.type) {
        errorSection.classList.remove('hidden-section');
        errorType.textContent = step.error.type;
        errorContent.textContent = step.error.message || 'An error occurred';
    } else {
        errorSection.classList.add('hidden-section');
    }

    // Final answer / Action Output section
    // Show for: is_final_answer with action_output, OR error with action_output (like AgentMaxStepsError)
    const finalAnswerSection = document.getElementById('finalAnswerSection');
    const finalAnswerTitle = document.getElementById('finalAnswerTitle');
    const finalAnswerContent = document.getElementById('finalAnswerContent');

    const hasActionOutput = step.action_output && typeof step.action_output === 'string' && step.action_output.trim().length > 0;
    const isErrorWithOutput = step.error && step.error.type && hasActionOutput;
    const isFinalAnswer = step.is_final_answer && hasActionOutput;

    if (isFinalAnswer || isErrorWithOutput) {
        finalAnswerSection.classList.remove('hidden-section');

        // Set appropriate title based on context
        if (isErrorWithOutput && step.error.type === 'AgentMaxStepsError') {
            finalAnswerTitle.textContent = 'Final Output (Max Steps Reached)';
        } else if (isFinalAnswer) {
            finalAnswerTitle.textContent = 'Final Answer';
        } else {
            finalAnswerTitle.textContent = 'Action Output';
        }

        // Render action_output as markdown
        try {
            const outputHtml = await markdownToHtml(step.action_output);
            finalAnswerContent.innerHTML = outputHtml;
        } catch (e) {
            // Fallback to plain text if markdown parsing fails
            finalAnswerContent.textContent = step.action_output;
        }
    } else {
        finalAnswerSection.classList.add('hidden-section');
    }
}

// Render observations with current language setting
function renderObservations(step) {
    const observationsSection = document.getElementById('observationsSection');
    const observationsContent = document.getElementById('observationsContent');

    if (step && step.observations) {
        observationsSection.classList.remove('hidden-section');
        observationsContent.innerHTML = '';

        // Handle observations as string or array
        const observations = Array.isArray(step.observations) ? step.observations : [step.observations];

        observations.forEach(obs => {
            const obsItem = document.createElement('div');
            obsItem.className = 'observation-item';

            let obsText = obs;
            if (typeof obs === 'object') {
                obsText = JSON.stringify(obs, null, 2);
            }

            // Apply selected syntax highlighting
            const highlightedContent = applySyntaxHighlight(obsText, currentObservationLang);
            obsItem.innerHTML = `<div class="observation-text">${highlightedContent}</div>`;
            observationsContent.appendChild(obsItem);
        });
    } else {
        observationsSection.classList.add('hidden-section');
    }
}

// Switch view mode
async function switchView(view) {
    currentView = view;

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Re-render current content
    if (currentStepIndex === -1) {
        await showTaskContent();
    } else {
        await showStepContent(steps[currentStepIndex]);
    }
}

// Event listeners
document.getElementById('prevStep').addEventListener('click', async () => {
    if (currentStepIndex > -1) {
        await selectStep(currentStepIndex - 1);
    }
});

document.getElementById('nextStep').addEventListener('click', async () => {
    if (currentStepIndex < steps.length - 1) {
        await selectStep(currentStepIndex + 1);
    }
});

document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        await switchView(btn.dataset.view);
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
});

// Theme toggle
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

// Observation language selector
document.getElementById('observationLang').addEventListener('change', (e) => {
    currentObservationLang = e.target.value;
    if (currentStepData) {
        renderObservations(currentStepData);
    }
});

// Keyboard navigation
document.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentStepIndex > -1) {
            await selectStep(currentStepIndex - 1);
        }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentStepIndex < steps.length - 1) {
            await selectStep(currentStepIndex + 1);
        }
    }
});

// Initialize
async function init() {
    // Initialize theme
    initTheme();

    // Load marked.js for markdown rendering
    await loadMarked();

    // Get trajectory metadata
    const trajectories = JSON.parse(sessionStorage.getItem('trajectories_data') || '[]');
    trajectoryMeta = trajectories.find(t => t.id === trajectoryId);

    if (!trajectoryMeta) {
        document.getElementById('trajectoryTitle').textContent = 'Trajectory not found';
        return;
    }

    // Render basic info
    renderTrajectoryInfo();

    // Load steps
    const allSteps = await loadSteps();
    if (allSteps && allSteps[trajectoryId]) {
        steps = allSteps[trajectoryId];
    }

    // Render step list
    renderStepList();

    // Show task by default
    await selectStep(-1);
}

init();

