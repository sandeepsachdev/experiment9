// Raid on Bungeling Bay -- HTML5 Canvas tribute
// Top-down helicopter shooter. Destroy 6 factories before the threat hits 100%.

(() => {
    'use strict';

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const mini = document.getElementById('minimap');
    const miniCtx = mini.getContext('2d');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMessage = document.getElementById('overlay-message');
    const startBtn = document.getElementById('start-btn');

    const hud = {
        score: document.getElementById('hud-score'),
        hp: document.getElementById('hud-hp'),
        ammo: document.getElementById('hud-ammo'),
        bombs: document.getElementById('hud-bombs'),
        factories: document.getElementById('hud-factories'),
        threat: document.getElementById('hud-threat'),
    };

    const VIEW_W = canvas.width;
    const VIEW_H = canvas.height;
    const WORLD_W = 2400;
    const WORLD_H = 2400;

    const keys = Object.create(null);
    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'p') paused = !paused;
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    // -- World entities --
    let player, carrier, islands, factories, enemies, bullets, bombs, particles, popups;
    let score = 0;
    let threat = 0;       // 0..100, when 100 -> game over
    let timeAlive = 0;
    let paused = false;
    let running = false;
    let lastTimestamp = 0;

    function rand(min, max) { return Math.random() * (max - min) + min; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // ---------- Initialization ----------
    function reset() {
        score = 0;
        threat = 0;
        timeAlive = 0;
        bullets = [];
        bombs = [];
        enemies = [];
        particles = [];
        popups = [];

        carrier = {
            x: 300, y: WORLD_H - 250,
            vx: 0.25, vy: 0,
            heading: 0,
            w: 90, h: 40,
            hp: 500,
        };

        player = {
            x: carrier.x, y: carrier.y - 50,
            vx: 0, vy: 0,
            heading: -Math.PI / 2,
            hp: 100, maxHp: 100,
            ammo: 30, maxAmmo: 30,
            bombs: 8, maxBombs: 8,
            cooldown: 0,
            bombCooldown: 0,
            radius: 12,
            landed: false,
            rearmTimer: 0,
        };

        islands = buildIslands();
        factories = islands.filter(i => i.factory).map(i => ({
            x: i.x, y: i.y - 5, hp: 6, island: i, fireCooldown: rand(2, 4),
        }));

        // AA guns on each island
        for (const isl of islands) {
            const count = isl.factory ? 2 : 1;
            for (let i = 0; i < count; i++) {
                enemies.push({
                    type: 'aa',
                    x: isl.x + rand(-isl.r * 0.6, isl.r * 0.6),
                    y: isl.y + rand(-isl.r * 0.6, isl.r * 0.6),
                    hp: 2,
                    cooldown: rand(1, 3),
                });
            }
        }

        // Patrol ships
        for (let i = 0; i < 6; i++) {
            enemies.push({
                type: 'ship',
                x: rand(200, WORLD_W - 200),
                y: rand(200, WORLD_H - 200),
                vx: rand(-0.4, 0.4),
                vy: rand(-0.4, 0.4),
                hp: 3,
                cooldown: rand(2, 5),
            });
        }
    }

    function buildIslands() {
        // Six factories spread across the bay, plus a few decorative islands.
        const list = [];
        const factorySpots = [
            { x: 700,  y: 500 },
            { x: 1400, y: 400 },
            { x: 2000, y: 700 },
            { x: 600,  y: 1300 },
            { x: 1700, y: 1500 },
            { x: 1200, y: 1900 },
        ];
        for (const p of factorySpots) {
            list.push({ x: p.x, y: p.y, r: 80, factory: true });
        }
        // Decorative atolls
        for (let i = 0; i < 8; i++) {
            list.push({
                x: rand(200, WORLD_W - 200),
                y: rand(200, WORLD_H - 400),
                r: rand(30, 60),
                factory: false,
            });
        }
        return list;
    }

    // ---------- Update ----------
    function update(dt) {
        timeAlive += dt;
        // Threat grows faster the more factories remain
        const remaining = factories.length;
        threat += dt * (0.4 + remaining * 0.35);
        if (threat >= 100) {
            return gameOver('THE DOOMSDAY WEAPON HAS LAUNCHED', false);
        }

        updatePlayer(dt);
        updateCarrier(dt);
        updateEnemies(dt);
        updateBullets(dt);
        updateBombs(dt);
        updateParticles(dt);
        updatePopups(dt);

        // Win
        if (factories.length === 0) {
            return gameOver('ALL FACTORIES DESTROYED -- MISSION COMPLETE', true);
        }
    }

    function updatePlayer(dt) {
        const accel = 220;     // px/s^2
        const maxSpeed = 240;
        const drag = 0.96;

        const up = keys['w'] || keys['arrowup'];
        const down = keys['s'] || keys['arrowdown'];
        const left = keys['a'] || keys['arrowleft'];
        const right = keys['d'] || keys['arrowright'];

        let ax = 0, ay = 0;
        if (up) ay -= 1;
        if (down) ay += 1;
        if (left) ax -= 1;
        if (right) ax += 1;
        const len = Math.hypot(ax, ay);
        if (len > 0) { ax /= len; ay /= len; }

        player.vx += ax * accel * dt;
        player.vy += ay * accel * dt;
        player.vx *= drag;
        player.vy *= drag;
        const sp = Math.hypot(player.vx, player.vy);
        if (sp > maxSpeed) {
            player.vx = player.vx / sp * maxSpeed;
            player.vy = player.vy / sp * maxSpeed;
        }
        if (sp > 6) {
            player.heading = Math.atan2(player.vy, player.vx);
        }

        player.x = clamp(player.x + player.vx * dt, 20, WORLD_W - 20);
        player.y = clamp(player.y + player.vy * dt, 20, WORLD_H - 20);

        // Bullet firing
        player.cooldown -= dt;
        if (keys[' '] && player.cooldown <= 0 && player.ammo > 0) {
            const spd = 480;
            bullets.push({
                from: 'player',
                x: player.x + Math.cos(player.heading) * 18,
                y: player.y + Math.sin(player.heading) * 18,
                vx: Math.cos(player.heading) * spd + player.vx,
                vy: Math.sin(player.heading) * spd + player.vy,
                life: 1.2,
                dmg: 1,
            });
            player.ammo -= 1;
            player.cooldown = 0.12;
        }

        // Bomb drop
        player.bombCooldown -= dt;
        if (keys['f'] && player.bombCooldown <= 0 && player.bombs > 0) {
            bombs.push({
                x: player.x, y: player.y,
                vx: player.vx * 0.4, vy: player.vy * 0.4,
                fuse: 0.9,
                radius: 4,
                blast: 70,
            });
            player.bombs -= 1;
            player.bombCooldown = 0.4;
        }

        // Rearm if on carrier
        const onCarrier = Math.abs(player.x - carrier.x) < carrier.w / 2 &&
                          Math.abs(player.y - carrier.y) < carrier.h / 2 &&
                          sp < 40;
        if (onCarrier) {
            player.rearmTimer += dt;
            if (player.rearmTimer > 0.5) {
                player.rearmTimer = 0;
                if (player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 8);
                if (player.ammo < player.maxAmmo) player.ammo = Math.min(player.maxAmmo, player.ammo + 6);
                if (player.bombs < player.maxBombs) player.bombs = Math.min(player.maxBombs, player.bombs + 1);
                addPopup(player.x, player.y - 20, 'REARM', '#7fffa0');
            }
            player.landed = true;
        } else {
            player.landed = false;
            player.rearmTimer = 0;
        }
    }

    function updateCarrier(dt) {
        carrier.x += carrier.vx * dt * 30;
        if (carrier.x < 200 || carrier.x > WORLD_W - 200) carrier.vx *= -1;
    }

    function updateEnemies(dt) {
        for (const e of enemies) {
            if (e.type === 'aa') {
                e.cooldown -= dt;
                const d = dist(e, player);
                if (d < 280 && e.cooldown <= 0) {
                    fireAt(e, player, 220, 'enemy', 8, 1);
                    e.cooldown = rand(1.3, 2.5);
                }
            } else if (e.type === 'ship') {
                e.x += e.vx * dt * 30;
                e.y += e.vy * dt * 30;
                if (e.x < 100 || e.x > WORLD_W - 100) e.vx *= -1;
                if (e.y < 100 || e.y > WORLD_H - 100) e.vy *= -1;
                e.cooldown -= dt;
                const d = dist(e, player);
                if (d < 350 && e.cooldown <= 0) {
                    fireAt(e, player, 200, 'enemy', 6, 1);
                    e.cooldown = rand(1.8, 3.2);
                }
            } else if (e.type === 'jet') {
                // Pursuit
                const ang = Math.atan2(player.y - e.y, player.x - e.x);
                e.vx = Math.cos(ang) * 140;
                e.vy = Math.sin(ang) * 140;
                e.x += e.vx * dt;
                e.y += e.vy * dt;
                e.cooldown -= dt;
                if (e.cooldown <= 0 && dist(e, player) < 500) {
                    fireAt(e, player, 320, 'enemy', 10, 1);
                    e.cooldown = rand(1.2, 2.0);
                }
                e.life -= dt;
                if (e.life <= 0) e.hp = 0;
            }
        }
        enemies = enemies.filter(e => e.hp > 0);

        // Factories occasionally launch jets at higher threat
        for (const f of factories) {
            f.fireCooldown -= dt;
            if (f.fireCooldown <= 0) {
                if (threat > 30 && enemies.filter(e => e.type === 'jet').length < 3) {
                    enemies.push({
                        type: 'jet',
                        x: f.x, y: f.y,
                        vx: 0, vy: 0,
                        hp: 2,
                        cooldown: 0.8,
                        life: 20,
                    });
                }
                f.fireCooldown = rand(6, 12) - threat * 0.04;
            }
        }
    }

    function fireAt(src, tgt, spd, owner, dmg, count) {
        const ang = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        bullets.push({
            from: owner,
            x: src.x, y: src.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 2.0,
            dmg,
        });
    }

    function updateBullets(dt) {
        for (const b of bullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            if (b.from === 'player') {
                for (const e of enemies) {
                    if (dist(b, e) < 14) {
                        e.hp -= b.dmg;
                        b.life = 0;
                        spark(b.x, b.y, '#ffae3b');
                        if (e.hp <= 0) {
                            score += e.type === 'jet' ? 250 : (e.type === 'ship' ? 200 : 100);
                            explode(e.x, e.y, e.type === 'ship' ? 1.4 : 1.0);
                        }
                        break;
                    }
                }
                // Bullets damage factories lightly
                for (const f of factories) {
                    if (dist(b, f) < 28) {
                        b.life = 0;
                        spark(b.x, b.y, '#ffae3b');
                        // No factory damage from bullets (need bombs)
                        break;
                    }
                }
            } else {
                if (dist(b, player) < player.radius && !player.landed) {
                    player.hp -= b.dmg * 6;
                    b.life = 0;
                    spark(player.x, player.y, '#ff5050');
                    if (player.hp <= 0) {
                        explode(player.x, player.y, 2.0);
                        return gameOver('YOUR HELICOPTER WAS DESTROYED', false);
                    }
                }
            }
        }
        bullets = bullets.filter(b => b.life > 0 &&
            b.x > -10 && b.x < WORLD_W + 10 && b.y > -10 && b.y < WORLD_H + 10);
    }

    function updateBombs(dt) {
        for (const b of bombs) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vx *= 0.96;
            b.vy *= 0.96;
            b.fuse -= dt;
            if (b.fuse <= 0) detonate(b);
        }
        bombs = bombs.filter(b => b.fuse > 0);
    }

    function detonate(b) {
        explode(b.x, b.y, 2.2);
        // Factory damage
        for (let i = factories.length - 1; i >= 0; i--) {
            const f = factories[i];
            if (dist(b, f) < b.blast) {
                f.hp -= 2;
                score += 50;
                addPopup(f.x, f.y - 30, '-2', '#ffd84a');
                if (f.hp <= 0) {
                    factories.splice(i, 1);
                    score += 1000;
                    threat = Math.max(0, threat - 8);
                    bigExplode(f.x, f.y);
                    addPopup(f.x, f.y - 30, 'FACTORY DOWN +1000', '#7fffa0');
                }
            }
        }
        // Enemy damage
        for (const e of enemies) {
            if (dist(b, e) < b.blast) {
                e.hp -= 2;
                if (e.hp <= 0) {
                    score += e.type === 'jet' ? 250 : (e.type === 'ship' ? 200 : 100);
                    explode(e.x, e.y, 1.2);
                }
            }
        }
        // Self damage if you bomb yourself
        if (dist(b, player) < b.blast && !player.landed) {
            player.hp -= 25;
            if (player.hp <= 0) {
                explode(player.x, player.y, 2.0);
                return gameOver('YOU WERE CAUGHT IN YOUR OWN BLAST', false);
            }
        }
    }

    function spark(x, y, color) {
        for (let i = 0; i < 4; i++) {
            particles.push({
                x, y,
                vx: rand(-60, 60), vy: rand(-60, 60),
                life: rand(0.15, 0.35), color, r: 1.5,
            });
        }
    }

    function explode(x, y, scale) {
        for (let i = 0; i < 22 * scale; i++) {
            particles.push({
                x, y,
                vx: rand(-160, 160) * scale,
                vy: rand(-160, 160) * scale,
                life: rand(0.4, 0.9),
                color: i % 3 === 0 ? '#ffd84a' : (i % 3 === 1 ? '#ff7a1a' : '#ff3030'),
                r: rand(1.5, 3) * scale,
            });
        }
    }

    function bigExplode(x, y) {
        explode(x, y, 3.0);
        for (let i = 0; i < 40; i++) {
            particles.push({
                x, y,
                vx: rand(-260, 260),
                vy: rand(-260, 260),
                life: rand(0.8, 1.4),
                color: '#3a2310',
                r: rand(3, 6),
            });
        }
    }

    function updateParticles(dt) {
        for (const p of particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.life -= dt;
        }
        particles = particles.filter(p => p.life > 0);
    }

    function addPopup(x, y, text, color) {
        popups.push({ x, y, text, color, life: 1.2 });
    }
    function updatePopups(dt) {
        for (const p of popups) {
            p.y -= 24 * dt;
            p.life -= dt;
        }
        popups = popups.filter(p => p.life > 0);
    }

    // ---------- Drawing ----------
    function camera() {
        return {
            x: clamp(player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W),
            y: clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H),
        };
    }

    function draw() {
        const cam = camera();
        // Ocean
        ctx.fillStyle = '#0c3a6e';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawWaves(cam);

        // Islands
        for (const isl of islands) {
            const sx = isl.x - cam.x, sy = isl.y - cam.y;
            if (sx < -120 || sx > VIEW_W + 120 || sy < -120 || sy > VIEW_H + 120) continue;
            // Beach ring
            ctx.fillStyle = '#e8d28a';
            ctx.beginPath();
            ctx.arc(sx, sy, isl.r + 6, 0, Math.PI * 2);
            ctx.fill();
            // Grass
            ctx.fillStyle = isl.factory ? '#3d7e3b' : '#4a8d44';
            ctx.beginPath();
            ctx.arc(sx, sy, isl.r, 0, Math.PI * 2);
            ctx.fill();
            // Detail
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.arc(sx - isl.r * 0.3, sy - isl.r * 0.2, isl.r * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Factories
        for (const f of factories) {
            drawFactory(f, cam);
        }

        // Carrier
        drawCarrier(carrier, cam);

        // Enemies
        for (const e of enemies) drawEnemy(e, cam);

        // Bombs
        for (const b of bombs) {
            const sx = b.x - cam.x, sy = b.y - cam.y;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ff5050';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 8 * (1 - b.fuse / 0.9), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Bullets
        for (const b of bullets) {
            const sx = b.x - cam.x, sy = b.y - cam.y;
            ctx.fillStyle = b.from === 'player' ? '#ffdd66' : '#ff5050';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player
        drawHelicopter(player, cam);

        // Particles
        for (const p of particles) {
            const sx = p.x - cam.x, sy = p.y - cam.y;
            ctx.globalAlpha = clamp(p.life * 2, 0, 1);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Popups
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        for (const p of popups) {
            ctx.globalAlpha = clamp(p.life, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x - cam.x, p.y - cam.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';

        // Edge markers for off-screen enemies near player
        drawOffscreenMarkers(cam);

        if (paused) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
            ctx.fillStyle = '#ffd84a';
            ctx.font = 'bold 36px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('-- PAUSED --', VIEW_W / 2, VIEW_H / 2);
            ctx.textAlign = 'start';
        }

        drawMinimap();
        drawHud();
    }

    function drawWaves(cam) {
        // Subtle wave grid for motion feedback
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.08)';
        ctx.lineWidth = 1;
        const offX = (-cam.x % 40);
        const offY = (-cam.y % 40);
        for (let x = offX; x < VIEW_W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, VIEW_H);
            ctx.stroke();
        }
        for (let y = offY; y < VIEW_H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(VIEW_W, y);
            ctx.stroke();
        }
    }

    function drawFactory(f, cam) {
        const sx = f.x - cam.x, sy = f.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        // Base
        ctx.fillStyle = '#5a5a64';
        ctx.fillRect(-22, -18, 44, 36);
        // Roof
        ctx.fillStyle = '#7a7280';
        ctx.fillRect(-22, -18, 44, 8);
        // Smokestacks
        ctx.fillStyle = '#2a2a30';
        ctx.fillRect(-14, -28, 6, 12);
        ctx.fillRect(8, -28, 6, 12);
        // Damage indicator
        ctx.fillStyle = '#ff4030';
        ctx.fillRect(-22, 20, 44 * (f.hp / 6), 3);
        ctx.strokeStyle = '#222';
        ctx.strokeRect(-22, 20, 44, 3);
        // Smoke if damaged
        if (f.hp < 4) {
            ctx.fillStyle = 'rgba(60, 60, 60, 0.6)';
            const t = timeAlive * 3;
            ctx.beginPath();
            ctx.arc(-11 + Math.sin(t) * 3, -34 + Math.cos(t) * 2, 5, 0, Math.PI * 2);
            ctx.arc(11 + Math.sin(t + 1) * 3, -34 + Math.cos(t + 1) * 2, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawCarrier(c, cam) {
        const sx = c.x - cam.x, sy = c.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#3a3a44';
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.fillStyle = '#5a5a64';
        ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 4, c.w - 8, c.h - 8);
        // Landing pad markings
        ctx.strokeStyle = '#ffd84a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-c.w / 2 + 8, -c.h / 2 + 8, c.w - 16, c.h - 16);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd84a';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CV-1', 0, 4);
        ctx.textAlign = 'start';
        ctx.restore();
    }

    function drawEnemy(e, cam) {
        const sx = e.x - cam.x, sy = e.y - cam.y;
        if (sx < -30 || sx > VIEW_W + 30 || sy < -30 || sy > VIEW_H + 30) return;
        ctx.save();
        ctx.translate(sx, sy);
        if (e.type === 'aa') {
            ctx.fillStyle = '#7a3030';
            ctx.fillRect(-7, -7, 14, 14);
            // Turret aimed at player
            const ang = Math.atan2(player.y - e.y, player.x - e.x);
            ctx.rotate(ang);
            ctx.fillStyle = '#d04040';
            ctx.fillRect(0, -2, 12, 4);
        } else if (e.type === 'ship') {
            ctx.fillStyle = '#404a55';
            ctx.fillRect(-16, -6, 32, 12);
            ctx.fillStyle = '#606a78';
            ctx.fillRect(-8, -3, 16, 6);
            ctx.fillStyle = '#a04040';
            ctx.fillRect(-2, -2, 4, 4);
        } else if (e.type === 'jet') {
            const ang = Math.atan2(e.vy, e.vx);
            ctx.rotate(ang);
            ctx.fillStyle = '#a04040';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-8, 7);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, -7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#d06060';
            ctx.fillRect(-8, -1.5, 6, 3);
        }
        ctx.restore();
    }

    function drawHelicopter(p, cam) {
        const sx = p.x - cam.x, sy = p.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.heading);
        // Tail boom
        ctx.fillStyle = '#3a4a3a';
        ctx.fillRect(-18, -2, 14, 4);
        // Body
        ctx.fillStyle = '#5a7a55';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cockpit
        ctx.fillStyle = '#a0d0ff';
        ctx.beginPath();
        ctx.ellipse(5, 0, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rotor (spinning)
        const rotorAngle = (timeAlive * 30) % (Math.PI * 2);
        ctx.strokeStyle = 'rgba(20,20,20,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAngle) * 18, Math.sin(rotorAngle) * 18);
        ctx.lineTo(-Math.cos(rotorAngle) * 18, -Math.sin(rotorAngle) * 18);
        ctx.moveTo(Math.cos(rotorAngle + Math.PI / 2) * 18, Math.sin(rotorAngle + Math.PI / 2) * 18);
        ctx.lineTo(-Math.cos(rotorAngle + Math.PI / 2) * 18, -Math.sin(rotorAngle + Math.PI / 2) * 18);
        ctx.stroke();
        // Tail rotor
        ctx.strokeStyle = 'rgba(20,20,20,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-18, -4);
        ctx.lineTo(-18, 4);
        ctx.stroke();
        ctx.restore();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx + 8, sy + 12, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawOffscreenMarkers(cam) {
        for (const e of enemies) {
            const sx = e.x - cam.x, sy = e.y - cam.y;
            if (sx >= 0 && sx <= VIEW_W && sy >= 0 && sy <= VIEW_H) continue;
            const cx = VIEW_W / 2, cy = VIEW_H / 2;
            const ang = Math.atan2(sy - cy, sx - cx);
            const mx = cx + Math.cos(ang) * (VIEW_W / 2 - 18);
            const my = cy + Math.sin(ang) * (VIEW_H / 2 - 18);
            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(ang);
            ctx.fillStyle = '#ff5050';
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, 4);
            ctx.lineTo(-4, -4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    function drawMinimap() {
        const w = mini.width, h = mini.height;
        const sx = w / WORLD_W, sy = h / WORLD_H;
        miniCtx.fillStyle = '#082445';
        miniCtx.fillRect(0, 0, w, h);
        // Islands
        for (const isl of islands) {
            miniCtx.fillStyle = isl.factory ? '#4f9d49' : '#3d7e3b';
            miniCtx.beginPath();
            miniCtx.arc(isl.x * sx, isl.y * sy, Math.max(2, isl.r * sx * 0.8), 0, Math.PI * 2);
            miniCtx.fill();
        }
        // Factories (highlighted)
        for (const f of factories) {
            miniCtx.fillStyle = '#ffd84a';
            miniCtx.fillRect(f.x * sx - 2, f.y * sy - 2, 4, 4);
        }
        // Enemies
        for (const e of enemies) {
            miniCtx.fillStyle = e.type === 'jet' ? '#ff7060' : '#ff3030';
            miniCtx.fillRect(e.x * sx - 1, e.y * sy - 1, 2, 2);
        }
        // Carrier
        miniCtx.fillStyle = '#80c0ff';
        miniCtx.fillRect(carrier.x * sx - 3, carrier.y * sy - 2, 6, 4);
        // Player
        miniCtx.fillStyle = '#ffffff';
        miniCtx.fillRect(player.x * sx - 2, player.y * sy - 2, 4, 4);
        // Viewport rectangle
        const cam = camera();
        miniCtx.strokeStyle = 'rgba(255,255,255,0.4)';
        miniCtx.strokeRect(cam.x * sx, cam.y * sy, VIEW_W * sx, VIEW_H * sy);
    }

    function drawHud() {
        hud.score.textContent = score;
        hud.hp.textContent = Math.max(0, Math.round(player.hp));
        hud.ammo.textContent = player.ammo;
        hud.bombs.textContent = player.bombs;
        hud.factories.textContent = factories.length;
        const t = Math.min(100, Math.floor(threat));
        hud.threat.textContent = t + '%';
        hud.threat.style.color = t > 70 ? '#ff5050' : (t > 40 ? '#ff9a3a' : '#ffd84a');
    }

    // ---------- Loop ----------
    function loop(ts) {
        if (!running) return;
        const dt = Math.min(0.05, (ts - lastTimestamp) / 1000 || 0);
        lastTimestamp = ts;
        if (!paused) update(dt);
        draw();
        requestAnimationFrame(loop);
    }

    // ---------- Game state transitions ----------
    function start() {
        reset();
        overlay.classList.add('hidden');
        running = true;
        paused = false;
        lastTimestamp = performance.now();
        requestAnimationFrame(loop);
    }

    function gameOver(message, victory) {
        running = false;
        overlayTitle.textContent = victory ? 'VICTORY' : 'MISSION FAILED';
        overlayMessage.innerHTML = `${message}<br><br>
            Score: <b>${score}</b><br>
            Factories destroyed: <b>${6 - factories.length}</b> / 6<br>
            Time: <b>${Math.floor(timeAlive)}s</b><br><br>
            Submit your callsign:
            <input id="callsign" maxlength="12" value="ACE" style="font-family:inherit;background:#02050d;color:#ffd84a;border:1px solid #ffd84a;padding:4px 8px;text-align:center;letter-spacing:2px;">`;
        startBtn.textContent = 'SUBMIT & PLAY AGAIN';
        overlay.classList.remove('hidden');
        startBtn.onclick = async () => {
            const name = (document.getElementById('callsign')?.value || 'ACE').trim();
            await submitScore(name, score, 6 - factories.length);
            startBtn.textContent = 'START MISSION';
            startBtn.onclick = start;
            start();
        };
    }

    async function submitScore(name, score, factoriesDestroyed) {
        try {
            await fetch('/api/highscores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score, factoriesDestroyed }),
            });
            await loadScores();
        } catch (err) {
            console.warn('Could not submit score', err);
        }
    }

    async function loadScores() {
        try {
            const r = await fetch('/api/highscores');
            const list = await r.json();
            const ol = document.getElementById('highscore-list');
            ol.innerHTML = '';
            for (const s of list) {
                const li = document.createElement('li');
                li.textContent = `${s.name.padEnd(12)} ${String(s.score).padStart(6)}  (${s.factoriesDestroyed}/6)`;
                ol.appendChild(li);
            }
        } catch (err) {
            console.warn('Could not load scores', err);
        }
    }

    startBtn.onclick = start;
    loadScores();
})();
