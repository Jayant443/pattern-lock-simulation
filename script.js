const ns = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('pattern-grid');
const simBtn = document.getElementById('sim-btn');
const clearBtn = document.getElementById('clear-btn');
const messageEl = document.getElementById('message');
const stopBtn = document.getElementById('stop-btn');
const stopwatchEl = document.getElementById('stopwatch');
const pauseBtn = document.getElementById('pause-btn');
let swInterval = null, swStart = null;

const rows = 3, cols = 3, r = 7;
const spacingX = 140, spacingY = 140;
const offsetX = 80, offsetY = 80;

let locked = false, dragging = null, tempLine = null, simCancelled = false, simTimeout = null, paused = false, swElapsed = 0, resumeFn = null;
const circles = [];


const positions = {
    1: [0, 0],
    2: [0, 1],
    3: [0, 2],
    4: [1, 0],
    5: [1, 1],
    6: [1, 2],
    7: [2, 0],
    8: [2, 1],
    9: [2, 2]
};
const nodes = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function computeBlockers() {
    const blockers = {};
    for (const a of nodes) for (const b of nodes) {
        if (a === b) continue;
        const [r1, c1] = positions[a], [r2, c2] = positions[b];
        const midR = (r1 + r2) / 2, midC = (c1 + c2) / 2;
        const key = `${a}, ${b}`;
        blockers[key] = (Number.isInteger(midR) && Number.isInteger(midC)) ? (nodes.find(m => positions[m][0] === midR && positions[m][1] === midC) ?? null) : null;
    }
    return blockers;
}

const blockers = computeBlockers();

function isValidNext(a, b, visited) {
    const blocker = blockers[`${a}, ${b}`];
    return blocker === null || blocker === undefined || visited.has(blocker);
}

function dfs(current, visited, path, allPaths) {
    for (const neighbor of nodes) {
        if (!visited.has(neighbor) && isValidNext(current, neighbor, visited)) {
            visited.add(neighbor);
            path.push(neighbor);
            if (path.length >= 4) allPaths.push([...path]);
            dfs(neighbor, visited, path, allPaths);
            path.pop();
            visited.delete(neighbor);
        }
    }
}

function calPaths() {
    const allPaths = [];
    for (const start of nodes) {
        dfs(start, new Set([start]), [start], allPaths);
    }
    return allPaths;
}

function setLocked(val) {
    locked = val;
    simBtn.disabled = val;
    clearBtn.disabled = val;
    stopBtn.disabled = !val;
    pauseBtn.disabled = !val;
    svg.style.pointerEvents = val ? 'none' : 'all';
}

function setMessage(text, type = 'info') {
    messageEl.textContent = text;
    messageEl.className = type;
}

function startStopwatch() {
    swStart = Date.now();
    swInterval = setInterval(() => {
        const elapsed = swElapsed + (Date.now() - swStart);
        const mins = String(Math.floor(elapsed / 60000)).padStart(2, '0');
        const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
        const tenths = Math.floor((elapsed % 1000) / 100);
        stopwatchEl.textContent = `${mins}:${secs}.${tenths}`;
    }, 100);
}

function stopStopwatch() {
    clearInterval(swInterval);
    swElapsed += Date.now() - swStart;
    swInterval = null;
}

function resetStopwatch() {
    stopStopwatch();
    swElapsed = 0;
    stopwatchEl.textContent = '00:00.0';
}

class Circle {
    constructor(x, y, r, index) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.index = index;
        this.connected = false;

        this.el = document.createElementNS(ns, 'circle');
        this.el.setAttribute('cx', x);
        this.el.setAttribute('cy', y);
        this.el.setAttribute('r', r);
        this.el.setAttribute('class', 'circle');
    }

    setConnected(val) {
        this.connected = val;
    }
    appendTo(svg) {
        svg.appendChild(this.el);
    }
}

function drawLine(x1, y1, x2, y2) {
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    l.setAttribute('class', 'line');
    svg.insertBefore(l, svg.firstChild);
    return l;
}

function distToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
    const t = Math.max(0, Math.min(1, (A * C + B * D) / (C * C + D * D)));
    return Math.hypot(px - (x1 + t * C), py - (y1 + t * D));
}

function getSVGCoords(e) {
    const rect = svg.getBoundingClientRect();
    const scaleX = (offsetX * 2 + (cols - 1) * spacingX) / rect.width;
    const scaleY = (offsetY * 2 + (rows - 1) * spacingY) / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
        mx: (src.clientX - rect.left) * scaleX,
        my: (src.clientY - rect.top) * scaleY
    };
}

function buildCircles() {
    for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++)
            circles.push(new Circle(offsetX + col * spacingX, offsetY + row * spacingY, r, row * cols + col + 1));
}

function renderGrid() {
    const w = offsetX * 2 + (cols - 1) * spacingX;
    const h = offsetY * 2 + (rows - 1) * spacingY;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    circles.forEach(c => c.appendTo(svg));
}

function onDragStart(circle, e) {
    if (locked) return;
    e.preventDefault();
    clear();
    dragging = circle;
    circle.setConnected(true);
    tempLine = drawLine(circle.x, circle.y, circle.x, circle.y);
}

