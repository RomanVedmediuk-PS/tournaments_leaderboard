# Tournament Leaderboard

A dynamic tournament leaderboard web application that displays real-time tournament rankings and player statistics.

## 🌐 Live Demo

Visit the live site: [https://romanvedmediuk-ps.github.io/tournaments_leaderboard/](https://romanvedmediuk-ps.github.io/tournaments_leaderboard/)

## Features

- **🏆 Podium Visualization** - stunning 3D podium-style leaderboard with animated blocks
- **👑 Winner Crown** - special crown animation and effects for the tournament champion
- **🔄 Dual View Modes** - toggle between podium visualization and traditional table view
- **📅 Historical Data Access** - browse and view tournament standings from any previous date
- **📡 Real-time data fetching** from GitHub repository with robust error handling
- **📱 Fully responsive design** - works beautifully on desktop, tablet, and mobile
- **🎨 Modern UI** with beautiful styling, animations, and empty states
- **🚫 No Stale Data** - shows empty state instead of outdated fallback information
- **⏰ Auto-refresh** functionality (every 5 minutes) with date preservation
- **🏅 Color-coded positions** - unique colors for each ranking position
- **🔗 Dynamic links** to player detail pages (adapts to tournament folder)
- **📊 Smart score formatting** (K for thousands, M for millions)
- **🎯 Flexible Configuration** - easily adaptable to different repositories and tournaments
- **🔍 Date Navigation** - intuitive dropdown to select and view historical tournament data
- **✨ Smooth Animations** - engaging slide-in effects and block animations

## Podium Visualization

Experience tournament standings like never before with our interactive 3D podium:

### **Visual Elements**
- **Animated Blocks**: Colored building blocks that grow to represent player scores
- **Winner's Crown**: Special golden crown with bounce animation for 1st place
- **Player Avatars**: Circular profile pictures with initials above each podium
- **Color Coding**: 
  - 🥇 **1st Place**: Blue blocks with crown
  - 🥈 **2nd Place**: Green blocks  
  - 🥉 **3rd Place**: Red blocks
  - **4th Place**: Yellow blocks

### **Interactive Features**
- **Height Scaling**: Block heights automatically scale based on relative scores
- **Shine Effects**: Subtle light animations across the blocks
- **View Toggle**: Switch between podium and traditional table views
- **Responsive Design**: Adapts beautifully to all screen sizes

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
