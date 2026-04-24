// Dashboard JavaScript
const API_BASE = 'https://kissubot-telegram-bot-3.onrender.com';

// ── Utility ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
    if (!date) return 'Never';
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Navigation helper (used by stat cards) ──────────────────────────────
function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`${page}-page`);
    if (pageEl) pageEl.classList.add('active');
    const titles = { overview:'Dashboard Overview', users:'User Management', revenue:'Revenue Analytics', matches:'Match Statistics', reports:'Reports & Moderation', settings:'Bot Settings' };
    document.getElementById('page-title').textContent = titles[page] || page;
    loadPageData(page);
}

function navigateToWithFilter(page, filter) {
    usersCurrentFilter = filter;
    // Update active filter tab after nav renders
    setTimeout(() => {
        document.querySelectorAll('.filter-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === filter);
        });
    }, 50);
    navigateTo(page);
}

// Test connection on load
async function testConnection() {
    try {
        console.log('Testing connection to:', API_BASE);
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        console.log('✅ Backend connected:', data);
        return true;
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        console.error('Make sure your backend is deployed and running at:', API_BASE);
        showNotification(`Cannot connect to backend at ${API_BASE}. Check console for details.`, 'error');
        return false;
    }
}

// Mobile menu toggle
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    
    sidebar.classList.toggle('mobile-open');
    backdrop.classList.toggle('active');
}

// Close mobile menu
function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('active');
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Close mobile menu on navigation
        closeMobileMenu();
        
        // Update active page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');
        
        // Update header
        const titles = {
            overview: 'Dashboard Overview',
            users: 'User Management',
            revenue: 'Revenue Analytics',
            matches: 'Match Statistics',
            reports: 'Reports & Moderation',
            settings: 'Bot Settings'
        };
        document.getElementById('page-title').textContent = titles[page];
        
        // Load page data
        loadPageData(page);
    });
});

// Load dashboard data
async function loadDashboardData() {
    try {
        const stats = await apiFetch('/admin/stats');
        document.getElementById('total-users').textContent = stats.totalUsers || 0;
        document.getElementById('total-matches').textContent = stats.totalMatches || 0;
        document.getElementById('vip-users').textContent = stats.vipUsers || 0;
        document.getElementById('total-revenue').textContent = `$${stats.totalRevenue || 0}`;
        const bannedEl = document.getElementById('banned-users');
        if (bannedEl) bannedEl.textContent = stats.bannedUsers || 0;
        await loadUserGrowthChart();
        await loadMatchActivityChart();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification(`Failed to load dashboard: ${error.message}`, 'error');
        ['total-users','total-matches','vip-users','total-revenue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Error';
        });
    }
}

// User Growth Chart
let userGrowthChart;
async function loadUserGrowthChart() {
    try {
        const res = await fetch(`${API_BASE}/admin/user-growth`);
        const growthData = await res.json();
        
        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        
        if (userGrowthChart) {
            userGrowthChart.destroy();
        }
        
        userGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: growthData.map(d => d.day),
                datasets: [{
                    label: 'New Users',
                    data: growthData.map(d => d.users),
                    borderColor: '#FF6B9D',
                    backgroundColor: 'rgba(255, 107, 157, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading user growth chart:', error);
    }
}

// Match Activity Chart
let matchActivityChart;
async function loadMatchActivityChart() {
    try {
        const res = await fetch(`${API_BASE}/admin/matches`);
        const matchStats = await res.json();
        
        const ctx = document.getElementById('matchActivityChart').getContext('2d');
        
        if (matchActivityChart) {
            matchActivityChart.destroy();
        }
        
        matchActivityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: matchStats.matchData.map(d => d.day),
                datasets: [{
                    label: 'Matches',
                    data: matchStats.matchData.map(d => d.matches),
                    backgroundColor: '#4A90E2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading match activity chart:', error);
    }
}

// Recent Activity
async function loadRecentActivity() {
    try {
        const res = await fetch(`${API_BASE}/admin/activity`);
        const activities = await res.json();
        
        const activityList = document.getElementById('recent-activity');
        
        if (activities.length === 0) {
            activityList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No recent activity</p>';
            return;
        }
        
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${activity.icon}</div>
                <div class="activity-info">
                    <p>${activity.text}</p>
                    <span class="activity-time">${activity.time}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading recent activity:', error);
        document.getElementById('recent-activity').innerHTML = '<p style="color: red;">Failed to load activity</p>';
    }
}

// ── Users: state ─────────────────────────────────────────────────────────
let usersCurrentPage = 1;
let usersCurrentFilter = '';
let searchTimeout;

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(1), 400);
}

