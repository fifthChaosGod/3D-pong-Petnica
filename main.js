// === 3D PONG GAME LOGIC ===

// Kontekst za 3D renderovanje
const glCanvas = document.getElementById("glCanvas");
const gl = glCanvas.getContext("webgl"); // WebGL1 kontekst
if (!gl) {
    alert("WebGL nije podržan.");
} else {
    // Ako želite da canvas zauzima ceo prozor
    glCanvas.width = window.innerWidth;
    glCanvas.height = window.innerHeight;
    gl.viewport(0, 0, glCanvas.width, gl.canvas.height);
}

// Kontekst za 2D HUD (scoreboard i Game Over)
const hudCanvas = document.getElementById("hudCanvas");
const hudCtx = hudCanvas.getContext("2d");
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

varying vec3 v_normal;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_normal = mat3(u_model) * a_normal;
}
`;

const fsSource = `
precision mediump float; // Uvek definisati preciznost za float u fragment šejderu

varying vec3 v_normal;

uniform vec3 u_lightDirection;
uniform vec4 u_color;

void main() {
    // Normalizujemo normalu i smer svetlosti pre dot proizvoda
    float light = max(dot(normalize(v_normal), normalize(u_lightDirection)), 0.0);
    gl_FragColor = vec4(u_color.rgb * light, u_color.a);
}
`;

// Funkcije za učitavanje i kreiranje šejdera i programa
function loadShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Shader compile failed (${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}):\n`, gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(vsSource, fsSource) {
    const vs = loadShader(gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl.FRAGMENT_SHADER, fsSource);
    // Provera da li su šejderi uspešno kompajlirani
    if (!vs || !fs) {
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link failed:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

const program = createProgram(vsSource, fsSource);
// Provera da li je program uspešno kreiran pre upotrebe
if (!program) {
    alert("WebGL program nije uspeo da se inicijalizuje. Pogledajte konzolu za detalje.");
    throw new Error("WebGL Program creation failed.");
}
gl.useProgram(program);


// Dobijanje lokacija uniformi i atributa iz šejdera
const u_projection = gl.getUniformLocation(program, "u_projection");
const u_view = gl.getUniformLocation(program, "u_view");
const u_model = gl.getUniformLocation(program, "u_model");
const u_lightDirection = gl.getUniformLocation(program, "u_lightDirection");
const u_color = gl.getUniformLocation(program, "u_color");
const a_position = gl.getAttribLocation(program, "a_position");
const a_normal = gl.getAttribLocation(program, "a_normal");

// Pomoćna funkcija za postavljanje atributa
function setupAttribute(location, buffer, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(location);
}

// Funkcija za kreiranje sfere (loptice)
function createSphere(radius, latBands, longBands) {
    const positions = [], normals = [], indices = [];
    for (let lat = 0; lat <= latBands; ++lat) {
        const theta = lat * Math.PI / latBands;
        const sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
        for (let lon = 0; lon <= longBands; ++lon) {
            const phi = lon * 2 * Math.PI / longBands;
            const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
            const x = cosPhi * sinTheta, y = cosTheta, z = sinPhi * sinTheta;
            positions.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z); // Normale za osvetljenje
        }
    }
    for (let lat = 0; lat < latBands; ++lat) {
        for (let lon = 0; lon < longBands; ++lon) {
            const first = lat * (longBands + 1) + lon;
            const second = first + longBands + 1;
            indices.push(first, second, first + 1, second, second + 1, first + 1);
        }
    }
    return { positions, normals, indices, radius }; // Dodaj radius
}

// Funkcija za kreiranje kutije (reketa, golova, novčića)
function createBox(width, height, depth) {
    const w = width / 2, h = height / 2, d = depth / 2;
    // Pozicije vrhova kocke (po 4 vrha za svaku od 6 strana, ukupno 24 vrha)
    const positions = [
        // Prednja strana
        -w, -h,  d,  w, -h,  d,  w,  h,  d, -w,  h,  d,
        // Zadnja strana
        -w, -h, -d, -w,  h, -d,  w,  h, -d,  w, -h, -d,
        // Gornja strana
        -w,  h, -d, -w,  h,  d,  w,  h,  d,  w,  h, -d,
        // Donja strana
        -w, -h, -d,  w, -h, -d,  w, -h,  d, -w, -h,  d,
        // Desna strana
         w, -h, -d,  w,  h, -d,  w,  h,  d,  w, -h,  d,
        // Leva strana
        -w, -h, -d, -w, -h,  d, -w,  h,  d, -w,  h, -d
    ];
    // Normale vrhova (za svaku stranu)
    const normals = [
        // Prednja
        0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
        // Zadnja
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Gornja
        0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
        // Donja
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Desna
        1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
        // Leva
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
    ];
    // Indeksi za crtanje trouglova za svaku stranu (dva trougla po strani = 6 indeksa po strani)
    const indices = [
        0, 1, 2,  0, 2, 3,    // Prednja
        4, 5, 6,  4, 6, 7,    // Zadnja
        8, 9, 10, 8, 10, 11,  // Gornja
        12, 13, 14, 12, 14, 15, // Donja
        16, 17, 18, 16, 18, 19, // Desna
        20, 21, 22, 20, 22, 23  // Leva
    ];
    return { positions, normals, indices, width, height, depth }; // Dodaj dimenzije
}

// Funkcija za kreiranje i vezivanje bafera
function createAndBindBuffers(geometry) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

    return {
        positionBuffer,
        normalBuffer,
        indexBuffer,
        count: geometry.indices.length,
        // Propagiraj dimenzije/radijus za lakšu proveru kolizija
        width: geometry.width,
        height: geometry.height,
        depth: geometry.depth,
        radius: geometry.radius
    };
}

