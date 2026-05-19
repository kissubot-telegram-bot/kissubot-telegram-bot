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

function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

// Load dashboard data
async function loadDashboardData() {
    try {
        const s = await apiFetch('/admin/stats');

        // ROW 1 — Today
        setEl('active-today', (s.activeToday || 0).toLocaleString());
        setEl('matches-today', (s.matchesToday || 0).toLocaleString());
        setEl('revenue-today', `$${s.revenueToday || 0}`);
        setEl('new-today', (s.newToday || 0).toLocaleString());

        // ROW 2 — Rates
        setEl('match-rate', `${s.matchRate || 0}%`);
        setEl('conversion-rate', `${s.conversionRate || 0}%`);
        setEl('retention-rate', `${s.retentionRate || 0}%`);
        setEl('gender-ratio', `${s.maleRatio || 0}% M`);
        setEl('gender-ratio-sub', `👔 ${s.maleRatio || 0}% · 👗 ${s.femaleRatio || 0}%`);

        // ROW 3 — Volume
        setEl('total-users', (s.totalUsers || 0).toLocaleString());
        setEl('male-users', (s.maleUsers || 0).toLocaleString());
        setEl('female-users', (s.femaleUsers || 0).toLocaleString());
        setEl('banned-users', (s.bannedUsers || 0).toLocaleString());
        setEl('total-swipes', (s.totalSwipes || 0).toLocaleString());
        setEl('chats-started', (s.chatsStarted || 0).toLocaleString());
        setEl('avg-matches', s.avgMatchesPerUser || 0);
        setEl('vip-users', (s.vipUsers || 0).toLocaleString());
        setEl('total-revenue', s.totalRevenue || 0);

        // Funnel
        const f = s.funnel || {};
        const base = f.joined || 1;
        const pct = (n) => base > 0 ? `${((n / base) * 100).toFixed(1)}%` : '–';
        const fSteps = ['joined','swiped','matched','chatted','paid'];
        fSteps.forEach(step => {
            const el = document.getElementById(`funnel-${step}`);
            if (!el) return;
            el.querySelector('.funnel-count').textContent = (f[step] || 0).toLocaleString();
            const pctEl = el.querySelector('.funnel-pct');
            if (pctEl) pctEl.textContent = step === 'joined' ? 'baseline' : pct(f[step] || 0);
        });

        await loadUserGrowthChart();
        await loadMatchActivityChart();
        await loadRecentActivity();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification(`Failed to load dashboard: ${error.message}`, 'error');
        ['total-users','vip-users','total-revenue','active-today','matches-today','new-today'].forEach(id => {
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
        case 'settings':
            updateBroadcastCount();
            break;
    }
}

// ── Revenue ────────────────────────────────────────────────────────────────
let revenueChart, revTypeChart;
let currentRevMonth = 'all';
let currentTxnPage = 1;
let allTxnData = [];

const TYPE_COLORS = { vip: '#FFD700', coins: '#4CAF50', boost: '#2196F3', gift_vip: '#E91E63' };
const TYPE_LABELS = { vip: '👑 VIP', coins: '💰 Coins', boost: '🚀 Boosts', gift_vip: '🎁 Gift VIP' };

function fmtStars(n) { return `${Number(n || 0).toLocaleString()} ⭐`; }
function fmtUSD(n)   { return `$${Number(n || 0).toFixed(2)}`; }

async function loadRevenueChart() {
    try {
        // Load month dropdown
        const mRes = await fetch(`${API_BASE}/admin/revenue/months`);
        const months = await mRes.json();
        const sel = document.getElementById('revenue-month-filter');
        if (sel) {
            sel.innerHTML = '<option value="all">All Time</option>' +
                months.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
            sel.value = currentRevMonth;
            sel.onchange = () => { currentRevMonth = sel.value; currentTxnPage = 1; loadRevenueChart(); };
        }

        // Load main revenue data
        const url = currentRevMonth === 'all'
            ? `${API_BASE}/admin/revenue`
            : `${API_BASE}/admin/revenue?month=${currentRevMonth}`;
        const res = await fetch(url);
        const d = await res.json();

        // Summary cards (always show all-time in top row regardless of filter)
        const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        setEl('rev-stars',     fmtStars(d.allTime?.stars));
        setEl('rev-usd',       fmtUSD(d.allTime?.usd));
        setEl('rev-count',     (d.allTime?.count || 0).toLocaleString());
        setEl('avg-revenue',   fmtUSD(d.arpu));
        setEl('monthly-revenue', fmtUSD(d.thisMonth?.usd) + ` (${fmtStars(d.thisMonth?.stars)})`);
        setEl('rev-today',     fmtUSD(d.today?.usd) + ` (${fmtStars(d.today?.stars)})`);

        // Revenue trend chart
        const ctx = document.getElementById('revenueChart');
        if (ctx) {
            if (revenueChart) revenueChart.destroy();
            revenueChart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: d.revenueData.map(r => r.month),
                    datasets: [
                        { label: '⭐ Stars', data: d.revenueData.map(r => r.stars), backgroundColor: 'rgba(255,215,0,0.7)', yAxisID: 'y' },
                        { label: '💵 USD', data: d.revenueData.map(r => r.revenue), backgroundColor: 'rgba(76,175,80,0.7)', yAxisID: 'y2' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: { legend: { labels: { color: '#ccc' } } },
                    scales: {
                        y:  { beginAtZero: true, ticks: { color: '#FFD700', callback: v => v + '⭐' } },
                        y2: { beginAtZero: true, position: 'right', ticks: { color: '#4CAF50', callback: v => '$' + v }, grid: { drawOnChartArea: false } }
                    }
                }
            });
        }

        // Product type pie chart
        const typeCtx = document.getElementById('revTypeChart');
        if (typeCtx && d.byType && d.byType.length) {
            if (revTypeChart) revTypeChart.destroy();
            revTypeChart = new Chart(typeCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: d.byType.map(t => TYPE_LABELS[t._id] || t._id),
                    datasets: [{ data: d.byType.map(t => t.stars), backgroundColor: d.byType.map(t => TYPE_COLORS[t._id] || '#888') }]
                },
                options: { responsive: true, plugins: { legend: { labels: { color: '#ccc', font: { size: 12 } } } } }
            });
        }

        // Top buyers table
        const tbody = document.getElementById('top-buyers-body');
        if (tbody) {
            tbody.innerHTML = (d.topBuyers || []).length === 0
                ? '<tr><td colspan="4" style="text-align:center;color:#666;padding:12px">No buyers yet</td></tr>'
                : (d.topBuyers || []).map(b =>
                    `<tr style="border-bottom:1px solid #222">
                        <td style="padding:6px">${b.name || '—'}<br><span style="color:#666;font-size:11px">${b._id}</span></td>
                        <td style="text-align:right;padding:6px;color:#FFD700">${b.stars.toLocaleString()}</td>
                        <td style="text-align:right;padding:6px;color:#4CAF50">${fmtUSD(b.usd)}</td>
                        <td style="text-align:right;padding:6px">${b.count}</td>
                    </tr>`).join('');
        }

        // Load transaction log
        await loadTransactions(currentRevMonth, currentTxnPage);

    } catch (error) {
        console.error('Error loading revenue chart:', error);
    }
}

