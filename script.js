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
    friction: 0.95,
    frameSkip: 0 // Para reduzir frame rate em mobile se necessário
};

let particles = [];
let isDragging = false;
let startX, startY;
let currentRotationX = 0;
let currentRotationY = config.autoSpeed;
let resizeTimeout;
let frameCount = 0;
let animationId = null;
let isVisible = true;

function resize() {
    if (!container) return;
    
    width = container.offsetWidth || window.innerWidth;
    height = container.offsetHeight || 300;
    
    // Garante mínimo
    if (width < 100) width = 100;
    if (height < 100) height = 100;
    
    // Usa devicePixelRatio apenas se necessário (evita sobrecarga em mobile)
    const dpr = window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Escala o contexto para alta resolução
    if (dpr !== 1) {
        ctx.scale(dpr, dpr);
    }

    // --- DETECÇÃO DE DISPOSITIVO ---
    const isMobile = width < 768; // Considera mobile se for menor que tablet
    const isSmallMobile = width < 480; // Mobile muito pequeno

    // --- CALIBRAÇÃO DE TAMANHO (RAIO) ---
    // Desktop: 0.48 (ocupa quase toda a altura disponível, fica imponente)
    // Mobile: 0.30 (fica menorzinho para dar respiro nas bordas)
    const radiusFactor = isMobile ? 0.30 : 0.48;
    
    config.radius = Math.min(width, height) * radiusFactor; 

    // --- CALIBRAÇÃO DE DENSIDADE (QUANTIDADE DE PONTOS) ---
    // Desktop: 150 pontos (visual rico)
    // Mobile: 70 pontos (visual mais limpo e leve para processador de celular)
    // Mobile pequeno: 50 pontos (ainda mais leve)
    const targetParticleCount = isSmallMobile ? 50 : (isMobile ? 70 : 150);
    
    // Reduz conexões em mobile para melhor performance
    config.connectionDist = isMobile ? 45 : 60;
    
    // Reduz frame skip em mobile (renderiza menos frames)
    config.frameSkip = isMobile ? 1 : 0;

    // Recria as partículas com a nova quantidade e raio
    particles = [];
    for(let i = 0; i < targetParticleCount; i++) {
        particles.push(new Point3D());
    }
}

// Força resize inicial com delay para garantir que DOM está pronto
setTimeout(resize, 50);

// Otimização: Debounce do resize para melhor performance
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resize();
    }, 150);
}, { passive: true });

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
    
    // Pausar rotação automática durante o drag
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        currentRotationY = deltaX * config.dragSensitivity;
        currentRotationX = deltaY * config.dragSensitivity;
    }
}

function stopDrag() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener('mouseup', stopDrag);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        startDrag(touch.clientX - rect.left, touch.clientY - rect.top);
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        moveDrag(touch.clientX - rect.left, touch.clientY - rect.top);
    }
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopDrag();
}, {passive: false});

canvas.addEventListener('touchcancel', stopDrag);

function animate() {
    // Verificar se canvas tem dimensões válidas
    if (!canvas || canvas.width <= 0 || canvas.height <= 0 || !isVisible) {
        animationId = requestAnimationFrame(animate);
        return;
    }

    // Frame skipping para mobile (reduz carga de CPU)
    frameCount++;
    if (config.frameSkip > 0 && frameCount % (config.frameSkip + 1) !== 0) {
        animationId = requestAnimationFrame(animate);
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

    // Otimização: limitar número de conexões verificadas
    const maxConnections = config.particleCount < 100 ? projectedPoints.length : Math.min(projectedPoints.length, 100);
    
    for (let i = 0; i < maxConnections; i++) {
        for (let j = i + 1; j < Math.min(i + 20, projectedPoints.length); j++) {
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

    animationId = requestAnimationFrame(animate);
}

// Otimização: Pausar animação quando a aba não está visível
document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible && !animationId) {
        animate();
    }
});

animate();

// Destacar o link da sidebar baseado na seção visível (otimizado com throttle)
function highlightCurrentSection() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    let ticking = false;

    const updateActiveSection = () => {
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
        
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateActiveSection);
            ticking = true;
        }
    }, { passive: true });
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
    hamburger.setAttribute('aria-expanded', 'false');
    
    // Inserir hamburger antes da navega��o
    sidebar.appendChild(hamburger);
    
    // Funcionalidade do hamburger
    hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = sidebarNav.classList.toggle('active');
        hamburger.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        
        // Previne scroll do body quando menu está aberto
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
    
    // Fechar menu ao clicar em um link
    const navLinks = sidebarNav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebarNav.classList.remove('active');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
    
    // Fechar menu ao clicar fora
    document.addEventListener('click', function(e) {
        if (sidebarNav.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !sidebarNav.contains(e.target) &&
            !hamburger.contains(e.target)) {
            sidebarNav.classList.remove('active');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    });
    
    // Fechar menu ao redimensionar a janela
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebarNav.classList.remove('active');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }
    }, { passive: true });
});
