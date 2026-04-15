// Dashboard JavaScript
// Update this URL to your deployed bot backend
// For local testing, use: http://localhost:3002
// For production, use your Render URL
const API_BASE = 'https://kissubot-telegram-bot-3.onrender.com';

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

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
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
        // Fetch stats
        console.log('Fetching from:', `${API_BASE}/admin/stats`);
        const statsRes = await fetch(`${API_BASE}/admin/stats`);
        
        if (!statsRes.ok) {
            throw new Error(`HTTP ${statsRes.status}: ${statsRes.statusText}`);
        }
        
        const stats = await statsRes.json();
        console.log('Stats loaded:', stats);
        
        // Update stats cards
        document.getElementById('total-users').textContent = stats.totalUsers || 0;
        document.getElementById('total-matches').textContent = stats.totalMatches || 0;
        document.getElementById('vip-users').textContent = stats.vipUsers || 0;
        document.getElementById('total-revenue').textContent = `$${stats.totalRevenue || 0}`;
        
        // Load charts with real data
        await loadUserGrowthChart();
        await loadMatchActivityChart();
        
        // Load recent activity
        await loadRecentActivity();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const errorMsg = `Failed to load dashboard: ${error.message}. Check if backend is running at ${API_BASE}`;
        showNotification(errorMsg, 'error');
        
        // Show error in UI
        document.getElementById('total-users').textContent = 'Error';
        document.getElementById('total-matches').textContent = 'Error';
        document.getElementById('vip-users').textContent = 'Error';
        document.getElementById('total-revenue').textContent = 'Error';
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

// Load Users
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE}/admin/users`);
        const users = await res.json();
        
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.telegramId}</td>
                <td>${user.name}</td>
                <td>${user.gender}</td>
                <td>${user.location || 'N/A'}</td>
                <td><span class="badge ${user.isVip ? 'vip' : ''}">${user.isVip ? 'VIP' : 'Free'}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <button onclick="viewUser('${user.telegramId}')">View</button>
                    <button onclick="banUser('${user.telegramId}')">Ban</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load Reports
async function loadReports() {
    try {
        const res = await fetch(`${API_BASE}/admin/reports`);
        const reports = await res.json();
        
        const tbody = document.getElementById('reports-table-body');
        tbody.innerHTML = reports.map(report => `
            <tr>
                <td>${report._id.substring(0, 8)}</td>
                <td>${report.type}</td>
                <td>${report.reporterId}</td>
                <td>${report.reportedId || 'N/A'}</td>
                <td>${report.reason}</td>
                <td><span class="badge ${report.status}">${report.status}</span></td>
                <td>
                    <button onclick="reviewReport('${report._id}')">Review</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading reports:', error);
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

// User actions
function viewUser(userId) {
    alert(`Viewing user: ${userId}`);
}

function banUser(userId) {
    if (confirm(`Are you sure you want to ban user ${userId}?`)) {
        fetch(`${API_BASE}/admin/users/${userId}/ban`, { method: 'POST' })
            .then(() => {
                showNotification('User banned successfully', 'success');
                loadUsers();
            })
            .catch(err => showNotification('Failed to ban user', 'error'));
    }
}

function reviewReport(reportId) {
    alert(`Reviewing report: ${reportId}`);
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