async function loadTransactions(month, page) {
    try {
        const url = `${API_BASE}/admin/revenue/transactions?month=${month}&page=${page}`;
        const res = await fetch(url);
        const data = await res.json();
        allTxnData = data.transactions || [];

        const label = document.getElementById('txn-count-label');
        if (label) label.textContent = `${data.total} transactions · ${fmtStars(data.totalStars)} · ${fmtUSD(data.totalUSD)}`;

        const tbody = document.getElementById('txn-table-body');
        if (!tbody) return;
        if (!allTxnData.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#666">No transactions yet</td></tr>';
        } else {
            const badgeColors = { vip:'#FFD700', coins:'#4CAF50', boost:'#2196F3', gift_vip:'#E91E63' };
            tbody.innerHTML = allTxnData.map(t => {
                const dt = new Date(t.createdAt);
                const dateStr = dt.toLocaleDateString('en-GB') + ' ' + dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
                const badge = `<span style="background:${badgeColors[t.type]||'#555'};color:#000;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700">${(TYPE_LABELS[t.type]||t.type).replace(/^.+? /,'')}</span>`;
                return `<tr style="border-bottom:1px solid #1a1a2e">
                    <td style="padding:8px;color:#aaa;white-space:nowrap">${dateStr}</td>
                    <td style="padding:8px">${t.buyerName||'—'}<br><span style="color:#555;font-size:11px">${t.telegramId}</span></td>
                    <td style="padding:8px">${t.productTitle||t.productKey}</td>
                    <td style="padding:8px;text-align:center">${badge}</td>
                    <td style="padding:8px;text-align:right;color:#FFD700">${t.amountStars.toLocaleString()}</td>
                    <td style="padding:8px;text-align:right;color:#4CAF50">${fmtUSD(t.amountUSD)}</td>
                </tr>`;
            }).join('');
        }

        // Pagination
        const pgDiv = document.getElementById('txn-pagination');
        if (pgDiv) {
            pgDiv.innerHTML = '';
            for (let i = 1; i <= data.pages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.style.cssText = `padding:6px 12px;border-radius:6px;border:none;cursor:pointer;background:${i === page ? '#7c3aed' : '#2a2a3e'};color:#fff`;
                btn.onclick = () => { currentTxnPage = i; loadTransactions(currentRevMonth, i); };
                pgDiv.appendChild(btn);
            }
        }
    } catch (err) {
        console.error('Error loading transactions:', err);
    }
}

