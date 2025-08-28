// Kube Tetris Game Logic
class KubeTetris {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load bucket image
        this.bucketImage = new Image();
        this.bucketImage.src = 'assets/bucket.svg';
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
        
        // Landing animation properties
        this.landingAnimations = [];
        this.landingEffects = [];
        this.bucketShakeAnimations = [];
        
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
        // Load pod images
        const podTypes = this.getPodTypes();
        for (const [key, pod] of Object.entries(podTypes)) {
            if (pod.image) {
                const img = new Image();
                img.src = pod.image;
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
                img.src = resource.image;
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
            this.board[this.BOARD_HEIGHT - 1][x] = {
                type: 'node',
                nodeId: x,
                resources: { 
                    totalCpu: 64, 
                    totalRam: 128,
                    totalSsd: 500,
                    totalGpu: 16,
                    usedCpu: 0, 
                    usedRam: 0,
                    usedSsd: 0,
                    usedGpu: 0
                },
                specialization: this.getNodeSpecialization(x),
                pods: [],
                filled: false
            };
        }
    }
    
    initializeNodes() {
        this.nodes = [];
        for (let i = 0; i < this.BOARD_WIDTH; i++) {
            const nodeData = {
                id: i,
                name: `node-${i}`,
                resources: { 
                    totalCpu: 64, 
                    totalRam: 128,
                    totalSsd: 500,
                    totalGpu: 16,
                    usedCpu: 0, 
                    usedRam: 0,
                    usedSsd: 0,
                    usedGpu: 0
                },
                specialization: this.getNodeSpecialization(i),
                pods: []
            };
            this.nodes.push(nodeData);
            
            // Sync with board - copy all resources
            if (this.board[this.BOARD_HEIGHT - 1][i]) {
                this.board[this.BOARD_HEIGHT - 1][i].specialization = nodeData.specialization;
                this.board[this.BOARD_HEIGHT - 1][i].resources = { ...nodeData.resources };
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
                resources: { cpu: 1, ram: 4, ssd: 10, gpu: 0 },
                dependencies: ['backend'],
                preferredNode: 'EDGE', // Prefers edge nodes for low latency
                image: './assets/pod-frontend.svg'
            },
            backend: {
                symbol: 'B', 
                color: '#3498db',
                resources: { cpu: 2, ram: 8, ssd: 20, gpu: 0 },
                dependencies: ['database', 'cache'],
                preferredNode: 'CPU', // Prefers CPU-optimized nodes
                image: './assets/pod-backend.svg'
            },
            database: {
                symbol: 'D',
                color: '#27ae60',
                resources: { cpu: 3, ram: 12, ssd: 50, gpu: 0 },
                dependencies: [],
                preferredNode: 'SSD', // Prefers SSD storage nodes
                image: './assets/pod-db.svg'
            },
            cache: {
                symbol: 'C',
                color: '#f39c12',
                resources: { cpu: 1, ram: 16, ssd: 5, gpu: 0 },
                dependencies: [],
                preferredNode: 'RAM', // Prefers memory-optimized nodes
                image: './assets/pod-cache.svg'
            },
            monitor: {
                symbol: 'M',
                color: '#9b59b6',
                resources: { cpu: 1, ram: 2, ssd: 8, gpu: 0 },
                dependencies: [],
                preferredNode: 'NET', // Prefers network-optimized nodes
                image: './assets/pod-monitor.svg'
            },
            mltask: {
                symbol: 'ML',
                color: '#ff6b6b',
                resources: { cpu: 4, ram: 16, ssd: 30, gpu: 2 },
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
                capacity: { ram: 32 },
                description: 'RAM Upgrade',
                image: './assets/resource-ram.svg'
            },
            cpu: {
                symbol: 'CP',
                color: '#45b7d1',
                capacity: { cpu: 16 },
                description: 'CPU Upgrade',
                image: './assets/resource-cpu.svg'
            },
            ssd: {
                symbol: 'S',
                color: '#34495e',
                capacity: { ssd: 200 },
                description: 'SSD Storage',
                image: './assets/resource-ssd.svg'
            },
            gpu: {
                symbol: 'G',
                color: '#feca57',
                capacity: { gpu: 8 },
                description: 'GPU Unit',
                image: './assets/resource-gpu.svg'
            }
        };
    }
    
