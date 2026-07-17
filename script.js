// ---- Theme toggle ----
const root = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');

function setTheme(dark){
  root.classList.toggle('dark', dark);
  iconSun.style.display = dark ? 'none' : 'inline-block';
  iconMoon.style.display = dark ? 'inline-block' : 'none';
}
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
setTheme(prefersDark);

function toggleThemeAt(x, y){
  const goingDark = !root.classList.contains('dark');
  if(!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    setTheme(goingDark); return;
  }
  const transition = document.startViewTransition(() => setTheme(goingDark));
  transition.ready.then(() => {
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
      { duration:650, easing:'cubic-bezier(.65,0,.35,1)', pseudoElement:'::view-transition-new(root)' }
    );
  });
}
themeBtn.addEventListener('click', (e) => {
  const r = themeBtn.getBoundingClientRect();
  toggleThemeAt(r.left + r.width / 2, r.top + r.height / 2);
});

// ---- Mobile menu ----
const menuToggle = document.getElementById('menuToggle');
const navlinks = document.getElementById('navlinks');
menuToggle.addEventListener('click', () => navlinks.classList.toggle('open'));
navlinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navlinks.classList.remove('open')));

// ---- Active nav + header CTA ----
const sections = ['experience','skills','projects','education','contact'].map(id => document.getElementById(id));
const navA = document.querySelectorAll('[data-nav]');
const headerCta = document.getElementById('ctaHeader');
const hero = document.getElementById('hero');

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting)
      navA.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin:'-45% 0px -50% 0px', threshold:0 });
sections.forEach(s => s && io.observe(s));

const heroIo = new IntersectionObserver((entries) => {
  entries.forEach(entry => { headerCta.style.display = entry.isIntersecting ? 'none' : 'inline-flex'; });
}, { threshold:0 });
heroIo.observe(hero);

// ---- Scroll reveal ----
(function initReveal(){
  ['.exp-list-wrap .exp-card','.skill-grid .skill-card','.proj-grid .proj-card','.cert-list .cert-item']
    .forEach(sel => document.querySelectorAll(sel).forEach((el,i) => el.style.transitionDelay = (i*.09)+'s'));

  const revealIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('in-view'); revealIo.unobserve(entry.target); }
    });
  }, { threshold:0.15, rootMargin:'0px 0px -80px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealIo.observe(el));
})();

