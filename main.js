// === 3D PONG GAME LOGIC ===

// Kontekst za 3D renderovanje
const glCanvas = document.getElementById("glCanvas");
const gl = glCanvas.getContext("webgl"); // 

// WebGL1 kontekst
if (!gl) {
    alert("WebGL nije podržan."); // 
} else {
    // Ako želite da canvas zauzima ceo prozor
    glCanvas.width = window.innerWidth; // 
    glCanvas.height = window.innerHeight; // 
    gl.viewport(0, 0, glCanvas.width, gl.canvas.height); // 
}

// Kontekst za 2D HUD (scoreboard i Game Over)
const hudCanvas = document.getElementById("hudCanvas");
const hudCtx = hudCanvas.getContext("2d"); // 
// Ako želite da canvas zauzima ceo prozor
hudCanvas.width = window.innerWidth;
hudCanvas.height = window.innerHeight;

// --- Ugrađeni šejderi (Vertex i Fragment) ---
const vsSource = `
attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform vec3 u_lightDirection;

varying vec3 v_normal;
varying vec3 v_surfaceToLight;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_normal = mat3(u_model) * a_normal;
    v_surfaceToLight = u_lightDirection;
}
`; // 

const fsSource = `
precision mediump float;

varying vec3 v_normal;
varying vec3 v_surfaceToLight;

uniform vec4 u_color;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
    float light = dot(normal, surfaceToLightDirection);
    gl_FragColor = u_color * (light * 0.7 + 0.3); // Osvetljenje
}
`; // 

// Funkcije za kompajliranje i povezivanje šejdera
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader); // 
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader); // 
        return null;
    }
    return shader;
} // 

function createProgram(gl, vsSource, fsSource) {
    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER); // 

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { // 
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null; // 
    }
    return program;
}

const shaderProgram = createProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: {
        position: gl.getAttribLocation(shaderProgram, 'a_position'),
        normal: gl.getAttribLocation(shaderProgram, 'a_normal'),
    },
    uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'u_projection'),
        modelMatrix: gl.getUniformLocation(shaderProgram, 'u_model'),
        viewMatrix: gl.getUniformLocation(shaderProgram, 'u_view'),
        color: gl.getUniformLocation(shaderProgram, 'u_color'),
        lightDirection: gl.getUniformLocation(shaderProgram, 'u_lightDirection'),
    },
}; // 

// --- Matrične operacije (jednostavna implementacija) ---
function createIdentityMatrix() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
} // 

function multiplyMatrices(m1, m2) {
    const result = new Array(16).fill(0); // 
    for (let i = 0; i < 4; i++) { // 
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                result[i * 4 + j] += m1[i * 4 + k] * m2[k * 4 + j]; // 
            }
        }
    }
    return result;
}

function translateMatrix(matrix, x, y, z) {
    const translationMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ];
    return multiplyMatrices(matrix, translationMatrix); // 
} // 

function scaleMatrix(matrix, sx, sy, sz) {
    const scaleMatrix = [
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1
    ];
    return multiplyMatrices(matrix, scaleMatrix); // 
}

function perspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2); // 
    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) / (near - far), -1,
        0, 0, (2 * near * far) / (near - far), 0
    ];
} // 

// --- Generisanje geometrijskih oblika ---
function createSphere(gl, radius, slices, stacks) {
    const positions = []; // 
    const normals = []; // 
    const indices = [];

    for (let i = 0; i <= stacks; i++) {
        const phi = Math.PI * i / stacks;
        for (let j = 0; j <= slices; j++) { // 
            const theta = 2 * Math.PI * j / slices;
            const x = radius * Math.sin(phi) * Math.cos(theta); // 
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi); // 

            positions.push(x, y, z);
            normals.push(x, y, z);
            if (i < stacks && j < slices) { // 
                const first = (i * (slices + 1)) + j;
                const second = first + slices + 1; // 

                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
    }

    const positionBuffer = gl.createBuffer(); // 
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // 
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); // 
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        normal: normalBuffer,
        indices: indexBuffer,
        vertexCount: indices.length,
        radius: radius
    };
} // 