function setFilter(btn, filter) {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    usersCurrentFilter = filter;
    loadUsers(1);
}

async function loadUsers(page = usersCurrentPage) {
    usersCurrentPage = page;
    const tbody = document.getElementById('users-table-body');
    const search = document.getElementById('user-search')?.value?.trim() || '';
    const limit = document.getElementById('per-page-select')?.value || 25;

    try {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;padding:24px">
            <div style="display:inline-block;width:24px;height:24px;border:3px solid #FF6B9D;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></div>
            <div style="margin-top:8px;font-size:13px">Loading users...</div>
        </td></tr>`;

        let url = `/admin/users?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (usersCurrentFilter) url += `&filter=${usersCurrentFilter}`;

        const data = await apiFetch(url);
        // Handle both legacy array response and new paginated object
        const users = Array.isArray(data) ? data : (data.users || []);
        const total = Array.isArray(data) ? data.length : (data.total || 0);
        const pages = Array.isArray(data) ? 1 : (data.pages || 1);

        // Update count label
        const countEl = document.getElementById('users-count-label');
        if (countEl) countEl.textContent = `${total.toLocaleString()} users · page ${page} of ${pages}`;

        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#888;padding:24px">No users found</td></tr>`;
            renderPagination(0, 0, 0);
            return;
        }

        tbody.innerHTML = users.map(user => {
            const username = user.username ? `@${user.username}` : `<span style="color:#666;font-size:11px">${user.telegramId}</span>`;
            const name = user.name || '<span style="color:#666">N/A</span>';
            const age = user.age || '–';
            const gender = user.gender ? user.gender[0] : '–';
            const location = user.location || '<span style="color:#666">–</span>';
            const matchCount = user.matches?.length || 0;
            const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '–';
            let statusBadge = '';
            if (user.isBanned) statusBadge = '<span class="badge-banned">🚫 Banned</span>';
            else if (user.isVip) statusBadge = '<span class="badge-vip">👑 VIP</span>';
            else statusBadge = '<span class="badge-free">Free</span>';

            return `<tr style="transition:background .1s" onmouseover="this.style.background='rgba(255,107,157,0.05)'" onmouseout="this.style.background=''">
                <td style="font-family:monospace;font-size:12px">${username}</td>
                <td>${name}</td>
                <td style="text-align:center">${age}</td>
                <td style="text-align:center">${gender}</td>
                <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${location}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center">${matchCount}</td>
                <td style="font-size:12px;color:#aaa">${joined}</td>
                <td class="tbl-actions">
                    <button class="action-btn" style="background:#4A90E2;color:#fff" onclick="viewUser('${user.telegramId}')">👤</button>
                    ${user.isBanned
                        ? `<button class="action-btn" style="background:#43a047;color:#fff" onclick="unbanUser('${user.telegramId}')">Unban</button>`
                        : `<button class="action-btn" style="background:#e53935;color:#fff" onclick="banUser('${user.telegramId}')">Ban</button>`
                    }
                    ${user.isVip
                        ? `<button class="action-btn" style="background:#6d4c41;color:#fff" onclick="revokeVip('${user.telegramId}')">-VIP</button>`
                        : `<button class="action-btn" style="background:#f9a825;color:#000" onclick="grantVip('${user.telegramId}')">👑</button>`
                    }
                    <button class="action-btn" style="background:#b71c1c;color:#fff" onclick="deleteUser('${user.telegramId}')">🗑️</button>
                </td>
            </tr>`;
        }).join('');

        renderPagination(page, pages, total);

    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#e53935;padding:20px">Failed: ${error.message}</td></tr>`;
    }
}

