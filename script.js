const canvas = document.getElementById('holo-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('holo-container');

let width, height;

const config = {
    particleCount: 150,
    radius: 180,
    perspective: 800,
    autoSpeed: 0.002,      // Velocidade da rotação automática (lenta)
    connectionDist: 60,
    dragSensitivity: 0.005, // Quão rápido ele gira quando você arrasta
    friction: 0.95
};

let particles = [];
let isDragging = false;
let startX, startY;
let currentRotationX = 0; // Velocidade atual no eixo X (Cima/Baixo)
let currentRotationY = config.autoSpeed;

function resize() {
    width = container.offsetWidth;
    height = container.offsetHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

class Point3D {
    constructor() {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        this.x = config.radius * Math.sin(phi) * Math.cos(theta);
        this.y = config.radius * Math.sin(phi) * Math.sin(theta);
        this.z = config.radius * Math.cos(phi);
        
        this.baseColor = Math.random() > 0.5 ? '#9D46FF' : '#00FFFF';
    }

    rotate(rotationX, rotationY) {
        let dy = this.y * Math.cos(rotationX) - this.z * Math.sin(rotationX);
        let dz = this.y * Math.sin(rotationX) + this.z * Math.cos(rotationX);
        this.y = dy;
        this.z = dz;
        let dx = this.x * Math.cos(rotationY) - this.z * Math.sin(rotationY);
        dz = this.x * Math.sin(rotationY) + this.z * Math.cos(rotationY);
        this.x = dx;
        this.z = dz;
    }

    project() {
        const scale = config.perspective / (config.perspective + this.z);
        const x2d = (this.x * scale) + width / 2;
        const y2d = (this.y * scale) + height / 2;
        return { x: x2d, y: y2d, scale: scale };
    }
}

// Criar partículas
for(let i = 0; i < config.particleCount; i++) {
    particles.push(new Point3D());
}

function startDrag(x, y) {
    isDragging = true;
    startX = x;
    startY = y;
    canvas.style.cursor = 'grabbing';
}

function moveDrag(x, y) {
    if (!isDragging) return;
    
    const deltaX = x - startX;
    const deltaY = y - startY;
    currentRotationY = deltaX * config.dragSensitivity;
    currentRotationX = deltaY * config.dragSensitivity;

    startX = x;
    startY = y;
}

function stopDrag() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener('mouseup', stopDrag);

canvas.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY), {passive: false});
window.addEventListener('touchmove', (e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY), {passive: false});
window.addEventListener('touchend', stopDrag);

function animate() {
    ctx.clearRect(0, 0, width, height);
    if (!isDragging) {
        currentRotationX *= config.friction;
        currentRotationY *= config.friction;
        if (Math.abs(currentRotationY) < config.autoSpeed) {
            currentRotationY = config.autoSpeed;
        }
    }

    const projectedPoints = [];

    particles.forEach(p => {
        p.rotate(currentRotationX, currentRotationY);
        
        const proj = p.project();
        projectedPoints.push({ proj: proj, color: p.baseColor });
        
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 2 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = p.baseColor;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    for (let i = 0; i < projectedPoints.length; i++) {
        for (let j = i + 1; j < projectedPoints.length; j++) {
            const p1 = projectedPoints[i];
            const p2 = projectedPoints[j];
            
            const dx = p1.proj.x - p2.proj.x;
            const dy = p1.proj.y - p2.proj.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < config.connectionDist) {
                ctx.beginPath();
                ctx.moveTo(p1.proj.x, p1.proj.y);
                ctx.lineTo(p2.proj.x, p2.proj.y);
                ctx.strokeStyle = `rgba(0, 255, 255, ${1 - dist/config.connectionDist})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animate);
}

animate();

// Destacar o link da sidebar baseado na seção visível
function highlightCurrentSection() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    window.addEventListener('scroll', () => {
        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            // Se a seção está na viewport
            if (window.pageYOffset >= sectionTop - 300) {
                currentSection = section.getAttribute('id');
            }
        });

        // Remove a classe "active" de todos os links
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Adiciona a classe "active" ao link que corresponde à seção atual
        if (currentSection) {
            const activeLink = document.querySelector(`.sidebar-nav a[href="#${currentSection}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    });
}

highlightCurrentSection();

// Efeito de Ripple no botão de orçamento
const btnAction = document.querySelector('.btn-action');
if (btnAction) {
    btnAction.addEventListener('click', function(e) {
        // Remove a classe se já existir
        this.classList.remove('active');
        
        // Força um reflow para reiniciar a animação
        void this.offsetWidth;
        
        // Adiciona a classe para ativar a animação
        this.classList.add('active');
    });
}