function createCube(gl, width, height, depth) {
    const vertices = [
        // Front face
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Back face
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
        // Top face
        -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
       // Bottom face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
        // Right face
        0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
        // Left face
        -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    ]; // 
    const scaledVertices = vertices.map((val, i) => {
        if (i % 3 === 0) return val * width;
        if (i % 3 === 1) return val * height;
        if (i % 3 === 2) return val * depth;
        return val;
    }); // 
    const normals = [
        // Front
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
        // Back
        0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
        // Top
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
        // Bottom
        0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
        // Right
        1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
        // Left
        -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    ]; // 
    const indices = [
        0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ]; // 
    const positionBuffer = gl.createBuffer(); // 
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scaledVertices), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    const indexBuffer = gl.createBuffer(); // 
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    return {
        position: positionBuffer,
        normal: normalBuffer,
        indices: indexBuffer,
        vertexCount: indices.length,
        width: width,
        height: height,
        depth: depth
    }; // 
}


// --- Objekti igre ---
const sphere = createSphere(gl, 0.15, 30, 30); // Loptica
const paddleL = createCube(gl, 0.2, 0.8, 0.2); // 
const paddleR = createCube(gl, 0.2, 0.8, 0.2); // Desni reket // 
const wallTop = createCube(gl, 6, 0.2, 0.2); // 
const wallBottom = createCube(gl, 6, 0.2, 0.2); // Donji zid // 
const goalLeft = createCube(gl, 0.2, 3.5, 0.2); // 
const goalRight = createCube(gl, 0.2, 3.5, 0.2); // Desni gol // 
const field = createCube(gl, 6, 3.5, 0.05); // 
const coin = createCube(gl, 0.1, 0.1, 0.1); // Novčić // 

const obstacles = []; // 

// === Igra ===
let ball = { x: 0, y: 0, dx: 0.03, dy: 0.02 }; // 
let leftX = 0, leftY = 0; // 
let rightX = 0, rightY = 0; // 
let keys = {}; // 
let player1Score = 0, player2Score = 0; // 
let player1Coins = 0, player2Coins = 0; // 
let maxScore = 10; // 
let gameOver = false; // 
let gameMode = ''; // 
let gameDifficulty = ''; // 
let isPaused = false; // 
let playAgainstAI = false; // 
const initialBallSpeedNoob = 0.022; // 
const initialBallSpeedNormal = 0.028; // 
const initialBallSpeedFast = 0.035; // 
const initialBallSpeedHard = 0.028; // 

const speedIncreasePerHitNoob = 0.0010; // 
const speedIncreasePerHitNormal = 0.0018; // 
const speedIncreasePerHitFast = 0.0035; // 
const speedIncreasePerHitHard = 0.0020; // 

const maxBallSpeed = 0.08;

let coins = [];
let lastCoinSpawnTime = 0; // 
const coinSpawnInterval = 5000; // 

const initialLeftX = -2.5;
const initialLeftY = 0;
const initialRightX = 2.5;
const initialRightY = 0; // 

let lastObstacleSpawnTime = 0;
const obstacleSpawnInterval = 10000;
const obstacleWidth = 0.2;
const obstacleHeight = 0.8;
const obstacleDepth = 0.2; // 