// ---- Metal card: cursor-tracked specular reflection + 3-D tilt ----
(function initCardTilt(){
  const card = document.getElementById('appleCard');
  if(!card) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MAX_TILT   = 12;   // degrees — refined down from 14 for a more premium feel
  const SPRING     = 0.12; // lerp factor for smooth continuous tracking
  const MIN_TRANSITION_MS = 4; // nearly instant during tracking

  // Current animated state
  let targetRx = 0, targetRy = 0;
  let currentRx = 0, currentRy = 0;
  let targetMx = 28, targetMy = 22; // specular hotspot %
  let currentMx = 28, currentMy = 22;
  let isHovering = false;
  let rafId = null;

  /*
    Shadow generation: the cast shadow shifts in the opposite direction
    of the tilt so the card appears to lift and lean over its shadow.
    Two directional shadows: a near sharp one and a far diffuse one.
  */
  function buildShadow(rx, ry){
    // ry positive → card leans right → shadow extends left
    const ox = (-ry * 1.4).toFixed(2);
    // rx positive → card tilts back top → shadow extends down
    const oy = (rx * 1.0).toFixed(2);
    const tiltMag = Math.sqrt(rx * rx + ry * ry) / MAX_TILT; // 0–1
    const bloom   = (0.30 + tiltMag * 0.12).toFixed(3);
    const lift    = (0.26 + tiltMag * 0.10).toFixed(3);
    return `
      inset 0 1px 0 hsl(var(--background) / .22),
      inset 0 -1px 0 hsl(0 0% 0% / .18),
      inset 0 0 0 1px hsl(var(--background) / .11),
      0 2px 4px -1px hsl(var(--foreground) / .20),
      ${ox}px ${oy}px 22px -4px hsl(var(--foreground) / ${lift}),
      ${(ox * 1.6).toFixed(2)}px ${(oy * 1.6).toFixed(2)}px 52px -12px hsl(var(--foreground) / ${bloom}),
      0 40px 80px -24px hsl(var(--foreground) / .22)
    `;
  }

  // Resting shadow (cursor off card)
  const RESTING_SHADOW = `
    inset 0 1px 0 hsl(var(--background) / .20),
    inset 0 -1px 0 hsl(0 0% 0% / .16),
    inset 0 0 0 1px hsl(var(--background) / .10),
    0 2px 6px -1px hsl(var(--foreground) / .22),
    0 8px 20px -6px hsl(var(--foreground) / .28),
    0 28px 56px -16px hsl(var(--foreground) / .32)
  `;

  function lerp(a, b, t){ return a + (b - a) * t; }

  function tick(){
    if(!isHovering && Math.abs(currentRx) < 0.01 && Math.abs(currentRy) < 0.01){
      // Fully settled at rest — stop the loop
      currentRx = 0; currentRy = 0;
      currentMx = 28; currentMy = 22;
      card.style.transform  = '';
      card.style.boxShadow  = RESTING_SHADOW;
      card.style.setProperty('--mx', '28');
      card.style.setProperty('--my', '22');
      card.style.transition = `transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s cubic-bezier(0.23,1,0.32,1)`;
      rafId = null;
      return;
    }

    // Spring towards target
    const sp = isHovering ? SPRING : SPRING * 0.65; // slower spring-back
    currentRx = lerp(currentRx, targetRx, sp);
    currentRy = lerp(currentRy, targetRy, sp);
    currentMx = lerp(currentMx, targetMx, sp);
    currentMy = lerp(currentMy, targetMy, sp);

    const scale = isHovering ? 1.022 : 1;

    card.style.transition = 'none';
    card.style.transform  = `rotateX(${currentRx.toFixed(3)}deg) rotateY(${currentRy.toFixed(3)}deg) scale(${scale})`;
    card.style.boxShadow  = buildShadow(currentRx, currentRy);
    card.style.setProperty('--mx', currentMx.toFixed(2));
    card.style.setProperty('--my', currentMy.toFixed(2));

    rafId = requestAnimationFrame(tick);
  }

  function startLoop(){
    if(!rafId) rafId = requestAnimationFrame(tick);
  }

  card.addEventListener('mouseenter', () => {
    isHovering = true;
    card.classList.add('card-active');
    startLoop();
  });

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    // Normalised cursor position: 0 at left/top → 1 at right/bottom
    const nx = (e.clientX - rect.left)  / rect.width;   // 0–1
    const ny = (e.clientY - rect.top)   / rect.height;  // 0–1

    // Tilt: centred, ±1
    const dx = nx * 2 - 1;
    const dy = ny * 2 - 1;

    targetRy =  dx * MAX_TILT;
    targetRx = -dy * MAX_TILT;

    // Specular hotspot follows cursor directly (in 0–100 space for CSS)
    // Slight exaggeration so the hotspot moves visibly
    targetMx = nx * 100;
    targetMy = ny * 100;
  });

  card.addEventListener('mouseleave', () => {
    isHovering = false;
    targetRx = 0;
    targetRy = 0;
    targetMx = 28;
    targetMy = 22;
    card.classList.remove('card-active');
    startLoop(); // continue running until fully settled
  });

  // Touch support (reduced tilt)
  card.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const rect  = card.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (touch.clientX - rect.left)  / rect.width));
    const ny = Math.max(0, Math.min(1, (touch.clientY - rect.top)   / rect.height));
    const dx = nx * 2 - 1;
    const dy = ny * 2 - 1;
    targetRy =  dx * MAX_TILT * 0.55;
    targetRx = -dy * MAX_TILT * 0.55;
    targetMx = nx * 100;
    targetMy = ny * 100;
    if(!isHovering){ isHovering = true; card.classList.add('card-active'); startLoop(); }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    isHovering = false;
    targetRx = 0; targetRy = 0;
    targetMx = 28; targetMy = 22;
    card.classList.remove('card-active');
    startLoop();
  });

  // Initialise CSS properties so the ::before gradient has values from the start
  card.style.setProperty('--mx', '28');
  card.style.setProperty('--my', '22');
})();