    createRandomDrop() {
        // 70% chance of pod, 30% chance of resource
        const isPod = Math.random() < 0.7;
        
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
        
        // Single pod only (no tetromino shapes)
        return {
            type: type,
            dropType: 'pod',
            symbol: podType.symbol,
            color: podType.color,
            resources: { ...podType.resources }, // Copy resources
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
        
        return {
            type: type,
            dropType: 'resource',
            symbol: resourceType.symbol,
            color: resourceType.color,
            capacity: { ...resourceType.capacity }, // Copy capacity increases
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
        if (!this.gameRunning) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.dropCounter += deltaTime;
        // Set constant drop time (no speed increase)
        const dropTime = 1000; // Always 1 second
        
        // Handle instant drop animation
        if (this.isInstantDropping) {
            this.animationOffset += this.instantDropSpeed;
            const currentY = this.dropStartY + this.animationOffset;
            
            if (currentY >= this.targetDropY) {
                // Animation complete, trigger bucket collision animation
                this.checkBucketCollisionAndAnimate(this.currentPod.x, this.targetDropY);
                
                // Place the pod
                this.currentPod.y = this.targetDropY;
                this.placePod();
                this.isInstantDropping = false;
                this.animationOffset = 0;
            }
        } else {
            // Normal smooth animation interpolation
            this.animationOffset = Math.min(this.dropCounter / dropTime, 1.0);
            
            if (this.dropCounter > dropTime) {
                this.movePod(0, 1);
                this.dropCounter = 0;
                this.animationOffset = 0;
            }
        }
        
        // Update landing animations
        this.updateLandingAnimations();
        
        this.draw();
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
                        this.gameOver(`Node ${x} ran out of resources! No space for ${this.currentPod.type} pod.`);
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
        
        console.log(`Applied ${resource.description} to Node ${node.nodeId}`);
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
        // Update landing animations
        this.landingAnimations = this.landingAnimations.filter(anim => {
            anim.currentFrame++;
            anim.scale *= anim.scaleDecay;
            anim.alpha *= anim.alphaDecay;
            return anim.currentFrame < anim.duration && anim.alpha > 0.1;
        });
        
        // Update particle effects
        this.landingEffects = this.landingEffects.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3; // gravity
            particle.life--;
            return particle.life > 0;
        });
        
        // Update bucket shake animations
        this.bucketShakeAnimations = this.bucketShakeAnimations.filter(shake => {
            shake.currentFrame++;
            shake.shakeIntensity *= shake.shakeDecay;
            return shake.currentFrame < shake.duration && shake.shakeIntensity > 0.1;
        });
    }
    
