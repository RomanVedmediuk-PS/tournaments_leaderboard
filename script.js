// Tournament Leaderboard JavaScript
class TournamentLeaderboard {
    constructor() {
        // Configuration
        this.config = {
            repo: 'RomanVedmediuk-PS/tournaments_data',
            group: 'group',
            tournament: 'winterchampionship2025'
        };
        
        // Build URLs dynamically
        this.baseUrl = `https://raw.githubusercontent.com/${this.config.repo}/main/${this.config.group}/${this.config.tournament}`;
        this.apiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.group}/${this.config.tournament}`;
        this.repoApiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.group}`;
        
        this.dataUrl = null; // Will be determined dynamically
        this.currentDate = null;
        this.currentTimestamp = null;
        this.tournamentFolder = null;
        this.availableDates = [];
        this.availableTimestamps = []; // New: track timestamps for selected date
        this.selectedDate = 'latest';
        this.selectedTimestamp = 'latest';
        this.init();
    }

    async init() {
        this.showLoading(true);
        try {
            // First, discover the latest tournament and all available dates
            await this.discoverLatestTournament();
            await this.discoverAllAvailableDates();
            this.setupDateSelector();
            await this.loadDataForSelectedDateTime();
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
            
            // Filter for tournament folders (any folder in the group directory)
            const tournamentFolders = folders
                .filter(folder => folder.type === 'dir')
                .map(folder => ({
                    name: folder.name,
                    // For now, use the folder name as identifier
                    date: folder.name
                }))
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort alphabetically, newest first
            
            if (tournamentFolders.length > 0) {
                const latestTournament = tournamentFolders[0];
                this.tournamentFolder = latestTournament.name;
                // Update URLs to use the discovered tournament
                this.baseUrl = `https://raw.githubusercontent.com/${this.config.repo}/main/${this.config.group}/${this.tournamentFolder}`;
                this.apiUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.group}/${this.tournamentFolder}`;
                console.log(`Using latest tournament folder: ${this.tournamentFolder}`);
            } else {
                console.log('No tournament folders found, using configured tournament');
                this.tournamentFolder = this.config.tournament;
            }
        } catch (error) {
            console.warn('Failed to discover latest tournament via API:', error);
            // Continue with configured tournament
            this.tournamentFolder = this.config.tournament;
        }
    }

    async discoverAllAvailableDates() {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const dateFolders = await response.json();
            
            // Filter for date folders (YYYY-MM-DD pattern)
            const validDateFolders = dateFolders
                .filter(folder => folder.type === 'dir' && folder.name.match(/^\d{4}-\d{2}-\d{2}$/))
                .sort((a, b) => b.name.localeCompare(a.name)); // Sort by date, newest first
            
            this.availableDates = [];
            
            // For each date folder, find ALL timestamp folders inside
            for (const dateFolder of validDateFolders) {
                try {
                    const timestampResponse = await fetch(`${this.apiUrl}/${dateFolder.name}`);
                    if (timestampResponse.ok) {
                        const timestampFolders = await timestampResponse.json();
                        
                        // Find ALL timestamp folders and look for standings.md
                        const validTimestamps = timestampFolders
                            .filter(folder => folder.type === 'dir' && folder.name.match(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/))
                            .sort((a, b) => b.name.localeCompare(a.name)); // Sort by timestamp, newest first
                        
                        const timestampsWithStandings = [];
                        
                        // Check each timestamp for standings.md
                        for (const timestampFolder of validTimestamps) {
                            try {
                                const standingsResponse = await fetch(`${this.apiUrl}/${dateFolder.name}/${timestampFolder.name}`);
                                if (standingsResponse.ok) {
                                    const standingsFiles = await standingsResponse.json();
                                    const hasStandings = standingsFiles.some(file => 
                                        file.type === 'file' && file.name === 'standings.md'
                                    );
                                    
                                    if (hasStandings) {
                                        timestampsWithStandings.push({
                                            name: timestampFolder.name,
                                            displayTime: this.formatTimestamp(timestampFolder.name),
                                            fullPath: `${dateFolder.name}/${timestampFolder.name}/standings.md`
                                        });
                                    }
                                }
                            } catch (error) {
                                console.warn(`Failed to check timestamp folder ${timestampFolder.name}:`, error);
                            }
                        }
                        
                        // Only add date if it has timestamps with standings
                        if (timestampsWithStandings.length > 0) {
                            this.availableDates.push({
                                name: dateFolder.name,
                                date: dateFolder.name,
                                displayDate: this.formatDisplayDate(dateFolder.name),
                                timestamps: timestampsWithStandings,
                                latestTimestamp: timestampsWithStandings[0] // First one is latest due to sorting
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to check date folder ${dateFolder.name}:`, error);
                }
            }
            
            if (this.availableDates.length === 0) {
                throw new Error('No standings files found in the tournament folder');
            }
            
            console.log(`Found ${this.availableDates.length} available dates:`, this.availableDates);
        } catch (error) {
            console.warn('Failed to discover available dates:', error);
            throw new Error('Could not find any tournament standings data');
        }
    }

    extractDateFromFolderName(folderName) {
        // Extract date from folder name like "winterchampionship2025" or date folders
        // For the new structure, this is mainly used for tournament discovery
        return folderName;
    }

    formatDisplayDate(dateString, timestampString = null) {
        if (!dateString) return 'Unknown Date';
        
        try {
            const date = new Date(dateString);
            let displayText = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Add timestamp if available
            if (timestampString) {
                const timeMatch = timestampString.match(/\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})-(\d{2})$/);
                if (timeMatch) {
                    const [, hours, minutes, seconds] = timeMatch;
                    displayText += ` at ${hours}:${minutes}:${seconds}`;
                }
            }
            
            return displayText;
        } catch (error) {
            return dateString;
        }
    }

    formatTimestamp(timestampString) {
        if (!timestampString) return 'Unknown Time';
        
        const timeMatch = timestampString.match(/\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})-(\d{2})$/);
        if (timeMatch) {
            const [, hours, minutes, seconds] = timeMatch;
            return `${hours}:${minutes}:${seconds}`;
        }
        return timestampString;
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
        
        // Setup timestamp selector for the current date
        this.setupTimestampSelector();
        
        // Add event listeners
        dateSelect.addEventListener('change', async (event) => {
            this.selectedDate = event.target.value;
            await this.handleDateChange();
        });
        
        refreshBtn.addEventListener('click', async () => {
            await this.refreshAvailableDates();
        });
    }

    setupTimestampSelector() {
        // Check if timestamp selector exists, if not create it
        let timestampSelect = document.getElementById('timestampSelect');
        if (!timestampSelect) {
            // Create timestamp selector container
            const timestampContainer = document.createElement('div');
            timestampContainer.className = 'controls-group';
            timestampContainer.innerHTML = `
                <label for="timestampSelect">Time:</label>
                <select id="timestampSelect">
                    <option value="latest">Latest</option>
                </select>
            `;
            
            // Insert after date selector
            const dateContainer = document.querySelector('.controls-group');
            if (dateContainer && dateContainer.parentNode) {
                dateContainer.parentNode.insertBefore(timestampContainer, dateContainer.nextSibling);
            }
            
            timestampSelect = document.getElementById('timestampSelect');
        }
        
        // Clear existing options except the first one
        while (timestampSelect.children.length > 1) {
            timestampSelect.removeChild(timestampSelect.lastChild);
        }
        
        // Find timestamps for the selected date
        const selectedDateInfo = this.availableDates.find(d => 
            this.selectedDate === 'latest' ? d === this.availableDates[0] : d.date === this.selectedDate
        );
        
        if (selectedDateInfo && selectedDateInfo.timestamps) {
            this.availableTimestamps = selectedDateInfo.timestamps;
            
            // Populate timestamp options
            selectedDateInfo.timestamps.forEach(timestampInfo => {
                const option = document.createElement('option');
                option.value = timestampInfo.name;
                option.textContent = timestampInfo.displayTime;
                if (timestampInfo.name === this.currentTimestamp) {
                    option.selected = true;
                }
                timestampSelect.appendChild(option);
            });
        } else {
            this.availableTimestamps = [];
        }
        
        // Add event listener for timestamp changes
        timestampSelect.removeEventListener('change', this.handleTimestampChange);
        timestampSelect.addEventListener('change', (event) => this.handleTimestampChange(event));
    }

    async handleTimestampChange(event) {
        this.selectedTimestamp = event.target.value;
        await this.loadDataForSelectedDateTime();
    }

    async handleDateChange() {
        this.showLoading(true);
        try {
            // Reset timestamp selection when date changes
            this.selectedTimestamp = 'latest';
            this.setupTimestampSelector();
            await this.loadDataForSelectedDateTime();
        } catch (error) {
            console.error('Failed to load data for selected date:', error);
            this.showError(true);
            this.renderEmptyLeaderboard();
        } finally {
            this.showLoading(false);
        }
    }

    async loadDataForSelectedDateTime() {
        try {
            // Get the selected date info
            let selectedDateInfo;
            if (this.selectedDate === 'latest' && this.availableDates.length > 0) {
                selectedDateInfo = this.availableDates[0];
            } else {
                selectedDateInfo = this.availableDates.find(d => d.date === this.selectedDate);
            }
            
            if (!selectedDateInfo) {
                throw new Error('Selected date not found');
            }
            
            // Get the selected timestamp info
            let selectedTimestampInfo;
            if (this.selectedTimestamp === 'latest' && selectedDateInfo.timestamps.length > 0) {
                selectedTimestampInfo = selectedDateInfo.timestamps[0];
            } else {
                selectedTimestampInfo = selectedDateInfo.timestamps.find(t => t.name === this.selectedTimestamp);
            }
            
            if (!selectedTimestampInfo) {
                throw new Error('Selected timestamp not found');
            }
            
            this.dataUrl = `${this.baseUrl}/${selectedTimestampInfo.fullPath}`;
            this.currentDate = selectedDateInfo.date;
            this.currentTimestamp = selectedTimestampInfo.name;
            
            console.log(`Loading data for: ${selectedTimestampInfo.fullPath} (${selectedDateInfo.date} at ${selectedTimestampInfo.displayTime})`);
            
            const data = await this.fetchLeaderboardData();
            this.renderLeaderboard(data);
        } catch (error) {
            console.error('Failed to load data for selected date and timestamp:', error);
            throw error;
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
                this.selectedTimestamp = 'latest';
                dateSelect.value = 'latest';
                await this.loadDataForSelectedDateTime();
            }
        } catch (error) {
            console.error('Failed to refresh dates:', error);
        } finally {
            refreshBtn.innerHTML = originalHTML;
            refreshBtn.disabled = false;
        }
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
            // Render only podium view
            this.renderPodiumView(data);
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

    renderEmptyLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        
        this.renderEmptyState();
        leaderboard.style.display = 'block';
        this.updateTournamentTitle();
    }

    renderEmptyState() {
        const podiumContainer = document.getElementById('podiumContainer');
        
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
        
        // Show empty state in podium view only
        const podiumEmptyState = document.createElement('div');
        podiumEmptyState.className = 'empty-state';
        podiumEmptyState.innerHTML = emptyStateHTML;
        podiumContainer.innerHTML = '';
        podiumContainer.appendChild(podiumEmptyState);
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
            titleElement.textContent = `Winter Championship 2025 - ${formattedDate}`;
        } else {
            titleElement.textContent = 'Winter Championship 2025 - Latest Standings';
        }
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
        
        if (this.currentDate && this.currentTimestamp) {
            // Use the date and timestamp from the data
            const dataDate = new Date(this.currentDate);
            const now = new Date();
            const timestampDisplay = this.formatTimestamp(this.currentTimestamp);
            
            lastUpdated.textContent = `${dataDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })} at ${timestampDisplay} (fetched at ${now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })})`;
        } else if (this.currentDate) {
            // Fallback to just date
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
            await this.loadDataForSelectedDateTime();
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