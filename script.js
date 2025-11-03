// Tournament Leaderboard JavaScript
class TournamentLeaderboard {
    constructor() {
        // Configuration
        this.config = {
            repo: 'RomanVedmediuk-PS/tournaments_data',
            year: '2025',
            tournament: 'battle_2025_11_28'
        };
        
        // Build URLs dynamically
        this.baseUrl = `https://raw.githubusercontent.com/${this.config.repo}/main/${this.config.year}/${this.config.tournament}`;
        this.apiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.year}/${this.config.tournament}`;
        this.repoApiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.year}`;
        
        this.dataUrl = null; // Will be determined dynamically
        this.currentDate = null;
        this.tournamentFolder = null;
        this.init();
    }

    async init() {
        this.showLoading(true);
        try {
            // First, discover the latest tournament and standings file
            await this.discoverLatestTournament();
            await this.discoverLatestFile();
            const data = await this.fetchLeaderboardData();
            this.renderLeaderboard(data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            this.showError(true);
            this.renderEmptyLeaderboard();
        } finally {
            this.showLoading(false);
        }
    }

    async discoverLatestTournament() {
        try {
            const response = await fetch(this.repoApiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const folders = await response.json();
            
            // Filter for tournament folders (battle_YYYY_MM_DD pattern)
            const tournamentFolders = folders
                .filter(folder => folder.type === 'dir' && folder.name.startsWith('battle_'))
                .map(folder => ({
                    name: folder.name,
                    date: this.extractDateFromFolderName(folder.name)
                }))
                .filter(folder => folder.date) // Only folders with valid dates
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
            
            if (tournamentFolders.length > 0) {
                const latestTournament = tournamentFolders[0];
                this.tournamentFolder = latestTournament.name;
                // Update URLs to use the discovered tournament
                this.baseUrl = `https://raw.githubusercontent.com/${this.config.repo}/main/${this.config.year}/${this.tournamentFolder}`;
                this.apiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.year}/${this.tournamentFolder}`;
                console.log(`Using latest tournament folder: ${this.tournamentFolder} (${latestTournament.date})`);
            } else {
                console.log('No tournament folders found, using configured tournament');
            }
        } catch (error) {
            console.warn('Failed to discover latest tournament via API:', error);
            // Continue with configured tournament
        }
    }

    async discoverLatestFile() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const files = await response.json();
            
            // Filter for standings files and find the latest one
            const standingsFiles = files
                .filter(file => file.name.startsWith('standings_') && file.name.endsWith('.md'))
                .map(file => ({
                    name: file.name,
                    date: this.extractDateFromFilename(file.name)
                }))
                .filter(file => file.date) // Only files with valid dates
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
            
            if (standingsFiles.length > 0) {
                const latestFile = standingsFiles[0];
                this.dataUrl = `${this.baseUrl}/${latestFile.name}`;
                this.currentDate = latestFile.date;
                console.log(`Using latest standings file: ${latestFile.name} (${latestFile.date})`);
            } else {
                throw new Error('No standings files found in the tournament folder');
            }
        } catch (error) {
            console.warn('Failed to discover latest standings file:', error);
            throw new Error('Could not find any tournament standings data');
        }
    }

    extractDateFromFolderName(folderName) {
        // Extract date from folder name like "battle_2025_11_28"
        const match = folderName.match(/battle_(\d{4}_\d{2}_\d{2})$/);
        if (match) {
            // Convert from YYYY_MM_DD to YYYY-MM-DD
            return match[1].replace(/_/g, '-');
        }
        return null;
    }

    extractDateFromFilename(filename) {
        // Extract date from filename like "standings_2025_11_30.md"
        const match = filename.match(/standings_(\d{4}_\d{2}_\d{2})\.md/);
        if (match) {
            // Convert from YYYY_MM_DD to YYYY-MM-DD
            return match[1].replace(/_/g, '-');
        }
        return null;
    }

    async fetchLeaderboardData() {
        try {
            const response = await fetch(this.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const markdown = await response.text();
            return this.parseMarkdownData(markdown);
        } catch (error) {
            throw new Error('Failed to fetch leaderboard data');
        }
    }

    parseMarkdownData(markdown) {
        const lines = markdown.split('\n');
        const data = [];
        let inTable = false;
        let headerPassed = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (!trimmedLine) continue;
            
            // Check if we're entering the table
            if (trimmedLine.startsWith('| Rank') || trimmedLine.startsWith('|  |')) {
                inTable = true;
                continue;
            }
            
            // Skip table separator lines
            if (trimmedLine.match(/^\|\s*[:|-]+\s*\|/)) {
                headerPassed = true;
                continue;
            }
            
            // Parse table rows
            if (inTable && headerPassed && trimmedLine.startsWith('|')) {
                const columns = trimmedLine.split('|').map(col => col.trim()).filter(col => col);
                
                if (columns.length >= 3) {
                    const rank = parseInt(columns[0]) || data.length + 1;
                    const score = parseInt(columns[1]) || 0;
                    const name = columns[2] || 'Unknown';
                    const detailsColumn = columns[3] || '';
                    
                    // Extract details link if present
                    let detailsLink = null;
                    const linkMatch = detailsColumn.match(/\[details\]\(([^)]+)\)/);
                    if (linkMatch) {
                        detailsLink = linkMatch[1];
                    }
                    
                    data.push({
                        rank: rank,
                        score: score,
                        name: name,
                        details: detailsLink
                    });
                }
            }
        }

        // Sort by rank to ensure proper order
        return data.sort((a, b) => a.rank - b.rank);
    }

    renderLeaderboard(data) {
        const leaderboardBody = document.getElementById('leaderboardBody');
        const leaderboard = document.getElementById('leaderboard');
        
        leaderboardBody.innerHTML = '';
        
        if (data.length === 0) {
            this.renderEmptyState();
        } else {
            data.forEach((player, index) => {
                const entry = this.createLeaderboardEntry(player, index);
                leaderboardBody.appendChild(entry);
            });
        }
        
        leaderboard.style.display = 'block';
        this.updateLastUpdated();
        this.updateTournamentTitle();
    }

    renderEmptyLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        const leaderboardBody = document.getElementById('leaderboardBody');
        
        leaderboardBody.innerHTML = '';
        this.renderEmptyState();
        leaderboard.style.display = 'block';
        this.updateTournamentTitle();
    }

    renderEmptyState() {
        const leaderboardBody = document.getElementById('leaderboardBody');
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-content">
                <i class="fas fa-trophy empty-icon"></i>
                <h3>No Tournament Data Available</h3>
                <p>Unable to load tournament standings at this time.</p>
                <button class="btn refresh-btn" onclick="window.location.reload()">
                    <i class="fas fa-sync-alt"></i>
                    Try Again
                </button>
            </div>
        `;
        leaderboardBody.appendChild(emptyState);
    }

    updateTournamentTitle() {
        const titleElement = document.getElementById('tournamentTitle');
        if (this.currentDate) {
            const date = new Date(this.currentDate);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            titleElement.textContent = `Battle Tournament - ${formattedDate}`;
        } else {
            titleElement.textContent = 'Battle Tournament - Latest Standings';
        }
    }

    createLeaderboardEntry(player, index) {
        const entry = document.createElement('div');
        entry.className = 'leaderboard-entry';
        
        const rankClass = player.rank <= 3 ? `rank-${player.rank}` : '';
        const medal = this.getMedalIcon(player.rank);
        
        entry.innerHTML = `
            <div class="rank ${rankClass}">
                ${medal}${player.rank}
            </div>
            <div class="player-name">
                <div class="player-avatar">${this.getPlayerInitials(player.name)}</div>
                <span>${this.escapeHtml(player.name)}</span>
            </div>
            <div class="score">
                <div class="score-badge">${this.formatScore(player.score)}</div>
            </div>
            <div class="details-btn">
                ${player.details ? 
                    `<a href="https://github.com/${this.config.repo}/blob/main/${this.config.year}/${this.tournamentFolder || this.config.tournament}/${player.details}" 
                       target="_blank" class="btn">
                        <i class="fas fa-external-link-alt"></i>
                        View
                    </a>` : 
                    '<span class="btn" style="opacity: 0.5; cursor: not-allowed;">No Details</span>'
                }
            </div>
        `;
        
        return entry;
    }

    getMedalIcon(rank) {
        switch (rank) {
            case 1: return '<i class="fas fa-medal rank-medal" style="color: #ffd700;"></i>';
            case 2: return '<i class="fas fa-medal rank-medal" style="color: #c0c0c0;"></i>';
            case 3: return '<i class="fas fa-medal rank-medal" style="color: #cd7f32;"></i>';
            default: return '';
        }
    }

    getPlayerInitials(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('')
            .substring(0, 2);
    }

    formatScore(score) {
        if (score >= 1000000) {
            return (score / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        } else if (score >= 1000) {
            return (score / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        } else {
            return score.toLocaleString();
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }

    showError(show) {
        const error = document.getElementById('error');
        error.style.display = show ? 'block' : 'none';
    }

    updateLastUpdated() {
        const lastUpdated = document.getElementById('lastUpdated');
        
        if (this.currentDate) {
            // Use the date from the data file
            const dataDate = new Date(this.currentDate);
            const now = new Date();
            lastUpdated.textContent = `${dataDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })} (fetched at ${now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })})`;
        } else {
            // Fallback to current time
            const now = new Date();
            lastUpdated.textContent = now.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // Method to refresh data
    async refresh() {
        await this.init();
    }
}

// Initialize the leaderboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const leaderboard = new TournamentLeaderboard();
    
    // Add refresh functionality (optional)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
            event.preventDefault();
            leaderboard.refresh();
        }
    });

    // Auto-refresh every 5 minutes (optional)
    setInterval(() => {
        leaderboard.refresh();
    }, 5 * 60 * 1000);
});

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Add click sound effect (optional)
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn')) {
            // Could add click sound here if desired
        }
    });

    // Add keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Could add modal close functionality here
        }
    });
});