function renderPagination(currentPage, totalPages, totalItems) {
    const container = document.getElementById('users-pagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const limit = parseInt(document.getElementById('per-page-select')?.value || 25);
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalItems);

    let html = `<span class="page-info">${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${totalItems.toLocaleString()}</span>`;
    html += `<button class="page-btn" onclick="loadUsers(1)" ${currentPage === 1 ? 'disabled' : ''}>«</button>`;
    html += `<button class="page-btn" onclick="loadUsers(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

    // Smart page number range
    let startP = Math.max(1, currentPage - 2);
    let endP = Math.min(totalPages, currentPage + 2);
    if (endP - startP < 4) {
        if (startP === 1) endP = Math.min(totalPages, startP + 4);
        else startP = Math.max(1, endP - 4);
    }
    if (startP > 1) html += `<span class="page-info">...</span>`;
    for (let p = startP; p <= endP; p++) {
        html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="loadUsers(${p})">${p}</button>`;
    }
    if (endP < totalPages) html += `<span class="page-info">...</span>`;

    html += `<button class="page-btn" onclick="loadUsers(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
    html += `<button class="page-btn" onclick="loadUsers(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>»</button>`;
    html += `<span class="page-info">${totalPages} pages</span>`;

    container.innerHTML = html;
}

// Load Reports
async function loadReports() {
    const tbody = document.getElementById('reports-table-body');
    try {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;padding:20px">Loading...</td></tr>`;
        const reports = await apiFetch('/admin/reports');
        const countEl = document.getElementById('reports-count');
        if (countEl) countEl.textContent = `${reports.length} total · ${reports.filter(r=>r.status==='pending').length} pending`;
        if (!reports.length) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;padding:20px">No reports</td></tr>`;
            return;
        }
        tbody.innerHTML = reports.map(r => {
            const statusClass = r.status === 'pending' ? 'status-pending' : r.status === 'resolved' ? 'status-resolved' : 'status-dismissed';
            return `<tr>
                <td style="font-family:monospace;font-size:11px">${r._id?.substring(0,8) || 'N/A'}</td>
                <td>${r.type || 'N/A'}</td>
                <td style="font-size:12px">${r.reporterId || 'N/A'}</td>
                <td style="font-size:12px">${r.reportedId || 'N/A'}</td>
                <td>${r.reason || 'N/A'}</td>
                <td style="font-size:12px">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td><span class="${statusClass}">${r.status || 'pending'}</span></td>
                <td class="tbl-actions">
                    ${r.status === 'pending' ? `
                        <button class="action-btn" style="background:#43a047;color:#fff" onclick="resolveReport('${r._id}', this)">✅ Resolve</button>
                        <button class="action-btn" style="background:#666;color:#fff" onclick="dismissReport('${r._id}', this)">✗ Dismiss</button>
                    ` : `<span style="color:#888;font-size:12px">${r.status}</span>`}
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#e53935;padding:20px">Failed to load reports: ${error.message}</td></tr>`;
    }
}

// Load page-specific data
async function loadPageData(page) {
    switch(page) {
        case 'overview':
            await loadDashboardData();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'reports':
            await loadReports();
            break;
        case 'revenue':
            await loadRevenueChart();
            break;
        case 'matches':
            await loadMatchStats();
            break;
    }
}

// Revenue Chart
let revenueChart;
async function loadRevenueChart() {
    try {
        const res = await fetch(`${API_BASE}/admin/revenue`);
        const revenueData = await res.json();
        
        // Update revenue stats
        document.getElementById('monthly-revenue').textContent = `$${revenueData.monthlyRevenue}`;
        document.getElementById('avg-revenue').textContent = `$${revenueData.avgRevenuePerUser}`;
        
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        revenueChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: revenueData.revenueData.map(d => d.month),
                datasets: [{
                    label: 'Revenue',
                    data: revenueData.revenueData.map(d => d.revenue),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading revenue chart:', error);
    }
}

// Load Match Statistics
async function loadMatchStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/matches`);
        const matchStats = await res.json();
        
        // Update match stats cards
        document.getElementById('today-matches').textContent = matchStats.todayMatches || 0;
        document.getElementById('match-rate').textContent = `${matchStats.matchRate}%`;
        
    } catch (error) {
        console.error('Error loading match stats:', error);
    }
}

// Refresh data
function refreshData() {
    const currentPage = document.querySelector('.nav-item.active').dataset.page;
    loadPageData(currentPage);
    showNotification('Data refreshed successfully', 'success');
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#4A90E2'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ── User Actions ──────────────────────────────────────────────────────────────
async function viewUser(telegramId) {
    try {
        const user = await apiFetch(`/admin/users/${telegramId}`);
        const modal = document.getElementById('userModal');
        document.getElementById('modal-title').textContent = `👤 ${user.name || 'Unknown'} ${user.isVip ? '👑' : ''}`;
        document.getElementById('modal-body').innerHTML = `
            <div class="modal-field"><strong>Username:</strong> ${user.username ? '@'+user.username : 'N/A'}</div>
            <div class="modal-field"><strong>Telegram ID:</strong> ${user.telegramId}</div>
            <div class="modal-field"><strong>Age:</strong> ${user.age || 'N/A'}</div>
            <div class="modal-field"><strong>Gender:</strong> ${user.gender || 'N/A'}</div>
            <div class="modal-field"><strong>Location:</strong> ${user.location || 'N/A'}</div>
            <div class="modal-field"><strong>Bio:</strong> ${user.bio || 'N/A'}</div>
            <div class="modal-field"><strong>Looking for:</strong> ${user.lookingFor || 'N/A'}</div>
            <div class="modal-field"><strong>Matches:</strong> ${user.matches?.length || 0}</div>
            <div class="modal-field"><strong>Likes received:</strong> ${user.likes?.length || 0}</div>
            <div class="modal-field"><strong>VIP:</strong> ${user.isVip ? '✅ ' + (user.vipExpiresAt ? 'Expires: ' + new Date(user.vipExpiresAt).toLocaleDateString() : 'Active') : 'No'}</div>
            <div class="modal-field"><strong>Status:</strong> ${user.isBanned ? '🚫 Banned' + (user.banReason ? ' (' + user.banReason + ')' : '') : '✅ Active'}</div>
            <div class="modal-field"><strong>Joined:</strong> ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}</div>
            <div class="modal-field"><strong>Last active:</strong> ${timeAgo(user.lastActive)}</div>
        `;
        document.getElementById('modal-actions').innerHTML = `
            ${user.isBanned
                ? `<button class="btn-sm btn-unban" onclick="unbanUser('${telegramId}', true)">✅ Unban</button>`
                : `<button class="btn-sm btn-ban" onclick="banUser('${telegramId}', true)">🚫 Ban</button>`
            }
            ${user.isVip
                ? `<button class="btn-sm btn-revoke" onclick="revokeVip('${telegramId}', true)">❌ Revoke VIP</button>`
                : `<button class="btn-sm btn-vip" onclick="grantVip('${telegramId}', true)">👑 Grant VIP</button>`
            }
            <button class="btn-sm btn-delete" onclick="deleteUser('${telegramId}', true)">🗑️ Delete</button>
            <button class="btn-sm btn-close" onclick="closeModal()">✕ Close</button>
        `;
        modal.classList.add('active');
    } catch (err) {
        showNotification('Failed to load user: ' + err.message, 'error');
    }
}

function closeModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function banUser(telegramId, fromModal = false) {
    const reason = prompt('Ban reason (optional):') ?? 'Admin action';
    if (reason === null) return;
    try {
        await apiFetch(`/admin/users/${telegramId}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
        showNotification('User banned', 'success');
        if (fromModal) closeModal();
        loadUsers();
    } catch (err) { showNotification('Failed to ban: ' + err.message, 'error'); }
}

