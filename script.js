const canvas = document.getElementById('holo-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('holo-container');

let width, height;

const config = {
    particleCount: 150,
    radius: 180,
    perspective: 800,
    autoSpeed: 0.002,
    connectionDist: 60,
    dragSensitivity: 0.005,
    friction: 0.95
};

let particles = [];
let isDragging = false;
let startX, startY;
let currentRotationX = 0;
let currentRotationY = config.autoSpeed;
let resizeTimeout;

function resize() {
    if (!container) return;
    
    width = container.offsetWidth || window.innerWidth;
    height = container.offsetHeight || 300;
    
    // Garante mínimo
    if (width < 100) width = 100;
    if (height < 100) height = 100;
    
    canvas.width = width;
    canvas.height = height;

    // --- DETECÇÃO DE DISPOSITIVO ---
    const isMobile = width < 768; // Considera mobile se for menor que tablet

    // --- CALIBRAÇÃO DE TAMANHO (RAIO) ---
    // Desktop: 0.48 (ocupa quase toda a altura disponível, fica imponente)
    // Mobile: 0.30 (fica menorzinho para dar respiro nas bordas)
    const radiusFactor = isMobile ? 0.30 : 0.48;
    
    config.radius = Math.min(width, height) * radiusFactor; 

    // --- CALIBRAÇÃO DE DENSIDADE (QUANTIDADE DE PONTOS) ---
    // Desktop: 150 pontos (visual rico)
    // Mobile: 70 pontos (visual mais limpo e leve para processador de celular)
    const targetParticleCount = isMobile ? 70 : 150;

    // Recria as partículas com a nova quantidade e raio
    particles = [];
    for(let i = 0; i < targetParticleCount; i++) {
        particles.push(new Point3D());
    }
}

// Força resize inicial com delay para garantir que DOM está pronto
setTimeout(resize, 50);

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

canvas.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: false});

canvas.addEventListener('touchend', stopDrag);

function animate() {
    // Verificar se canvas tem dimensões válidas
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        requestAnimationFrame(animate);
        return;
    }

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

// Efeito de Ripple nos botões primários
const btnRippleEffects = document.querySelectorAll('.btn-ripple-effect');
btnRippleEffects.forEach(btn => {
    btn.addEventListener('click', function(e) {
        // Remove a classe se já existir
        this.classList.remove('ripple');
        
        // Força um reflow para reiniciar a animação
        void this.offsetWidth;
        
        // Adiciona a classe para ativar a animação
        this.classList.add('ripple');
    });
});

// ========== MENU MOBILE ==========
// Criar bot�o hamburger dinamicamente em mobile
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarNav = document.querySelector('.sidebar-nav');
    
    // Criar bot�o hamburger
    const hamburger = document.createElement('button');
    hamburger.className = 'hamburger-menu';
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    hamburger.setAttribute('aria-label', 'Menu');
    
    // Inserir hamburger antes da navega��o
    sidebar.appendChild(hamburger);
    
    // Funcionalidade do hamburger
    hamburger.addEventListener('click', function() {
        sidebarNav.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
    
    // Fechar menu ao clicar em um link
    const navLinks = sidebarNav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebarNav.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
    
    // Fechar menu ao redimensionar a janela
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebarNav.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
});