function spawnRandomObstacles() {
    obstacles.length = 0; // 
    for (let i = 0; i < 2; i++) { // 
        let randomX, randomY, validPosition;
        // Ponavljaj generisanje pozicije dok se ne nađe validna (koja se ne preklapa sa reketima)
        do { // 
            // 1. Generiši nasumične koordinate za prepreku
            randomX = (Math.random() * 3.6) - 1.8; // 
            randomY = (Math.random() * 2.0) - 1.0; // 

            // 2. Postavi pretpostavku da je pozicija validna
            validPosition = true; // 
            // 3. Definiši granice (bounding box) nove prepreke
            const newObstacleBounds = {
                x: randomX - obstacleWidth / 2,
                y: randomY - obstacleHeight / 2,
                width: obstacleWidth,
                height: obstacleHeight
            }; // 
            // 4. Proveri da li se prepreka preklapa sa levim reketom
            if (checkAABBCollision(
                newObstacleBounds.x, newObstacleBounds.y, newObstacleBounds.width, newObstacleBounds.height,
                leftX - paddleL.width / 2, leftY - paddleL.height / 2, paddleL.width, paddleL.height
            )) {
                validPosition = false; // 
            } // 

            // 5. Proveri da li se prepreka preklapa sa desnim reketom (samo ako već nije nevalidna)
            if (validPosition && checkAABBCollision(
                newObstacleBounds.x, newObstacleBounds.y, newObstacleBounds.width, newObstacleBounds.height,
                rightX - paddleR.width / 2, rightY - paddleR.height / 2, paddleR.width, paddleR.height
            )) { // 
                validPosition = false; // 
            }

        } while (!validPosition); // 

        // 7. Kada se pronađe validna pozicija, kreiraj i dodaj prepreku u niz
        obstacles.push({
            obj: createCube(gl, obstacleWidth, obstacleHeight, obstacleDepth),
            bounds: {
                x: randomX - obstacleWidth / 2,
                y: randomY - obstacleHeight / 2,
                width: obstacleWidth,
                height: obstacleHeight,
                depth: obstacleDepth
            }, // 
            position: { x: randomX, y: randomY }
        });
    }
} // 

/**
 * **NOVA FUNKCIJA**
 * Generiše dva novčića na validnim pozicijama koje se ne preklapaju sa reketima.
 * Ponavlja generisanje koordinata dok ne nađe slobodno mesto.
 * @param {number} currentTime - Trenutno vreme za beleženje vremena stvaranja novčića.
 */
function spawnCoins(currentTime) {
    // Petlja za generisanje levog novčića
    let coinLeftX, randomYLeft, isLeftValid;
    do {
        isLeftValid = true;
        randomYLeft = (Math.random() * 2.0) - 1.0;
        coinLeftX = (Math.random() * 2.0) - 2.5; // Leva polovina terena

        // Provera kolizije sa levim reketom
        if (checkAABBCollision(
            coinLeftX - coin.width / 2, randomYLeft - coin.height / 2, coin.width, coin.height,
            leftX - paddleL.width / 2, leftY - paddleL.height / 2, paddleL.width, paddleL.height
        )) {
            isLeftValid = false;
        }
    } while (!isLeftValid);

    coins.push({
        position: { x: coinLeftX, y: randomYLeft },
        spawnTime: currentTime
    });

    // Petlja za generisanje desnog novčića
    let coinRightX, randomYRight, isRightValid;
    do {
        isRightValid = true;
        randomYRight = (Math.random() * 2.0) - 1.0;
        coinRightX = (Math.random() * 2.0) + 0.5; // Desna polovina terena

        // Provera kolizije sa desnim reketom
        if (checkAABBCollision(
            coinRightX - coin.width / 2, randomYRight - coin.height / 2, coin.width, coin.height,
            rightX - paddleR.width / 2, rightY - paddleR.height / 2, paddleR.width, paddleR.height
        )) {
            isRightValid = false;
        }
    } while (!isRightValid);

    coins.push({
        position: { x: coinRightX, y: randomYRight },
        spawnTime: currentTime
    });
}

document.addEventListener("keydown", e => {
    keys[e.key] = true;
    if (e.key === " " && gameOver) {
        showMenu('mode');
    } else if (e.key === "Escape" && !gameOver) {
        isPaused = !isPaused;
        if (!isPaused) {
            lastTime = performance.now();
            requestAnimationFrame(render);
        }
    }
});
document.addEventListener("keyup", e => keys[e.key] = false); // 

