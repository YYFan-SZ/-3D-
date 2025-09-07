// 3D贪吃蛇游戏
class Snake3DGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.snake = [];
        this.food = null;
        this.direction = { x: 1, y: 0, z: 0 };
        this.nextDirection = { x: 1, y: 0, z: 0 };
        this.inputQueue = [];
        this.score = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        this.gameSpeed = 450; // 更灵敏的控制但不至于太快
        this.gridSize = 20;
        this.boardSize = 12; // 保持更大的游戏区域
        this.headLight = null;
        
        // 相机模式与参数
        this.cameraMode = 'free'; // 'free' | 'top' | 'follow'
        this.followOffset = { back: this.gridSize * 6, up: this.gridSize * 3 };
        this.topViewHeight = this.boardSize * this.gridSize * 1.2;
        
        // 材质
        this.snakeMaterial = null;
        this.foodMaterial = null;
        this.boardMaterial = null;
        
        this.init();
    }
    
    init() {
        this.setupScene();
        this.setupLighting();
        this.createBoard();
        this.createSnake();
        this.createFood();
        this.setupControls();
        this.setupUI();
        this.animate();
        
        // 隐藏加载界面
        document.getElementById('loading').style.display = 'none';
    }
    
    setupScene() {
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f1324);
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );
        // 根据棋盘尺寸设置等距视角
        const size = this.boardSize * this.gridSize;
        this.camera.position.set(size * 0.7, size * 0.9, size * 0.7);
        this.camera.lookAt(0, 0, 0);
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 轨道控制器
        if (THREE.OrbitControls) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.enablePan = false;
            this.controls.minDistance = size * 0.6;
            this.controls.maxDistance = size * 1.4;
            this.controls.minPolarAngle = Math.PI / 4;
            this.controls.maxPolarAngle = Math.PI / 2.05;
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        
        // 添加到DOM
        const canvas = this.renderer.domElement;
        canvas.id = 'gameCanvas';
        document.getElementById('gameContainer').appendChild(canvas);
        
        // 响应式设计
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    setupLighting() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);
        
        // 天空光（让场景更自然）
        const hemiLight = new THREE.HemisphereLight(0x88ccee, 0x223344, 0.5);
        this.scene.add(hemiLight);
        
        // 方向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(80, 120, 60);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);
        
        // 主舞台点光源（柔和氛围）
        const pointLight = new THREE.PointLight(0x66ffcc, 0.3, 400);
        pointLight.position.set(0, 60, 0);
        this.scene.add(pointLight);
    }
    
    createBoard() {
        // 创建游戏板
        const boardGeometry = new THREE.PlaneGeometry(
            this.boardSize * this.gridSize,
            this.boardSize * this.gridSize
        );
        this.boardMaterial = new THREE.MeshLambertMaterial({
            color: 0x0c1a2a,
            transparent: true,
            opacity: 0.95
        });
        const board = new THREE.Mesh(boardGeometry, this.boardMaterial);
        board.rotation.x = -Math.PI / 2;
        board.receiveShadow = true;
        this.scene.add(board);
        
        // 创建网格线（更亮更清晰）
        const gridHelper = new THREE.GridHelper(
            this.boardSize * this.gridSize,
            this.boardSize,
            0x2bd9a8,
            0x2bd9a8
        );
        gridHelper.position.y = 0.1; // 避免与地面z-fighting
        this.scene.add(gridHelper);
        
        // 创建边界
        this.createBoundaries();
    }
    
    createBoundaries() {
        const boundaryMaterial = new THREE.MeshLambertMaterial({ color: 0xff4757 });
        const boundaryGeometry = new THREE.BoxGeometry(2, 20, 2);
        
        const size = this.boardSize * this.gridSize / 2 + 10;
        const positions = [
            [size, 10, 0], [-size, 10, 0],
            [0, 10, size], [0, 10, -size]
        ];
        
        positions.forEach(pos => {
            const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
            boundary.position.set(...pos);
            boundary.castShadow = true;
            this.scene.add(boundary);
        });
    }
    
    createSnake() {
        this.snake = [];
        
        // 蛇头
        const headGeometry = new THREE.SphereGeometry(5, 20, 20);
        this.snakeMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff88,
            shininess: 100,
            specular: 0x222222,
            emissive: 0x004422,
            emissiveIntensity: 0.4
        });
        
        const head = new THREE.Mesh(headGeometry, this.snakeMaterial);
        head.position.set(-40, 10, 0);
        head.castShadow = true;
        // 给蛇头加一盏跟随灯光，突出显示蛇头
        this.headLight = new THREE.PointLight(0x00ff88, 0.7, 180);
        head.add(this.headLight);
        this.scene.add(head);
        this.snake.push(head);
        
        // 初始蛇身（更容易看到蛇身）
        const bodyColors = [0x00e6a8, 0x00cc88, 0x00b377];
        for (let i = 1; i <= 3; i++) {
            const segment = new THREE.Mesh(
                new THREE.BoxGeometry(10, 10, 10),
                new THREE.MeshPhongMaterial({ color: bodyColors[i - 1], shininess: 60, emissive: 0x002815, emissiveIntensity: 0.3 })
            );
            segment.position.set(head.position.x - i * this.gridSize, 10, head.position.z);
            segment.castShadow = true;
            this.addOutline(segment, 0x99ffee);
            this.scene.add(segment);
            this.snake.push(segment);
        }
    }
    
    createFood() {
        if (this.food) {
            this.scene.remove(this.food);
        }
        
        const foodGeometry = new THREE.OctahedronGeometry(4);
        this.foodMaterial = new THREE.MeshPhongMaterial({
            color: 0xff7070,
            shininess: 120,
            emissive: 0x330000,
            emissiveIntensity: 0.6
        });
        
        this.food = new THREE.Mesh(foodGeometry, this.foodMaterial);
        this.placeFood();
        this.food.castShadow = true;
        
        // 给食物加轮廓和发光点光源，提升可见性
        this.addOutline(this.food, 0xffaaaa);
        const foodLight = new THREE.PointLight(0xff5555, 0.7, 140);
        this.food.add(foodLight);
        
        this.scene.add(this.food);
        
        // 食物旋转动画
        this.animateFood();
    }
    
    placeFood() {
        let validPosition = false;
        let x, z;
        
        while (!validPosition) {
            x = (Math.floor(Math.random() * this.boardSize) - this.boardSize / 2) * this.gridSize;
            z = (Math.floor(Math.random() * this.boardSize) - this.boardSize / 2) * this.gridSize;
            
            validPosition = !this.snake.some(segment => 
                Math.abs(segment.position.x - x) < this.gridSize / 2 &&
                Math.abs(segment.position.z - z) < this.gridSize / 2
            );
        }
        
        this.food.position.set(x, 10, z);
    }
    
    animateFood() {
        if (this.food) {
            this.food.rotation.y += 0.02;
            this.food.position.y = 10 + Math.sin(Date.now() * 0.005) * 2;
        }
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            // 允许空格随时暂停/继续
            if (event.code === 'Space') {
                this.togglePause();
                event.preventDefault();
                return;
            }
            if (!this.gameRunning) return;
            
            const isOpposite = (a, b) => (a.x + b.x === 0 && a.z + b.z === 0);
            let desired = null;
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    desired = { x: 0, y: 0, z: -1 }; break;
                case 'ArrowDown':
                case 'KeyS':
                    desired = { x: 0, y: 0, z: 1 }; break;
                case 'ArrowLeft':
                case 'KeyA':
                    desired = { x: -1, y: 0, z: 0 }; break;
                case 'ArrowRight':
                case 'KeyD':
                    desired = { x: 1, y: 0, z: 0 }; break;
            }
            if (desired) {
                const lastDir = this.inputQueue.length ? this.inputQueue[this.inputQueue.length - 1] : this.direction;
                if (!isOpposite(desired, lastDir)) {
                    this.inputQueue.push(desired);
                }
                event.preventDefault();
            }
        });
    }
    
    setupUI() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.resetGame();
            document.getElementById('gameOver').style.display = 'none';
        });
        
        // 视角按钮
        const topBtn = document.getElementById('topViewBtn');
        const followBtn = document.getElementById('followViewBtn');
        const freeBtn = document.getElementById('freeViewBtn');
        if (topBtn) topBtn.addEventListener('click', () => this.setTopView());
        if (followBtn) followBtn.addEventListener('click', () => this.setFollowView());
        if (freeBtn) freeBtn.addEventListener('click', () => this.setFreeView());
        
        // 教程按钮
        const tutorialBtn = document.getElementById('tutorialBtn');
        const closeTutorialBtn = document.getElementById('closeTutorialBtn');
        if (tutorialBtn) tutorialBtn.addEventListener('click', () => this.openTutorial());
        if (closeTutorialBtn) closeTutorialBtn.addEventListener('click', () => this.closeTutorial());
    }
    
    startGame() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.gamePaused = false;
            // 添加初始延迟，让玩家准备
            setTimeout(() => {
                if (this.gameRunning) {
                    this.gameLoop();
                }
            }, 1000);
        }
    }
    
    togglePause() {
        if (this.gameRunning) {
            this.gamePaused = !this.gamePaused;
            if (!this.gamePaused) {
                this.gameLoop();
            }
        }
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.direction = { x: 1, y: 0, z: 0 };
        this.nextDirection = { x: 1, y: 0, z: 0 };
        
        // 清除蛇身
        this.snake.forEach(segment => this.scene.remove(segment));
        this.createSnake();
        this.createFood();
        this.updateUI();
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        // 优先使用输入队列中的方向，增强灵敏度
        if (this.inputQueue.length) {
            this.direction = this.inputQueue.shift();
        }
        this.moveSnake();
        
        if (this.checkCollision()) {
            this.gameOver();
            return;
        }
        
        if (this.checkFoodCollision()) {
            this.eatFood();
        }
        
        this.updateUI();
        setTimeout(() => this.gameLoop(), this.gameSpeed);
    }
    
    moveSnake() {
        const head = this.snake[0];
        const newX = head.position.x + this.direction.x * this.gridSize;
        const newZ = head.position.z + this.direction.z * this.gridSize;
        
        // 移动蛇身
        for (let i = this.snake.length - 1; i > 0; i--) {
            this.snake[i].position.copy(this.snake[i - 1].position);
        }
        
        head.position.x = newX;
        head.position.z = newZ;
    }
    
    checkCollision() {
        const head = this.snake[0];
        const maxPos = (this.boardSize / 2 - 0.5) * this.gridSize;
        
        // 调试输出
        console.log('Head position:', head.position.x, head.position.z, 'MaxPos:', maxPos);
        
        // 检查边界碰撞 - 修复边界检测逻辑
        if (Math.abs(head.position.x) > maxPos || Math.abs(head.position.z) > maxPos) {
            console.log('边界碰撞!');
            return true;
        }
        
        // 检查自身碰撞
        for (let i = 1; i < this.snake.length; i++) {
            if (Math.abs(head.position.x - this.snake[i].position.x) < this.gridSize / 2 &&
                Math.abs(head.position.z - this.snake[i].position.z) < this.gridSize / 2) {
                console.log('自身碰撞!');
                return true;
            }
        }
        
        return false;
    }
    
    checkFoodCollision() {
        const head = this.snake[0];
        return Math.abs(head.position.x - this.food.position.x) < this.gridSize / 2 &&
               Math.abs(head.position.z - this.food.position.z) < this.gridSize / 2;
    }
    
    eatFood() {
        this.score += 10;
        
        // 添加新的蛇身段 - 可见性更好
        const tailGeometry = new THREE.BoxGeometry(10, 10, 10);
        const tailMaterial = new THREE.MeshPhongMaterial({
            color: 0x00cc88,
            shininess: 60,
            emissive: 0x002815,
            emissiveIntensity: 0.3
        });
        
        const newSegment = new THREE.Mesh(tailGeometry, tailMaterial);
        const lastSegment = this.snake[this.snake.length - 1];
        newSegment.position.copy(lastSegment.position);
        newSegment.castShadow = true;
        this.addOutline(newSegment, 0x99ffee);
        
        this.scene.add(newSegment);
        this.snake.push(newSegment);
        
        // 生成新食物
        this.createFood();
        
        // 增加游戏速度 - 保持合理难度
        if (this.gameSpeed > 250) {
            this.gameSpeed -= 15;
        }
    }
    
    gameOver() {
        this.gameRunning = false;
        document.getElementById('finalScore').textContent = `最终分数: ${this.score}`;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    updateUI() {
        document.getElementById('score').textContent = `分数: ${this.score}`;
        document.getElementById('length').textContent = `长度: ${this.snake.length}`;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.animateFood();
        
        // 相机模式更新
        if (this.cameraMode === 'follow') {
            const head = this.snake[0];
            if (head) {
                const dir = new THREE.Vector3(this.direction.x, 0, this.direction.z);
                if (dir.lengthSq() === 0) dir.set(1, 0, 0);
                dir.normalize();
                const back = dir.clone().multiplyScalar(-this.followOffset.back);
                const up = new THREE.Vector3(0, this.followOffset.up, 0);
                const desiredPos = head.position.clone().add(back).add(up);
                // 平滑跟随
                this.camera.position.lerp(desiredPos, 0.18);
                this.camera.lookAt(head.position);
            }
        } else if (this.cameraMode === 'top') {
            const desiredPos = new THREE.Vector3(0, this.topViewHeight, 0);
            this.camera.position.lerp(desiredPos, 0.1);
            this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        } else {
            // 自由视角使用轨道控制器
            if (this.controls) this.controls.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // 视角切换
    setTopView() {
        this.cameraMode = 'top';
        if (this.controls) this.controls.enabled = false;
        // 立即设置一次位置，避免首次切换抖动
        this.camera.position.set(0, this.topViewHeight, 0);
        this.camera.lookAt(0, 0, 0);
    }
    
    setFollowView() {
        this.cameraMode = 'follow';
        if (this.controls) this.controls.enabled = false;
        const head = this.snake[0];
        if (head) {
            const dir = new THREE.Vector3(this.direction.x, 0, this.direction.z);
            if (dir.lengthSq() === 0) dir.set(1, 0, 0);
            dir.normalize();
            const back = dir.clone().multiplyScalar(-this.followOffset.back);
            const up = new THREE.Vector3(0, this.followOffset.up, 0);
            const desiredPos = head.position.clone().add(back).add(up);
            this.camera.position.copy(desiredPos);
            this.camera.lookAt(head.position);
        }
    }
    
    setFreeView() {
        this.cameraMode = 'free';
        if (this.controls) {
            this.controls.enabled = true;
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }
    
    // 教程模态框
    openTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (modal) modal.style.display = 'block';
    }
    
    closeTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (modal) modal.style.display = 'none';
    }
    
    // 为网格体添加高对比轮廓线，提升可见性
    addOutline(mesh, color = 0xffffff) {
        const geo = new THREE.EdgesGeometry(mesh.geometry, 1);
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 });
        const outline = new THREE.LineSegments(geo, mat);
        outline.position.set(0, 0, 0);
        mesh.add(outline);
        return outline;
    }
}

// 启动游戏
window.addEventListener('load', () => {
    new Snake3DGame();
});