// Funkcije za matrice (jednostavne implementacije bez gl-matrix biblioteke)
function getIdentityMatrix() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

function getTranslationMatrix(x, y, z) {
    const m = getIdentityMatrix();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
}

function getScaleMatrix(x, y, z) {
    const m = getIdentityMatrix();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
}

function multiplyMatrices(m1, m2) {
    const result = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                result[i * 4 + j] += m1[i * 4 + k] * m2[k * 4 + j];
            }
        }
    }
    return result;
}

function getProjectionMatrix(aspect, fov, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0
    ];
}


// Funkcija za crtanje objekta
function drawObject(obj, positionX, positionY, positionZ, scaleX, scaleY, scaleZ, color) {
    setupAttribute(a_position, obj.positionBuffer, 3);
    setupAttribute(a_normal, obj.normalBuffer, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);

    let modelMatrix = getTranslationMatrix(positionX, positionY, positionZ);
    // Skaliranje je obično deo modelovanja, ali ovde ga primenjujemo posle translacije za jednostavnost
    let scaleMatrix = getScaleMatrix(scaleX, scaleY, scaleZ);
    modelMatrix = multiplyMatrices(modelMatrix, scaleMatrix);


    gl.uniformMatrix4fv(u_model, false, new Float32Array(modelMatrix));
    gl.uniform4fv(u_color, color); // Boja se prosleđuje kao vec4
    gl.drawElements(gl.TRIANGLES, obj.count, gl.UNSIGNED_SHORT, 0);
}

// === Geometrija ===
const paddleWidth = 0.2;
const paddleHeight = 0.6;
const paddleDepth = 0.2; // Dubina reketa

const goalWidth = 0.2;
const goalHeight = 2.0; // Visina gola, preko celog ekrana
const goalDepth = 0.2;

const coinSize = 0.1; // Veličina novčića

const paddleL = createAndBindBuffers(createBox(paddleWidth, paddleHeight, paddleDepth));
const paddleR = createAndBindBuffers(createBox(paddleWidth, paddleHeight, paddleDepth));
const sphereRadius = 0.08;
const sphere = createAndBindBuffers(createSphere(sphereRadius, 30, 30));

const goalLeft = createAndBindBuffers(createBox(goalWidth, goalHeight, goalDepth));
const goalRight = createAndBindBuffers(createBox(goalWidth, goalHeight, goalDepth));

const coin = createAndBindBuffers(createBox(coinSize, coinSize, coinSize));