async function exportRevenueCSV() {
    try {
        const url = `${API_BASE}/admin/revenue/transactions?month=${currentRevMonth}&page=1`;
        // Fetch all pages
        const first = await (await fetch(url)).json();
        let rows = [...(first.transactions || [])];
        for (let p = 2; p <= first.pages; p++) {
            const r = await (await fetch(`${API_BASE}/admin/revenue/transactions?month=${currentRevMonth}&page=${p}`)).json();
            rows = rows.concat(r.transactions || []);
        }
        const header = 'Date,Buyer Name,Telegram ID,Product,Type,Stars,USD';
        const lines = rows.map(t => [
            new Date(t.createdAt).toISOString(),
            `"${(t.buyerName||'').replace(/"/g,'""')}"`,
            t.telegramId,
            `"${(t.productTitle||t.productKey||'').replace(/"/g,'""')}"`,
            t.type,
            t.amountStars,
            (t.amountUSD||0).toFixed(2)
        ].join(','));
        const csv = [header, ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kissubot-revenue-${currentRevMonth}.csv`;
        a.click();
    } catch (err) {
        console.error('CSV export error:', err);
        alert('Export failed: ' + err.message);
    }
}

// ── Matches: state ────────────────────────────────────────────────────────
let matchCurrentPage = 1;
let matchSearchTimeout;

function debounceMatchSearch() {
    clearTimeout(matchSearchTimeout);
    matchSearchTimeout = setTimeout(() => loadMatchStats(1), 400);
}

async function loadMatchStats(page = matchCurrentPage) {
    matchCurrentPage = page;
    const tbody = document.getElementById('matches-table-body');
    const search = document.getElementById('match-search')?.value?.trim() || '';
    const limit = document.getElementById('match-per-page')?.value || 25;

    try {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:24px">
            <div style="display:inline-block;width:24px;height:24px;border:3px solid #FF6B9D;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></div>
            <div style="margin-top:8px;font-size:13px">Loading matches...</div>
        </td></tr>`;

        let url = `/admin/matches?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const data = await apiFetch(url);

        // Stat cards
        const tmEl = document.getElementById('total-matches-page');
        if (tmEl) tmEl.textContent = (data.totalMatches || 0).toLocaleString();
        const tdEl = document.getElementById('today-matches');
        if (tdEl) tdEl.textContent = data.todayMatches || 0;
        const mrEl = document.getElementById('match-rate');
        if (mrEl) mrEl.textContent = `${data.matchRate || 0}%`;
        // Sync overview card too
        const omEl = document.getElementById('total-matches');
        if (omEl) omEl.textContent = (data.totalMatches || 0).toLocaleString();

        const total = data.total || 0;
        const pages = data.pages || 1;
        const countEl = document.getElementById('matches-count-label');
        if (countEl) countEl.textContent = `${total.toLocaleString()} matches · page ${page} of ${pages}`;

        const pairs = data.recentPairs || [];
        if (!tbody) return;
        if (!pairs.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:24px">No matches found</td></tr>`;
            renderMatchPagination(0, 0, 0);
            return;
        }

        tbody.innerHTML = pairs.map(pair => {
            const u1 = pair.user1 || {};
            const u2 = pair.user2 || {};
            const u1sub = u1.username ? `<br><span style="color:#888;font-size:11px;font-family:monospace">@${u1.username}</span>` : `<br><span style="color:#555;font-size:10px">${u1.telegramId||''}</span>`;
            const u2sub = u2.username ? `<br><span style="color:#888;font-size:11px;font-family:monospace">@${u2.username}</span>` : `<br><span style="color:#555;font-size:10px">${u2.telegramId||''}</span>`;
            const g1 = u1.gender === 'Male' ? '👔' : u1.gender === 'Female' ? '👗' : '–';
            const g2 = u2.gender === 'Male' ? '👔' : u2.gender === 'Female' ? '👗' : '–';
            const loc = u1.location || u2.location || '–';
            const when = pair.matchedAt ? new Date(pair.matchedAt).toLocaleDateString() : '–';
            return `<tr style="transition:background .1s" onmouseover="this.style.background='rgba(255,107,157,0.05)'" onmouseout="this.style.background=''">
                <td><strong>${u1.name||'Unknown'}${u1.isVip?' 👑':''}</strong>${u1sub}</td>
                <td style="text-align:center;font-size:16px">${g1}</td>
                <td><strong>${u2.name||'Unknown'}${u2.isVip?' 👑':''}</strong>${u2sub}</td>
                <td style="text-align:center;font-size:16px">${g2}</td>
                <td style="color:#aaa;font-size:13px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${loc}</td>
                <td style="color:#aaa;font-size:12px">${when}</td>
            </tr>`;
        }).join('');

        renderMatchPagination(page, pages, total);

    } catch (error) {
        console.error('Error loading match stats:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#e53935;padding:20px">Failed: ${error.message}</td></tr>`;
    }
}

function renderMatchPagination(currentPage, totalPages, totalItems) {
    const container = document.getElementById('matches-pagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const limit = parseInt(document.getElementById('match-per-page')?.value || 25);
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalItems);

    let html = `<span class="page-info">${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${totalItems.toLocaleString()}</span>`;
    html += `<button class="page-btn" onclick="loadMatchStats(1)" ${currentPage===1?'disabled':''}>«</button>`;
    html += `<button class="page-btn" onclick="loadMatchStats(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;

    let startP = Math.max(1, currentPage - 2);
    let endP = Math.min(totalPages, currentPage + 2);
    if (endP - startP < 4) {
        if (startP === 1) endP = Math.min(totalPages, startP + 4);
        else startP = Math.max(1, endP - 4);
    }
    if (startP > 1) html += `<span class="page-info">...</span>`;
    for (let p = startP; p <= endP; p++) {
        html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="loadMatchStats(${p})">${p}</button>`;
    }
    if (endP < totalPages) html += `<span class="page-info">...</span>`;
    html += `<button class="page-btn" onclick="loadMatchStats(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>›</button>`;
    html += `<button class="page-btn" onclick="loadMatchStats(${totalPages})" ${currentPage===totalPages?'disabled':''}>»</button>`;
    html += `<span class="page-info">${totalPages} pages</span>`;

    container.innerHTML = html;
}