function resetGameState() {
    ball.x = 0;
    ball.y = 0;
    let currentInitialSpeed;
    if (gameDifficulty === 'noob') currentInitialSpeed = initialBallSpeedNoob; // 
    else if (gameDifficulty === 'fast') currentInitialSpeed = initialBallSpeedFast; // 
    else if (gameDifficulty === 'hard') currentInitialSpeed = initialBallSpeedHard; // 
    else currentInitialSpeed = initialBallSpeedNormal;
    ball.dx = currentInitialSpeed * (Math.random() > 0.5 ? 1 : -1); // 
    ball.dy = currentInitialSpeed * (Math.random() > 0.5 ? 1 : -1) * 0.5; // 
    leftX = initialLeftX;
    leftY = initialLeftY;
    rightX = initialRightX; // 
    rightY = initialRightY; // 
    coins = []; // Resetuj novčiće // 
}

const menuContainer = document.getElementById('menuContainer');
const menuTitle = document.getElementById('menuTitle');
const classicModeBtn = document.getElementById('classicModeBtn'); // 
const freeModeBtn = document.getElementById('freeModeBtn'); // 
const singlePlayerBtn = document.getElementById('singlePlayerBtn');
const twoPlayerBtn = document.getElementById('twoPlayerBtn');
const noobDifficultyBtn = document.getElementById('noobDifficultyBtn');
const normalDifficultyBtn = document.getElementById('normalDifficultyBtn'); // 
const fastDifficultyBtn = document.getElementById('fastDifficultyBtn'); // 
const hardDifficultyBtn = document.getElementById('hardDifficultyBtn'); // 
const score10Btn = document.getElementById('score10Btn');
const score20Btn = document.getElementById('score20Btn'); // 
const score30Btn = document.getElementById('score30Btn'); // 

function hideAllMenuButtons() {
    [classicModeBtn, freeModeBtn, singlePlayerBtn, twoPlayerBtn, noobDifficultyBtn, normalDifficultyBtn, fastDifficultyBtn, hardDifficultyBtn, score10Btn, score20Btn, score30Btn].forEach(btn => btn.style.display = 'none');
} // 

function showMenu(level) {
    menuContainer.style.display = 'block';
    hideAllMenuButtons(); // 
    if (level === 'mode') { // 
        menuTitle.textContent = 'Choose Game Mode:';
        classicModeBtn.style.display = 'block'; // 
        freeModeBtn.style.display = 'block'; // 
        gameOver = true;
    } else if (level === 'players') { // 
        menuTitle.textContent = 'Choose Players:';
        singlePlayerBtn.style.display = 'block'; // 
        twoPlayerBtn.style.display = 'block'; // 
    } else if (level === 'difficulty') { // 
        menuTitle.textContent = 'Choose Difficulty:';
        noobDifficultyBtn.style.display = 'block'; // 
        normalDifficultyBtn.style.display = 'block'; // 
        fastDifficultyBtn.style.display = 'block'; // 
        hardDifficultyBtn.style.display = 'block'; // 
    } else if (level === 'score') { // 
        menuTitle.textContent = 'Choose Max Score:';
        score10Btn.style.display = 'block'; // 
        score20Btn.style.display = 'block'; // 
        score30Btn.style.display = 'block'; // 
    }
}

classicModeBtn.addEventListener('click', () => { gameMode = 'classic'; showMenu('players'); });
freeModeBtn.addEventListener('click', () => { gameMode = 'free'; showMenu('players'); }); // 
singlePlayerBtn.addEventListener('click', () => { playAgainstAI = true; showMenu('difficulty'); });
twoPlayerBtn.addEventListener('click', () => { playAgainstAI = false; showMenu('difficulty'); }); // 
noobDifficultyBtn.addEventListener('click', () => { gameDifficulty = 'noob'; showMenu('score'); });
normalDifficultyBtn.addEventListener('click', () => { gameDifficulty = 'normal'; showMenu('score'); }); // 
fastDifficultyBtn.addEventListener('click', () => { gameDifficulty = 'fast'; showMenu('score'); }); // 
hardDifficultyBtn.addEventListener('click', () => { gameDifficulty = 'hard'; showMenu('score'); }); // 
score10Btn.addEventListener('click', () => { maxScore = 10; startGame(); });
score20Btn.addEventListener('click', () => { maxScore = 20; startGame(); }); // 
score30Btn.addEventListener('click', () => { maxScore = 30; startGame(); }); // 