// === Igra ===
let ball = { x: 0, y: 0, dx: 0.03, dy: 0.02 };
let leftX = 0, leftY = 0; // Početne pozicije reketa - inicijalizuju se u resetGameState
let rightX = 0, rightY = 0; // Početne pozicije reketa - inicijalizuju se u resetGameState
let keys = {};
let player1Score = 0, player2Score = 0;
let maxScore = 10; // Defaultna vrednost, biće podešena kroz meni
let gameOver = false;
let gameMode = ''; // 'classic' or 'free'
let gameDifficulty = ''; // 'normal' or 'fast'
let ballSpeedIncreaseFactor = 0.0; // Faktor ubrzanja loptice
const initialBallSpeedNormalMode = 0.03; // Početna brzina loptice za Normal Mode
const initialBallSpeedFastMode = 0.005; // SMANJENO JOŠ VIŠE: Početna brzina loptice za Fast Mode (mnogo sporije)
const speedIncreasePerHitNormal = 0.002; // Koliko se faktor ubrzanja povećava po udarcu u Normal modu
const speedIncreasePerHitFast = 0.004; // POVEĆANO: Brže ubrzanje u Fast modu

let coinActive = false;
let coinPosition = { x: 0, y: 0 };
let lastCoinSpawnTime = 0;
const coinSpawnIntervalNormal = 2000; // Normalna frekvencija spawn-ovanja novčića
const coinSpawnIntervalFast = 4000; // Spora frekvencija spawn-ovanja novčića u Fast Mode

// Početne pozicije za reset reketa
const initialLeftX = -2.5; // Ostaju iste
const initialLeftY = 0;
const initialRightX = 2.5; // Ostaju iste
const initialRightY = 0;

// Upravljanje unosom sa tastature
document.addEventListener("keydown", e => {
    keys[e.key] = true;
    if (e.key === " " && gameOver) {
        // Resetovanje igre kada je Game Over i pritisnut je SPACE
        player1Score = 0;
        player2Score = 0;
        gameOver = false;
        showMenu(); // Pokaži meni ponovo
    }
});
document.addEventListener("keyup", e => keys[e.key] = false);

// Funkcija za resetovanje stanja igre (pozicije loptice i reketa)
function resetGameState() {
    ball.x = 0;
    ball.y = 0;
    // Odredi početnu brzinu na osnovu odabranog moda težine
    let currentInitialSpeed = (gameDifficulty === 'fast') ? initialBallSpeedFastMode : initialBallSpeedNormalMode;
    ball.dx = currentInitialSpeed * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = currentInitialSpeed * (Math.random() > 0.5 ? 1 : -1);
    leftX = initialLeftX;
    leftY = initialLeftY;
    rightX = initialRightX;
    rightY = initialRightY;
    ballSpeedIncreaseFactor = 0.0; // Resetuj faktor brzine
    coinActive = false; // Ukloni novčić pri resetu
    lastCoinSpawnTime = performance.now(); // Resetuj vreme za spawn novčića
}

// === Meni i Inicijalizacija ===
const menuContainer = document.getElementById('menuContainer');
const menuTitle = document.getElementById('menuTitle');
const classicModeBtn = document.getElementById('classicModeBtn');
const freeModeBtn = document.getElementById('freeModeBtn');
const normalDifficultyBtn = document.getElementById('normalDifficultyBtn');
const fastDifficultyBtn = document.getElementById('fastDifficultyBtn');
const score10Btn = document.getElementById('score10Btn');
const score20Btn = document.getElementById('score20Btn');
const score30Btn = document.getElementById('score30Btn');

classicModeBtn.addEventListener('click', () => {
    gameMode = 'classic';
    showDifficultyMenu();
});

freeModeBtn.addEventListener('click', () => {
    gameMode = 'free';
    showDifficultyMenu();
});

normalDifficultyBtn.addEventListener('click', () => {
    gameDifficulty = 'normal';
    showScoreLimitMenu();
});

fastDifficultyBtn.addEventListener('click', () => {
    gameDifficulty = 'fast';
    showScoreLimitMenu();
});

score10Btn.addEventListener('click', () => {
    maxScore = 10;
    startGame();
});

score20Btn.addEventListener('click', () => {
    maxScore = 20;
    startGame();
});

score30Btn.addEventListener('click', () => {
    maxScore = 30;
    startGame();
});


function showMenu() {
    menuContainer.style.display = 'block';
    menuTitle.textContent = 'Choose Game Mode:';
    classicModeBtn.style.display = 'block';
    freeModeBtn.style.display = 'block';
    normalDifficultyBtn.style.display = 'none';
    fastDifficultyBtn.style.display = 'none';
    score10Btn.style.display = 'none';
    score20Btn.style.display = 'none';
    score30Btn.style.display = 'none';
    gameOver = true; // Zadrži igru pauziranom dok je meni aktivan
}

