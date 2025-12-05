// Agent Trajectory Viewer - Main Module

// Theme management
let isDarkTheme = true;

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
}

// Initialize theme immediately
initTheme();

// Check authentication
if (sessionStorage.getItem('trajectory_authenticated') !== 'true') {
    window.location.href = 'login.html';
} else {
    document.querySelector('.container').style.display = 'block';
}

// Get trajectory data from session storage
const trajectories = JSON.parse(sessionStorage.getItem('trajectories_data') || '[]');

// Format duration in seconds to human-readable format
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

// Format large numbers with commas
function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString();
}

// Truncate text with ellipsis
function truncateText(text, maxLength = 150) {
    if (!text) return '';
    // Remove markdown formatting for preview
    text = text.replace(/#+\s*/g, '')
               .replace(/\*\*/g, '')
               .replace(/`/g, '')
               .replace(/\n+/g, ' ')
               .trim();
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Calculate total statistics
function calculateStats() {
    const totalTrajectories = trajectories.length;
    const totalSteps = trajectories.reduce((sum, t) => sum + (t.step_count || 0), 0);
    const totalTokens = trajectories.reduce((sum, t) => {
        return sum + (t.total_tokens?.total_tokens || 0);
    }, 0);
    
    return { totalTrajectories, totalSteps, totalTokens };
}

// Render statistics in header
function renderStats() {
    const stats = calculateStats();
    
    document.querySelector('#totalTrajectories .stat-value').textContent = formatNumber(stats.totalTrajectories);
    document.querySelector('#totalSteps .stat-value').textContent = formatNumber(stats.totalSteps);
    document.querySelector('#totalTokens .stat-value').textContent = formatNumber(stats.totalTokens);
}

// Create trajectory card HTML
function createTrajectoryCard(trajectory) {
    const card = document.createElement('div');
    card.className = 'trajectory-card';
    card.setAttribute('data-id', trajectory.id);
    
    const taskPreview = truncateText(trajectory.task);
    const totalTokens = trajectory.total_tokens?.total_tokens || 0;
    const sessionDate = formatDate(trajectory.session_timestamp);
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-icon">🤖</div>
            <div class="card-title">
                <h3>${escapeHtml(trajectory.title)}</h3>
                <span class="card-id">${trajectory.id}</span>
            </div>
        </div>
        <div class="card-preview">
            <p>${escapeHtml(taskPreview)}</p>
        </div>
        <div class="card-stats">
            <div class="card-stat steps">
                <span class="card-stat-icon">📊</span>
                <span class="card-stat-value">${trajectory.step_count || 0}</span>
                <span class="card-stat-label">steps</span>
            </div>
            <div class="card-stat duration">
                <span class="card-stat-icon">⏱️</span>
                <span class="card-stat-value">${formatDuration(trajectory.total_duration)}</span>
            </div>
            <div class="card-stat tokens">
                <span class="card-stat-icon">🔢</span>
                <span class="card-stat-value">${formatNumber(totalTokens)}</span>
                <span class="card-stat-label">tokens</span>
            </div>
        </div>
        ${sessionDate ? `<div class="card-date">📅 ${sessionDate}</div>` : ''}
    `;
    
    // Navigate to detail page on click
    card.addEventListener('click', () => {
        window.location.href = `detail.html?id=${encodeURIComponent(trajectory.id)}`;
    });
    
    return card;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render trajectory grid
function renderTrajectories(trajectoriesToRender) {
    const grid = document.getElementById('trajectoryGrid');
    grid.innerHTML = '';
    
    if (trajectoriesToRender.length === 0) {
        grid.innerHTML = '<div class="no-results">No trajectories found</div>';
        return;
    }
    
    trajectoriesToRender.forEach(trajectory => {
        grid.appendChild(createTrajectoryCard(trajectory));
    });
}

// Sort trajectories based on selected option
function sortTrajectories(trajectories, sortBy) {
    const sorted = [...trajectories];
    
    // Helper to get sort timestamp
    const getTimestamp = (t) => t.session_timestamp || t.created_at || '';
    
    switch (sortBy) {
        case 'date-desc':
            sorted.sort((a, b) => getTimestamp(b).localeCompare(getTimestamp(a)));
            break;
        case 'date-asc':
            sorted.sort((a, b) => getTimestamp(a).localeCompare(getTimestamp(b)));
            break;
        case 'steps-desc':
            sorted.sort((a, b) => (b.step_count || 0) - (a.step_count || 0));
            break;
        case 'steps-asc':
            sorted.sort((a, b) => (a.step_count || 0) - (b.step_count || 0));
            break;
        case 'tokens-desc':
            sorted.sort((a, b) => {
                const tokensA = a.total_tokens?.total_tokens || 0;
                const tokensB = b.total_tokens?.total_tokens || 0;
                return tokensB - tokensA;
            });
            break;
        case 'duration-desc':
            sorted.sort((a, b) => (b.total_duration || 0) - (a.total_duration || 0));
            break;
        default:
            break;
    }
    
    return sorted;
}

// Filter trajectories based on search term
function filterTrajectories(trajectories, searchTerm) {
    if (!searchTerm) return trajectories;
    
    const term = searchTerm.toLowerCase();
    return trajectories.filter(t => {
        const title = (t.title || '').toLowerCase();
        const task = (t.task || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        
        return title.includes(term) || task.includes(term) || id.includes(term);
    });
}

// Apply filters and sorting, then render
function applyFiltersAndRender() {
    const searchTerm = document.getElementById('searchInput').value;
    const sortBy = document.getElementById('sortSelect').value;
    
    let filtered = filterTrajectories(trajectories, searchTerm);
    let sorted = sortTrajectories(filtered, sortBy);
    
    renderTrajectories(sorted);
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', applyFiltersAndRender);
document.getElementById('sortSelect').addEventListener('change', applyFiltersAndRender);

// Theme toggle
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

// Logout button
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
});

// Notification helper
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification' + (isError ? ' error' : '');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Initial render
renderStats();
applyFiltersAndRender();

