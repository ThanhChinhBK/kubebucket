// Kube Tetris Game Logic
class KubeTetris {
    constructor() {
        // Cache busting and version management
        this.gameVersion = '0.0.1'; // Update this when making significant changes
        this.checkAndClearCache();
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load bucket image
        this.bucketImage = new Image();
        this.bucketImage.src = `assets/bucket.svg?v=${this.gameVersion}&t=${Date.now()}`;
        this.bucketImageLoaded = false;
        this.bucketImage.onload = () => {
            this.bucketImageLoaded = true;
            this.draw();
        };
        
        // Load pod and resource images
        this.images = {};
        this.assetsLoaded = false;
        this.loadAssets();
        
        // Game dimensions
        this.BOARD_WIDTH = 8;
        this.BOARD_HEIGHT = 6;
        this.CELL_SIZE = 100;
        this.NODE_HEIGHT = 1; // Bottom 1 row for nodes
        
        // Game state
        this.board = [];
        this.currentPod = null;
        this.nextPod = null;
        this.score = 0;
        this.level = 1;
        this.gameRunning = false;
        this.gamePaused = false;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.animationOffset = 0; // For smooth dropping animation
        this.isInstantDropping = false; // For smooth instant drop
        this.instantDropSpeed = 0.1; // Speed of instant drop animation
        
        // Unified animation system for better performance
        this.animations = []; // Single array for all animations
        this.landingAnimations = []; // Keep for backwards compatibility
        this.landingEffects = [];
        this.bucketShakeAnimations = [];

        // Performance optimizations
        this.isDirty = true; // Track if canvas needs redrawing
        this.forceRedraw = false; // Force redraw on next frame
        this.animationFrameThrottle = 0; // Throttle animations to 30fps instead of 60fps
        this.frameSkipCount = 0; // Track frame skipping
        this.targetFPS = 60;
        this.frameTime = 1000 / this.targetFPS;
        this.lastFrameTime = 0;

        // Visual effect caches
        this.cachedGradients = new Map(); // Cache gradients to avoid recreation
        this.cachedImageData = null; // Cache background image data
        this.backgroundNeedsUpdate = true; // Track if background needs redraw

        // Object pooling
        this.particlePool = []; // Object pool for particles
        this.animationPool = []; // Object pool for animations
        this.maxParticles = 30; // Reduced particle count for performance

        // Effect intensity controls
        this.cachedGlowIntensity = 0; // Cache glow calculations
        this.lastGlowUpdate = 0; // Track last glow update time
        this.effectQuality = 1.0; // Dynamic quality scaling (0.5-1.0)
        this.performanceMode = false; // Automatically reduce effects if needed

        // Kubernetes constraints
        this.activeConstraints = [];
        this.nodes = [];
        
        this.initializeBoard();
        this.initializeNodes();
        this.setupControls();
        this.setupUI();
        this.loadHighScores();
        this.resizeCanvas();
        
        // Track user interaction for haptic feedback
        this.userHasInteracted = false;
        this.lastMoveActionTime = 0; // Shared cooldown for all movement actions
        
        document.addEventListener('touchstart', () => {
            this.userHasInteracted = true;
        }, { once: true });
        document.addEventListener('click', () => {
            this.userHasInteracted = true;
        }, { once: true });
        
        // Add resize listener
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Add orientation change listener for mobile devices
        window.addEventListener('orientationchange', () => {
            // Delay the resize to ensure the orientation change is complete
            setTimeout(() => this.resizeCanvas(), 100);
        });
    }

    // Performance: Gradient caching system
    getCachedGradient(key, createFunction) {
        if (this.cachedGradients.has(key)) {
            return this.cachedGradients.get(key);
        }
        const gradient = createFunction();
        this.cachedGradients.set(key, gradient);
        return gradient;
    }

    clearGradientCache() {
        this.cachedGradients.clear();
    }

    // Performance: Object pooling for animations
    getPooledParticle() {
        return this.particlePool.length > 0 ? this.particlePool.pop() : {};
    }

    returnPooledParticle(particle) {
        if (this.particlePool.length < this.maxParticles) {
            // Reset particle properties
            Object.keys(particle).forEach(key => delete particle[key]);
            this.particlePool.push(particle);
        }
    }

    getPooledAnimation() {
        return this.animationPool.length > 0 ? this.animationPool.pop() : {};
    }

    returnPooledAnimation(animation) {
        if (this.animationPool.length < 20) { // Limit pool size
            // Reset animation properties
            Object.keys(animation).forEach(key => delete animation[key]);
            this.animationPool.push(animation);
        }
    }
    
    // Cache management and version checking
    checkAndClearCache() {
        const storedVersion = localStorage.getItem('kubetetris_version');
        
        // If version has changed or doesn't exist, clear relevant caches
        if (storedVersion !== this.gameVersion) {
            console.log(`KubeTetris version updated: ${storedVersion} → ${this.gameVersion}`);
            
            // Clear localStorage except for high scores
            const highScores = localStorage.getItem('kubetetris_highscores');
            localStorage.clear();
            if (highScores) {
                localStorage.setItem('kubetetris_highscores', highScores);
            }
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Try to clear browser cache programmatically
            if ('caches' in window) {
                caches.keys().then(cacheNames => {
                    cacheNames.forEach(cacheName => {
                        if (cacheName.includes('kubetetris') || cacheName.includes('game')) {
                            caches.delete(cacheName);
                        }
                    });
                });
            }
            
            // Store new version
            localStorage.setItem('kubetetris_version', this.gameVersion);
            
            console.log('Game caches cleared for new version');
        }
    }
    