function showDifficultyMenu() {
    menuTitle.textContent = 'Choose Difficulty:';
    classicModeBtn.style.display = 'none';
    freeModeBtn.style.display = 'none';
    normalDifficultyBtn.style.display = 'block';
    fastDifficultyBtn.style.display = 'block';
    score10Btn.style.display = 'none';
    score20Btn.style.display = 'none';
    score30Btn.style.display = 'none';
}

function showScoreLimitMenu() {
    menuTitle.textContent = 'Play to:';
    classicModeBtn.style.display = 'none';
    freeModeBtn.style.display = 'none';
    normalDifficultyBtn.style.display = 'none';
    fastDifficultyBtn.style.display = 'none';
    score10Btn.style.display = 'block';
    score20Btn.style.display = 'block';
    score30Btn.style.display = 'block';
}


function startGame() {
    menuContainer.style.display = 'none';
    gameOver = false;
    player1Score = 0; // Resetuj skor pri novoj igri
    player2Score = 0; // Resetuj skor pri novoj igri
    resetGameState();
    // lastCoinSpawnTime se resetuje u resetGameState()
    requestAnimationFrame(render); // Pokreni render petlju
}

showMenu(); // Prikaži meni kada se stranica učita

// Ažuriranje skorborda i Game Over poruke
function drawScore() {
    // Postavi veličinu HUD canvasa da odgovara WebGL canvasu
    hudCanvas.width = glCanvas.width;
    hudCanvas.height = glCanvas.height;

    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hudCtx.font = "30px Arial";
    hudCtx.fillStyle = "white";
    hudCtx.textAlign = "left";
    hudCtx.fillText("Player 1: " + player1Score, 50, 50);
    hudCtx.textAlign = "right";
    hudCtx.fillText("Player 2: " + player2Score, hudCanvas.width - 50, 50);

    if (gameOver) {
        hudCtx.font = "50px Arial";
        hudCtx.textAlign = "center";
        hudCtx.fillText("GAME OVER", hudCanvas.width / 2, hudCanvas.height / 2 - 30);
        hudCtx.font = "30px Arial";
        hudCtx.fillText("Press SPACE to restart", hudCanvas.width / 2, hudCanvas.height / 2 + 20);
    }
}

// Funkcija za proveru kolizije između AABB (Axis-Aligned Bounding Box)
function checkAABBCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return (x1 < x2 + w2 &&
            x1 + w1 > x2 &&
            y1 < y2 + h2 &&
            y1 + h1 > y2);
}