function onDragMove(e) {
    if (locked || !dragging || !tempLine) return;
    e.preventDefault();
    const { mx, my } = getSVGCoords(e);

    tempLine.setAttribute('x2', mx);
    tempLine.setAttribute('y2', my);

    circles.forEach(c => {
        if (c === dragging || c.connected) return;
        const dist = Math.hypot(c.x - mx, c.y - my);
        const lineDist = distToLine(c.x, c.y, dragging.x, dragging.y, mx, my);
        if (dist <= c.r || lineDist <= c.r) {
            c.setConnected(true);
            svg.removeChild(tempLine);
            drawLine(dragging.x, dragging.y, c.x, c.y);
            dragging = c;
            tempLine = drawLine(c.x, c.y, c.x, c.y);
        }
    });
}

function onDragEnd(e) {
    if (!dragging) return;
    const src = e.changedTouches ? { touches: e.changedTouches } : e;
    const { mx, my } = getSVGCoords(src);

    let target = null;
    circles.forEach(c => {
        if (c === dragging || c.connected) return;
        if (Math.hypot(c.x - mx, c.y - my) <= c.r) target = c;
    });

    if (tempLine) {
        svg.removeChild(tempLine); tempLine = null;
    }
    if (target) {
        drawLine(dragging.x, dragging.y, target.x, target.y);
        target.setConnected(true);
    }
    dragging = null;

    const connectedCount = circles.filter(c => c.connected).length;
    if (connectedCount > 0 && connectedCount < 4) {
        svg.querySelectorAll('.line').forEach(l => l.classList.add('invalid'));
        circles.filter(c => c.connected).forEach(c => c.el.classList.add('invalid'));
        setMessage('Pattern too short — connect at least 4 dots', 'error');
    } else if (connectedCount >= 4) {
        setMessage(`${connectedCount} dots connected`, 'info');
    }
}

function setupDragEvents() {
    circles.forEach(c => {
        c.el.addEventListener('mousedown', e => onDragStart(c, e));
        c.el.addEventListener('touchstart', e => onDragStart(c, e), { passive: false });
    });

    svg.addEventListener('mousemove', onDragMove);
    svg.addEventListener('touchmove', onDragMove, { passive: false });
    svg.addEventListener('mouseup', onDragEnd);
    svg.addEventListener('touchend', onDragEnd);
}

function drawPattern(indices, speed = 2, done = null) {
    let segmentIndex = 0, progress = 0, animLine = null;
    const from = () => circles.find(c => c.index === indices[segmentIndex]);
    const to = () => circles.find(c => c.index === indices[segmentIndex + 1]);
    function animate() {
        if (simCancelled) return;

        if (paused) {
            resumeFn = animate;
            return;
        }

        if (segmentIndex >= indices.length - 1) {
            if (done) done();
            return;
        }
        const f = from(), t = to();
        if (!f || !t) return;
        const dx = t.x - f.x, dy = t.y - f.y, dist = Math.hypot(dx, dy);
        if (!animLine) {
            f.setConnected(true);
            animLine = drawLine(f.x, f.y, f.x, f.y);
        }
        progress = Math.min(progress + speed, dist);
        const ratio = progress / dist;
        animLine.setAttribute('x2', f.x + dx * ratio);
        animLine.setAttribute('y2', f.y + dy * ratio);
        if (progress >= dist) {
            t.setConnected(true);
            animLine = null;
            progress = 0;
            segmentIndex++;
        }
        requestAnimationFrame(animate);
    }
    animate();
}

function clear() {
    circles.forEach(c => {
        c.connected = false;
        c.el.classList.remove('invalid');
    });
    svg.querySelectorAll('.line').forEach(l => l.remove());
    if (tempLine) {
        svg.removeChild(tempLine);
        tempLine = null;
    }
    dragging = null;
    setMessage('');
}

function simulatePathsSequentially(allPaths, index = 0) {
    if (simCancelled || index >= allPaths.length) {
        setLocked(false);
        stopStopwatch();
        resetStopwatch();
        setMessage('');
        return;
    }
    clear();
    setMessage(`${index + 1} of ${allPaths.length}`);
    drawPattern(allPaths[index], 1000, () => {
        simTimeout = setTimeout(() => simulatePathsSequentially(allPaths, index + 1));
    });
}

buildCircles();
renderGrid();
setupDragEvents();

clearBtn.addEventListener('click', clear);

stopBtn.addEventListener('click', () => {
    simCancelled = true;
    stopBtn.disabled = true;
    paused = false;
    resumeFn = null;
    pauseBtn.textContent = 'Pause';
    clearTimeout(simTimeout);
    stopStopwatch();
    resetStopwatch();
    setLocked(false);
    clear();
});

pauseBtn.addEventListener('click', () => {
    if (!paused) {
        paused = true;
        pauseBtn.textContent = 'Resume';
        stopStopwatch();
    } else {
        paused = false;
        pauseBtn.textContent = 'Pause';
        startStopwatch();
        if (resumeFn) {
            resumeFn();
            resumeFn = null;
        }
    }
});

simBtn.addEventListener('click', () => {
    if (locked) return;
    simCancelled = false;
    paused = false;
    resumeFn = null;
    pauseBtn.textContent = 'Pause';
    setLocked(true);
    resetStopwatch();
    startStopwatch();
    setTimeout(() => simulatePathsSequentially(calPaths()), 50);
});