// ---- Typewriter console ----
const queryLinesData = [
  {
    text:"SELECT name, role, based_in, focus, degree",
    html:'<span class="c-kw">SELECT</span> <span class="c-col">name</span>, <span class="c-col">role</span>, <span class="c-col">based_in</span>, <span class="c-col">focus</span>, <span class="c-col">degree</span>'
  },
  {
    text:"FROM professionals",
    html:'<span class="c-kw">FROM</span> <span class="c-fn">professionals</span>'
  },
  {
    text:"WHERE id = 'ken_joshua';",
    html:'<span class="c-kw">WHERE</span> id = <span class="c-str">\'ken_joshua\'</span>;'
  },
];
const queryPlainText = "SELECT name, role, based_in, focus, degree\nFROM professionals\nWHERE id = 'ken_joshua';";

const body    = document.getElementById('consoleBody');
const lineNums= document.getElementById('consoleLines');
const resultWrap= document.getElementById('resultWrap');
const footerMeta= document.getElementById('footerMeta');
let li = 0;

function finishTyping(){
  const c = document.createElement('span'); c.className='caret'; body.appendChild(c);
  setTimeout(() => { c.remove(); resultWrap.classList.add('show'); footerMeta.textContent='5 rows · 12 ms'; }, 450);
}
function typeLine(){
  if(li >= queryLinesData.length){ finishTyping(); return; }
  const numDiv = document.createElement('div'); numDiv.textContent = li+1; lineNums.appendChild(numDiv);
  const lineDiv = document.createElement('div');
  const textSpan = document.createElement('span');
  const caret = document.createElement('span'); caret.className='caret';
  lineDiv.appendChild(textSpan); lineDiv.appendChild(caret); body.appendChild(lineDiv);
  const fullText = queryLinesData[li].text; let ci = 0;
  function typeChar(){
    if(ci <= fullText.length){ textSpan.textContent = fullText.slice(0,ci); ci++; setTimeout(typeChar, 16+Math.random()*26); }
    else { lineDiv.innerHTML = queryLinesData[li].html; li++; setTimeout(typeLine, 220); }
  }
  typeChar();
}
setTimeout(typeLine, 500);

// ---- Copy query button ----
const copyBtn = document.getElementById('copyBtn');
const copyLabel = document.getElementById('copyLabel');
copyBtn.addEventListener('click', async () => {
  try{ await navigator.clipboard.writeText(queryPlainText); copyLabel.textContent='Copied'; }
  catch(e){ copyLabel.textContent='Select & copy'; }
  setTimeout(() => { copyLabel.textContent='Copy'; }, 1500);
});