// ── Match Users Modal ─────────────────────────────────────────────────────
function openMatchModal() {
    document.getElementById('match-user1').value = '';
    document.getElementById('match-user2').value = '';
    const msg = document.getElementById('match-modal-msg');
    msg.style.display = 'none';
    document.getElementById('match-modal').style.display = 'flex';
}

function closeMatchModal() {
    document.getElementById('match-modal').style.display = 'none';
}

async function submitMatch() {
    const raw1 = document.getElementById('match-user1').value.trim();
    const raw2 = document.getElementById('match-user2').value.trim();
    const msgEl = document.getElementById('match-modal-msg');

    const resolve = async (val) => {
        if (/^\d+$/.test(val)) return val;
        const uname = val.replace('@', '');
        const data = await apiFetch(`/admin/users?search=${encodeURIComponent(uname)}&limit=1`);
        const users = Array.isArray(data) ? data : (data.users || []);
        if (!users.length) throw new Error(`User not found: ${val}`);
        return users[0].telegramId;
    };

    const showMsg = (text, ok) => {
        msgEl.textContent = text;
        msgEl.style.background = ok ? 'rgba(67,160,71,0.15)' : 'rgba(229,57,53,0.15)';
        msgEl.style.color = ok ? '#43a047' : '#e53935';
        msgEl.style.border = `1px solid ${ok ? '#43a047' : '#e53935'}`;
        msgEl.style.display = 'block';
    };

    if (!raw1 || !raw2) return showMsg('Both fields are required.', false);

    try {
        msgEl.textContent = 'Looking up users...';
        msgEl.style.display = 'block';
        msgEl.style.color = '#888';
        msgEl.style.background = 'rgba(255,255,255,0.05)';
        msgEl.style.border = '1px solid #444';

        const [id1, id2] = await Promise.all([resolve(raw1), resolve(raw2)]);
        const result = await apiFetch('/admin/match', { method: 'POST', body: JSON.stringify({ user1Id: id1, user2Id: id2 }) });
        showMsg(`✅ ${result.message}`, true);
        setTimeout(() => { closeMatchModal(); loadMatchStats(1); }, 1500);
    } catch (err) {
        showMsg(`❌ ${err.message}`, false);
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
async function updateBroadcastCount() {
    const target = document.querySelector('input[name="target"]:checked')?.value || 'all';
    const label = document.getElementById('broadcast-count-label');
    if (!label) return;
    label.textContent = 'calculating...';
    try {
        const data = await apiFetch(`/admin/broadcast/count?targetGroup=${target}`);
        label.textContent = `~${data.count.toLocaleString()} recipients`;
    } catch { label.textContent = 'count unavailable'; }
}

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
