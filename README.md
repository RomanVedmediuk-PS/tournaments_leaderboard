# Tournament Leaderboard

A dynamic tournament leaderboard web application that displays real-time tournament rankings and player statistics.

## 🌐 Live Demo

Visit the live site: [https://romanvedmediuk-ps.github.io/tournaments_leaderboard/](https://romanvedmediuk-ps.github.io/tournaments_leaderboard/)

## Features

- **🔄 Smart Auto-discovery** of latest tournament folders and standings files
- **📅 Historical Data Access** - browse and view tournament standings from any previous date
- **📡 Real-time data fetching** from GitHub repository with robust error handling
- **📱 Fully responsive design** that works on desktop, tablet, and mobile
- **🎨 Modern UI** with beautiful styling, animations, and empty states
- **🚫 No Stale Data** - shows empty state instead of outdated fallback information
- **⏰ Auto-refresh** functionality (every 5 minutes) with date preservation
- **🏅 Medal icons** for top 3 players with special styling
- **🔗 Dynamic links** to player detail pages (adapts to tournament folder)
- **📊 Smart score formatting** (K for thousands, M for millions)
- **🎯 Flexible Configuration** - easily adaptable to different repositories and tournaments
- **🔍 Date Navigation** - intuitive dropdown to select and view historical tournament data

## Historical Data Navigation

The website now includes powerful historical data browsing capabilities:

### **Date Selector**
- **Dropdown Menu**: Select from all available tournament dates
- **"Latest Available" Option**: Always shows the most recent data
- **Refresh Button**: Updates the available dates list
- **Automatic Discovery**: Finds all `standings_YYYY_MM_DD.md` files

### **Smart Data Loading**
- **Dynamic URL Building**: Automatically constructs URLs for selected dates
- **Preserved State**: Selected date persists during auto-refresh cycles
- **Error Recovery**: Falls back gracefully if selected date becomes unavailable
- **Fast Switching**: Instant navigation between different tournament dates

### **User Experience**
- **Intuitive Interface**: Calendar icon and clear date formatting
- **Responsive Design**: Works seamlessly on all device sizes
- **Loading Feedback**: Visual indicators during date changes
- **Keyboard Accessible**: Full keyboard navigation support

## Technologies Used

- HTML5
- CSS3 (with modern flexbox/grid layouts)
- JavaScript (ES6+)
- Font Awesome icons
- Google Fonts (Inter)
- GitHub API for dynamic content discovery

## Local Development

To run this project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/RomanVedmediuk-PS/tournaments_leaderboard.git
   cd tournaments_leaderboard
   ```

2. Start a local server:
   ```bash
   python -m http.server 8080
   ```

3. Open your browser and navigate to `http://localhost:8080`

## Deployment

This site is automatically deployed to GitHub Pages using GitHub Actions. Any push to the `main` branch will trigger a new deployment.
