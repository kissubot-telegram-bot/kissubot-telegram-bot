# Kissubot Admin Dashboard

A professional web-based admin dashboard for monitoring and managing your Telegram dating bot.

## 🎯 Features

### Dashboard Overview
- **Real-time Statistics**
  - Total users count
  - Total matches created
  - VIP subscribers
  - Revenue tracking
  
- **Interactive Charts**
  - User growth trends
  - Match activity analytics
  - Revenue over time
  
- **Recent Activity Feed**
  - New user registrations
  - Match notifications
  - VIP subscriptions
  - System alerts

### User Management
- View all registered users
- Search and filter users
- Ban/unban users
- Export user data
- View user profiles and activity

### Revenue Analytics
- Monthly revenue tracking
- Average revenue per user
- VIP subscription trends
- Revenue forecasting

### Match Statistics
- Daily match count
- Match success rate
- Popular matching times
- User engagement metrics

### Reports & Moderation
- View pending reports
- Review user complaints
- Moderate content
- Take action on violations

### Settings
- Configure bot parameters
- Update admin credentials
- Manage notifications
- System preferences

## 🚀 Deployment

### Local Development

1. **Start your bot server:**
```bash
cd kissubot-telegram-bot
npm start
```

2. **Access the dashboard:**
```
http://localhost:3000/admin
```

### Production Deployment

#### Option 1: Deploy with your existing bot (Recommended)

The dashboard is already integrated with your bot server. Just deploy your bot and access:
```
https://your-bot-domain.com/admin
```

#### Option 2: Deploy separately on Netlify/Vercel

1. **Create a new repository with just the admin folder**

2. **Deploy to Netlify:**
   - Go to netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect your repository
   - Set build settings:
     - Base directory: `admin`
     - Build command: (leave empty)
     - Publish directory: `.`
   - Click "Deploy"

3. **Deploy to Vercel:**
   - Go to vercel.com
   - Click "New Project"
   - Import your repository
   - Set root directory to `admin`
   - Click "Deploy"

4. **Update API endpoint:**
   - Open `admin/dashboard.js`
   - Update `API_BASE` to your bot's backend URL:
   ```javascript
   const API_BASE = 'https://your-bot-backend.onrender.com';
   ```

## 🔐 Security

### Add Authentication (Recommended)

Currently, the dashboard has no authentication. To secure it:

#### Option 1: Simple Password Protection

Add this to `admin/index.html` before the closing `</body>` tag:

```html
<script>
  const ADMIN_PASSWORD = 'your-secure-password-here';
  const isAuthenticated = sessionStorage.getItem('adminAuth');
  
  if (!isAuthenticated) {
    const password = prompt('Enter admin password:');
    if (password !== ADMIN_PASSWORD) {
      alert('Access denied');
      window.location.href = '/';
    } else {
      sessionStorage.setItem('adminAuth', 'true');
    }
  }
</script>
```

#### Option 2: Server-side Authentication

Add authentication middleware in `server.js`:

```javascript
// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = 'your-secret-token'; // Use environment variable
  
  if (authHeader === `Bearer ${token}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Protect admin routes
app.get('/admin/stats', adminAuth, async (req, res) => {
  // ... existing code
});
```

## 📊 API Endpoints

The dashboard uses these API endpoints:

- `GET /admin/stats` - Dashboard statistics
- `GET /admin/users` - List all users
- `GET /admin/reports` - List all reports
- `POST /admin/users/:telegramId/ban` - Ban a user

## 🎨 Customization

### Change Colors

Edit `admin/styles.css`:

```css
:root {
    --primary: #FF6B9D;        /* Main brand color */
    --primary-dark: #E85A8A;   /* Darker shade */
    --secondary: #4A90E2;      /* Secondary color */
    --success: #4CAF50;        /* Success messages */
    --warning: #FFC107;        /* Warnings */
    --danger: #F44336;         /* Errors/danger */
}
```

### Add New Pages

1. Add navigation item in `index.html`:
```html
<a href="#" class="nav-item" data-page="analytics">
    <span class="icon">📈</span>
    <span>Analytics</span>
</a>
```

2. Add page content:
```html
<div id="analytics-page" class="page">
    <!-- Your content here -->
</div>
```

3. Add page loader in `dashboard.js`:
```javascript
function loadPageData(page) {
    switch(page) {
        case 'analytics':
            loadAnalytics();
            break;
        // ... other cases
    }
}
```

## 🔧 Troubleshooting

### Dashboard not loading data

1. Check if your bot server is running
2. Verify API_BASE URL in `dashboard.js`
3. Check browser console for errors
4. Ensure CORS is enabled on your server

### Charts not displaying

1. Verify Chart.js is loaded (check browser console)
2. Ensure canvas elements have correct IDs
3. Check if data is being fetched successfully

### 404 errors on admin routes

1. Ensure `express.static('admin')` is configured in server.js
2. Verify admin folder is in the correct location
3. Restart your server

## 💡 Tips

1. **Use HTTPS in production** - Always use HTTPS for security
2. **Add authentication** - Protect your admin panel
3. **Monitor regularly** - Check dashboard daily for issues
4. **Backup data** - Regular database backups
5. **Set up alerts** - Get notified of critical events

## 📱 Mobile Responsive

The dashboard is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones

## 🆘 Support

For issues or questions:
- Check the troubleshooting section
- Review server logs
- Contact your developer

## 📝 License

This admin dashboard is part of the Kissubot project.