async function unbanUser(telegramId, fromModal = false) {
    if (!confirm('Unban this user?')) return;
    try {
        await apiFetch(`/admin/users/${telegramId}/unban`, { method: 'POST' });
        showNotification('User unbanned', 'success');
        if (fromModal) closeModal();
        loadUsers();
    } catch (err) { showNotification('Failed to unban: ' + err.message, 'error'); }
}

async function grantVip(telegramId, fromModal = false) {
    const days = prompt('Grant VIP for how many days?', '30');
    if (!days) return;
    try {
        await apiFetch(`/admin/users/${telegramId}/grant-vip`, { method: 'POST', body: JSON.stringify({ days: parseInt(days) }) });
        showNotification(`VIP granted for ${days} days`, 'success');
        if (fromModal) { closeModal(); viewUser(telegramId); }
        loadUsers();
    } catch (err) { showNotification('Failed to grant VIP: ' + err.message, 'error'); }
}

async function revokeVip(telegramId, fromModal = false) {
    if (!confirm('Revoke VIP for this user?')) return;
    try {
        await apiFetch(`/admin/users/${telegramId}/revoke-vip`, { method: 'POST' });
        showNotification('VIP revoked', 'success');
        if (fromModal) { closeModal(); viewUser(telegramId); }
        loadUsers();
    } catch (err) { showNotification('Failed to revoke VIP: ' + err.message, 'error'); }
}