    // Manual cache clearing method (can be called from console)
    forceClearCache() {
        console.log('Manually clearing all caches...');
        
        // Clear localStorage except for high scores
        const highScores = localStorage.getItem('kubetetris_highscores');
        localStorage.clear();
        if (highScores) {
            localStorage.setItem('kubetetris_highscores', highScores);
        }
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear service worker caches
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                    console.log(`Cleared cache: ${cacheName}`);
                });
            });
        }
        
        // Force page reload to ensure fresh assets
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
        
        console.log('Cache cleared! Page will reload...');
    }

    resizeCanvas() {
        // Calculate available space for the canvas
        const container = document.querySelector('.canvas-container');
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        const isLandscape = window.innerWidth > window.innerHeight;
        
        let maxWidth, maxHeight;
        
        if (isMobile) {
            if (isLandscape) {
                // Mobile landscape: Use more width, less height
                maxWidth = Math.min(window.innerWidth * 0.7, 500);
                maxHeight = Math.min(window.innerHeight * 0.6, 240);
            } else {
                // Mobile portrait: Use most of the screen width, limited height
                maxWidth = Math.min(window.innerWidth * 0.95, 400);
                maxHeight = Math.min(window.innerHeight * 0.45, 300);
            }
        } else {
            // Desktop: Use container space
            maxWidth = Math.min(containerRect.width - 40, window.innerWidth * 0.6);
            maxHeight = Math.min(containerRect.height - 40, window.innerHeight * 0.8);
        }
        
        // Calculate cell size based on available space
        const cellWidth = Math.floor(maxWidth / this.BOARD_WIDTH);
        const cellHeight = Math.floor(maxHeight / this.BOARD_HEIGHT);
        
        let minCellSize, maxCellSize;
        if (isMobile) {
            minCellSize = isLandscape ? 35 : 40;
            maxCellSize = isLandscape ? 60 : 75;
        } else {
            minCellSize = 60;
            maxCellSize = 150;
        }
        
        const newCellSize = Math.min(Math.max(Math.min(cellWidth, cellHeight), minCellSize), maxCellSize);
        
        // Update cell size if it's different
        this.CELL_SIZE = newCellSize;
        
        // Set canvas dimensions
        const canvasWidth = this.BOARD_WIDTH * this.CELL_SIZE;
        const canvasHeight = this.BOARD_HEIGHT * this.CELL_SIZE;
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        // Set CSS size to match for proper scaling
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        
        // Redraw the game
        this.draw();
        
        // Redraw the game
        if (this.bucketImageLoaded && this.assetsLoaded) {
            this.draw();
        }
    }
    
    async loadAssets() {
        // Cache busting parameter for fresh assets
        const cacheBuster = `?v=${this.gameVersion}&t=${Date.now()}`;
        
        // Load pod images
        const podTypes = this.getPodTypes();
        for (const [key, pod] of Object.entries(podTypes)) {
            if (pod.image) {
                const img = new Image();
                img.src = pod.image + cacheBuster;
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if image fails to load
                });
                this.images[`pod_${key}`] = img;
            }
        }
        
        // Load resource images
        const resourceTypes = this.getResourceTypes();
        for (const [key, resource] of Object.entries(resourceTypes)) {
            if (resource.image) {
                const img = new Image();
                img.src = resource.image + cacheBuster;
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve; // Continue even if image fails to load
                });
                this.images[`resource_${key}`] = img;
            }
        }
        
        this.assetsLoaded = true;
        this.resizeCanvas();
        this.draw();
    }
    
    initializeBoard() {
        // Initialize empty board
        this.board = Array(this.BOARD_HEIGHT).fill(null).map(() => 
            Array(this.BOARD_WIDTH).fill(null)
        );
        
        // Create node foundation (bottom row)
        for (let x = 0; x < this.BOARD_WIDTH; x++) {
            const nodeResources = this.generateRandomNodeCapacity();
            this.board[this.BOARD_HEIGHT - 1][x] = {
                type: 'node',
                nodeId: x,
                resources: nodeResources,
                specialization: this.getNodeSpecialization(x),
                pods: [],
                filled: false
            };
        }
    }
    
    // Generate random node capacity within specified ranges
    generateRandomNodeCapacity() {
        const capacityRanges = {
            cpu: [4, 8, 16, 32, 48, 64],          // 4 to 64 cores
            ram: [32, 64, 96, 128, 128],           // 16GB to 128GB
            ssd: [128, 256, 512, 1024, 2048],     // 128GB to 2TB (in GB)
            gpu: [0, 4, 8, 16, 24, 32, 48]  // 0 to 48GB GPU (more chance for 0)
        };
        
        const generated = {
            totalCpu: capacityRanges.cpu[Math.floor(Math.random() * capacityRanges.cpu.length)],
            totalRam: capacityRanges.ram[Math.floor(Math.random() * capacityRanges.ram.length)],
            totalSsd: capacityRanges.ssd[Math.floor(Math.random() * capacityRanges.ssd.length)],
            totalGpu: capacityRanges.gpu[Math.floor(Math.random() * capacityRanges.gpu.length)],
            usedCpu: 0,
            usedRam: 0,
            usedSsd: 0,
            usedGpu: 0
        };
        
        return generated;
    }

    initializeNodes() {
        this.nodes = [];
        for (let i = 0; i < this.BOARD_WIDTH; i++) {
            // Use the same resources that were already generated for the board
            const boardNodeResources = this.board[this.BOARD_HEIGHT - 1][i].resources;
            const nodeData = {
                id: i,
                name: `node-${i}`,
                resources: { ...boardNodeResources }, // Copy from board
                specialization: this.getNodeSpecialization(i),
                pods: []
            };
            this.nodes.push(nodeData);
            
            // Sync specialization back to board
            if (this.board[this.BOARD_HEIGHT - 1][i]) {
                this.board[this.BOARD_HEIGHT - 1][i].specialization = nodeData.specialization;
            }
        }
    }
    
    getNodeSpecialization(nodeId) {
        const specializations = ['GPU', 'SSD', 'RAM', 'CPU', 'NET', 'STOR', 'COMP', 'EDGE'];
        return specializations[nodeId % specializations.length];
    }
    
    generateClusterConstraints() {
        const constraints = [];
        if (Math.random() < 0.4) {
            constraints.push({
                type: 'anti-affinity',
                target: 'database',
                description: 'Database pods prefer separate nodes'
            });
        }
        if (Math.random() < 0.3) {
            constraints.push({
                type: 'resource-limit',
                cpu: 8,
                ram: 16,
                description: 'Resource quota enforcement'
            });
        }
        return constraints;
    }
    
    // Pod types with Kubernetes characteristics
    getPodTypes() {
        return {
            frontend: {
                symbol: 'F',
                color: '#e74c3c',
                resourceRanges: { 
                    cpu: [0.5, 1], 
                    ram: [1, 1, 2, 4], 
                    ssd: [2, 2, 4, 4, 5, 10], 
                    gpu: [0] 
                },
                dependencies: ['backend'],
                preferredNode: 'EDGE', // Prefers edge nodes for low latency
                image: './assets/pod-frontend.svg'
            },
            backend: {
                symbol: 'B', 
                color: '#3498db',
                resourceRanges: { 
                    cpu: [1, 2, 4], 
                    ram: [1, 1, 2, 2, 4, 8, 12], 
                    ssd: [10, 20, 30], 
                    gpu: [0, 1] 
                },
                dependencies: ['database', 'cache'],
                preferredNode: 'CPU', // Prefers CPU-optimized nodes
                image: './assets/pod-backend.svg'
            },
            database: {
                symbol: 'D',
                color: '#27ae60',
                resourceRanges: { 
                    cpu: [2, 4, 6], 
                    ram: [8, 16, 24], 
                    ssd: [20, 40, 60], 
                    gpu: [0] 
                },
                dependencies: [],
                preferredNode: 'SSD', // Prefers SSD storage nodes
                image: './assets/pod-db.svg'
            },
            cache: {
                symbol: 'C',
                color: '#f39c12',
                resourceRanges: { 
                    cpu: [0.5, 1, 2], 
                    ram: [8, 16, 16, 32, 32], 
                    ssd: [20, 50, 100], 
                    gpu: [0] 
                },
                dependencies: [],
                preferredNode: 'RAM', // Prefers memory-optimized nodes
                image: './assets/pod-cache.svg'
            },
            monitor: {
                symbol: 'M',
                color: '#9b59b6',
                resourceRanges: { 
                    cpu: [0.5, 1], 
                    ram: [1, 2, 4], 
                    ssd: [5, 10], 
                    gpu: [0] 
                },
                dependencies: [],
                preferredNode: 'NET', // Prefers network-optimized nodes
                image: './assets/pod-monitor.svg'
            },
            mltask: {
                symbol: 'ML',
                color: '#ff6b6b',
                resourceRanges: { 
                    cpu: [1, 1, 1, 2, 4, 8], 
                    ram: [8, 16, 32], 
                    ssd: [20, 40, 80], 
                    gpu: [1, 2, 4, 4, 8, 8, 8, 16, 16, 16] 
                },
                dependencies: [],
                preferredNode: 'GPU', // Prefers GPU nodes for ML tasks
                image: './assets/pod-mltask.svg'
            }
        };
    }

    // Resource types that increase bucket capacity
    getResourceTypes() {
        return {
            ram: {
                symbol: 'R',
                color: '#4ecdc4',
                capacityRanges: { ram: [2, 4, 8] },
                description: 'RAM Upgrade',
                image: './assets/resource-ram.svg'
            },
            cpu: {
                symbol: 'CP',
                color: '#45b7d1',
                capacityRanges: { cpu: [2, 4, 8] },
                description: 'CPU Upgrade',
                image: './assets/resource-cpu.svg'
            },
            ssd: {
                symbol: 'S',
                color: '#34495e',
                capacityRanges: { ssd: [20, 40, 80] },
                description: 'SSD Storage',
                image: './assets/resource-ssd.svg'
            },
            gpu: {
                symbol: 'G',
                color: '#feca57',
                capacityRanges: { gpu: [1, 2, 4] },
                description: 'GPU Unit',
                image: './assets/resource-gpu.svg'
            }
        };
    }
    
    // Helper method to randomly select from an array or return single value
    getRandomResourceValue(resourceRanges, resourceType) {
        const range = resourceRanges[resourceType];
        if (!range || range.length === 0) return 0;
        if (range.length === 1) return range[0];
        
        // Randomly select from the available options
        const randomIndex = Math.floor(Math.random() * range.length);
        return range[randomIndex];
    }
    
    createRandomDrop() {
        // 83% chance of pod, 17% chance of resource (approximately 5:1 ratio)
        const isPod = Math.random() < 0.83;
        
        if (isPod) {
            return this.createRandomPod();
        } else {
            return this.createRandomResource();
        }
    }
    
    createRandomPod() {
        const types = Object.keys(this.getPodTypes());
        const type = types[Math.floor(Math.random() * types.length)];
        const podType = this.getPodTypes()[type];
        
        // Generate random resources based on the defined ranges
        const resources = {
            cpu: this.getRandomResourceValue(podType.resourceRanges, 'cpu'),
            ram: this.getRandomResourceValue(podType.resourceRanges, 'ram'),
            ssd: this.getRandomResourceValue(podType.resourceRanges, 'ssd'),
            gpu: this.getRandomResourceValue(podType.resourceRanges, 'gpu')
        };
        
        // Single pod only (no tetromino shapes)
        return {
            type: type,
            dropType: 'pod',
            symbol: podType.symbol,
            color: podType.color,
            resources: resources,
            dependencies: [...podType.dependencies], // Copy dependencies
            preferredNode: podType.preferredNode,
            shape: [[1]], // Always single cell
            x: Math.floor(this.BOARD_WIDTH / 2),
            y: 0,
            id: Math.random().toString(36).substr(2, 9)
        };
    }
    
    createRandomResource() {
        const types = Object.keys(this.getResourceTypes());
        const type = types[Math.floor(Math.random() * types.length)];
        const resourceType = this.getResourceTypes()[type];
        
        // Generate random capacity based on the defined ranges
        const capacity = {};
        for (const [resourceKey, range] of Object.entries(resourceType.capacityRanges)) {
            capacity[resourceKey] = this.getRandomResourceValue(resourceType.capacityRanges, resourceKey);
        }
        
        return {
            type: type,
            dropType: 'resource',
            symbol: resourceType.symbol,
            color: resourceType.color,
            capacity: capacity,
            description: resourceType.description,
            shape: [[1]], // Always single cell
            x: Math.floor(this.BOARD_WIDTH / 2),
            y: 0,
            id: Math.random().toString(36).substr(2, 9)
        };
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    if (!this.gameRunning) {
                        this.startGame();
                    }
                    break;
                case 'ArrowLeft':
                    if (this.gameRunning) {
                        e.preventDefault();
                        this.movePod(-1, 0);
                    }
                    break;
                case 'ArrowRight':
                    if (this.gameRunning) {
                        e.preventDefault();
                        this.movePod(1, 0);
                    }
                    break;
                case 'ArrowDown':
                    if (this.gameRunning) {
                        e.preventDefault();
                        this.dropPodInstantly();
                    }
                    break;
                case 'KeyR':
                    e.preventDefault();
                    this.resetGame();
                    break;
            }
        });
        
        // Mobile touch controls
        this.setupMobileControls();
        
        document.getElementById('play-again-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('save-score-btn').addEventListener('click', () => this.saveHighScore());
    }
    
    setupMobileControls() {
        // Mobile control buttons
        const moveLeftBtn = document.getElementById('move-left-btn');
        const moveRightBtn = document.getElementById('move-right-btn');
        const startDropBtn = document.getElementById('start-drop-btn');
        const instantDropBtn = document.getElementById('instant-drop-btn');
        const resetBtn = document.getElementById('reset-btn');
        
        // Debug: Check if elements exist
        console.log('Mobile buttons found:', {
            moveLeftBtn: !!moveLeftBtn,
            moveRightBtn: !!moveRightBtn,
            startDropBtn: !!startDropBtn,
            instantDropBtn: !!instantDropBtn,
            resetBtn: !!resetBtn
        });
        
        // Mobile haptic feedback helper
        const hapticFeedback = (intensity = 'medium') => {
            // Only attempt vibration on mobile devices, after user interaction, and if vibration is supported
            if (this.userHasInteracted && navigator.vibrate && 'ontouchstart' in window) {
                try {
                    switch(intensity) {
                        case 'light':
                            navigator.vibrate(10);
                            break;
                        case 'medium':
                            navigator.vibrate(25);
                            break;
                        case 'heavy':
                            navigator.vibrate(50);
                            break;
                    }
                } catch (error) {
                    // Silently ignore vibration errors
                    console.debug('Vibration not available:', error.message);
                }
            }
        };
        
        // Prevent default touch behaviors
        const preventDefaultTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        // Enhanced button interaction with feedback
        const setupButton = (button, action, feedbackIntensity = 'medium') => {
            if (!button) {
                console.warn('Button not found for setup');
                return;
            }
            
            console.log('Setting up button:', button.id);
            
            let isPressed = false;
            let lastActionTime = 0;
            const actionCooldown = 100; // 100ms cooldown between actions
            
            const executeAction = () => {
                const now = Date.now();
                // Use shared cooldown for movement actions
                if (button.id.includes('move') && now - this.lastMoveActionTime < 100) {
                    console.log('Button action blocked - shared cooldown active');
                    return;
                }
                action();
            };
            
            // Primary interaction - use touchstart/touchend for mobile, click for desktop
            if ('ontouchstart' in window) {
                // Mobile/touch device
                button.addEventListener('touchstart', (e) => {
                    console.log('Touch start on', button.id);
                    e.preventDefault();
                    e.stopPropagation();
                    isPressed = true;
                    button.classList.add('active');
                    hapticFeedback(feedbackIntensity);
                }, { passive: false });
                
                button.addEventListener('touchend', (e) => {
                    console.log('Touch end on', button.id);
                    e.preventDefault();
                    e.stopPropagation();
                    if (isPressed) {
                        button.classList.remove('active');
                        executeAction();
                        isPressed = false;
                    }
                }, { passive: false });
                
                button.addEventListener('touchcancel', (e) => {
                    e.preventDefault();
                    button.classList.remove('active');
                    isPressed = false;
                }, { passive: false });
                
                // Prevent click events on touch devices
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, { passive: false });
                
            } else {
                // Desktop - use mouse events
                button.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    isPressed = true;
                    button.classList.add('active');
                });
                
                button.addEventListener('mouseup', (e) => {
                    e.preventDefault();
                    if (isPressed) {
                        button.classList.remove('active');
                        executeAction();
                        isPressed = false;
                    }
                });
                
                button.addEventListener('mouseleave', (e) => {
                    button.classList.remove('active');
                    isPressed = false;
                });
                
                // Click as backup for desktop
                button.addEventListener('click', (e) => {
                    console.log('Click on', button.id);
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isPressed) {
                        executeAction();
                    }
                });
            }
        };
        
        // Setup each button with appropriate actions
        setupButton(moveLeftBtn, () => {
            console.log('Move left action triggered');
            if (this.gameRunning) {
                this.movePod(-1, 0);
            }
        }, 'light');
        
        setupButton(moveRightBtn, () => {
            console.log('Move right action triggered');
            if (this.gameRunning) {
                this.movePod(1, 0);
            }
        }, 'light');
        
        setupButton(startDropBtn, () => {
            console.log('Start/drop action triggered, gameRunning:', this.gameRunning);
            if (!this.gameRunning) {
                this.startGame();
                hapticFeedback('heavy'); // Extra feedback for game start
            } else {
                this.dropPodInstantly();
            }
        }, 'medium');
        
        setupButton(instantDropBtn, () => {
            console.log('Instant drop action triggered');
            if (this.gameRunning) {
                this.dropPodInstantly();
            }
        }, 'medium');
        
        setupButton(resetBtn, () => {
            console.log('Reset action triggered');
            this.resetGame();
            hapticFeedback('heavy'); // Strong feedback for reset
        }, 'heavy');
        
        // Touch gesture support for canvas
        this.setupCanvasTouchControls();
    }
    
    setupCanvasTouchControls() {
        let touchStartX = null;
        let touchStartY = null;
        let touchStartTime = null;
        const touchThreshold = 30; // Minimum distance for a swipe
        const tapTimeThreshold = 200; // Maximum time for a tap (milliseconds)
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            if (touchStartX === null || touchStartY === null || touchStartTime === null) {
                return;
            }
            
            const touch = e.changedTouches[0];
            const touchEndX = touch.clientX;
            const touchEndY = touch.clientY;
            const touchEndTime = Date.now();
            
            // Check cooldown to prevent conflicts with button presses
            if (touchEndTime - this.lastMoveActionTime < 100) {
                console.log('Canvas swipe blocked - shared cooldown active');
                touchStartX = null;
                touchStartY = null;
                touchStartTime = null;
                return;
            }
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const touchDuration = touchEndTime - touchStartTime;
            
            // Haptic feedback for gestures
            const hapticFeedback = (intensity = 'light') => {
                if (this.userHasInteracted && navigator.vibrate && 'ontouchstart' in window) {
                    try {
                        switch(intensity) {
                            case 'light': navigator.vibrate(10); break;
                            case 'medium': navigator.vibrate(25); break;
                            case 'heavy': navigator.vibrate(50); break;
                        }
                    } catch (error) {
                        console.debug('Vibration not available:', error.message);
                    }
                }
            };
            
            // Check if it's a tap (quick touch with minimal movement)
            if (touchDuration < tapTimeThreshold && Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
                if (!this.gameRunning) {
                    this.startGame();
                    hapticFeedback('heavy');
                } else {
                    // Tap during game - could be a quick action
                    hapticFeedback('light');
                }
                return;
            }
            
            // Determine gesture type based on larger movement
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > touchThreshold) {
                    if (deltaX > 0) {
                        // Swipe right
                        if (this.gameRunning) {
                            console.log('Canvas swipe right detected');
                            this.movePod(1, 0);
                            hapticFeedback('light');
                        }
                    } else {
                        // Swipe left
                        if (this.gameRunning) {
                            console.log('Canvas swipe left detected');
                            this.movePod(-1, 0);
                            hapticFeedback('light');
                        }
                    }
                }
            } else {
                // Vertical swipe
                if (Math.abs(deltaY) > touchThreshold) {
                    if (deltaY > 0) {
                        // Swipe down - instant drop
                        if (this.gameRunning) {
                            console.log('Canvas swipe down detected');
                            this.dropPodInstantly();
                            hapticFeedback('medium');
                        }
                    } else {
                        // Swipe up - could be used for future features
                        hapticFeedback('light');
                    }
                }
            }
            
            // Reset touch coordinates
            touchStartX = null;
            touchStartY = null;
            touchStartTime = null;
        }, { passive: false });
    }
    
    setupUI() {
        this.updateDisplay();
        this.updateConstraints();
    }
    
    startGame() {
        this.gameRunning = true;
        this.currentPod = this.createRandomDrop();
        this.nextPod = this.createRandomDrop();
        
        // Hide overlay
        document.getElementById('game-overlay').style.display = 'none';
        
        this.updateNextPodDisplay();
        this.gameLoop(0);
    }
    
    resetGame() {
        this.gameRunning = false;
        this.score = 0;
        this.level = 1;
        this.currentPod = null;
        this.nextPod = null;
        
        this.initializeBoard();
        this.initializeNodes();
        
        // Show overlay
        document.getElementById('game-overlay').style.display = 'flex';
        
        this.updateDisplay();
        this.draw();
    }
    
    startNewGame() {
        document.getElementById('game-over-modal').classList.add('hidden');
        this.resetGame();
        this.startGame();
    }
    
    gameLoop(currentTime) {
        if (!this.gameRunning) {
            // Still request next frame to resume properly
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }

        const deltaTime = currentTime - this.lastTime;

        // Frame rate control and skipping for performance
        if (deltaTime < this.frameTime && !this.forceRedraw) {
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }

        this.lastTime = currentTime;
        this.dropCounter += deltaTime;

        // Set constant drop time (no speed increase)
        const dropTime = 1000; // Always 1 second

        // Performance optimization: Throttle animations and effects
        this.animationFrameThrottle++;
        const shouldUpdateAnimations = this.animationFrameThrottle % (this.performanceMode ? 3 : 2) === 0;
        const shouldUpdateEffects = this.animationFrameThrottle % 4 === 0;

        // Track if we need to redraw this frame
        let needsRedraw = this.isDirty || this.forceRedraw;

        // Handle instant drop animation
        if (this.isInstantDropping) {
            this.animationOffset += this.instantDropSpeed;
            const currentY = this.dropStartY + this.animationOffset;
            needsRedraw = true; // Always redraw during instant drop

            if (currentY >= this.targetDropY) {
                // Animation complete, trigger bucket collision animation
                this.checkBucketCollisionAndAnimate(this.currentPod.x, this.targetDropY);

                // Place the pod
                this.currentPod.y = this.targetDropY;
                this.placePod();
                this.isInstantDropping = false;
                this.animationOffset = 0;
                this.isDirty = true;
            }
        } else {
            // Normal smooth animation interpolation
            const newAnimationOffset = Math.min(this.dropCounter / dropTime, 1.0);

            // Only mark dirty if animation actually changed
            if (Math.abs(newAnimationOffset - this.animationOffset) > 0.01) {
                this.animationOffset = newAnimationOffset;
                needsRedraw = true;
            }

            if (this.dropCounter > dropTime) {
                this.movePod(0, 1);
                this.dropCounter = 0;
                this.animationOffset = 0;
                this.isDirty = true;
                needsRedraw = true;
            }
        }

        // Update animations only when needed
        if (shouldUpdateAnimations) {
            this.updateLandingAnimations();
            
            // Check if animations are still running
            const hasActiveAnimations = this.landingAnimations.length > 0 || 
                                        this.landingEffects.length > 0 || 
                                        this.bucketShakeAnimations.length > 0;
            if (hasActiveAnimations) {
                needsRedraw = true;
            }
        }

        // Only draw if something changed
        if (needsRedraw) {
            this.draw();
            this.isDirty = false;
            this.forceRedraw = false;
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    movePod(dx, dy) {
        if (!this.currentPod) return false;
        
        // Add cooldown for horizontal movements to prevent double execution
        const now = Date.now();
        if (dx !== 0 && now - this.lastMoveActionTime < 100) {
            console.log(`Movement blocked - cooldown active (${now - this.lastMoveActionTime}ms ago)`);
            return false;
        }
        
        console.log(`movePod called with dx=${dx}, dy=${dy}, current pos: x=${this.currentPod.x}, y=${this.currentPod.y}`);
        
        const newX = this.currentPod.x + dx;
        const newY = this.currentPod.y + dy;
        
        if (this.isValidPosition(this.currentPod.shape, newX, newY)) {
            this.currentPod.x = newX;
            this.currentPod.y = newY;
            this.isDirty = true; // Mark for redraw

            // Update cooldown timer for horizontal movements
            if (dx !== 0) {
                this.lastMoveActionTime = now;
            }
            
            console.log(`Pod moved to new position: x=${newX}, y=${newY}`);
            return true;
        } else if (dy > 0) {
            // Check if pod is about to hit a bucket (node) and trigger animation
            this.checkBucketCollisionAndAnimate(newX, newY);

            // Pod can't move down, place it
            this.placePod();
            this.isDirty = true; // Mark for redraw
            return false;
        }
        console.log(`Movement blocked - invalid position: x=${newX}, y=${newY}`);
        return false;
    }
    
    dropPodInstantly() {
        if (!this.currentPod) return;
        
        // Find the target Y position where the pod will land
        this.targetDropY = this.currentPod.y;
        while (this.isValidPosition(this.currentPod.shape, this.currentPod.x, this.targetDropY + 1)) {
            this.targetDropY++;
        }
        
        // Start smooth drop animation
        this.isInstantDropping = true;
        this.dropStartY = this.currentPod.y;
    }
    
    checkBucketCollisionAndAnimate(x, y) {
        // Check if the pod is hitting a bucket (node)
        if (y >= 0 && y < this.BOARD_HEIGHT && x >= 0 && x < this.BOARD_WIDTH) {
            const cell = this.board[y][x];
            if (cell && cell.type === 'node') {
                // Pod is hitting a bucket! Trigger animation
                this.triggerLandingAnimation(x, y);
                console.log(`Pod hitting bucket at (${x}, ${y})`);
            }
        }
        
        // Also check if hitting another pod that's on top of a bucket
        for (let checkY = y; checkY < this.BOARD_HEIGHT; checkY++) {
            if (checkY >= 0 && checkY < this.BOARD_HEIGHT && x >= 0 && x < this.BOARD_WIDTH) {
                const cell = this.board[checkY][x];
                if (cell && cell.type === 'node') {
                    // Found the bucket underneath
                    this.triggerLandingAnimation(x, checkY);
                    console.log(`Pod landing above bucket at (${x}, ${checkY})`);
                    break;
                }
            }
        }
    }
    
    rotatePod() {
        if (!this.currentPod) return;
        
        const rotated = this.rotateMatrix(this.currentPod.shape);
        if (this.isValidPosition(rotated, this.currentPod.x, this.currentPod.y)) {
            this.currentPod.shape = rotated;
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotated[j][rows - 1 - i] = matrix[i][j];
            }
        }
        return rotated;
    }
    
    isValidPosition(shape, x, y) {
        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px]) {
                    const newX = x + px;
                    const newY = y + py;
                    
                    if (newX < 0 || newX >= this.BOARD_WIDTH || 
                        newY >= this.BOARD_HEIGHT ||
                        (newY >= 0 && this.board[newY][newX] && this.board[newY][newX].filled)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    placePod() {
        if (!this.currentPod) return;

        const x = this.currentPod.x;
        const y = this.currentPod.y;
        
        // Find the lowest available position in this column
        let targetY = y;
        for (let checkY = y; checkY < this.BOARD_HEIGHT; checkY++) {
            if (this.board[checkY][x] && this.board[checkY][x].type === 'node') {
                // Reached a node, place drop here
                targetY = checkY;
                break;
            } else if (this.board[checkY][x] && this.board[checkY][x].filled) {
                // Hit another drop, place above it
                targetY = checkY - 1;
                break;
            }
            targetY = checkY;
        }
        
        // Place drop on board
        if (targetY >= 0 && targetY < this.BOARD_HEIGHT) {
            if (this.board[targetY][x] && this.board[targetY][x].type === 'node') {
                // Placing on a node
                const node = this.board[targetY][x];
                
                if (this.currentPod.dropType === 'resource') {
                    // Resource increases bucket capacity
                    this.applyResourceUpgrade(node, this.currentPod);
                    
                    // Trigger bucket shake animation
                    this.triggerBucketShake(x, targetY);
                } else if (this.currentPod.dropType === 'pod') {
                    // Pod placement logic
                    if (this.canPlacePodOnNode(this.currentPod, node)) {
                        node.pods.push({ ...this.currentPod });
                        node.resources.usedCpu += this.currentPod.resources.cpu;
                        node.resources.usedRam += this.currentPod.resources.ram;
                        node.resources.usedSsd += this.currentPod.resources.ssd;
                        node.resources.usedGpu += this.currentPod.resources.gpu;
                        node.filled = true;
                        
                        // Update the visual representation
                        this.board[targetY][x] = { ...node };
                        
                        // Trigger bucket shake animation
                        this.triggerBucketShake(x, targetY);
                    } else {
                        // Can't place pod here due to resource constraints - Game Over!
                        this.gameOver(`Node ${x} ran out of resources! No space for the new ${this.currentPod.type} pod.`);
                        return;
                    }
                }
            } else {
                // Placing on empty space above nodes
                this.board[targetY][x] = {
                    type: this.currentPod.dropType,
                    pod: this.currentPod.dropType === 'pod' ? { ...this.currentPod } : null,
                    resource: this.currentPod.dropType === 'resource' ? { ...this.currentPod } : null,
                    filled: true
                };
            }
        }
        
        // Calculate score based on placement
        this.calculatePlacementScore();
        
        // Check for completed lines
        this.checkCompletedLines();
        
        // Spawn next drop
        this.currentPod = this.nextPod;
        this.nextPod = this.createRandomDrop();
        this.updateNextPodDisplay();
        
        // Reset drop properties
        this.dropCounter = 0;
        this.animationOffset = 0;
        
        // Check game over
        if (!this.isValidPosition(this.currentPod.shape, this.currentPod.x, this.currentPod.y)) {
            this.gameOver("Board is full! No space for new drops.");
        }
        
        this.updateDisplay();
        this.updateConstraints();
    }
    
    applyResourceUpgrade(node, resource) {
        // Apply capacity increases from resource
        if (resource.capacity.cpu) {
            node.resources.totalCpu += resource.capacity.cpu;
        }
        if (resource.capacity.ssd) {
            node.resources.totalSsd += resource.capacity.ssd;
        }
        if (resource.capacity.ram) {
            node.resources.totalRam += resource.capacity.ram;
        }
        if (resource.capacity.gpu) {
            node.resources.totalGpu += resource.capacity.gpu;
        }
        
        // Update the corresponding node in the nodes array
        if (this.nodes[node.nodeId]) {
            this.nodes[node.nodeId].resources = { ...node.resources };
        }
        
        console.log(`Applied ${resource.description} (+${JSON.stringify(resource.capacity)}) to Node ${node.nodeId}`);
    }
    
    triggerLandingAnimation(x, y) {
        // Create landing effect
        const cellX = x * this.CELL_SIZE;
        const cellY = y * this.CELL_SIZE;
        
        console.log('Triggering landing animation at:', x, y, 'cellX:', cellX, 'cellY:', cellY); // Debug
        
        // Check if this is a perfect match for bonus effects
        let isPerfectMatch = false;
        const node = this.board[y] && this.board[y][x];
        if (node && node.type === 'node' && this.currentPod) {
            const podPreferredNodes = this.currentPod.preferredNodes || [];
            isPerfectMatch = podPreferredNodes.includes(node.specialization);
        }
        
        // Add bounce animation for the pod
        this.landingAnimations.push({
            x: cellX,
            y: cellY,
            scale: isPerfectMatch ? 2.0 : 1.6, // Increased scale
            scaleDecay: 0.92, // Slower decay
            alpha: 1.0,
            alphaDecay: 0.95, // Slower fade
            duration: isPerfectMatch ? 50 : 40, // Longer duration
            currentFrame: 0,
            isPerfectMatch: isPerfectMatch
        });
        
        // Add particle effects (more for perfect matches)
        const particleCount = isPerfectMatch ? 15 : 10; // More particles
        for (let i = 0; i < particleCount; i++) {
            this.landingEffects.push({
                x: cellX + this.CELL_SIZE / 2,
                y: cellY + this.CELL_SIZE / 2,
                vx: (Math.random() - 0.5) * (isPerfectMatch ? 10 : 8), // Faster particles
                vy: (Math.random() - 0.5) * (isPerfectMatch ? 10 : 8) - 3, // Higher velocity
                life: isPerfectMatch ? 50 : 40, // Longer life
                maxLife: isPerfectMatch ? 50 : 40,
                color: isPerfectMatch ? 
                    `hsl(${60 + Math.random() * 60}, 100%, ${70 + Math.random() * 20}%)` : 
                    `hsl(${180 + Math.random() * 60}, 100%, ${50 + Math.random() * 30}%)`,
                size: isPerfectMatch ? 3 + Math.random() * 4 : 2 + Math.random() * 3
            });
        }
    }
    
    triggerBucketShake(x, y) {
        // Add bucket shake animation
        this.bucketShakeAnimations.push({
            x: x,
            y: y,
            shakeIntensity: 3,
            shakeDecay: 0.9,
            duration: 20,
            currentFrame: 0
        });
    }
    
    updateLandingAnimations() {
        // Update landing animations with swap-and-pop optimization
        for (let i = this.landingAnimations.length - 1; i >= 0; i--) {
            const anim = this.landingAnimations[i];
            anim.currentFrame++;
            anim.scale *= anim.scaleDecay;
            anim.alpha *= anim.alphaDecay;
            
            if (anim.currentFrame >= anim.duration || anim.alpha <= 0.1) {
                // Return to pool before removing
                this.returnPooledAnimation(anim);
                // Swap with last element and pop for O(1) removal
                this.landingAnimations[i] = this.landingAnimations[this.landingAnimations.length - 1];
                this.landingAnimations.pop();
            }
        }
        
        // Update particle effects with swap-and-pop optimization
        for (let i = this.landingEffects.length - 1; i >= 0; i--) {
            const particle = this.landingEffects[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3; // gravity
            particle.life--;
            
            if (particle.life <= 0) {
                // Return to pool before removing
                this.returnPooledParticle(particle);
                // Swap with last element and pop for O(1) removal
                this.landingEffects[i] = this.landingEffects[this.landingEffects.length - 1];
                this.landingEffects.pop();
            }
        }
        
        // Update bucket shake animations with swap-and-pop optimization
        for (let i = this.bucketShakeAnimations.length - 1; i >= 0; i--) {
            const shake = this.bucketShakeAnimations[i];
            shake.currentFrame++;
            shake.shakeIntensity *= shake.shakeDecay;
            
            if (shake.currentFrame >= shake.duration || shake.shakeIntensity <= 0.1) {
                // Return to pool before removing
                this.returnPooledAnimation(shake);
                // Swap with last element and pop for O(1) removal
                this.bucketShakeAnimations[i] = this.bucketShakeAnimations[this.bucketShakeAnimations.length - 1];
                this.bucketShakeAnimations.pop();
            }
        }
    }
    
    drawLandingAnimations() {
        // Draw landing bounce effects
        this.landingAnimations.forEach(anim => {
            this.ctx.save();
            this.ctx.globalAlpha = anim.alpha;
            this.ctx.translate(anim.x + this.CELL_SIZE / 2, anim.y + this.CELL_SIZE / 2);
            this.ctx.scale(anim.scale, anim.scale);
            
            // Draw glowing circle effect (different colors for perfect matches)
            const gradientKey = anim.isPerfectMatch ? 'landing-perfect' : 'landing-normal';
            const gradient = this.getCachedGradient(gradientKey, () => {
                const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.CELL_SIZE / 2);
                if (anim.isPerfectMatch) {
                    grad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
                    grad.addColorStop(0.5, 'rgba(255, 165, 0, 0.5)');
                    grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
                } else {
                    grad.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
                    grad.addColorStop(0.5, 'rgba(0, 200, 255, 0.4)');
                    grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
                }
                return grad;
            });
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.CELL_SIZE / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
        
        // Draw particle effects
        this.landingEffects.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = particle.color;
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    canPlacePodOnNode(pod, node) {
        // Only apply to pod drops, not resource drops
        if (pod.dropType !== 'pod') {
            return true;
        }
        
        // Check resource constraints
        if (node.resources.usedCpu + pod.resources.cpu > node.resources.totalCpu) {
            return false;
        }
        if (node.resources.usedRam + pod.resources.ram > node.resources.totalRam) {
            return false;
        }
        if (node.resources.usedSsd + pod.resources.ssd > node.resources.totalSsd) {
            return false;
        }
        if (node.resources.usedGpu + pod.resources.gpu > node.resources.totalGpu) {
            return false;
        }
        
        return true;
    }
    
    calculatePlacementScore() {
        let points = 100; // Base points
        
        // Bonus for optimal placement
        const placementBonus = this.calculatePlacementBonus();
        points += placementBonus;
        
        // Level multiplier
        points *= this.level;
        
        this.score += points;
        
        // Level up every 1000 points
        const newLevel = Math.floor(this.score / 1000) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
        }
    }
    
    calculatePlacementBonus() {
        let bonus = 0;
        
        // Bonus for matching preferred node specialization
        if (this.currentPod && this.currentPod.x >= 0 && this.currentPod.x < this.nodes.length) {
            const targetNode = this.nodes[this.currentPod.x];
            if (targetNode.specialization === this.currentPod.preferredNode) {
                bonus += 200; // Big bonus for optimal placement
            }
        }
        
        // Check for proper resource utilization
        const nodeUtilization = this.nodes.map(node => {
            const totalResources = node.resources.totalCpu + node.resources.totalRam;
            const usedResources = node.resources.usedCpu + node.resources.usedRam;
            return usedResources / totalResources;
        });
        
        // Bonus for balanced distribution
        const avgUtilization = nodeUtilization.reduce((a, b) => a + b, 0) / nodeUtilization.length;
        const maxUtilization = Math.max(...nodeUtilization);
        
        if (maxUtilization < 0.9) { // Not overloaded
            bonus += 150;
        }
        
        if (avgUtilization > 0.3 && maxUtilization - Math.min(...nodeUtilization) < 0.3) {
            bonus += 200; // Good balance
        }
        
        // Bonus for constraint adherence
        const constraintsMet = this.checkConstraintCompliance();
        bonus += constraintsMet * 100;
        
        return bonus;
    }
    
    getClusterPodDistribution() {
        return this.nodes.map(node => ({
            id: node.id,
            pods: node.pods
        }));
    }
    
    checkDependencies() {
        // Check if dependencies are satisfied in nearby nodes
        let dependenciesMet = 0;
        
        if (this.currentPod.dependencies.length === 0) {
            return 1; // No dependencies to check
        }
        
        // Check all nodes for dependencies
        this.currentPod.dependencies.forEach(dep => {
            const hasDependency = this.nodes.some(node => 
                node.pods.some(pod => pod.type === dep)
            );
            if (hasDependency) {
                dependenciesMet++;
            }
        });
        
        return dependenciesMet / this.currentPod.dependencies.length;
    }
    
    getNearbyPods() {
        const nearby = [];
        const range = 2;
        
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const x = this.currentPod.x + dx;
                const y = this.currentPod.y + dy;
                
                if (x >= 0 && x < this.BOARD_WIDTH && y >= 0 && y < this.BOARD_HEIGHT) {
                    const cell = this.board[y][x];
                    if (cell && cell.filled && cell.pod) {
                        nearby.push(cell.pod);
                    }
                }
            }
        }
        
        return nearby;
    }
    
    checkConstraintCompliance() {
        // Simplified constraint checking
        let compliance = 0;
        
        this.activeConstraints.forEach(constraint => {
            if (this.evaluateConstraint(constraint)) {
                compliance++;
            }
        });
        
        return compliance;
    }
    
    evaluateConstraint(constraint) {
        // Simplified constraint evaluation (no more taint/toleration blocking)
        switch (constraint.type) {
            case 'resource-limit':
                return this.currentPod.resources.cpu <= constraint.cpu &&
                       this.currentPod.resources.ram <= constraint.ram;
            case 'anti-affinity':
                return this.currentPod.type !== constraint.target ||
                       this.hasAntiAffinityCompliance();
            case 'node-selector':
                // No more blocking based on node selection, always return true
                return true;
            default:
                return true;
        }
    }
    
    hasAntiAffinityCompliance() {
        // Check if pod type distribution is good across nodes
        const currentNodeId = this.currentPod.x;
        const targetNode = this.nodes[currentNodeId];
        
        if (!targetNode) return true;
        
        const sameTypePods = targetNode.pods.filter(pod => 
            pod.type === this.currentPod.type
        ).length;
        
        return sameTypePods <= 2; // Allow up to 2 pods of same type per node
    }
    
    checkCompletedLines() {
        // Check for completed rows
        this.clearCompletedLines();
        // Check for overloaded nodes that need clearing
        this.checkNodeOptimization();
    }
    
    clearCompletedLines() {
        for (let y = this.BOARD_HEIGHT - 2; y >= 0; y--) { // Don't clear node row
            if (this.isLineFull(y)) {
                this.clearLine(y);
                this.score += 400 * this.level;
                y++; // Check the same line again
            }
        }
    }
    
    checkNodeOptimization() {
        // Bonus points for well-distributed pods across nodes
        let balanceBonus = 0;
        const nodeLoads = this.nodes.map(node => 
            node.resources.usedCpu / node.resources.totalCpu
        );
        
        const avgLoad = nodeLoads.reduce((a, b) => a + b, 0) / nodeLoads.length;
        const loadVariance = nodeLoads.reduce((acc, load) => 
            acc + Math.pow(load - avgLoad, 2), 0) / nodeLoads.length;
        
        // Lower variance means better distribution
        if (loadVariance < 0.1) {
            balanceBonus = 200 * this.level;
            this.score += balanceBonus;
        }
    }
    
    clearCompletedLines() {
        for (let y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.isLineFull(y)) {
                this.clearLine(y);
                this.score += 400 * this.level;
                y++; // Check the same line again
            }
        }
    }
    
    isLineFull(y) {
        for (let x = 0; x < this.BOARD_WIDTH; x++) {
            if (!this.board[y][x] || !this.board[y][x].filled) {
                return false;
            }
        }
        return true;
    }
    
    clearLine(y) {
        // Remove the completed line
        this.board.splice(y, 1);
        
        // Add new empty line at top
        const newLine = Array(this.BOARD_WIDTH).fill(null);
        this.board.unshift(newLine);
    }
    
    checkClusterOptimization() {
        // Bonus points for well-organized clusters
        const clusterPods = this.getClusterPodDistribution();
        
        clusterPods.forEach(cluster => {
            if (this.isClusterOptimal(cluster)) {
                this.score += 500 * this.level;
            }
        });
    }
    
    isClusterOptimal(cluster) {
        const pods = cluster.pods;
        if (pods.length < 3) return false;
        
        // Check for balanced pod types
        const types = [...new Set(pods.map(pod => pod.type))];
        return types.length >= 2 && this.hasGoodDependencyStructure(pods);
    }
    
    hasGoodDependencyStructure(pods) {
        // Simplified: check if there are both databases and services
        const hasDatabases = pods.some(pod => pod.type === 'database');
        const hasServices = pods.some(pod => ['frontend', 'backend'].includes(pod.type));
        return hasDatabases && hasServices;
    }
    
    generateActiveConstraints() {
        this.activeConstraints = [];
        
        // Add random constraints based on game state
        const constraints = [
            {
                type: 'resource-limit',
                cpu: 2,
                ram: 4,
                description: 'CPU: ≤2, RAM: ≤4GB'
            },
            {
                type: 'anti-affinity',
                target: 'database',
                description: 'Spread database pods'
            },
            {
                type: 'node-selector',
                selector: 'ssd',
                description: 'Requires SSD nodes'
            }
        ];
        
        // Add 1-3 random constraints
        const numConstraints = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numConstraints; i++) {
            const constraint = constraints[Math.floor(Math.random() * constraints.length)];
            if (!this.activeConstraints.some(c => c.type === constraint.type)) {
                this.activeConstraints.push(constraint);
            }
        }
    }
    
    gameOver(reason = "Game Over!") {
        this.gameRunning = false;
        const modal = document.getElementById('game-over-modal');
        const finalScore = document.getElementById('final-score');
        const newHighScore = document.getElementById('new-high-score');
        const gameOverMessage = document.querySelector('#game-over-modal h2');
        
        finalScore.textContent = this.score.toLocaleString();
        gameOverMessage.textContent = reason;
        
        if (this.isNewHighScore()) {
            newHighScore.classList.remove('hidden');
        } else {
            newHighScore.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
    }
    
    isNewHighScore() {
        const highScores = this.getHighScores();
        return highScores.length < 10 || this.score > highScores[highScores.length - 1].score;
    }
    
    saveHighScore() {
        const playerName = document.getElementById('player-name').value.trim();
        if (!playerName) {
            alert('Please enter your name!');
            return;
        }
        
        const highScores = this.getHighScores();
        highScores.push({
            name: playerName,
            score: this.score,
            level: this.level,
            date: new Date().toLocaleDateString()
        });
        
        highScores.sort((a, b) => b.score - a.score);
        highScores.splice(10); // Keep only top 10
        
        localStorage.setItem('kubetetris-highscores', JSON.stringify(highScores));
        this.displayHighScores();
        
        document.getElementById('new-high-score').classList.add('hidden');
    }
    
    getHighScores() {
        const stored = localStorage.getItem('kubetetris-highscores');
        return stored ? JSON.parse(stored) : [];
    }
    
    loadHighScores() {
        this.displayHighScores();
    }
    
    displayHighScores() {
        const highScores = this.getHighScores();
        const container = document.getElementById('high-scores-list');
        
        if (highScores.length === 0) {
            container.innerHTML = '<div style="text-align: center; opacity: 0.7;">No scores yet!</div>';
            return;
        }
        
        container.innerHTML = highScores.map((score, index) => `
            <div class="high-score-item">
                <span class="high-score-rank">${index + 1}.</span>
                <span class="high-score-name">${score.name}</span>
                <span class="high-score-score">${score.score.toLocaleString()}</span>
            </div>
        `).join('');
    }
    
    updateDisplay() {
        const scoreElement = document.getElementById('current-score');
        const levelElement = document.getElementById('current-level');
        
        if (scoreElement) {
            scoreElement.textContent = this.score.toLocaleString();
        }
        if (levelElement) {
            levelElement.textContent = this.level;
        }
    }
    
    updateConstraints() {
        const container = document.getElementById('constraints-list');
        if (!container) return; // Guard clause for missing element
        
        // Show node status instead of constraints
        let nodeStatus = '';
        this.nodes.forEach((node, index) => {
            const cpuPercent = Math.round((node.resources.usedCpu / node.resources.totalCpu) * 100);
            const memPercent = Math.round((node.resources.usedRam / node.resources.totalRam) * 100);
            const ssdPercent = Math.round((node.resources.usedSsd / node.resources.totalSsd) * 100);
            const gpuPercent = node.resources.totalGpu > 0 ? Math.round((node.resources.usedGpu / node.resources.totalGpu) * 100) : 0;
            
            const maxPercent = Math.max(cpuPercent, memPercent, ssdPercent, gpuPercent);
            const status = maxPercent > 80 ? '🔴' : maxPercent > 60 ? '🟡' : '🟢';
            
            const gpuDisplay = node.resources.totalGpu > 0 ? `, ${gpuPercent}% GPU` : '';
            
            nodeStatus += `
                <div class="constraint-item">
                    ${status} N${index}: ${cpuPercent}%CPU, ${memPercent}%RAM, ${ssdPercent}%SSD${gpuDisplay}
                    <div style="font-size: 10px; opacity: 0.8;">
                        Total: ${node.resources.totalCpu}C/${node.resources.totalRam}G/${node.resources.totalSsd}G${node.resources.totalGpu > 0 ? `/${node.resources.totalGpu}GPU` : ''}
                    </div>
                </div>
            `;
        });
        
        // Show simplified node status only
        container.innerHTML = nodeStatus || '<div class="constraint-item">All nodes operational</div>';
    }
    
    updateNextPodDisplay() {
        const container = document.getElementById('next-pod');
        if (!container || !this.nextPod) return; // Guard clause for missing element
        
        container.style.backgroundColor = 'transparent'; // Let image show through
        
        if (this.nextPod.dropType === 'pod') {
            const podImage = this.images[`pod_${this.nextPod.type}`];
            const imageHtml = podImage && this.assetsLoaded ? 
                `<img src="${podImage.src}" style="width: 60px; height: 60px; margin-bottom: 5px;">` :
                `<div style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: ${this.nextPod.color};">${this.nextPod.symbol}</div>`;
            
            container.innerHTML = `
                ${imageHtml}
                <div style="font-size: 10px; line-height: 1.2; color: #fff;">
                    <div><strong>${this.nextPod.type} pod</strong></div>
                    <div>CPU: ${this.nextPod.resources.cpu}</div>
                    <div>RAM: ${this.nextPod.resources.ram}</div>
                    <div>SSD: ${this.nextPod.resources.ssd}GB</div>
                    ${this.nextPod.resources.gpu > 0 ? `<div>GPU: ${this.nextPod.resources.gpu}</div>` : ''}
                </div>
            `;
        } else if (this.nextPod.dropType === 'resource') {
            const resourceImage = this.images[`resource_${this.nextPod.type}`];
            const imageHtml = resourceImage && this.assetsLoaded ? 
                `<img src="${resourceImage.src}" style="width: 60px; height: 60px; margin-bottom: 5px;">` :
                `<div style="font-size: 24px; font-weight: bold; margin-bottom: 5px; color: ${this.nextPod.color};">${this.nextPod.symbol}</div>`;
            
            const capacity = this.nextPod.capacity;
            const capacityText = Object.keys(capacity).map(key => 
                `${key.toUpperCase()}: +${capacity[key]}`
            ).join('<br>');
            
            container.innerHTML = `
                ${imageHtml}
                <div style="font-size: 10px; line-height: 1.2; color: #fff;">
                    <div><strong>${this.nextPod.description}</strong></div>
                    <div>${capacityText}</div>
                </div>
            `;
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000814';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw placed pods
        this.drawBoard();
        
        // Draw current falling pod
        if (this.currentPod) {
            this.drawPod(this.currentPod);
        }
        
        // Draw cluster boundaries
        this.drawClusterBoundaries();
        
        // Draw landing animations
        this.drawLandingAnimations();
    }
    
    drawGrid() {
        // Enhanced cyberpunk grid with multiple layers and pulsing effects
        this.ctx.save();
        
        // Main grid with neon glow
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 8;
        
        // Vertical lines
        for (let x = 0; x <= this.BOARD_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.CELL_SIZE, 0);
            this.ctx.lineTo(x * this.CELL_SIZE, this.BOARD_HEIGHT * this.CELL_SIZE);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.CELL_SIZE);
            this.ctx.lineTo(this.BOARD_WIDTH * this.CELL_SIZE, y * this.CELL_SIZE);
            this.ctx.stroke();
        }
        
        // Secondary grid with purple glow
        this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#FF00FF';
        this.ctx.shadowBlur = 4;
        
        // Diagonal accent lines
        for (let i = 0; i < this.BOARD_WIDTH + this.BOARD_HEIGHT; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.CELL_SIZE / 2, 0);
            this.ctx.lineTo(0, i * this.CELL_SIZE / 2);
            this.ctx.stroke();
        }
        
        // Pulsing corner markers
        const pulseIntensity = (Math.sin(Date.now() / 1000) + 1) / 2;
        this.ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + pulseIntensity * 0.3})`;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 15;
        
        // Corner markers
        const markerSize = 8;
        const positions = [
            [0, 0], [this.BOARD_WIDTH * this.CELL_SIZE - markerSize, 0],
            [0, this.BOARD_HEIGHT * this.CELL_SIZE - markerSize],
            [this.BOARD_WIDTH * this.CELL_SIZE - markerSize, this.BOARD_HEIGHT * this.CELL_SIZE - markerSize]
        ];
        
        positions.forEach(([x, y]) => {
            this.ctx.fillRect(x, y, markerSize, markerSize);
        });
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        this.ctx.restore();
    }
    
    drawBoard() {
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                const cell = this.board[y][x];
                if (cell) {
                    if (cell.type === 'node') {
                        this.drawNode(x, y, cell);
                    } else if (cell.filled && cell.pod) {
                        this.drawPlacedPod(x, y, cell.pod);
                    }
                }
            }
        }
    }
    
    drawNode(x, y, node) {
        const cellX = x * this.CELL_SIZE;
        const cellY = y * this.CELL_SIZE;
        const isMobile = window.innerWidth <= 768;
        
        // Check for bucket shake animation
        let shakeX = 0, shakeY = 0;
        const shakeAnim = this.bucketShakeAnimations.find(shake => shake.x === x && shake.y === y);
        if (shakeAnim) {
            shakeX = (Math.random() - 0.5) * shakeAnim.shakeIntensity;
            shakeY = (Math.random() - 0.5) * shakeAnim.shakeIntensity;
        }
        
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        
        if (false) { // Force manual bucket drawing for now
            // Draw bucket using SVG image
            this.ctx.drawImage(this.bucketImage, cellX, cellY, this.CELL_SIZE, this.CELL_SIZE);
            
            // Add resource fill overlay
            const totalResources = node.resources.totalCpu + node.resources.totalRam;
            const usedResources = node.resources.usedCpu + node.resources.usedRam;
            const fillPercent = usedResources / totalResources;
            
            if (fillPercent > 0) {
                const fillHeight = (this.CELL_SIZE * 0.6) * fillPercent;
                const fillY = cellY + this.CELL_SIZE - fillHeight - 8;
                
                this.ctx.fillStyle = fillPercent > 0.8 ? 'rgba(231, 76, 60, 0.6)' : 
                                    fillPercent > 0.6 ? 'rgba(243, 156, 18, 0.6)' : 'rgba(39, 174, 96, 0.6)';
                
                // Draw liquid fill
                this.ctx.beginPath();
                this.ctx.moveTo(cellX + 16, fillY);
                this.ctx.lineTo(cellX + this.CELL_SIZE - 16, fillY);
                this.ctx.lineTo(cellX + this.CELL_SIZE - 18, cellY + this.CELL_SIZE - 8);
                this.ctx.lineTo(cellX + 18, cellY + this.CELL_SIZE - 8);
                this.ctx.closePath();
                this.ctx.fill();
                
                // Add liquid surface effect
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(cellX + 16, fillY, this.CELL_SIZE - 32, 2);
            }
        } else {
            // Fallback: Draw bucket shape manually
            this.drawBucketManual(cellX, cellY, node);
        }
        
        // Resource information overlay (always drawn) - mobile responsive font sizes
        this.ctx.fillStyle = '#00FFFF'; // Cyberpunk cyan instead of white
        const baseFontSize = isMobile ? Math.max(8, this.CELL_SIZE / 8) : Math.max(10, this.CELL_SIZE / 8);
        this.ctx.font = `bold ${baseFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = isMobile ? 2 : 1;
        
        const lineHeight = baseFontSize + 2;
        let currentY = cellY + (isMobile ? 8 : 16);
        
        // CPU info with outline for better visibility - cyberpunk orange
        this.ctx.fillStyle = '#FF6600';
        const cpuText = `C:${node.resources.usedCpu}/${node.resources.totalCpu}`;
        this.ctx.strokeText(cpuText, cellX + this.CELL_SIZE / 2, currentY);
        this.ctx.fillText(cpuText, cellX + this.CELL_SIZE / 2, currentY);
        currentY += lineHeight;
        
        // Memory info with outline - cyberpunk green
        this.ctx.fillStyle = '#00FF66';
        const ramDisplayText = `R:${node.resources.usedRam}/${node.resources.totalRam}`;
        this.ctx.strokeText(ramDisplayText, cellX + this.CELL_SIZE / 2, currentY);
        this.ctx.fillText(ramDisplayText, cellX + this.CELL_SIZE / 2, currentY);
        currentY += lineHeight;
        
        // Only show SSD and GPU on larger screens or larger cells
        if (!isMobile || this.CELL_SIZE > 60) {
            // SSD info - cyberpunk purple
            this.ctx.fillStyle = '#9966FF';
            const ssdText = `S:${node.resources.usedSsd}/${node.resources.totalSsd}`;
            this.ctx.strokeText(ssdText, cellX + this.CELL_SIZE / 2, currentY);
            this.ctx.fillText(ssdText, cellX + this.CELL_SIZE / 2, currentY);
            currentY += lineHeight;
            
            // GPU info - cyberpunk yellow
            this.ctx.fillStyle = '#FFFF00';
            const gpuText = `G:${node.resources.usedGpu}/${node.resources.totalGpu}`;
            this.ctx.strokeText(gpuText, cellX + this.CELL_SIZE / 2, currentY);
            this.ctx.fillText(gpuText, cellX + this.CELL_SIZE / 2, currentY);
        }
        
        // Node ID - larger and more visible
        this.ctx.fillStyle = '#61dafb';
        const nodeFontSize = isMobile ? Math.max(10, this.CELL_SIZE / 6) : Math.max(12, this.CELL_SIZE / 7);
        this.ctx.font = `bold ${nodeFontSize}px Roboto Mono`;
        this.ctx.strokeStyle = '#000000';
        this.ctx.strokeText(`N${node.nodeId}`, cellX + this.CELL_SIZE / 2, cellY + this.CELL_SIZE - (isMobile ? 12 : 20));
        this.ctx.fillText(`N${node.nodeId}`, cellX + this.CELL_SIZE / 2, cellY + this.CELL_SIZE - (isMobile ? 12 : 20));
        
        // Specialization indicators - only on larger screens
        if (!isMobile && node.specialization) {
            this.ctx.fillStyle = '#ffd60a';
            const specFontSize = Math.max(8, this.CELL_SIZE / 10);
            this.ctx.font = `bold ${specFontSize}px Roboto Mono`;
            this.ctx.textAlign = 'left';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeText(node.specialization, cellX + 3, cellY + 8);
            this.ctx.fillText(node.specialization, cellX + 3, cellY + 8);
        }
        
        this.ctx.restore();
    }
    
    drawBucketManual(cellX, cellY, node) {
        // Enhanced cyberpunk bucket drawing with holographic effects
        const bucketWidth = this.CELL_SIZE - 8;
        const bucketHeight = this.CELL_SIZE - 8;
        const rimHeight = 8;
        
        this.ctx.save();
        
        // Holographic base glow
        const glowIntensity = (Math.sin(Date.now() / 800) + 1) / 2;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 20 + glowIntensity * 10;
        
        // Bucket body (trapezoid shape) - darker cyberpunk base with gradient
        const bodyGradient = this.ctx.createLinearGradient(cellX, cellY, cellX, cellY + bucketHeight);
        bodyGradient.addColorStop(0, '#0a0a0a');
        bodyGradient.addColorStop(0.3, '#1a1a2e');
        bodyGradient.addColorStop(0.7, '#16213e');
        bodyGradient.addColorStop(1, '#0a0a0a');
        this.ctx.fillStyle = bodyGradient;
        
        this.ctx.beginPath();
        this.ctx.moveTo(cellX + 8, cellY + 4); // Top left
        this.ctx.lineTo(cellX + bucketWidth, cellY + 4); // Top right
        this.ctx.lineTo(cellX + bucketWidth - 6, cellY + bucketHeight); // Bottom right
        this.ctx.lineTo(cellX + 14, cellY + bucketHeight); // Bottom left
        this.ctx.closePath();
        this.ctx.fill();
        
        // Holographic rim with rainbow gradient
        const rimGradient = this.ctx.createLinearGradient(cellX, cellY, cellX, cellY + rimHeight);
        rimGradient.addColorStop(0, '#00FFFF');
        rimGradient.addColorStop(0.3, '#0099FF');
        rimGradient.addColorStop(0.6, '#FF00FF');
        rimGradient.addColorStop(1, '#00FF99');
        this.ctx.fillStyle = rimGradient;
        this.ctx.fillRect(cellX + 6, cellY + 4, bucketWidth + 4, rimHeight);
        
        // Data flow lines on bucket sides
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 5;
        
        const flowOffset = (Date.now() / 100) % 20;
        for (let i = 0; i < 3; i++) {
            const y = cellY + 15 + i * 12 + flowOffset;
            this.ctx.beginPath();
            this.ctx.moveTo(cellX + 10, y);
            this.ctx.lineTo(cellX + 18, y);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(cellX + bucketWidth - 10, y);
            this.ctx.lineTo(cellX + bucketWidth - 2, y);
            this.ctx.stroke();
        }
        
        // Enhanced neon outline with pulsing effect
        this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 + glowIntensity * 0.2})`;
        this.ctx.lineWidth = 2 + glowIntensity;
        this.ctx.shadowBlur = 15 + glowIntensity * 5;
        
        this.ctx.beginPath();
        this.ctx.moveTo(cellX + 8, cellY + 4);
        this.ctx.lineTo(cellX + bucketWidth, cellY + 4);
        this.ctx.lineTo(cellX + bucketWidth - 6, cellY + bucketHeight);
        this.ctx.lineTo(cellX + 14, cellY + bucketHeight);
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Enhanced rim outline with secondary glow
        this.ctx.strokeStyle = `rgba(255, 0, 255, ${0.6 + glowIntensity * 0.3})`;
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#FF00FF';
        this.ctx.shadowBlur = 8;
        this.ctx.strokeRect(cellX + 6, cellY + 4, bucketWidth + 4, rimHeight);
        
        // Resource fill level with holographic liquid
        const totalResources = node.resources.totalCpu + node.resources.totalRam;
        const usedResources = node.resources.usedCpu + node.resources.usedRam;
        const fillPercent = usedResources / totalResources;
        
        if (fillPercent > 0) {
            const fillHeight = (bucketHeight - rimHeight - 4) * fillPercent;
            const fillY = cellY + bucketHeight - fillHeight;
            
            // Animated liquid with wave effect
            const waveOffset = Math.sin(Date.now() / 500 + cellX / 20) * 2;
            
            // Liquid gradient based on fill level
            const liquidGradient = this.ctx.createLinearGradient(cellX, fillY, cellX, cellY + bucketHeight);
            if (fillPercent > 0.8) {
                liquidGradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
                liquidGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.6)');
                liquidGradient.addColorStop(1, 'rgba(255, 0, 0, 0.9)');
            } else if (fillPercent > 0.6) {
                liquidGradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
                liquidGradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.6)');
                liquidGradient.addColorStop(1, 'rgba(255, 215, 0, 0.9)');
            } else {
                liquidGradient.addColorStop(0, 'rgba(0, 255, 100, 0.8)');
                liquidGradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.6)');
                liquidGradient.addColorStop(1, 'rgba(0, 255, 100, 0.9)');
            }
            
            this.ctx.fillStyle = liquidGradient;
            this.ctx.shadowColor = fillPercent > 0.8 ? '#FF0000' : fillPercent > 0.6 ? '#FFD700' : '#00FF64';
            this.ctx.shadowBlur = 10;
            
            // Draw trapezoid fill with wave effect
            this.ctx.beginPath();
            this.ctx.moveTo(cellX + 16, fillY + waveOffset);
            this.ctx.lineTo(cellX + bucketWidth - 8, fillY + waveOffset);
            this.ctx.lineTo(cellX + bucketWidth - 14, cellY + bucketHeight - 2);
            this.ctx.lineTo(cellX + 16, cellY + bucketHeight - 2);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Liquid surface reflection
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.shadowBlur = 0;
            this.ctx.fillRect(cellX + 16, fillY + waveOffset, bucketWidth - 24, 1);
        }
        
        // Holographic handles with glow
        this.ctx.fillStyle = `rgba(0, 255, 255, ${0.7 + glowIntensity * 0.3})`;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 8;
        
        // Left handle
        this.ctx.fillRect(cellX + 2, cellY + 6, 6, 8);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cellX + 2, cellY + 6, 6, 8);
        
        // Right handle
        this.ctx.fillRect(cellX + bucketWidth + 2, cellY + 6, 6, 8);
        this.ctx.strokeRect(cellX + bucketWidth + 2, cellY + 6, 6, 8);
        
        this.ctx.restore();
    }
    
    drawPlacedPod(x, y, pod) {
        const cellX = x * this.CELL_SIZE;
        const cellY = y * this.CELL_SIZE;
        
        // Pod background
        this.ctx.fillStyle = pod.color;
        this.ctx.fillRect(cellX + 6, cellY + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
        
        // Pod border
        this.ctx.strokeStyle = '#00FFFF'; // Cyberpunk cyan for border
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cellX + 6, cellY + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
        
        // Pod symbol
        this.ctx.fillStyle = '#00FFFF'; // Cyberpunk cyan for symbol
        this.ctx.font = 'bold 28px Roboto Mono';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(pod.symbol, cellX + this.CELL_SIZE / 2, cellY + this.CELL_SIZE / 2);
        
        // Calculate responsive font size for resource info
        const fontSize = Math.max(8, this.CELL_SIZE / 12);
        
        // Pod resource info with better stroke for visibility
        this.ctx.fillStyle = '#00FF66'; // Cyberpunk green for resource info
        this.ctx.font = `bold ${fontSize}px Roboto Mono`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2; // Thicker stroke for better readability
        
        const cpuText = `${pod.resources.cpu}c`;
        const ramText = `${pod.resources.ram}G`;
        
        this.ctx.strokeText(cpuText, cellX + 8, cellY + 8);
        this.ctx.fillText(cpuText, cellX + 8, cellY + 8);
        
        this.ctx.strokeText(ramText, cellX + 8 + 25, cellY + 8);
        this.ctx.fillText(ramText, cellX + 8 + 25, cellY + 8);
    }
    
    drawPod(pod) {
        const x = pod.x * this.CELL_SIZE;
        let y;
        
        if (this.isInstantDropping) {
            // Use instant drop animation position
            y = (this.dropStartY + this.animationOffset) * this.CELL_SIZE;
        } else {
            // Use normal smooth falling animation
            y = (pod.y + this.animationOffset) * this.CELL_SIZE;
        }
        
        // Cyberpunk neon glow effect
        this.ctx.shadowColor = pod.color;
        this.ctx.shadowBlur = 15;
        
        // Add trail effect during instant drop
        if (this.isInstantDropping) {
            const trailLength = 3;
            for (let i = 0; i < trailLength; i++) {
                const trailY = y - (i + 1) * 30;
                const opacity = (trailLength - i) / trailLength * 0.3;
                
                this.ctx.globalAlpha = opacity;
                this.ctx.fillStyle = pod.color;
                this.ctx.fillRect(x + 6, trailY + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            }
            this.ctx.globalAlpha = 1.0;
        }
        
        // Different visual styles for pods vs resources
        if (pod.dropType === 'resource') {
            this.drawResource(x, y, pod);
        } else {
            this.drawPodVisual(x, y, pod);
        }
    }
    
    drawPodVisual(x, y, pod) {
        const isMobile = window.innerWidth <= 768;
        
        this.ctx.save();
        
        // Enhanced holographic glow effect
        const glowIntensity = (Math.sin(Date.now() / 600 + x / 50) + 1) / 2;
        this.ctx.shadowColor = pod.color;
        this.ctx.shadowBlur = 20 + glowIntensity * 10;
        
        // Check if we have an image for this pod type
        const podImage = this.images[`pod_${pod.type}`];
        
        if (podImage && this.assetsLoaded) {
            // Draw holographic background effect
            const bgGradient = this.ctx.createRadialGradient(
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, 0,
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, this.CELL_SIZE / 2
            );
            bgGradient.addColorStop(0, `${pod.color}20`);
            bgGradient.addColorStop(0.7, `${pod.color}10`);
            bgGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = bgGradient;
            this.ctx.fillRect(x + 6, y + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            
            // Draw the pod image with enhanced effects
            const padding = isMobile ? 6 : 10;
            const imageSize = this.CELL_SIZE - (padding * 2);
            
            // Add scanning line effect
            const scanOffset = (Date.now() / 20) % (this.CELL_SIZE + 20);
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            this.ctx.fillRect(x + padding, y + padding + scanOffset - 10, imageSize, 2);
            
            this.ctx.drawImage(podImage, x + padding, y + padding, imageSize, imageSize);
            
            // Add holographic border with enhanced effects
            this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 + glowIntensity * 0.2})`;
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 10;
            this.ctx.strokeRect(x + padding, y + padding, imageSize, imageSize);
            
        } else {
            // Enhanced fallback drawing with cyberpunk aesthetics
            const gradient = this.ctx.createRadialGradient(
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, 0,
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, this.CELL_SIZE / 2
            );
            gradient.addColorStop(0, pod.color);
            gradient.addColorStop(0.3, `${pod.color}AA`);
            gradient.addColorStop(0.7, `${pod.color}55`);
            gradient.addColorStop(1, '#000000');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x + 6, y + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            
            // Enhanced neon border with multiple layers
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 15;
            this.ctx.strokeRect(x + 6, y + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            
            // Inner glow border with pod color
            this.ctx.strokeStyle = pod.color;
            this.ctx.lineWidth = 1;
            this.ctx.shadowBlur = 8;
            this.ctx.strokeRect(x + 8, y + 8, this.CELL_SIZE - 16, this.CELL_SIZE - 16);
            
            // Holographic symbol with enhanced glow
            this.ctx.fillStyle = '#00FFFF'; // Cyberpunk cyan for symbol
            const symbolSize = isMobile ? Math.max(20, this.CELL_SIZE / 2.5) : Math.max(20, this.CELL_SIZE / 3);
            this.ctx.font = `bold ${symbolSize}px Roboto Mono`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeStyle = pod.color;
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = '#00FFFF'; // Cyberpunk cyan for shadow glow
            this.ctx.shadowBlur = 15;
            this.ctx.strokeText(pod.symbol, x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
            this.ctx.fillText(pod.symbol, x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
        }
        
        this.ctx.restore();
        
        // Reset shadow for text
        this.ctx.shadowBlur = 0;
        
        // Calculate responsive font sizes - much larger for mobile
        const fontSize = isMobile ? Math.max(10, this.CELL_SIZE / 8) : Math.max(8, this.CELL_SIZE / 10);
        const labelFontSize = isMobile ? Math.max(12, this.CELL_SIZE / 6) : Math.max(10, this.CELL_SIZE / 8);
        
        // Pod resource info (always show for both image and fallback)
        this.ctx.font = `bold ${fontSize}px Roboto Mono`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = isMobile ? 3 : 3; // Thicker stroke for better readability
        
        const cpuText = `C:${pod.resources.cpu}`;
        const ramText = `R:${pod.resources.ram}`;
        const ssdText = `S:${pod.resources.ssd}`;
        const gpuText = `G:${pod.resources.gpu}`;
        
        // Display resources in better layout for mobile
        if (isMobile) {
            // Mobile: Stack resources vertically for better readability
            let textY = y + 2;
            const lineHeight = Math.max(10, fontSize + 2);
            
            // CPU in cyberpunk orange
            this.ctx.fillStyle = '#FF6600';
            this.ctx.strokeText(cpuText, x + 2, textY);
            this.ctx.fillText(cpuText, x + 2, textY);
            
            textY += lineHeight;
            // RAM in cyberpunk green
            this.ctx.fillStyle = '#00FF66';
            this.ctx.strokeText(ramText, x + 2, textY);
            this.ctx.fillText(ramText, x + 2, textY);
            
            // Show GPU and SSD on third line if there's space
            if (this.CELL_SIZE > 50 && (pod.resources.gpu > 0 || pod.resources.ssd > 0)) {
                textY += lineHeight;
                if (pod.resources.gpu > 0) {
                    // GPU in cyberpunk yellow
                    this.ctx.fillStyle = '#FFFF00';
                    this.ctx.strokeText(gpuText, x + 2, textY);
                    this.ctx.fillText(gpuText, x + 2, textY);
                }
                if (pod.resources.ssd > 0) {
                    // SSD in cyberpunk purple
                    this.ctx.fillStyle = '#9966FF';
                    const ssdX = pod.resources.gpu > 0 ? x + 2 + fontSize * 3 : x + 2;
                    this.ctx.strokeText(ssdText, ssdX, textY);
                    this.ctx.fillText(ssdText, ssdX, textY);
                }
            }
        } else {
            // Desktop: Keep horizontal layout
            let textY = y + 6;
            const textSpacing = 30;
            
            // CPU in cyberpunk orange
            this.ctx.fillStyle = '#FF6600';
            this.ctx.strokeText(cpuText, x + 4, textY);
            this.ctx.fillText(cpuText, x + 4, textY);
            
            // RAM in cyberpunk green
            this.ctx.fillStyle = '#00FF66';
            this.ctx.strokeText(ramText, x + 4 + textSpacing, textY);
            this.ctx.fillText(ramText, x + 4 + textSpacing, textY);
            
            // Only show GPU if it's greater than 0 and we have space
            if (pod.resources.gpu > 0) {
                // GPU in cyberpunk yellow
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.strokeText(gpuText, x + 4 + textSpacing * 2, textY);
                this.ctx.fillText(gpuText, x + 4 + textSpacing * 2, textY);
            }
        }
        
        // Pod type label - always show but with better mobile formatting
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.font = `bold ${labelFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = isMobile ? 3 : 3; // Consistent thick stroke
        
        if (isMobile) {
            // Mobile: Show shorter label at bottom with better positioning
            const labelText = pod.type.substring(0, 3).toUpperCase();
            const labelY = y + this.CELL_SIZE - Math.max(8, labelFontSize + 2);
            this.ctx.strokeText(labelText, x + this.CELL_SIZE / 2, labelY);
            this.ctx.fillText(labelText, x + this.CELL_SIZE / 2, labelY);
        } else {
            // Desktop: Full label
            const labelText = pod.type.toUpperCase();
            this.ctx.strokeText(labelText, x + this.CELL_SIZE / 2, y + this.CELL_SIZE - 12);
            this.ctx.fillText(labelText, x + this.CELL_SIZE / 2, y + this.CELL_SIZE - 12);
        }
    }
    
    drawResource(x, y, resource) {
        const isMobile = window.innerWidth <= 768;
        
        this.ctx.save();
        
        // Enhanced holographic glow for resources
        const glowIntensity = (Math.sin(Date.now() / 400 + x / 30) + 1) / 2;
        this.ctx.shadowColor = resource.color;
        this.ctx.shadowBlur = 25 + glowIntensity * 15;
        
        // Check if we have an image for this resource type
        const resourceImage = this.images[`resource_${resource.type}`];
        
        if (resourceImage && this.assetsLoaded) {
            // Holographic background for resource
            const bgGradient = this.ctx.createRadialGradient(
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, 0,
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, this.CELL_SIZE / 2
            );
            bgGradient.addColorStop(0, `${resource.color}40`);
            bgGradient.addColorStop(0.5, `${resource.color}20`);
            bgGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = bgGradient;
            this.ctx.fillRect(x + 5, y + 5, this.CELL_SIZE - 10, this.CELL_SIZE - 10);
            
            // Draw the resource image with pulsing effect
            const padding = 5;
            const imageSize = this.CELL_SIZE - (padding * 2);
            const pulseScale = 1 + glowIntensity * 0.1;
            const scaledSize = imageSize * pulseScale;
            const scalePadding = (imageSize - scaledSize) / 2;
            
            this.ctx.drawImage(resourceImage, 
                x + padding + scalePadding, 
                y + padding + scalePadding, 
                scaledSize, scaledSize);
            
            // Enhanced holographic border with energy flow
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + glowIntensity * 0.2})`;
            this.ctx.lineWidth = 2 + glowIntensity;
            this.ctx.shadowBlur = 15;
            this.ctx.strokeRect(x + padding, y + padding, imageSize, imageSize);
            
            // Energy flow lines around the border
            this.ctx.strokeStyle = resource.color;
            this.ctx.lineWidth = 1;
            this.ctx.shadowBlur = 8;
            const flowOffset = (Date.now() / 50) % 40;
            
            // Top flow
            this.ctx.beginPath();
            this.ctx.moveTo(x + padding + flowOffset, y + padding);
            this.ctx.lineTo(x + padding + flowOffset + 10, y + padding);
            this.ctx.stroke();
            
            // Right flow
            this.ctx.beginPath();
            this.ctx.moveTo(x + padding + imageSize, y + padding + flowOffset);
            this.ctx.lineTo(x + padding + imageSize, y + padding + flowOffset + 10);
            this.ctx.stroke();
            
        } else {
            // Enhanced fallback diamond with cyberpunk effects
            this.ctx.save();
            
            // Rotating diamond with energy trails
            this.ctx.translate(x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
            this.ctx.rotate((Date.now() / 2000) % (2 * Math.PI));
            
            // Energy trail effect
            for (let i = 0; i < 3; i++) {
                this.ctx.fillStyle = `${resource.color}${(3-i) * 20}`;
                this.ctx.shadowBlur = 20 - i * 5;
                const size = this.CELL_SIZE / 2 - 5 + i * 2;
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, -size);
                this.ctx.lineTo(size, 0);
                this.ctx.lineTo(0, size);
                this.ctx.lineTo(-size, 0);
                this.ctx.closePath();
                this.ctx.fill();
            }
            
            // Main diamond with holographic fill
            const diamondGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.CELL_SIZE / 2);
            diamondGradient.addColorStop(0, resource.color);
            diamondGradient.addColorStop(0.5, `${resource.color}AA`);
            diamondGradient.addColorStop(1, `${resource.color}55`);
            this.ctx.fillStyle = diamondGradient;
            
            const size = this.CELL_SIZE / 2 - 10;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -size);
            this.ctx.lineTo(size, 0);
            this.ctx.lineTo(0, size);
            this.ctx.lineTo(-size, 0);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Enhanced diamond border
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = resource.color;
            this.ctx.shadowBlur = 15;
            this.ctx.stroke();
            
            // Resource symbol with enhanced glow
            this.ctx.fillStyle = '#000000';
            this.ctx.shadowColor = '#FFFFFF';
            this.ctx.shadowBlur = 10;
            const symbolSize = isMobile ? Math.max(14, this.CELL_SIZE / 4) : 16;
            this.ctx.font = `bold ${symbolSize}px Roboto Mono`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(resource.symbol, 0, 0);
            
            this.ctx.restore();
        }
        
        this.ctx.restore();
        
        // Reset shadow for text
        this.ctx.shadowBlur = 0;
        
        // Calculate responsive font size - larger for mobile
        const labelFontSize = isMobile ? Math.max(8, this.CELL_SIZE / 8) : Math.max(10, this.CELL_SIZE / 10);
        const capacityFontSize = isMobile ? Math.max(10, this.CELL_SIZE / 6) : Math.max(12, this.CELL_SIZE / 7);
        
        // Resource capacity values - show what this upgrade adds (make it more prominent)
        this.ctx.fillStyle = '#00FFFF'; // Cyberpunk cyan for upgrade values
        this.ctx.font = `bold ${capacityFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3; // Thicker stroke for better visibility
        
        // Display capacity upgrade values - position it better
        const capacityText = Object.entries(resource.capacity)
            .map(([key, value]) => `+${value}${key.substring(0, 1).toUpperCase()}`)
            .join(' ');
        
        // Position capacity text in the upper part of the cell
        const capacityY = y + (isMobile ? 10 : 12);
        this.ctx.strokeText(capacityText, x + this.CELL_SIZE / 2, capacityY);
        this.ctx.fillText(capacityText, x + this.CELL_SIZE / 2, capacityY);
        
        // Resource description with better text stroke for visibility
        this.ctx.fillStyle = '#FF6600'; // Cyberpunk orange for resource description
        this.ctx.font = `bold ${labelFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3; // Thicker stroke for better readability
        
        const labelY = y + this.CELL_SIZE - (isMobile ? 4 : 6);
        this.ctx.strokeText(resource.description, x + this.CELL_SIZE / 2, labelY);
        this.ctx.fillText(resource.description, x + this.CELL_SIZE / 2, labelY);
    }
    
    drawClusterBoundaries() {
        const isMobile = window.innerWidth <= 768;
        
        // Draw node labels with bucket theme
        this.ctx.strokeStyle = '#61dafb';
        this.ctx.lineWidth = 2;
        
        for (let nodeId = 0; nodeId < this.BOARD_WIDTH; nodeId++) {
            const x = nodeId * this.CELL_SIZE;
            const y = (this.BOARD_HEIGHT - this.NODE_HEIGHT) * this.CELL_SIZE;
            
            // Platform/base for bucket
            this.ctx.fillStyle = '#34495e';
            this.ctx.fillRect(x + 2, y + this.CELL_SIZE - 4, this.CELL_SIZE - 4, 4);
            
            // Node label above with bucket emoji - larger font for mobile
            this.ctx.fillStyle = '#61dafb';
            const nodeFontSize = isMobile ? Math.max(10, this.CELL_SIZE / 8) : 12;
            this.ctx.font = `bold ${nodeFontSize}px Roboto Mono`;
            this.ctx.textAlign = 'center';
            const labelText = isMobile ? `🪣 ${nodeId}` : `🪣 Node ${nodeId}`;
            this.ctx.fillText(labelText, x + this.CELL_SIZE / 2, y - 8);
        }
    }
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    const game = new KubeTetris();
    game.draw();
    
    // Ensure mobile controls are set up after a brief delay
    setTimeout(() => {
        console.log('Re-setting up mobile controls...');
        if (game.setupMobileControls) {
            game.setupMobileControls();
        }
    }, 100);
});

// Global function for easy cache clearing from browser console
window.clearGameCache = function() {
    if (window.game && typeof window.game.forceClearCache === 'function') {
        window.game.forceClearCache();
    } else {
        console.log('Clearing caches manually...');
        
        // Clear localStorage except high scores
        const highScores = localStorage.getItem('kubetetris_highscores');
        localStorage.clear();
        if (highScores) {
            localStorage.setItem('kubetetris_highscores', highScores);
        }
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear browser caches
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                    caches.delete(cacheName);
                });
            });
        }
        
        console.log('Cache cleared! Please refresh the page manually.');
    }
};

console.log('💡 Tip: Type clearGameCache() in console to force clear all caches');
