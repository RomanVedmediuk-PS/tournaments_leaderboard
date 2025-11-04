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
        this.availableDates = [];
        this.selectedDate = 'latest';
        this.currentView = 'podium'; // 'podium' or 'table'
        this.init();
    }

    async init() {
        this.showLoading(true);
        try {
            // First, discover the latest tournament and all available dates
            await this.discoverLatestTournament();
            await this.discoverAllAvailableDates();
            this.setupDateSelector();
            await this.loadDataForSelectedDate();
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

    async discoverAllAvailableDates() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const files = await response.json();
            
            // Filter for standings files and extract all dates
            this.availableDates = files
                .filter(file => file.name.startsWith('standings_') && file.name.endsWith('.md'))
                .map(file => ({
                    name: file.name,
                    date: this.extractDateFromFilename(file.name),
                    displayDate: this.formatDisplayDate(this.extractDateFromFilename(file.name))
                }))
                .filter(file => file.date) // Only files with valid dates
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
            
            if (this.availableDates.length === 0) {
                throw new Error('No standings files found in the tournament folder');
            }
            
            console.log(`Found ${this.availableDates.length} available dates:`, this.availableDates);
        } catch (error) {
            console.warn('Failed to discover available dates:', error);
            throw new Error('Could not find any tournament standings data');
        }
    }

    async loadDataForSelectedDate() {
        try {
            let targetDate;
            
            if (this.selectedDate === 'latest' && this.availableDates.length > 0) {
                targetDate = this.availableDates[0];
            } else {
                targetDate = this.availableDates.find(d => d.date === this.selectedDate);
            }
            
            if (!targetDate) {
                throw new Error('Selected date not found');
            }
            
            this.dataUrl = `${this.baseUrl}/${targetDate.name}`;
            this.currentDate = targetDate.date;
            console.log(`Loading data for: ${targetDate.name} (${targetDate.date})`);
            
            const data = await this.fetchLeaderboardData();
            this.renderLeaderboard(data);
        } catch (error) {
            console.error('Failed to load data for selected date:', error);
            throw error;
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

    formatDisplayDate(dateString) {
        if (!dateString) return 'Unknown Date';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    setupDateSelector() {
        const dateSelect = document.getElementById('dateSelect');
        const refreshBtn = document.getElementById('refreshDates');
        
        // Clear existing options except the first one
        while (dateSelect.children.length > 1) {
            dateSelect.removeChild(dateSelect.lastChild);
        }
        
        // Populate with available dates
        this.availableDates.forEach(dateInfo => {
            const option = document.createElement('option');
            option.value = dateInfo.date;
            option.textContent = dateInfo.displayDate;
            if (dateInfo.date === this.currentDate) {
                option.selected = true;
            }
            dateSelect.appendChild(option);
        });
        
        // Add event listeners
        dateSelect.addEventListener('change', async (event) => {
            this.selectedDate = event.target.value;
            await this.handleDateChange();
        });
        
        refreshBtn.addEventListener('click', async () => {
            await this.refreshAvailableDates();
        });
    }

    async handleDateChange() {
        this.showLoading(true);
        try {
            await this.loadDataForSelectedDate();
        } catch (error) {
            console.error('Failed to load data for selected date:', error);
            this.showError(true);
            this.renderEmptyLeaderboard();
        } finally {
            this.showLoading(false);
        }
    }

    async refreshAvailableDates() {
        const refreshBtn = document.getElementById('refreshDates');
        const originalHTML = refreshBtn.innerHTML;
        
        try {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;
            
            await this.discoverLatestTournament();
            await this.discoverAllAvailableDates();
            this.setupDateSelector();
            
            // If current selection is no longer available, switch to latest
            const dateSelect = document.getElementById('dateSelect');
            if (!this.availableDates.find(d => d.date === this.selectedDate)) {
                this.selectedDate = 'latest';
                dateSelect.value = 'latest';
                await this.loadDataForSelectedDate();
            }
        } catch (error) {
            console.error('Failed to refresh dates:', error);
        } finally {
            refreshBtn.innerHTML = originalHTML;
            refreshBtn.disabled = false;
        }
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
        const leaderboard = document.getElementById('leaderboard');
        
        if (data.length === 0) {
            this.renderEmptyState();
        } else {
            // Render both views
            this.renderPodiumView(data);
            this.renderTableView(data);
            this.setupViewToggle();
        }
        
        leaderboard.style.display = 'block';
        this.updateLastUpdated();
        this.updateTournamentTitle();
    }

    renderPodiumView(data) {
        const podiumContainer = document.getElementById('podiumContainer');
        podiumContainer.innerHTML = '';
        
        // Sort players by rank and take top 4 for podium display
        const topPlayers = data.slice(0, 4);
        
        if (topPlayers.length === 0) return;
        
        // Calculate relative heights based on scores
        const maxScore = Math.max(...topPlayers.map(p => p.score));
        
        topPlayers.forEach((player, index) => {
            const column = this.createPodiumColumn(player, maxScore);
            podiumContainer.appendChild(column);
        });
    }

    renderTableView(data) {
        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = '';
        
        data.forEach((player, index) => {
            const entry = this.createLeaderboardEntry(player, index);
            leaderboardBody.appendChild(entry);
        });
    }

    createPodiumColumn(player, maxScore) {
        const column = document.createElement('div');
        column.className = `podium-column position-${player.rank}`;
        
        // Calculate height based on score relative to max score
        const relativeScore = player.score / maxScore;
        const minBlocks = 4;
        const maxBlocks = 15;
        
        // Ensure winner has the tallest column, then scale others proportionally
        let blockCount;
        if (player.rank === 1) {
            blockCount = maxBlocks;
        } else {
            blockCount = Math.max(minBlocks, Math.floor(relativeScore * maxBlocks));
        }
        
        // Create Tetris tetromino layers with cascading animation
        const blocksContainer = document.createElement('div');
        blocksContainer.className = 'podium-blocks';
        
        for (let i = 0; i < blockCount; i++) {
            const layer = this.createTetrisLayer(player.rank);
            
            // Tetris-like falling animation - layers fall from top and stack
            const fallDelay = (blockCount - i - 1) * 0.2 + player.rank * 0.1;
            layer.style.animationDelay = `${fallDelay}s`;
            
            // Add slight random rotation variation for more realistic Tetris feel
            const randomRotation = (Math.random() - 0.5) * 8; // -4 to +4 degrees
            layer.style.setProperty('--random-rotation', `${randomRotation}deg`);
            
            blocksContainer.appendChild(layer);
        }
        
        // Create avatar with profile picture
        const avatar = document.createElement('div');
        avatar.className = 'podium-avatar';
        
        // Create profile image
        const profileImg = document.createElement('img');
        profileImg.className = 'profile-image';
        profileImg.src = `https://github.com/${player.name}.png?size=64`;
        profileImg.alt = player.name;
        profileImg.onerror = function() {
            // Fallback to GitHub's default avatar if user image fails
            this.src = 'https://github.com/identicons/' + encodeURIComponent(player.name) + '.png';
        };
        
        avatar.appendChild(profileImg);
        
        // Create crown for winner
        if (player.rank === 1) {
            const crown = document.createElement('div');
            crown.className = 'crown';
            crown.innerHTML = '<i class="fas fa-crown"></i>';
            column.appendChild(crown);
        }
        
        // Create rank indicator
        const rankIndicator = document.createElement('div');
        rankIndicator.className = 'podium-rank';
        rankIndicator.textContent = player.rank;
        
        // Create info section
        const info = document.createElement('div');
        info.className = 'podium-info';
        info.innerHTML = `
            <div class="podium-score">${this.formatScore(player.score)}</div>
            <div class="podium-name">${this.escapeHtml(player.name)}</div>
        `;
        
        // Assemble column
        column.appendChild(avatar);
        column.appendChild(blocksContainer);
        column.appendChild(info);
        column.appendChild(rankIndicator);
        
        return column;
    }

    setupViewToggle() {
        const podiumBtn = document.getElementById('podiumViewBtn');
        const tableBtn = document.getElementById('tableViewBtn');
        const podiumContainer = document.getElementById('podiumContainer');
        const tableView = document.getElementById('tableView');
        
        // Set initial view
        if (this.currentView === 'podium') {
            podiumContainer.style.display = 'flex';
            tableView.style.display = 'none';
            podiumBtn.classList.add('active');
            tableBtn.classList.remove('active');
        } else {
            podiumContainer.style.display = 'none';
            tableView.style.display = 'block';
            podiumBtn.classList.remove('active');
            tableBtn.classList.add('active');
        }
        
        // Add event listeners
        podiumBtn.addEventListener('click', () => {
            this.currentView = 'podium';
            podiumContainer.style.display = 'flex';
            tableView.style.display = 'none';
            podiumBtn.classList.add('active');
            tableBtn.classList.remove('active');
        });
        
        tableBtn.addEventListener('click', () => {
            this.currentView = 'table';
            podiumContainer.style.display = 'none';
            tableView.style.display = 'block';
            podiumBtn.classList.remove('active');
            tableBtn.classList.add('active');
        });
    }

    renderEmptyLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        
        this.renderEmptyState();
        leaderboard.style.display = 'block';
        this.updateTournamentTitle();
    }

    renderEmptyState() {
        const podiumContainer = document.getElementById('podiumContainer');
        const leaderboardBody = document.getElementById('leaderboardBody');
        
        const emptyStateHTML = `
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
        
        // Show empty state in podium view
        const podiumEmptyState = document.createElement('div');
        podiumEmptyState.className = 'empty-state';
        podiumEmptyState.innerHTML = emptyStateHTML;
        podiumContainer.innerHTML = '';
        podiumContainer.appendChild(podiumEmptyState);
        
        // Show empty state in table view
        const tableEmptyState = document.createElement('div');
        tableEmptyState.className = 'empty-state';
        tableEmptyState.innerHTML = emptyStateHTML;
        leaderboardBody.innerHTML = '';
        leaderboardBody.appendChild(tableEmptyState);
        
        // Setup view toggle even for empty state
        this.setupViewToggle();
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

    createTetrisLayer(position) {
        const layer = document.createElement('div');
        layer.className = 'tetris-layer';
        
        // Define 2-block wide Tetris tetromino patterns - ALL SOLID (no empty spaces)
        const tetrominos = [
            [1, 1], // O-piece (solid 2x1 block)
            [1, 1], // I-piece horizontal (solid 2-block line)
            [1, 1], // Solid tetromino piece
            [1, 1], // Another solid piece
            [1, 1], // Full 2-block coverage
        ];
        
        // All patterns are solid, so just use [1, 1] for consistent fill
        const pattern = [1, 1]; // Always solid - no empty spaces
        
        // Create blocks based on the pattern (exactly 2 solid blocks)
        for (let i = 0; i < 2; i++) {
            const block = document.createElement('div');
            block.className = 'tetris-block'; // Always solid block
            layer.appendChild(block);
        }
        
        return layer;
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
        this.showLoading(true);
        try {
            await this.discoverLatestTournament();
            await this.discoverAllAvailableDates();
            this.setupDateSelector();
            await this.loadDataForSelectedDate();
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showError(true);
            this.renderEmptyLeaderboard();
        } finally {
            this.showLoading(false);
        }
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