async function deleteUser(telegramId, fromModal = false) {
    if (!confirm(`Permanently delete user ${telegramId}? This cannot be undone.`)) return;
    try {
        await apiFetch(`/admin/users/${telegramId}`, { method: 'DELETE' });
        showNotification('User deleted', 'success');
        if (fromModal) closeModal();
        loadUsers();
    } catch (err) { showNotification('Failed to delete: ' + err.message, 'error'); }
}

// ── Report Actions ────────────────────────────────────────────────────────────
async function resolveReport(reportId, btn) {
    try {
        await apiFetch(`/admin/reports/${reportId}/resolve`, { method: 'POST' });
        btn.closest('tr').querySelector('.status-pending').className = 'status-resolved';
        btn.closest('tr').querySelector('.status-resolved').textContent = 'resolved';
        btn.closest('td').innerHTML = '<span style="color:#888;font-size:12px">resolved</span>';
        showNotification('Report resolved', 'success');
    } catch (err) { showNotification('Failed: ' + err.message, 'error'); }
}

async function dismissReport(reportId, btn) {
    try {
        await apiFetch(`/admin/reports/${reportId}/dismiss`, { method: 'POST' });
        btn.closest('td').innerHTML = '<span style="color:#888;font-size:12px">dismissed</span>';
        showNotification('Report dismissed', 'success');
    } catch (err) { showNotification('Failed: ' + err.message, 'error'); }
}

// ── Broadcast ─────────────────────────────────────────────────────────────────
async function sendBroadcast() {
    const message = document.getElementById('broadcast-msg').value.trim();
    const target = document.querySelector('input[name="target"]:checked')?.value || 'all';
    const statusEl = document.getElementById('broadcast-status');
    const resultEl = document.getElementById('broadcast-result');
    if (!message) { showNotification('Please enter a message', 'error'); return; }
    statusEl.textContent = '⏳ Sending...';
    resultEl.style.display = 'none';
    try {
        const result = await apiFetch('/admin/broadcast', { method: 'POST', body: JSON.stringify({ message, targetGroup: target }) });
        statusEl.textContent = '';
        resultEl.style.display = 'block';
        resultEl.style.background = '#1b5e20';
        resultEl.style.color = '#a5d6a7';
        resultEl.textContent = `✅ Sent to ${result.sent}/${result.total} users (${result.failed} failed)`;
        document.getElementById('broadcast-msg').value = '';
        showNotification(`Broadcast sent to ${result.sent} users`, 'success');
    } catch (err) {
        statusEl.textContent = '';
        resultEl.style.display = 'block';
        resultEl.style.background = '#b71c1c';
        resultEl.style.color = '#ffcdd2';
        resultEl.textContent = `❌ Failed: ${err.message}`;
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Test connection first
    const connected = await testConnection();
    if (connected) {
        loadDashboardData();
    } else {
        // Show error state
        document.getElementById('total-users').textContent = 'N/A';
        document.getElementById('total-matches').textContent = 'N/A';
        document.getElementById('vip-users').textContent = 'N/A';
        document.getElementById('total-revenue').textContent = 'N/A';
    }
});

// Auto-refresh every 30 seconds
setInterval(() => {
    const currentPage = document.querySelector('.nav-item.active').dataset.page;
    if (currentPage === 'overview') {
        loadDashboardData();
    }
}, 30000);