function startGame() {
    menuContainer.style.display = 'none';
    player1Score = 0;
    player2Score = 0;
    player1Coins = 0;
    player2Coins = 0; // 
    gameOver = false;
    isPaused = false;
    resetGameState();

    lastCoinSpawnTime = performance.now(); // 
    if (gameDifficulty === 'hard') { // 
        spawnRandomObstacles();
        lastObstacleSpawnTime = performance.now();
    }
    lastTime = performance.now(); // 
    requestAnimationFrame(render);
} // 

function drawScore() {
    hudCanvas.width = glCanvas.width;
    hudCanvas.height = glCanvas.height;
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height); // 
    hudCtx.font = "30px Arial";
    hudCtx.fillStyle = "white";

    hudCtx.textAlign = "left";
    hudCtx.fillText("Player 1: " + player1Score, 50, 50); // 
    hudCtx.fillText("Coins: " + player1Coins, 50, 85);

    hudCtx.textAlign = "right";
    hudCtx.fillText("Player 2: " + player2Score, hudCanvas.width - 50, 50); // 
    hudCtx.fillText("Coins: " + player2Coins, hudCanvas.width - 50, 85); // 
    if (gameOver) { // 
        hudCtx.font = "50px Arial";
        hudCtx.textAlign = "center";
        hudCtx.fillText("GAME OVER", hudCanvas.width / 2, hudCanvas.height / 2 - 30); // 
        hudCtx.font = "30px Arial";
        hudCtx.fillText("Press SPACE to restart", hudCanvas.width / 2, hudCanvas.height / 2 + 20); // 
    } else if (isPaused) { // 
        // Crtanje polu-prozirnog crnog pravougaonika preko celog ekrana
        hudCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
        hudCtx.fillRect(0, 0, hudCanvas.width, hudCanvas.height); // 

        // Ispisivanje teksta "PAUSED" preko overlay-a
        hudCtx.fillStyle = "white";
        hudCtx.font = "80px Arial"; // 
        hudCtx.textAlign = "center";
        hudCtx.fillText("PAUSED", hudCanvas.width / 2, hudCanvas.height / 2); // 
    }
}

function drawObject(obj, x, y, z, scaleX, scaleY, scaleZ, color) {
    gl.useProgram(programInfo.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 3, gl.FLOAT, false, 0, 0); // 
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
    gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.normal);
    let modelMatrix = createIdentityMatrix();
    modelMatrix = translateMatrix(modelMatrix, x, y, z); // 
    modelMatrix = scaleMatrix(modelMatrix, scaleX, scaleY, scaleZ);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, new Float32Array(modelMatrix));
    gl.uniform4fv(programInfo.uniformLocations.color, new Float32Array(color));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indices); // 
    gl.drawElements(gl.TRIANGLES, obj.vertexCount, gl.UNSIGNED_SHORT, 0);
} // 

function checkAABBCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
} // 

function isPositionValid(x, y, width, height) {
    if (gameDifficulty !== 'hard') {
        return true;
    } // 
    for (const obstacle of obstacles) {
        if (checkAABBCollision(
            x - width / 2, y - height / 2, width, height,
            obstacle.bounds.x, obstacle.bounds.y, obstacle.bounds.width, obstacle.bounds.height
        )) {
            return false; // 
        }
    }
    return true; // 
}

let lastTime = 0;

