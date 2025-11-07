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
        this.fullLeaderboardData = [];
        this.init();
    }

    async init() {
        this.showLoading(true);
        try {
            // Discover the latest tournament
            await this.discoverLatestTournament();
            // Find and load the latest available data
            await this.loadLatestData();
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
            // Try API first, but fall back to configured tournament if it fails
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
            console.warn('Failed to discover latest tournament via API (likely 403 - private repo or rate limit):', error);
            // Continue with configured tournament - this is expected for private repos
            this.tournamentFolder = this.config.tournament;
            console.log(`Using configured tournament: ${this.tournamentFolder}`);
        }
    }

    async loadLatestData() {
        console.log('Finding and loading latest tournament data...');
        this.updateLoadingMessage('Searching for latest tournament data...');
        
        try {
            // Try API approach first
            const response = await fetch(this.apiUrl);
            if (response.ok) {
                const dateFolders = await response.json();
                
                // Filter for date folders (YYYY-MM-DD pattern) and sort newest first
                const validDateFolders = dateFolders
                    .filter(folder => folder.type === 'dir' && folder.name.match(/^\d{4}-\d{2}-\d{2}$/))
                    .sort((a, b) => b.name.localeCompare(a.name));
                
                console.log('Available date folders:', validDateFolders.map(f => f.name));
                
                // Try each date folder starting from the newest
                for (const dateFolder of validDateFolders) {
                    console.log(`Checking date folder: ${dateFolder.name}`);
                    const dataUrl = await this.findLatestDataInDate(dateFolder.name);
                    if (dataUrl) {
                        this.dataUrl = dataUrl;
                        this.currentDate = dateFolder.name;
                        console.log(`✅ Found latest data: ${dataUrl}`);
                        await this.fetchAndRenderData();
                        return;
                    }
                }
                
                console.log('No data found via API, trying direct file approach...');
            } else {
                console.log('API unavailable, trying direct file approach...');
            }
        } catch (error) {
            console.log('API failed, trying direct file approach:', error.message);
        }
        
        // Fallback to direct file discovery
        await this.findLatestDataDirectly();
    }

    async findLatestDataInDate(dateString) {
        try {
            const timestampResponse = await fetch(`${this.apiUrl}/${dateString}`);
            if (!timestampResponse.ok) return null;
            
            const timestampFolders = await timestampResponse.json();
            
            // Find timestamp folders and sort newest first
            const validTimestamps = timestampFolders
                .filter(folder => folder.type === 'dir' && folder.name.match(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/))
                .sort((a, b) => b.name.localeCompare(a.name));
            
            // Check each timestamp for standings.md
            for (const timestampFolder of validTimestamps) {
                const standingsResponse = await fetch(`${this.apiUrl}/${dateString}/${timestampFolder.name}`);
                if (standingsResponse.ok) {
                    const standingsFiles = await standingsResponse.json();
                    const hasStandings = standingsFiles.some(file => 
                        file.type === 'file' && file.name === 'standings.md'
                    );
                    
                    if (hasStandings) {
                        const fullPath = `${dateString}/${timestampFolder.name}/standings.md`;
                        this.currentTimestamp = timestampFolder.name;
                        console.log(`Found standings in ${fullPath}`);
                        return `${this.baseUrl}/${fullPath}`;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn(`Error checking date ${dateString}:`, error);
            return null;
        }
    }

    async findLatestDataDirectly() {
        console.log('Trying direct file discovery for latest data...');
        this.updateLoadingMessage('Scanning for tournament files...');
        
        // Try the last few days with the most successful patterns we know
        const currentDate = new Date();
        const knownPatterns = [
            { hour: 20, minute: 11, second: 23 }, // Based on your actual working file
            { hour: 23, minute: 11, second: 23 },
            { hour: 22, minute: 0, second: 0 },
            { hour: 21, minute: 0, second: 0 }
        ];
        
        // Only check the last 7 days to minimize requests
        for (let i = 0; i < 7; i++) {
            const testDate = new Date(currentDate);
            testDate.setDate(currentDate.getDate() - i);
            const dateString = testDate.toISOString().split('T')[0];
            
            console.log(`Testing date: ${dateString}`);
            
            // Try each known pattern
            for (const pattern of knownPatterns) {
                const timeString = `${dateString}_${pattern.hour.toString().padStart(2, '0')}-${pattern.minute.toString().padStart(2, '0')}-${pattern.second.toString().padStart(2, '0')}`;
                const testUrl = `${this.baseUrl}/${dateString}/${timeString}/standings.md`;
                
                try {
                    console.log(`Testing: ${testUrl}`);
                    const response = await fetch(testUrl);
                    
                    if (response.ok) {
                        const content = await response.text();
                        if (content.includes('| Rank') || content.includes('rank') || content.includes('score')) {
                            console.log(`✅ Found latest data: ${testUrl}`);
                            this.dataUrl = testUrl;
                            this.currentDate = dateString;
                            this.currentTimestamp = timeString;
                            await this.fetchAndRenderData();
                            return;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Test failed for ${timeString}:`, error.message);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        throw new Error('No tournament data found');
    }

    async fetchAndRenderData() {
        try {
            this.updateLoadingMessage('Loading tournament standings...');
            const data = await this.fetchLeaderboardData();
            this.renderLeaderboard(data);
        } catch (error) {
            console.error('Failed to fetch and render data:', error);
            throw error;
        }
    }

    extractDateFromFolderName(folderName) {
        // Extract date from folder name like "winterchampionship2025" or date folders
        // For the new structure, this is mainly used for tournament discovery
        return folderName;
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
        
        // Store all data for detailed table
        this.fullLeaderboardData = data;
        
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

    addTop50InfoBanner(totalParticipants) {
        const podiumContainer = document.getElementById('podiumContainer');
        
        // Create info banner
        const infoBanner = document.createElement('div');
        infoBanner.className = 'top50-info-banner';
        infoBanner.innerHTML = `
            <div class="banner-content">
                <i class="fas fa-info-circle"></i>
                <span class="banner-text">
                    Showing top 50 participants out of <strong>${totalParticipants.toLocaleString()}</strong> total competitors
                </span>
                <div class="banner-stats">
                    <span class="stat-item">
                        <i class="fas fa-trophy"></i>
                        Top 50 Leaders
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-users"></i>
                        ${totalParticipants.toLocaleString()} Total
                    </span>
                </div>
            </div>
        `;
        
        // Insert banner after podium columns
        podiumContainer.appendChild(infoBanner);
    }

    createPodiumColumn(player, maxScore) {
        const column = document.createElement('div');
        column.className = `podium-column position-${player.rank}`;
        
        // Add click functionality to show detailed table
        column.style.cursor = 'pointer';
        column.addEventListener('click', () => {
            this.showDetailedTable(player.rank);
        });
        
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

    async showDetailedTable(selectedRank) {
        // Find the player data for the selected rank, but limit to top 50 for modal display
        const top50Data = this.fullLeaderboardData.slice(0, 50);
        const player = top50Data.find(p => p.rank === selectedRank);
        if (!player) {
            console.error('Player not found in top 50 for rank:', selectedRank);
            return;
        }

        // Create modal overlay with loading state
        const modal = document.createElement('div');
        modal.className = 'detailed-table-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user"></i> ${this.escapeHtml(player.name)} - Detailed Stats</h3>
                    <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="loading-details">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading player details...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.appendChild(modal);
        
        // Close modal on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close modal on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Fetch and display player details
        try {
            const detailsContent = await this.fetchPlayerDetails(player);
            this.displayPlayerDetails(modal, player, detailsContent);
        } catch (error) {
            console.error('Failed to load player details:', error);
            this.displayPlayerDetailsError(modal, player, error.message);
        }
    }

    async fetchPlayerDetails(player) {
        if (!player.details) {
            throw new Error('No details file available for this player');
        }

        // Build the URL for the player's details file using actual values
        const detailsUrl = `${this.baseUrl}/${this.currentDate}/${this.currentTimestamp}/${player.details}`;
        console.log('Fetching player details from:', detailsUrl);

        try {
            const response = await fetch(detailsUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch details: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            throw new Error('Could not load player details file');
        }
    }

    displayPlayerDetails(modal, player, detailsContent) {
        const modalBody = modal.querySelector('.modal-body');
        
        // Parse the markdown content
        const parsedDetails = this.parsePlayerDetailsMarkdown(detailsContent);
        
        modalBody.innerHTML = `
            <div class="player-details-container">
                <div class="top50-notice">
                    <i class="fas fa-info-circle"></i>
                    <span>Showing Top 50 Participants Only</span>
                </div>
                
                <div class="player-summary">
                    <div class="player-avatar-large">
                        <img src="https://github.com/${player.name}.png?size=128" 
                             alt="${player.name}"
                             onerror="this.src='https://github.com/identicons/${encodeURIComponent(player.name)}.png'">
                    </div>
                    <div class="player-summary-info">
                        <h4>${this.escapeHtml(player.name)}</h4>
                        <div class="rank-badge rank-${player.rank}">
                            ${this.getRankDisplay(player.rank)}
                        </div>
                        <div class="score-display">
                            <i class="fas fa-star"></i>
                            ${this.formatScore(player.score)} points
                        </div>
                        <div class="rank-note">
                            Rank ${player.rank} of Top 50 Leaders
                        </div>
                    </div>
                </div>
                
                <div class="player-details-content">
                    <h5><i class="fas fa-chart-line"></i> Performance Details</h5>
                    <div class="details-markdown">
                        ${parsedDetails.html}
                    </div>
                </div>
                
                <div class="view-source">
                    <a href="https://github.com/${this.config.repo}/blob/main/${this.config.group}/${this.tournamentFolder || this.config.tournament}/${this.currentDate}/${this.currentTimestamp}/${player.details}" 
                       target="_blank" class="source-link">
                        <i class="fas fa-external-link-alt"></i>
                        View Full Details on GitHub
                    </a>
                </div>
            </div>
        `;
    }

    displayPlayerDetailsError(modal, player, errorMessage) {
        const modalBody = modal.querySelector('.modal-body');
        
        modalBody.innerHTML = `
            <div class="player-details-container">
                <div class="top50-notice">
                    <i class="fas fa-info-circle"></i>
                    <span>Showing Top 50 Participants Only</span>
                </div>
                
                <div class="player-summary">
                    <div class="player-avatar-large">
                        <img src="https://github.com/${player.name}.png?size=128" 
                             alt="${player.name}"
                             onerror="this.src='https://github.com/identicons/${encodeURIComponent(player.name)}.png'">
                    </div>
                    <div class="player-summary-info">
                        <h4>${this.escapeHtml(player.name)}</h4>
                        <div class="rank-badge rank-${player.rank}">
                            ${this.getRankDisplay(player.rank)}
                        </div>
                        <div class="score-display">
                            <i class="fas fa-star"></i>
                            ${this.formatScore(player.score)} points
                        </div>
                        <div class="rank-note">
                            Rank ${player.rank} of Top 50 Leaders
                        </div>
                    </div>
                </div>
                
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h5>Unable to Load Details</h5>
                    <p>${this.escapeHtml(errorMessage)}</p>
                    ${player.details ? `
                        <a href="https://github.com/${this.config.repo}/blob/main/${this.config.group}/${this.tournamentFolder || this.config.tournament}/${this.currentDate}/${this.currentTimestamp}/${player.details}" 
                           target="_blank" class="source-link">
                            <i class="fas fa-external-link-alt"></i>
                            View Details on GitHub
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }

    parsePlayerDetailsMarkdown(markdown) {
        // Enhanced markdown parser for better user experience
        const lines = markdown.split('\n');
        let html = '';
        let inCodeBlock = false;
        let inTable = false;
        let tableHeaders = [];
        let listItems = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines (but preserve spacing in code blocks)
            if (!trimmedLine && !inCodeBlock) {
                if (inList) {
                    html += this.finishList(listItems);
                    listItems = [];
                    inList = false;
                }
                continue;
            }
            
            // Handle code blocks
            if (trimmedLine.startsWith('```')) {
                if (inCodeBlock) {
                    html += '</code></pre>';
                    inCodeBlock = false;
                } else {
                    const language = trimmedLine.substring(3).trim();
                    html += `<pre class="code-block"><code class="language-${language}">`;
                    inCodeBlock = true;
                }
                continue;
            }
            
            if (inCodeBlock) {
                html += this.escapeHtml(line) + '\n';
                continue;
            }
            
            // Handle headers
            if (trimmedLine.startsWith('# ')) {
                const headerText = trimmedLine.substring(2);
                // Skip the main standings header that shows "Standings for [name] as of [timestamp]"
                if (!headerText.match(/^Standings for .+ as of \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/)) {
                    html += `<h1 class="detail-header-1">${this.escapeHtml(headerText)}</h1>`;
                }
            } else if (trimmedLine.startsWith('## ')) {
                html += `<h2 class="detail-header-2">${this.escapeHtml(trimmedLine.substring(3))}</h2>`;
            } else if (trimmedLine.startsWith('### ')) {
                html += `<h3 class="detail-header-3">${this.escapeHtml(trimmedLine.substring(4))}</h3>`;
            }
            // Handle lists
            else if (trimmedLine.match(/^[-*+]\s/)) {
                if (!inList) {
                    inList = true;
                }
                const content = trimmedLine.substring(2).trim();
                listItems.push(this.parseInlineMarkdown(content));
            }
            // Handle tables
            else if (trimmedLine.includes('|') && !inTable) {
                // Check if this might be a table
                const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
                if (nextLine.match(/^[\|\s\-:]+$/)) {
                    // This is a table header
                    tableHeaders = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
                    html += '<div class="table-container"><table class="detail-table">';
                    html += '<thead><tr>';
                    tableHeaders.forEach(header => {
                        html += `<th>${this.parseInlineMarkdown(header)}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                    inTable = true;
                    i++; // Skip the separator line
                }
            } else if (trimmedLine.includes('|') && inTable) {
                const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
                
                // Limit tables to 50 rows (excluding header) to match our top 50 participant limit in modals
                const currentRowCount = html.split('<tr>').length - 1; // Count existing rows
                if (currentRowCount >= 51) { // 1 header + 50 data rows
                    // Add a note that table was truncated
                    if (currentRowCount === 51) {
                        html += '<tr><td colspan="' + cells.length + '" style="text-align: center; font-style: italic; color: #666; padding: 10px;">... showing top 50 participants only ...</td></tr>';
                    }
                    // Skip additional rows
                    continue;
                }
                
                html += '<tr>';
                cells.forEach(cell => {
                    html += `<td>${this.parseInlineMarkdown(cell)}</td>`;
                });
                html += '</tr>';
            } else if (inTable && !trimmedLine.includes('|')) {
                html += '</tbody></table></div>';
                inTable = false;
                // Process this line normally
                html += `<p class="detail-paragraph">${this.parseInlineMarkdown(trimmedLine)}</p>`;
            }
            // Handle blockquotes
            else if (trimmedLine.startsWith('> ')) {
                html += `<blockquote class="detail-blockquote">${this.parseInlineMarkdown(trimmedLine.substring(2))}</blockquote>`;
            }
            // Handle horizontal rules
            else if (trimmedLine.match(/^[-*_]{3,}$/)) {
                html += '<hr class="detail-separator">';
            }
            // Handle regular paragraphs
            else if (trimmedLine) {
                if (inList) {
                    html += this.finishList(listItems);
                    listItems = [];
                    inList = false;
                }
                
                // Check if it's a key-value pair that might have markdown formatting
                const keyValueMatch = trimmedLine.match(/^\*\*([^:*]+):\*\*\s*(.+)$/);
                if (keyValueMatch) {
                    const [, key, value] = keyValueMatch;
                    html += `<div class="detail-stat">
                        <span class="stat-label"><strong class="detail-bold">${this.escapeHtml(key.trim())}:</strong></span>
                        <span class="stat-value">${this.escapeHtml(value.trim())}</span>
                    </div>`;
                }
                // Check for other key-value pairs (common in game details)
                else {
                    const regularKeyValueMatch = trimmedLine.match(/^([^:]+):\s*(.+)$/);
                    if (regularKeyValueMatch) {
                        const [, key, value] = regularKeyValueMatch;
                        html += `<div class="detail-stat">
                            <span class="stat-label">${this.escapeHtml(key.trim())}:</span>
                            <span class="stat-value">${this.parseInlineMarkdown(value.trim())}</span>
                        </div>`;
                    } else {
                        html += `<p class="detail-paragraph">${this.parseInlineMarkdown(trimmedLine)}</p>`;
                    }
                }
            }
        }
        
        // Close any remaining open elements
        if (inList) {
            html += this.finishList(listItems);
        }
        if (inTable) {
            html += '</tbody></table></div>';
        }
        if (inCodeBlock) {
            html += '</code></pre>';
        }
        
        return {
            html: html,
            text: markdown
        };
    }
    
    finishList(listItems) {
        if (listItems.length === 0) return '';
        return `<ul class="detail-list">${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }
    
    parseInlineMarkdown(text) {
        // First escape HTML to prevent injection
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        return escaped
            // Handle properly formatted bold markdown first
            .replace(/\*\*([^*]+?)\*\*/g, '<strong class="detail-bold">$1</strong>') // Complete bold formatting like "**Total Participants:**"
            // Fix malformed bold markdown patterns - most specific patterns first
            .replace(/\*\*([^*]+?):\s*\*\*\s*(\d+)/g, '<strong class="detail-bold">$1:</strong> $2') // Handle "**Total Participants:** 100" pattern
            .replace(/\*\*([^*]+?):\s+(\d+)/g, '<strong class="detail-bold">$1:</strong> $2') // Handle "**Total Participants: 100" pattern (no closing **)
            .replace(/\*\*([^*]+?)\s+(\d+)/g, '<strong class="detail-bold">$1</strong> $2') // Handle "**Total Participants 100" pattern
            .replace(/\*\*([^*]+?)(?=\s|$)/g, '<strong class="detail-bold">$1</strong>') // Incomplete bold at word boundary or end
            // Clean up any remaining asterisks (but preserve single ones for italic)
            .replace(/\*\*+/g, '')
            // Handle underscores for bold
            .replace(/__([^_]+?)__/g, '<strong class="detail-bold">$1</strong>')
            // Inline code (`) - do this before italic to avoid conflicts
            .replace(/`([^`]+)`/g, '<code class="detail-code">$1</code>')
            // Links - do this before other formatting
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="detail-link">$1</a>')
            // Italic text (* or _) - careful matching to avoid already processed content
            .replace(/\*([^*\s<][^*<]*?[^*\s<]*)\*/g, function(match, content) {
                // Don't format if it's just numbers or if it contains HTML
                if (/^\d+$/.test(content) || /</.test(content)) {
                    return match;
                }
                return '<em class="detail-italic">' + content + '</em>';
            })
            .replace(/(^|[^a-zA-Z0-9])_([^_\s<][^_<]*?[^_\s<]*)_([^a-zA-Z0-9]|$)/g, function(match, before, content, after) {
                // Don't format if it's just numbers or if it contains HTML
                if (/^\d+$/.test(content) || /</.test(content)) {
                    return match;
                }
                return before + '<em class="detail-italic">' + content + '</em>' + after;
            })
            // Strikethrough
            .replace(/~~([^~]+)~~/g, '<del class="detail-strikethrough">$1</del>')
            // Highlight/mark
            .replace(/==([^=]+)==/g, '<mark class="detail-highlight">$1</mark>')
            // Numbers with formatting - only for large numbers, avoid small ones in usernames
            .replace(/\b(\d{4,}|\d{1,3}(?:,\d{3})+)\b/g, '<span class="detail-number">$1</span>')
            // Clean up any remaining single asterisks
            .replace(/\*+/g, '');
    }

    createDetailedTableRow(player, selectedRank) {
        const isWinner = player.rank === 1;
        const isSelected = player.rank === selectedRank;
        const rowClass = `table-row ${isWinner ? 'winner-row' : ''} ${isSelected ? 'selected-row' : ''}`;
        
        return `
            <div class="${rowClass}">
                <div class="rank-col">
                    ${this.getRankDisplay(player.rank)}
                </div>
                <div class="player-col">
                    <img class="player-avatar-small" 
                         src="https://github.com/${player.name}.png?size=32" 
                         alt="${player.name}"
                         onerror="this.src='https://github.com/identicons/${encodeURIComponent(player.name)}.png'">
                    <span class="player-name">${this.escapeHtml(player.name)}</span>
                </div>
                <div class="score-col">
                    <span class="score-value">${this.formatScore(player.score)}</span>
                </div>
                <div class="details-col">
                    ${player.details ? 
                        `<a href="https://github.com/${this.config.repo}/blob/main/${this.config.group}/${this.tournamentFolder || this.config.tournament}/${this.currentDate}/${this.currentTimestamp}/${player.details}" 
                           target="_blank" class="details-link">
                            <i class="fas fa-external-link-alt"></i>
                            View
                        </a>` : 
                        '<span class="no-details">—</span>'
                    }
                </div>
            </div>
        `;
    }

    getRankDisplay(rank) {
        const medal = this.getMedalIcon(rank);
        return medal ? `${medal} ${rank}` : rank;
    }

    getMedalIcon(rank) {
        switch (rank) {
            case 1: return '<i class="fas fa-medal" style="color: #ffd700;"></i>';
            case 2: return '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
            case 3: return '<i class="fas fa-medal" style="color: #cd7f32;"></i>';
            default: return '';
        }
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

    updateLoadingMessage(message) {
        const loading = document.getElementById('loading');
        const loadingText = loading.querySelector('p') || loading;
        if (loadingText.tagName === 'P') {
            loadingText.textContent = message;
        }
        console.log(`Loading: ${message}`);
    }

    showError(show) {
        const error = document.getElementById('error');
        error.style.display = show ? 'block' : 'none';
    }

    updateLastUpdated() {
        const lastUpdated = document.getElementById('lastUpdated');
        
        if (this.currentDate && this.currentTimestamp) {
            // Parse the UTC data date and timestamp
            const dataDate = new Date(this.currentDate + 'T00:00:00Z'); // Start with UTC date
            const timeMatch = this.currentTimestamp.match(/\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})-(\d{2})$/);
            
            if (timeMatch) {
                const [, hours, minutes, seconds] = timeMatch;
                // Set the UTC time on the data date
                dataDate.setUTCHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
            }
            
            const now = new Date();
            
            // Format both dates consistently in local time (dataDate will be automatically converted from UTC)
            const dataDateFormatted = dataDate.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            const fetchTimeFormatted = now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            lastUpdated.innerHTML = `
                Data: ${dataDateFormatted} | Fetched: ${fetchTimeFormatted}
            `;
        } else if (this.currentDate) {
            // Fallback to just date
            const dataDate = new Date(this.currentDate);
            const now = new Date();
            
            const dataDateFormatted = dataDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const fetchTimeFormatted = now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            lastUpdated.innerHTML = `
                Data: ${dataDateFormatted} | Fetched: ${fetchTimeFormatted}
            `;
        } else {
            // Fallback to current time only
            const now = new Date();
            const fetchTimeFormatted = now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            lastUpdated.innerHTML = `
                Fetched: ${fetchTimeFormatted}
            `;
        }
    }

    // Method to refresh data
    async refresh() {
        this.showLoading(true);
        try {
            await this.discoverLatestTournament();
            await this.loadLatestData();
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