    drawLandingAnimations() {
        // Draw landing bounce effects
        this.landingAnimations.forEach(anim => {
            this.ctx.save();
            this.ctx.globalAlpha = anim.alpha;
            this.ctx.translate(anim.x + this.CELL_SIZE / 2, anim.y + this.CELL_SIZE / 2);
            this.ctx.scale(anim.scale, anim.scale);
            
            // Draw glowing circle effect (different colors for perfect matches)
            const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.CELL_SIZE / 2);
            if (anim.isPerfectMatch) {
                gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
                gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.5)');
                gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
            } else {
                gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
                gradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
            }
            
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
            const status = Math.max(cpuPercent, memPercent) > 80 ? '🔴' : 
                          Math.max(cpuPercent, memPercent) > 60 ? '🟡' : '🟢';
            
            nodeStatus += `
                <div class="constraint-item">
                    ${status} Node ${index}: ${cpuPercent}% CPU, ${memPercent}% RAM
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
        // Cyberpunk grid with neon glow
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 5;
        
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
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
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
        this.ctx.fillStyle = '#ffffff';
        const baseFontSize = isMobile ? Math.max(8, this.CELL_SIZE / 8) : Math.max(10, this.CELL_SIZE / 8);
        this.ctx.font = `bold ${baseFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = isMobile ? 2 : 1;
        
        const lineHeight = baseFontSize + 2;
        let currentY = cellY + (isMobile ? 8 : 16);
        
        // CPU info with outline for better visibility
        const cpuText = `C:${node.resources.usedCpu}/${node.resources.totalCpu}`;
        this.ctx.strokeText(cpuText, cellX + this.CELL_SIZE / 2, currentY);
        this.ctx.fillText(cpuText, cellX + this.CELL_SIZE / 2, currentY);
        currentY += lineHeight;
        
        // Memory info with outline - now showing RAM
        const ramDisplayText = `R:${node.resources.usedRam}/${node.resources.totalRam}`;
        this.ctx.strokeText(ramDisplayText, cellX + this.CELL_SIZE / 2, currentY);
        this.ctx.fillText(ramDisplayText, cellX + this.CELL_SIZE / 2, currentY);
        currentY += lineHeight;
        
        // Only show SSD and GPU on larger screens or larger cells
        if (!isMobile || this.CELL_SIZE > 60) {
            // SSD info
            const ssdText = `S:${node.resources.usedSsd}/${node.resources.totalSsd}`;
            this.ctx.strokeText(ssdText, cellX + this.CELL_SIZE / 2, currentY);
            this.ctx.fillText(ssdText, cellX + this.CELL_SIZE / 2, currentY);
            currentY += lineHeight;
            
            // GPU info
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
        // Cyberpunk bucket drawing with neon effects
        const bucketWidth = this.CELL_SIZE - 8;
        const bucketHeight = this.CELL_SIZE - 8;
        const rimHeight = 8;
        
        // Neon glow effect
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.shadowBlur = 20;
        
        // Bucket body (trapezoid shape) - dark cyberpunk base
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.beginPath();
        this.ctx.moveTo(cellX + 8, cellY + 4); // Top left
        this.ctx.lineTo(cellX + bucketWidth, cellY + 4); // Top right
        this.ctx.lineTo(cellX + bucketWidth - 6, cellY + bucketHeight); // Bottom right
        this.ctx.lineTo(cellX + 14, cellY + bucketHeight); // Bottom left
        this.ctx.closePath();
        this.ctx.fill();
        
        // Cyberpunk rim with gradient
        const gradient = this.ctx.createLinearGradient(cellX, cellY, cellX, cellY + rimHeight);
        gradient.addColorStop(0, '#00FFFF');
        gradient.addColorStop(1, '#FF00FF');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(cellX + 6, cellY + 4, bucketWidth + 4, rimHeight);
        
        // Neon outline - bright cyan
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(cellX + 8, cellY + 4);
        this.ctx.lineTo(cellX + bucketWidth, cellY + 4);
        this.ctx.lineTo(cellX + bucketWidth - 6, cellY + bucketHeight);
        this.ctx.lineTo(cellX + 14, cellY + bucketHeight);
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Rim outline
        this.ctx.strokeRect(cellX + 6, cellY + 4, bucketWidth + 4, rimHeight);
        
        // Resource fill level
        const totalResources = node.resources.totalCpu + node.resources.totalRam;
        const usedResources = node.resources.usedCpu + node.resources.usedRam;
        const fillPercent = usedResources / totalResources;
        
        if (fillPercent > 0) {
            const fillHeight = (bucketHeight - rimHeight - 4) * fillPercent;
            const fillY = cellY + bucketHeight - fillHeight;
            
            this.ctx.fillStyle = fillPercent > 0.8 ? 'rgba(231, 76, 60, 0.7)' : 
                                fillPercent > 0.6 ? 'rgba(243, 156, 18, 0.7)' : 'rgba(39, 174, 96, 0.7)';
            
            // Draw trapezoid fill
            this.ctx.beginPath();
            this.ctx.moveTo(cellX + 16, fillY);
            this.ctx.lineTo(cellX + bucketWidth - 8, fillY);
            this.ctx.lineTo(cellX + bucketWidth - 14, cellY + bucketHeight - 2);
            this.ctx.lineTo(cellX + 16, cellY + bucketHeight - 2);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Handle icons for bucket
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillRect(cellX + 4, cellY + 6, 4, 6);
        this.ctx.fillRect(cellX + bucketWidth + 4, cellY + 6, 4, 6);
    }
    
    drawPlacedPod(x, y, pod) {
        const cellX = x * this.CELL_SIZE;
        const cellY = y * this.CELL_SIZE;
        
        // Pod background
        this.ctx.fillStyle = pod.color;
        this.ctx.fillRect(cellX + 6, cellY + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
        
        // Pod border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cellX + 6, cellY + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
        
        // Pod symbol
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 28px Roboto Mono';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(pod.symbol, cellX + this.CELL_SIZE / 2, cellY + this.CELL_SIZE / 2);
        
        // Calculate responsive font size for resource info
        const fontSize = Math.max(8, this.CELL_SIZE / 12);
        
        // Pod resource info with better stroke for visibility
        this.ctx.fillStyle = '#ffffff';
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
        
        // Check if we have an image for this pod type
        const podImage = this.images[`pod_${pod.type}`];
        
        if (podImage && this.assetsLoaded) {
            // Draw the pod image
            const padding = isMobile ? 6 : 10;
            const imageSize = this.CELL_SIZE - (padding * 2);
            this.ctx.drawImage(podImage, x + padding, y + padding, imageSize, imageSize);
            
            // Add a subtle border
            this.ctx.strokeStyle = pod.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x + padding, y + padding, imageSize, imageSize);
        } else {
            // Fallback to original drawing code
            // Pod background with cyberpunk gradient
            const gradient = this.ctx.createRadialGradient(
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, 0,
                x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2, this.CELL_SIZE / 2
            );
            gradient.addColorStop(0, pod.color);
            gradient.addColorStop(1, '#000000');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x + 6, y + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            
            // Neon border with animation effect
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x + 6, y + 6, this.CELL_SIZE - 12, this.CELL_SIZE - 12);
            
            // Inner glow border
            this.ctx.strokeStyle = pod.color;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 8, y + 8, this.CELL_SIZE - 16, this.CELL_SIZE - 16);
            
            // Pod symbol with glow - mobile responsive size
            this.ctx.fillStyle = '#FFFFFF';
            const symbolSize = isMobile ? Math.max(20, this.CELL_SIZE / 2.5) : Math.max(20, this.CELL_SIZE / 3);
            this.ctx.font = `bold ${symbolSize}px Roboto Mono`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeStyle = pod.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(pod.symbol, x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
            this.ctx.fillText(pod.symbol, x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
        }
        
        // Reset shadow for text
        this.ctx.shadowBlur = 0;
        
        // Calculate responsive font sizes - much larger for mobile
        const fontSize = isMobile ? Math.max(10, this.CELL_SIZE / 8) : Math.max(8, this.CELL_SIZE / 10);
        const labelFontSize = isMobile ? Math.max(12, this.CELL_SIZE / 6) : Math.max(10, this.CELL_SIZE / 8);
        
        // Pod resource info (always show for both image and fallback)
        this.ctx.fillStyle = '#ffffff';
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
            
            this.ctx.strokeText(cpuText, x + 2, textY);
            this.ctx.fillText(cpuText, x + 2, textY);
            
            textY += lineHeight;
            this.ctx.strokeText(ramText, x + 2, textY);
            this.ctx.fillText(ramText, x + 2, textY);
            
            // Show GPU and SSD on third line if there's space
            if (this.CELL_SIZE > 50 && (pod.resources.gpu > 0 || pod.resources.ssd > 0)) {
                textY += lineHeight;
                if (pod.resources.gpu > 0) {
                    this.ctx.strokeText(gpuText, x + 2, textY);
                    this.ctx.fillText(gpuText, x + 2, textY);
                }
                if (pod.resources.ssd > 0) {
                    const ssdX = pod.resources.gpu > 0 ? x + 2 + fontSize * 3 : x + 2;
                    this.ctx.strokeText(ssdText, ssdX, textY);
                    this.ctx.fillText(ssdText, ssdX, textY);
                }
            }
        } else {
            // Desktop: Keep horizontal layout
            let textY = y + 6;
            const textSpacing = 30;
            
            this.ctx.strokeText(cpuText, x + 4, textY);
            this.ctx.fillText(cpuText, x + 4, textY);
            
            this.ctx.strokeText(ramText, x + 4 + textSpacing, textY);
            this.ctx.fillText(ramText, x + 4 + textSpacing, textY);
            
            // Only show GPU if it's greater than 0 and we have space
            if (pod.resources.gpu > 0) {
                this.ctx.strokeText(gpuText, x + 4 + textSpacing * 2, textY);
                this.ctx.fillText(gpuText, x + 4 + textSpacing * 2, textY);
            }
        }
        
        // Pod type label - always show but with better mobile formatting
        this.ctx.fillStyle = '#ffffff';
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
        
        // Check if we have an image for this resource type
        const resourceImage = this.images[`resource_${resource.type}`];
        
        if (resourceImage && this.assetsLoaded) {
            // Draw the resource image
            const padding = 5;
            const imageSize = this.CELL_SIZE - (padding * 2);
            this.ctx.drawImage(resourceImage, x + padding, y + padding, imageSize, imageSize);
            
            // Add a subtle border
            this.ctx.strokeStyle = resource.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x + padding, y + padding, imageSize, imageSize);
        } else {
            // Fallback to original diamond shape
            this.ctx.fillStyle = resource.color;
            this.ctx.beginPath();
            this.ctx.moveTo(x + this.CELL_SIZE / 2, y + 10);
            this.ctx.lineTo(x + this.CELL_SIZE - 10, y + this.CELL_SIZE / 2);
            this.ctx.lineTo(x + this.CELL_SIZE / 2, y + this.CELL_SIZE - 10);
            this.ctx.lineTo(x + 10, y + this.CELL_SIZE / 2);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Diamond border
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Resource symbol - larger on mobile
            this.ctx.fillStyle = '#000000';
            const symbolSize = isMobile ? Math.max(14, this.CELL_SIZE / 4) : 16;
            this.ctx.font = `bold ${symbolSize}px Roboto Mono`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(resource.symbol, x + this.CELL_SIZE / 2, y + this.CELL_SIZE / 2);
        }
        
        // Reset shadow for text
        this.ctx.shadowBlur = 0;
        
        // Calculate responsive font size - larger for mobile
        const labelFontSize = isMobile ? Math.max(10, this.CELL_SIZE / 6) : Math.max(12, this.CELL_SIZE / 8);
        
        // Resource description with better text stroke for visibility
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${labelFontSize}px Roboto Mono`;
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3; // Thicker stroke for better readability
        
        const labelY = y + this.CELL_SIZE - (isMobile ? 8 : 10);
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