// Glavna petlja igre
function render(currentTime) {
    if (gameOver) {
        drawScore(); // Prikazuj samo Game Over poruku
        return; // Ne pozivaj requestAnimationFrame ovde, pokreće se iz startGame
    }

    // --- Kretanje reketa ---
    const paddleSpeed = 0.05;
    const worldHeight = 2 * Math.tan(Math.PI / 4 / 2) * 5; // tan(FOV/2) * distance_to_plane
    const yLimit = (worldHeight / 2) - (paddleL.height / 2);
    // Prilagođavamo xHalfLimit da se reketi ne preklapaju kada su na krajevima terena
    // i da ostanu unutar vizuelnog polja.
    const xHalfLimit = 2.9; // Malo manje od goalXBoundary da reketi ne idu preko golova
    const player1MaxX = -paddleL.width / 2 - 0.1; // Malo odmaknuto od centra
    const player2MinX = paddleR.width / 2 + 0.1; // Malo odmaknuto od centra

    // Player 1 (W, A, S, D)
    if (keys["w"]) leftY = Math.min(yLimit, leftY + paddleSpeed);
    if (keys["s"]) leftY = Math.max(-yLimit, leftY - paddleSpeed);
    if (gameMode === 'free') {
        if (keys["a"]) leftX = Math.max(-xHalfLimit, leftX - paddleSpeed);
        if (keys["d"]) leftX = Math.min(player1MaxX, leftX + paddleSpeed);
    } else { // Classic mode, ograniči X kretanje
        leftX = initialLeftX; // Uvek na početnoj X poziciji
    }


    // Player 2 (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
    if (keys["ArrowUp"]) rightY = Math.min(yLimit, rightY + paddleSpeed);
    if (keys["ArrowDown"]) rightY = Math.max(-yLimit, rightY - paddleSpeed);
    if (gameMode === 'free') {
        if (keys["ArrowLeft"]) rightX = Math.max(player2MinX, rightX - paddleSpeed);
        if (keys["ArrowRight"]) rightX = Math.min(xHalfLimit, rightX + paddleSpeed);
    } else { // Classic mode, ograniči X kretanje
        rightX = initialRightX; // Uvek na početnoj X poziciji
    }

    // --- Kretanje lopte ---
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Gornja/donja ivica terena (odbijanje od "zidova")
    const ballYLimit = yLimit; // Lopta ne sme da ide van vidljivog Y opsega
    if (ball.y + sphere.radius > ballYLimit || ball.y - sphere.radius < -ballYLimit) {
        ball.dy *= -1;
        // Korekcija pozicije ako se zaglavi
        if (ball.y + sphere.radius > ballYLimit) ball.y = ballYLimit - sphere.radius;
        if (ball.y - sphere.radius < -ballYLimit) ball.y = -ballYLimit + sphere.radius;
    }

    // --- Kolizija sa reketima ---
    // Provera kolizije sa levim reketom (igrač 1)
    if (ball.dx < 0 && ball.x - sphere.radius <= leftX + paddleL.width / 2 && ball.x - sphere.radius >= leftX - paddleL.width / 2) {
        if (ball.y + sphere.radius > leftY - paddleL.height / 2 && ball.y - sphere.radius < leftY + paddleL.height / 2) {
            ball.dx *= -1; // Odbijanje
            if (gameDifficulty === 'fast') {
                // Brže povećanje brzine u Fast modu
                ball.dx = Math.sign(ball.dx) * (Math.abs(ball.dx) + speedIncreasePerHitFast);
                ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + speedIncreasePerHitFast);
            } else {
                // Standardno povećanje brzine u Normal modu
                ball.dx = Math.sign(ball.dx) * (Math.abs(ball.dx) + speedIncreasePerHitNormal);
                ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + speedIncreasePerHitNormal);
            }
            // Korekcija pozicije da lopta ne prođe kroz reket
            ball.x = leftX + paddleL.width / 2 + sphere.radius;
        }
    }

    // Provera kolizije sa desnim reketom (igrač 2)
    if (ball.dx > 0 && ball.x + sphere.radius >= rightX - paddleR.width / 2 && ball.x + sphere.radius <= rightX + paddleR.width / 2) {
        if (ball.y + sphere.radius > rightY - paddleR.height / 2 && ball.y - sphere.radius < rightY + paddleR.height / 2) {
            ball.dx *= -1; // Odbijanje
            if (gameDifficulty === 'fast') {
                // Brže povećanje brzine u Fast modu
                ball.dx = Math.sign(ball.dx) * (Math.abs(ball.dx) + speedIncreasePerHitFast);
                ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + speedIncreasePerHitFast);
            } else {
                // Standardno povećanje brzine u Normal modu
                ball.dx = Math.sign(ball.dx) * (Math.abs(ball.dx) + speedIncreasePerHitNormal);
                ball.dy = Math.sign(ball.dy) * (Math.abs(ball.dy) + speedIncreasePerHitNormal);
            }
            // Korekcija pozicije da lopta ne prođe kroz reket
            ball.x = rightX - paddleR.width / 2 - sphere.radius;
        }
    }

    // --- Kolizija reketa sa novčićem ---
    if (coinActive) {
        // Pozicija coin-a i njegove dimenzije za AABB
        const coinRect = {
            x: coinPosition.x - coin.width / 2,
            y: coinPosition.y - coin.height / 2,
            width: coin.width,
            height: coin.height
        };

        // Pozicija levog reketa i njegove dimenzije za AABB
        const paddleLRect = {
            x: leftX - paddleL.width / 2,
            y: leftY - paddleL.height / 2,
            width: paddleL.width,
            height: paddleL.height
        };

        // Pozicija desnog reketa i njegove dimenzije za AABB
        const paddleRRect = {
            x: rightX - paddleR.width / 2,
            y: rightY - paddleR.height / 2,
            width: paddleR.width,
            height: paddleR.height
        };

        if (checkAABBCollision(paddleLRect.x, paddleLRect.y, paddleLRect.width, paddleLRect.height,
                               coinRect.x, coinRect.y, coinRect.width, coinRect.height)) {
            player1Score++;
            coinActive = false;
        } else if (checkAABBCollision(paddleRRect.x, paddleRRect.y, paddleRRect.width, paddleRRect.height,
                                      coinRect.x, coinRect.y, coinRect.width, coinRect.height)) {
            player2Score++;
            coinActive = false;
        }
    }


    // --- Poeni i Game Over (golovi) ---
    const goalXBoundary = 4.0; // X pozicija golova

    if (ball.x < -goalXBoundary) { // Lopta je prošla levi gol (gol za igrača 2)
        player2Score++;
        resetGameState(); // Resetuje poziciju loptice i reketa
    } else if (ball.x > goalXBoundary) { // Lopta je prošla desni gol (gol za igrača 1)
        player1Score++;
        resetGameState(); // Resetuje poziciju loptice i reketa
    }

    if (player1Score >= maxScore || player2Score >= maxScore) {
        gameOver = true;
    }

    // --- Spawn novčića ---
    let currentCoinSpawnInterval = (gameDifficulty === 'fast') ? coinSpawnIntervalFast : coinSpawnIntervalNormal;

    if (!coinActive && currentTime - lastCoinSpawnTime > currentCoinSpawnInterval) {
        coinActive = true;
        const maxCoinX = 2.5; // Maksimalni X opseg za spawn novčića
        const maxCoinY = 1.8; // Maksimalni Y opseg za spawn novčića

        coinPosition.x = (Math.random() * 2 - 1) * maxCoinX; // Od -maxCoinX do maxCoinX

        if (gameMode === 'classic') {
            // U Classic modu, novčići se spawnuju samo na gornjoj ili donjoj ivici
            // Odredimo granice za Y poziciju novčića da budu blizu gornje/donje ivice
            const edgeSpawnOffset = 0.5; // Pomeraj od ivice da ne bude previše blizu
            if (Math.random() > 0.5) {
                coinPosition.y = maxCoinY - edgeSpawnOffset; // Gornja ivica
            } else {
                coinPosition.y = -maxCoinY + edgeSpawnOffset; // Donja ivica
            }
        } else {
            // U Free modu, nasumično po celom Y opsegu
            coinPosition.y = (Math.random() * 2 - 1) * maxCoinY; // Od -maxCoinY do maxCoinY
        }
        lastCoinSpawnTime = currentTime;
    }

    // --- Renderovanje ---
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    // Omogućavanje blendinga za transparentne objekte (golove)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


    // Podesite matricu projekcije i pogleda
    const projection = getProjectionMatrix(glCanvas.width / glCanvas.height, Math.PI / 4, 0.1, 100);
    const view = getTranslationMatrix(0, 0, -5); // Kamera je na Z = -5, gleda ka 0,0,0

    gl.uniformMatrix4fv(u_projection, false, new Float32Array(projection));
    gl.uniformMatrix4fv(u_view, false, new Float32Array(view));
    gl.uniform3fv(u_lightDirection, [1, 1, 1]); // Smer svetlosti (beli vektor [1,1,1] znači iz gornje desne prednje pozicije)

    // Crtanje loptice
    drawObject(sphere, ball.x, ball.y, 0, 1, 1, 1, [0.2, 0.6, 1.0, 1.0]); // Plava loptica

    // Crtanje levog reketa
    drawObject(paddleL, leftX, leftY, 0, 1, 1, 1, [1.0, 0.0, 0.0, 1.0]); // Crveni reket

    // Crtanje desnog reketa
    drawObject(paddleR, rightX, rightY, 0, 1, 1, 1, [0.0, 1.0, 0.0, 1.0]); // Zeleni reket

    // Crtanje golova (leva crvena, desna zelena)
    drawObject(goalLeft, -goalXBoundary, 0, 0, 1, 1, 1, [1.0, 0.0, 0.0, 0.3]); // Transparentno crvena
    drawObject(goalRight, goalXBoundary, 0, 0, 1, 1, 1, [0.0, 1.0, 0.0, 0.3]); // Transparentno zelena

    // Crtanje novčića ako je aktivan
    if (coinActive) {
        drawObject(coin, coinPosition.x, coinPosition.y, 0, 1, 1, 1, [1.0, 0.8, 0.0, 1.0]); // Zlatni novčić
    }

    drawScore(); // Ažuriraj i prikaži skor i Game Over poruku

    requestAnimationFrame(render);
}