// ---- Project galleries ----
const EYE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const projects = {
  ordertracker:{
    title:'Order Tracking System',
    images:[
      'projects/tracker1.png',
      'projects/tracker2.png',
      'projects/tracker3.png',
      'projects/tracker4.png',
      'projects/tracker5.png',
      'projects/tracker6.png',
      'projects/tracker7.png',
      'projects/tracker8.png',
    ],
  },
  recordfiles:{
    title:'Record Files Management System',
    images:[
      'projects/record1.png',
      'projects/record2.png',
      'projects/record3.png',
      'projects/record4.png',
      'projects/record5.png',
      'projects/record6.png',
    ],
  },
  albay:{
    title:'Albay Dialect Dictionary',
    images:[
      'projects/dictionary1.png',
      'projects/dictionary2.png',
      'projects/dictionary3.png',
      'projects/dictionary4.png',
      'projects/dictionary5.png',
      'projects/dictionary6.png',
      'projects/dictionary7.png',
      'projects/dictionary8.png',
      'projects/dictionary9.png',
      'projects/dictionary10.png',
      'projects/dictionary11.png',
      'projects/dictionary12.png',
      'projects/dictionary13.png',
      'projects/dictionary14.png',
      'projects/dictionary15.png',
      'projects/dictionary16.png',
      'projects/dictionary17.png',
      'projects/dictionary18.png',
      'projects/dictionary19.png',
      'projects/dictionary20.png',
    ],
  },
  cookie:{
    title:'Cookie Ordering System',
    images:[
      'projects/orders1.png',
      'projects/orders2.png',
      'projects/orders3.png',
      'projects/orders4.png',
      'projects/orders5.png',
      'projects/orders6.png',
      'projects/orders7.png',
      'projects/orders8.png',
      'projects/orders9.png',
      'projects/orders10.png',
      'projects/orders11.png',
      'projects/orders12.png',
    ],
  },
};

document.querySelectorAll('.proj-gallery').forEach(galleryEl => {
  const key = galleryEl.getAttribute('data-project');
  const proj = projects[key]; if(!proj) return;
  proj.images.forEach((src, idx) => {
    const btn = document.createElement('button');
    btn.className='proj-thumb-sm'; btn.type='button';
    btn.setAttribute('aria-label', `View ${proj.title} screenshot ${idx+1}`);
    btn.innerHTML=`<img src="${src}" alt="${proj.title} screenshot ${idx+1}" loading="lazy"><span class="proj-thumb-eye">${EYE_ICON}</span>`;
    btn.addEventListener('click', () => openGallery(key, idx));
    galleryEl.appendChild(btn);
  });
});

// ---- Modal ----
const modalOverlay=document.getElementById('modalOverlay');
const modalImg=document.getElementById('modalImg');
const modalTitle=document.getElementById('modalTitle');
const modalCounter=document.getElementById('modalCounter');
const modalClose=document.getElementById('modalClose');
const modalPrev=document.getElementById('modalPrev');
const modalNext=document.getElementById('modalNext');
let currentKey=null, currentIndex=0;

function renderModal(){
  const proj=projects[currentKey];
  modalImg.src=proj.images[currentIndex];
  modalImg.alt=`${proj.title} screenshot ${currentIndex+1}`;
  modalTitle.textContent=proj.title;
  modalCounter.textContent=`${currentIndex+1} / ${proj.images.length}`;
  const multi=proj.images.length>1;
  modalPrev.style.display=multi?'flex':'none';
  modalNext.style.display=multi?'flex':'none';
}
function openGallery(key,idx){ currentKey=key; currentIndex=idx; renderModal(); modalOverlay.classList.add('show'); document.body.style.overflow='hidden'; }
function closeProjectModal(){ modalOverlay.classList.remove('show'); document.body.style.overflow=''; }
function stepModal(delta){ const proj=projects[currentKey]; currentIndex=(currentIndex+delta+proj.images.length)%proj.images.length; renderModal(); }
modalOverlay.addEventListener('click',(e)=>{ if(e.target===modalOverlay) closeProjectModal(); });
modalClose.addEventListener('click',closeProjectModal);
modalPrev.addEventListener('click',()=>stepModal(-1));
modalNext.addEventListener('click',()=>stepModal(1));
document.addEventListener('keydown',(e)=>{
  if(!modalOverlay.classList.contains('show')) return;
  if(e.key==='Escape') closeProjectModal();
  if(e.key==='ArrowLeft') stepModal(-1);
  if(e.key==='ArrowRight') stepModal(1);
});