function render(currentTime) {
    if (gameOver || isPaused) { // 
        drawScore();
        return; // 
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const paddleSpeed = 3.5;
    const worldHeight = 2 * Math.tan(45 * Math.PI / 180 / 2) * 5; // 
    const yLimit = (worldHeight / 2.1) - (paddleL.height / 2); // 
    const xHalfLimit = 2.9;
    const player1MaxX = -paddleL.width / 2 - 0.1; // 
    const player2MinX = paddleR.width / 2 + 0.1; // 

    if (keys["w"]) { // 
        const nextY = Math.min(yLimit, leftY + paddleSpeed * deltaTime);
        if (isPositionValid(leftX, nextY, paddleL.width, paddleL.height)) { // 
            leftY = nextY;
        }
    }
    if (keys["s"]) { // 
        const nextY = Math.max(-yLimit, leftY - paddleSpeed * deltaTime);
        if (isPositionValid(leftX, nextY, paddleL.width, paddleL.height)) { // 
            leftY = nextY;
        }
    }
    if (gameMode === 'free') { // 
        if (keys["a"]) {
            const nextX = Math.max(-xHalfLimit, leftX - paddleSpeed * deltaTime);
            if (isPositionValid(nextX, leftY, paddleL.width, paddleL.height)) { // 
                leftX = nextX;
            }
        }
        if (keys["d"]) {
            const nextX = Math.min(player1MaxX, leftX + paddleSpeed * deltaTime); // 
            if (isPositionValid(nextX, leftY, paddleL.width, paddleL.height)) { // 
                leftX = nextX;
            }
        }
    } else {
        leftX = initialLeftX; // 
    }

    if (!playAgainstAI) { // 
        if (keys["ArrowUp"]) {
            const nextY = Math.min(yLimit, rightY + paddleSpeed * deltaTime);
            if (isPositionValid(rightX, nextY, paddleR.width, paddleR.height)) { // 
                rightY = nextY;
            }
        }
        if (keys["ArrowDown"]) {
            const nextY = Math.max(-yLimit, rightY - paddleSpeed * deltaTime); // 
            if (isPositionValid(rightX, nextY, paddleR.width, paddleR.height)) { // 
                rightY = nextY;
            }
        }
        if (gameMode === 'free') { // 
            if (keys["ArrowLeft"]) {
                const nextX = Math.max(player2MinX, rightX - paddleSpeed * deltaTime);
                if (isPositionValid(nextX, rightY, paddleR.width, paddleR.height)) { // 
                    rightX = nextX;
                }
            }
            if (keys["ArrowRight"]) {
                const nextX = Math.min(xHalfLimit, rightX + paddleSpeed * deltaTime); // 
                if (isPositionValid(nextX, rightY, paddleR.width, paddleR.height)) { // 
                    rightX = nextX;
                }
            }
        } else {
            rightX = initialRightX; // 
        }
    } else { // AI Logika
        let aiSpeed = paddleSpeed * 0.9; // 
        if (gameDifficulty === 'noob') aiSpeed *= 0.6; // 
        else if (gameDifficulty === 'normal') aiSpeed *= 0.75; // 
        else if (gameDifficulty === 'fast') aiSpeed *= 0.9; // 
        else if (gameDifficulty === 'hard') aiSpeed *= 1.1; // 
        if (ball.y > rightY + 0.15) { // 
            const nextY = Math.min(yLimit, rightY + aiSpeed * deltaTime);
            if (isPositionValid(rightX, nextY, paddleR.width, paddleR.height)) { // 
                rightY = nextY;
            }
        } else if (ball.y < rightY - 0.15) { // 
            const nextY = Math.max(-yLimit, rightY - aiSpeed * deltaTime);
            if (isPositionValid(rightX, nextY, paddleR.width, paddleR.height)) { // 
                rightY = nextY;
            }
        }

        if (gameMode === 'free') { // 
            const targetX = ball.x > 0 ? ball.x * 0.8 : initialRightX; // 
            if (rightX < targetX - 0.1) {
                const nextX = Math.min(xHalfLimit, rightX + aiSpeed * deltaTime);
                if (isPositionValid(nextX, rightY, paddleR.width, paddleR.height)) { // 
                    rightX = nextX;
                }
            } else if (rightX > targetX + 0.1) { // 
                const nextX = Math.max(player2MinX, rightX - aiSpeed * deltaTime);
                if (isPositionValid(nextX, rightY, paddleR.width, paddleR.height)) { // 
                    rightX = nextX;
                }
            }
        } else {
            rightX = initialRightX; // 
        }
    }


    ball.x += ball.dx;
    ball.y += ball.dy;
    const ballYLimit = (worldHeight / 2.1) - sphere.radius; // 
    if (ball.y > ballYLimit || ball.y < -ballYLimit) {
        ball.dy *= -1;
        ball.y = Math.sign(ball.y) * ballYLimit; // 
    }

    const currentSpeedIncrease = gameDifficulty === 'noob' ? speedIncreasePerHitNoob : gameDifficulty === 'fast' ? speedIncreasePerHitFast : gameDifficulty === 'hard' ? speedIncreasePerHitHard : speedIncreasePerHitNormal; // 
    if (ball.dx < 0 && checkAABBCollision(ball.x - sphere.radius, ball.y - sphere.radius, sphere.radius * 2, sphere.radius * 2, leftX - paddleL.width / 2, leftY - paddleL.height / 2, paddleL.width, paddleL.height)) { // 
        ball.dx *= -1;
        let relativeImpactY = (ball.y - leftY) / (paddleL.height / 2); // 
        ball.dy += relativeImpactY * 0.02;
        ball.dx += currentSpeedIncrease;
        ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + currentSpeedIncrease * 0.5); // 
        ball.x = leftX + paddleL.width / 2 + sphere.radius;
    }

    if (ball.dx > 0 && checkAABBCollision(ball.x - sphere.radius, ball.y - sphere.radius, sphere.radius * 2, sphere.radius * 2, rightX - paddleR.width / 2, rightY - paddleR.height / 2, paddleR.width, paddleR.height)) { // 
        ball.dx *= -1;
        let relativeImpactY = (ball.y - rightY) / (paddleR.height / 2); // 
        ball.dy += relativeImpactY * 0.02;
        ball.dx -= currentSpeedIncrease;
        ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + currentSpeedIncrease * 0.5); // 
        ball.x = rightX - paddleR.width / 2 - sphere.radius;
    }

    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy); // 
    if (speed > maxBallSpeed) { // 
        ball.dx = (ball.dx / speed) * maxBallSpeed;
        ball.dy = (ball.dy / speed) * maxBallSpeed; // 
    }
    
    // **ISPRAVLJENA LOGIKA ZA NOVČIĆE**
    if (coins.length === 0 && currentTime - lastCoinSpawnTime > coinSpawnInterval) {
        spawnCoins(currentTime); // Poziv nove, ispravljene funkcije
    }

    let collectionOccurred = false; // 
    for (const c of coins) {
        if (checkAABBCollision(leftX - paddleL.width / 2, leftY - paddleL.height / 2, paddleL.width, paddleL.height, c.position.x - coin.width / 2, c.position.y - coin.height / 2, coin.width, coin.height)) {
            player1Coins++;
            collectionOccurred = true; // 
            break;
        }
        if (checkAABBCollision(rightX - paddleR.width / 2, rightY - paddleR.height / 2, paddleR.width, paddleR.height, c.position.x - coin.width / 2, c.position.y - coin.height / 2, coin.width, coin.height)) {
            player2Coins++;
            collectionOccurred = true; // 
            break;
        }
    }
    
    if (collectionOccurred) {
        coins = [];
        lastCoinSpawnTime = currentTime; // 
    } else {
        const coinLifespan = 5000;
        const initialCoinCount = coins.length; // 
        coins = coins.filter(c => currentTime - c.spawnTime <= coinLifespan);
        if (coins.length < initialCoinCount && coins.length === 0) { // 
            lastCoinSpawnTime = currentTime;
        }
    }


    if (gameDifficulty === 'hard') { // 
        if (currentTime - lastObstacleSpawnTime > obstacleSpawnInterval) {
            spawnRandomObstacles();
            lastObstacleSpawnTime = currentTime; // 
        }
        obstacles.forEach(obstacle => {
            if (checkAABBCollision(ball.x - sphere.radius, ball.y - sphere.radius, sphere.radius * 2, sphere.radius * 2, obstacle.bounds.x, obstacle.bounds.y, obstacle.bounds.width, obstacle.bounds.height)) {
                const overlapX = (ball.x - obstacle.position.x);
                const overlapY = (ball.y - obstacle.position.y);
                
				if (Math.abs(overlapX) > Math.abs(overlapY)) { // 
                    ball.dx *= -1.05;
                    ball.x = obstacle.position.x + Math.sign(overlapX) * (obstacle.bounds.width / 2 + sphere.radius);
                } else {
                    ball.dy *= -1.05;
					ball.y = obstacle.position.y + Math.sign(overlapY) * (obstacle.bounds.height / 2 + sphere.radius); // 
                }
            }
        });
    }

    const goalXBoundary = 2.9; // 
    if (ball.x < -goalXBoundary) {
        player2Score++;
        resetGameState(); // 
    } else if (ball.x > goalXBoundary) {
        player1Score++;
        resetGameState();
    }

    const coinWinCount = maxScore * 1.5; // 
    if (player1Score >= maxScore || player2Score >= maxScore || player1Coins >= coinWinCount || player2Coins >= coinWinCount) { // 
        gameOver = true;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // 
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(programInfo.program);
    const fieldOfView = 45 * Math.PI / 180; // 
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0; // 
    const projection = perspectiveMatrix(fieldOfView, aspect, zNear, zFar);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, new Float32Array(projection));
    const view = createIdentityMatrix();
    const cameraZ = 5; // 
    const viewMatrix = translateMatrix(view, 0, 0, -cameraZ);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, new Float32Array(viewMatrix));
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, [1, 1, 1]);
    drawObject(sphere, ball.x, ball.y, 0, 1, 1, 1, [0.2, 0.6, 1.0, 1.0]); // 
    drawObject(paddleL, leftX, leftY, 0, 1, 1, 1, [1.0, 0.0, 0.0, 1.0]); // 
    drawObject(paddleR, rightX, rightY, 0, 1, 1, 1, [0.0, 1.0, 0.0, 1.0]); // 
    drawObject(goalLeft, -goalXBoundary, 0, 0, 1, 1, 1, [1.0, 0.0, 0.0, 0.3]); // 
    drawObject(goalRight, goalXBoundary, 0, 0, 1, 1, 1, [0.0, 1.0, 0.0, 0.3]); // 
    drawObject(wallTop, 0, worldHeight / 2.1, 0, 1, 1, 1, [0.8, 0.8, 0.8, 1.0]); // 
    drawObject(wallBottom, 0, -worldHeight / 2.1, 0, 1, 1, 1, [0.8, 0.8, 0.8, 1.0]); // 
    drawObject(field, 0, 0, -0.2, 1, 1, 1, [0.1, 0.1, 0.1, 1.0]); // 
    coins.forEach(c => {
        drawObject(coin, c.position.x, c.position.y, 0, 1, 1, 1, [1.0, 0.8, 0.0, 1.0]);
    }); // 
    if (gameDifficulty === 'hard') { // 
        obstacles.forEach(obstacle => {
            drawObject(obstacle.obj, obstacle.position.x, obstacle.position.y, 0, 1, 1, 1, [0.5, 0.5, 0.5, 1.0]);
        });
    }

    drawScore();

    requestAnimationFrame(render);
} // 

showMenu('mode');
window.addEventListener('resize', () => {
    glCanvas.width = window.innerWidth;
    glCanvas.height = window.innerHeight;
    gl.viewport(0, 0, glCanvas.width, gl.canvas.height);
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
    drawScore();
});