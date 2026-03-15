'use strict';

const throttle = (fn, ms=50) => { let l=0; return (...a) => { const n=Date.now(); if(n-l>=ms){l=n;fn(...a);} }; };
const debounce = (fn, ms=100) => { let id; return (...a) => { clearTimeout(id); id=setTimeout(()=>fn(...a),ms); }; };

// Cached touch-device check — used in multiple places to skip mouse-only effects
const IS_TOUCH = window.matchMedia('(hover:none)').matches;
// Cached reduced-motion preference — queried once to avoid repeated style recalcs
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let _galaxyCtrl = null; // controlled by initTheme after initGalaxy runs

/* ── 1. GALAXY ── */
function initGalaxy() {
  const canvas = document.getElementById('galaxyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars=[], nebulae=[], shooters=[];
  let rafId = null;
  const rand = (a,b) => Math.random()*(b-a)+a;

  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize();
  window.addEventListener('resize', debounce(()=>{ resize(); build(); }, 250));

  function build(){
    // More stars, each with autonomous drift velocity for a "flying through space" feel
    const N = Math.floor(W*H/900);
    const COLORS = ['#ffffff','#fffde0','#c8e6ff','#ffd8d8','#d0ffe8','#a5b4fc'];
    stars = Array.from({length:N}, ()=>{
      const layer = Math.floor(Math.random()*3); // 0=far/slow, 1=mid, 2=near/fast
      const speed = [0.08, 0.22, 0.5][layer];
      const angle = rand(0, Math.PI*2);
      return {
        x:rand(0,W), y:rand(0,H),
        r:rand(0.2,1.0)+layer*0.5,
        a:rand(0.25,0.95),
        phase:rand(0,Math.PI*2),
        twinkle:rand(0.003,0.012),
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed,
        color:COLORS[Math.floor(Math.random()*COLORS.length)],
        layer
      };
    });
    nebulae = Array.from({length:5}, ()=>({
      x:rand(0,W), y:rand(0,H), rx:rand(120,350), ry:rand(80,220),
      col:['rgba(79,70,229,','rgba(6,182,212,','rgba(139,92,246,','rgba(16,185,129,'][Math.floor(Math.random()*4)],
      a:rand(0.018,0.05)
    }));
  }
  build();

  let mx=0, my=0;
  if(!IS_TOUCH){
    let _rafMx=false;
    window.addEventListener('mousemove', e=>{ if(_rafMx) return; _rafMx=true; requestAnimationFrame(()=>{ mx=(e.clientX/W-0.5)*2; my=(e.clientY/H-0.5)*2; _rafMx=false; }); },{passive:true});
  }

  let t=0;
  const PLX = [0.4, 1.0, 1.8]; // mouse parallax per layer
  function frame(){
    ctx.clearRect(0,0,W,H);
    nebulae.forEach(n=>{
      const maxR=Math.max(n.rx,n.ry);
      const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,maxR);
      g.addColorStop(0,n.col+n.a+')'); g.addColorStop(1,n.col+'0)');
      ctx.save(); ctx.scale(n.rx/maxR,n.ry/maxR);
      ctx.fillStyle=g; ctx.beginPath();
      ctx.arc(n.x*(maxR/n.rx),n.y*(maxR/n.ry),maxR,0,Math.PI*2); ctx.fill(); ctx.restore();
    });
    t+=0.008;
    stars.forEach(s=>{
      // Drift — wrap around edges for seamless infinite field
      s.x += s.vx; s.y += s.vy;
      if(s.x < -2) s.x = W+2; else if(s.x > W+2) s.x = -2;
      if(s.y < -2) s.y = H+2; else if(s.y > H+2) s.y = -2;
      const px = s.x + mx*PLX[s.layer];
      const py = s.y + my*PLX[s.layer];
      const tw = s.a*(0.55+0.45*Math.sin(t*s.twinkle*80+s.phase));
      ctx.globalAlpha=tw; ctx.fillStyle=s.color;
      ctx.beginPath(); ctx.arc(px,py,s.r,0,Math.PI*2); ctx.fill();
    });
    // Shooting stars — frequent so it feels alive
    if(Math.random()<0.018 && shooters.length<6){
      shooters.push({x:rand(0,W*0.8),y:rand(0,H*0.5),len:rand(90,220),speed:rand(8,18),angle:rand(0.3,0.7),life:1,decay:rand(0.018,0.04)});
    }
    shooters=shooters.filter(s=>s.life>0);
    shooters.forEach(s=>{
      ctx.globalAlpha=s.life*0.9; ctx.strokeStyle='#fff'; ctx.lineWidth=1.4;
      ctx.shadowBlur=8; ctx.shadowColor='#a8c8ff';
      ctx.beginPath(); ctx.moveTo(s.x,s.y);
      ctx.lineTo(s.x-Math.cos(s.angle)*s.len,s.y-Math.sin(s.angle)*s.len); ctx.stroke();
      ctx.shadowBlur=0; s.x+=Math.cos(s.angle)*s.speed; s.y+=Math.sin(s.angle)*s.speed; s.life-=s.decay;
    });
    ctx.globalAlpha=1;
    rafId = requestAnimationFrame(frame);
  }

  _galaxyCtrl = {
    start(){ if(!rafId) frame(); },
    stop(){ if(rafId){ cancelAnimationFrame(rafId); rafId=null; } ctx.clearRect(0,0,W,H); }
  };
}

/* ── 2. THEME ── */
function initTheme(){
  const t = document.getElementById('theme-toggle');
  if(!t) return;
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (systemDark ? 'dark' : 'light');
  document.body.setAttribute('data-theme', theme);
  t.checked = (theme === 'dark');
  // Sync galaxy with initial theme
  theme === 'dark' ? _galaxyCtrl?.start() : _galaxyCtrl?.stop();

  function applyTheme(dark){
    const th = dark ? 'dark' : 'light';
    document.body.setAttribute('data-theme', th);
    localStorage.setItem('theme', th);
    t.checked = dark;
    dark ? _galaxyCtrl?.start() : _galaxyCtrl?.stop();
  }
  t.addEventListener('change', ()=>applyTheme(t.checked));

  // React to OS-level colour scheme changes (only when user hasn't set a manual preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{
    if(localStorage.getItem('theme')) return; // manual preference takes priority
    applyTheme(e.matches);
  });
}

/* ── 3. TYPED ── */
function initTyped(){
  const el=document.getElementById('typed'); if(!el) return;
  const strings=['Full-Stack Developer','Python & Django Engineer','AI & ML Engineer','React Frontend Engineer','Cloud & DevOps Practitioner'];
  if(reducedMotion){
    el.textContent=strings[0]; return;
  }
  let si=0,ci=0,del=false,wait=80;
  function tick(){
    const s=strings[si];
    el.textContent=del?s.slice(0,--ci):s.slice(0,++ci);
    if(!del&&ci===s.length){del=true;wait=2000;}
    else if(del&&ci===0){del=false;si=(si+1)%strings.length;wait=350;}
    else wait=del?35:55+Math.random()*35;
    setTimeout(tick,wait);
  }
  setTimeout(tick,1000);
}

/* ── 4. GSAP ANIMATIONS ── */
function revealHero(){
  document.querySelectorAll('.hero-anim-badge,.hero-anim-title,.hero-anim-subtitle,.hero-anim-desc,.hero-anim-cta,.hero-anim-socials')
    .forEach(el=>{ el.style.opacity='1'; el.style.transform='none'; });
}

function initAnimations(){
  if(typeof gsap==='undefined'){ revealHero(); return; }
  // Reduced motion: reveal all animated content immediately without transitions
  if(reducedMotion){
    revealHero();
    document.querySelectorAll('[data-gsap-fade],[data-gsap-slide],.gsap-fade-up,.fade-up,.reveal-item').forEach(el=>{
      el.style.opacity='1'; el.style.transform='none';
    });
    return;
  }
  if(typeof ScrollTrigger!=='undefined'){
    gsap.registerPlugin(ScrollTrigger);
  }

  // Set initial hidden state via JS (not CSS) so content is always visible if GSAP fails
  gsap.set('.hero-anim-badge',   {y:16,opacity:0});
  gsap.set('.hero-anim-title',   {y:44,opacity:0});
  gsap.set('.hero-anim-subtitle',{y:28,opacity:0});
  gsap.set('.hero-anim-desc',    {y:22,opacity:0});
  gsap.set('.hero-anim-cta > *', {y:18,opacity:0});
  gsap.set('.hero-anim-socials', {y:14,opacity:0});

  // Hero entrance
  gsap.timeline({defaults:{ease:'power3.out'}})
    .to('.hero-anim-badge',    {y:0,opacity:1,duration:0.6,delay:0.1})
    .to('.hero-anim-title',    {y:0,opacity:1,duration:0.9},'-=0.3')
    .to('.hero-anim-subtitle', {y:0,opacity:1,duration:0.7},'-=0.5')
    .to('.hero-anim-desc',     {y:0,opacity:1,duration:0.7},'-=0.45')
    .to('.hero-anim-cta > *',  {y:0,opacity:1,duration:0.55,stagger:0.12},'-=0.4')
    .to('.hero-anim-socials',  {y:0,opacity:1,duration:0.5},'-=0.3');

  if(typeof ScrollTrigger==='undefined') return;

  // ── Section headings — clip-path slide-reveal with underline drawing in ──
  gsap.utils.toArray('.section-heading').forEach(el=>{
    gsap.fromTo(el,
      {clipPath:'inset(0 100% 0 0)',opacity:0.4},
      {clipPath:'inset(0 0% 0 0)',opacity:1,duration:0.85,ease:'power3.out',
        scrollTrigger:{
          trigger:el,start:'top 88%',toggleActions:'play none none none',
          onStart:()=>{ el.classList.add('heading-visible'); sectionEntryBurst(el); }
        }}
    );
  });

  // ── About ──
  gsap.from('.about-photo-wrap',{scale:0.82,opacity:0,rotate:-8,duration:1,ease:'back.out(1.6)',
    scrollTrigger:{trigger:'#about',start:'top 80%'}});
  gsap.from('.about-name,.about-role',{x:-36,opacity:0,duration:0.75,stagger:0.18,ease:'power3.out',
    scrollTrigger:{trigger:'#about',start:'top 75%'}});
  gsap.from('#about .col-lg-8 > p',{y:20,opacity:0,duration:0.6,stagger:0.12,ease:'power2.out',
    scrollTrigger:{trigger:'#about .col-lg-8',start:'top 78%'}});
  gsap.from('.about-stat-card',{y:32,opacity:0,duration:0.65,stagger:0.1,ease:'back.out(1.4)',
    scrollTrigger:{trigger:'.about-stat-card',start:'top 85%'}});
  gsap.from('.about-cta-row > *',{y:18,opacity:0,duration:0.55,stagger:0.12,ease:'power2.out',
    scrollTrigger:{trigger:'.about-cta-row',start:'top 88%'}});

  // ── Timeline items — alternate left/right slide ──
  gsap.utils.toArray('.timeline-item').forEach((item,i)=>{
    gsap.from(item,{
      x:i%2===0 ? -50 : 50,
      opacity:0,duration:0.75,ease:'power3.out',
      scrollTrigger:{trigger:item,start:'top 85%',toggleActions:'play none none none'}
    });
  });

  // ── Skill cards — wave stagger left-to-right ──
  gsap.utils.toArray('.skill-card').forEach((c,i)=>{
    gsap.from(c,{y:28,opacity:0,scale:0.88,duration:0.5,
      delay:(i%8)*0.045,ease:'back.out(1.5)',
      scrollTrigger:{trigger:c,start:'top 92%',toggleActions:'play none none none'}});
  });

  // ── Achievement cards — scale up from below ──
  gsap.utils.toArray('.achievement-card').forEach((c,i)=>{
    gsap.from(c,{y:36,opacity:0,scale:0.95,duration:0.6,
      delay:(i%4)*0.09,ease:'back.out(1.3)',
      scrollTrigger:{trigger:c,start:'top 90%',toggleActions:'play none none none'}});
  });

  // ── Testimonial cards ──
  gsap.utils.toArray('.testimonial-card').forEach((c,i)=>{
    gsap.from(c,{y:32,opacity:0,duration:0.65,delay:i*0.14,ease:'power3.out',
      scrollTrigger:{trigger:c,start:'top 88%',toggleActions:'play none none none'}});
  });

  // ── Project cards — staggered grid reveal ──
  gsap.utils.toArray('.project-card').forEach((c,i)=>{
    gsap.from(c,{y:36,opacity:0,scale:0.94,duration:0.55,
      delay:(i%4)*0.08,ease:'back.out(1.3)',
      scrollTrigger:{trigger:c,start:'top 92%',toggleActions:'play none none none'}});
  });

  // ── Gallery items — alternating slide ──
  gsap.utils.toArray('.gallery-strip-item').forEach((item,i)=>{
    gsap.from(item,{x:i%2===0?-40:40,opacity:0,scale:0.96,duration:0.65,
      delay:i*0.1,ease:'power3.out',
      scrollTrigger:{trigger:item,start:'top 88%',toggleActions:'play none none none'}});
  });

  // ── Contact — stagger form fields + email row ──
  gsap.from('.contact-email-row',{y:20,opacity:0,duration:0.6,ease:'power2.out',
    scrollTrigger:{trigger:'#contact',start:'top 80%'}});
  gsap.from('#contactForm .mb-4',{y:24,opacity:0,duration:0.55,stagger:0.1,ease:'power2.out',
    scrollTrigger:{trigger:'#contactForm',start:'top 85%'}});
  gsap.from('#contactForm .d-grid',{y:16,opacity:0,duration:0.5,ease:'power2.out',
    scrollTrigger:{trigger:'#contactForm .d-grid',start:'top 90%'}});

  // ── Resume section ──
  gsap.from('.resume-preview',{y:30,opacity:0,scale:0.97,duration:0.8,ease:'power3.out',
    scrollTrigger:{trigger:'.resume-preview',start:'top 82%'}});

}

/* ── 5. HERO PARALLAX ── */
function initHeroParallax(){
  const hero = document.querySelector('.hero-section');
  if(!hero) return;
  if(reducedMotion) return;
  window.addEventListener('scroll', throttle(()=>{
    const offset = window.scrollY;
    if(offset < window.innerHeight){
      hero.style.backgroundPositionY = `calc(50% + ${offset * 0.3}px)`;
    }
  }, 16), {passive:true});
}

/* ── 6. PHOTO TILT ── */
function initPhotoTilt(){
  const wrap=document.querySelector('.about-photo-wrap'); if(!wrap) return;
  wrap.addEventListener('mousemove',e=>{
    const r=wrap.getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width-0.5)*22;
    const y=((e.clientY-r.top)/r.height-0.5)*-22;
    wrap.style.transform=`perspective(500px) rotateX(${y}deg) rotateY(${x}deg) scale(1.06)`;
  });
  wrap.addEventListener('mouseleave',()=>{ wrap.style.transform=''; });
}

/* ── 7. SCROLL BAR ── */
function initScrollBar(){
  const bar=document.getElementById('scrollBar'); if(!bar) return;
  window.addEventListener('scroll',throttle(()=>{
    const {scrollTop,scrollHeight,clientHeight}=document.documentElement;
    bar.style.width=(scrollTop/(scrollHeight-clientHeight)*100)+'%';
  },16),{passive:true});
}

/* ── 8. BACK TO TOP ── */
function initBackToTop(){
  const btn=document.getElementById('backToTop'); if(!btn) return;
  window.addEventListener('scroll',throttle(()=>{
    btn.style.display=window.scrollY>300?'flex':'none';
  },100),{passive:true});
  btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}

/* ── 9. HEADER ── */
function initHeader(){
  const header   = document.getElementById('site-header');
  const menuBtn  = document.getElementById('mobileMenuBtn');
  const sidebar  = document.getElementById('mobileSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  if(!header) return;

  // Scroll shadow
  window.addEventListener('scroll',throttle(()=>{
    header.classList.toggle('scrolled',window.scrollY>10);
  },100),{passive:true});

  // ── Sidebar open/close ──
  let _sidebarScroll = 0;
  function openSidebar(){
    _sidebarScroll = window.scrollY;
    sidebar?.classList.add('open');
    backdrop?.classList.add('open');
    sidebar?.setAttribute('aria-hidden','false');
    menuBtn?.setAttribute('aria-expanded','true');
    document.body.classList.add('sidebar-open');
    sidebar?.querySelector('.sidebar-link')?.focus();
  }

  // Focus trap inside sidebar while open
  function trapFocus(e){
    if(!sidebar?.classList.contains('open')) return;
    const focusable = Array.from(sidebar.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')).filter(el=>el.offsetParent!==null);
    if(!focusable.length) return;
    const first=focusable[0], last=focusable[focusable.length-1];
    if(e.key==='Tab'){
      if(e.shiftKey){ if(document.activeElement===first){e.preventDefault();last.focus();} }
      else { if(document.activeElement===last){e.preventDefault();first.focus();} }
    }
  }
  sidebar?.addEventListener('keydown',trapFocus);
  function closeSidebar(){
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('open');
    sidebar?.setAttribute('aria-hidden','true');
    menuBtn?.setAttribute('aria-expanded','false');
    document.body.classList.remove('sidebar-open');
    window.scrollTo(0, _sidebarScroll);
    menuBtn?.focus();
  }

  menuBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  // Close on nav-link click — guard prevents duplicate listeners if header re-inits
  sidebar?.querySelectorAll('.sidebar-link').forEach(a=>{
    if(a.dataset.sidebarListenerAdded) return;
    a.dataset.sidebarListenerAdded='1';
    a.addEventListener('click', closeSidebar);
  });

  // Escape key
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && sidebar?.classList.contains('open')) closeSidebar();
  });

  // ── Active link highlighting (desktop nav + sidebar) ──
  const allLinks=[
    ...document.querySelectorAll('.header-link[href^="#"]'),
    ...document.querySelectorAll('.sidebar-link[href^="#"]')
  ];
  const hl=()=>{
    const y=window.scrollY+80;
    allLinks.forEach(a=>{
      const s=document.querySelector(a.getAttribute('href'));
      a.classList.toggle('active-link',s&&s.offsetTop<=y&&s.offsetTop+s.offsetHeight>y);
    });
  };
  window.addEventListener('scroll',throttle(hl,100),{passive:true}); hl();
}

/* ── 10. TIMELINE ── */
function initTimeline(){
  const toggle=document.querySelector('.timeline-toggle'); if(!toggle) return;
  const btns=Array.from(toggle.querySelectorAll('.toggle-btn'));
  const secs={education:document.querySelector('.section-education'),experience:document.querySelector('.section-experience')};
  function show(name){
    toggle.dataset.active=name;
    toggle.style.setProperty('--pill-left',name==='education'?'0%':'50%');
    btns.forEach(b=>b.setAttribute('aria-selected',b.dataset.section===name));
    Object.entries(secs).forEach(([k,el])=>{
      if(!el) return;
      el.classList.toggle('d-none',k!==name);
      if(k===name) el.querySelectorAll('.timeline-item').forEach((item,i)=>{
        item.classList.add('tl-anim');
        item.classList.remove('visible');
        setTimeout(()=>item.classList.add('visible'),i*160);
      });
    });
  }
  btns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.section)));
  requestAnimationFrame(()=>requestAnimationFrame(()=>show(toggle.dataset.active||'education')));
}

/* ── 11. SKILLS ── */
function initSkills(){
  const toggle=document.querySelector('.skills-toggle'); if(!toggle) return;
  const btns=Array.from(toggle.querySelectorAll('.toggle-btn'));
  const cards=Array.from(document.querySelectorAll('.skill-card'));
  toggle.style.setProperty('--count',btns.length);
  toggle.style.setProperty('--pill-index',0);
  btns.forEach((btn,idx)=>{
    btn.setAttribute('aria-selected',idx===0);
    btn.addEventListener('click',()=>{
      toggle.style.setProperty('--pill-index',idx);
      btns.forEach(b=>b.setAttribute('aria-selected','false'));
      btn.setAttribute('aria-selected','true');
      const cat=btn.dataset.cat;
      cards.forEach(c=>c.classList.toggle('d-none',cat!=='all'&&c.dataset.cat!==cat));
    });
  });
}
function initSkillCharts(){
  const charts=Array.from(document.querySelectorAll('.skill-chart'));
  if(!charts.length) return;
  charts.forEach(c=>c.style.setProperty('--pct',0));
  function animate(chart){
    if(chart.dataset.animated) return;
    chart.dataset.animated='1';
    const card=chart.closest('.skill-card');
    const pct=parseFloat(card.dataset.value)||0;
    if(reducedMotion){
      chart.style.setProperty('--pct',pct);
      const valEl=card.querySelector('.skill-value');
      if(valEl) valEl.textContent=Math.round(pct)+'%';
      return;
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      chart.style.setProperty('--pct',pct);
      const valEl=card.querySelector('.skill-value');
      if(valEl){
        let start=null; const dur=1300;
        const step=(ts)=>{
          if(!start) start=ts;
          const p=Math.min((ts-start)/dur,1);
          const e=1-Math.pow(1-p,3); // ease-out cubic
          valEl.textContent=Math.round(pct*e)+'%';
          if(p<1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }));
  }
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      entries.forEach(e=>{ if(e.isIntersecting){animate(e.target);obs.unobserve(e.target);} });
    },{threshold:0.05,rootMargin:'0px 0px -20px 0px'});
    charts.forEach(c=>obs.observe(c));
  } else {
    // No IntersectionObserver — animate all immediately
    charts.forEach(c=>animate(c));
  }
}

/* ── 12. PROJECT FILTER ── */
function initProjectFilter(){
  const search=document.getElementById('projectSearch');
  const filter=document.getElementById('projectFilter');
  const sort=document.getElementById('projectSort');
  const cont=document.getElementById('projectGallery');
  const noMsg=document.getElementById('noProjectsMsg');
  if(!search||!filter||!sort||!cont||!noMsg) return;
  const cards=Array.from(document.querySelectorAll('.project-card'));
  function apply(){
    const term=search.value.trim().toLowerCase(), cat=filter.value; let vis=0;
    cards.forEach(c=>{
      const title=(c.querySelector('.card-title')?.textContent??'').toLowerCase();
      const desc=(c.querySelector('.card-text')?.textContent??'').toLowerCase();
      const ok=(!term||title.includes(term)||desc.includes(term))&&(cat==='all'||c.dataset.category===cat);
      c.style.display=ok?'':'none'; vis+=ok?1:0;
    });
    const visible=cards.filter(c=>c.style.display!=='none');
    const title=c=>(c.querySelector('.card-title')?.textContent||'');
    if(sort.value==='az') visible.sort((a,b)=>title(a).localeCompare(title(b)));
    if(sort.value==='za') visible.sort((a,b)=>title(b).localeCompare(title(a)));
    if(sort.value!=='none'){
      const frag=document.createDocumentFragment();
      visible.forEach(c=>frag.appendChild(c));
      cont.appendChild(frag);
    }
    noMsg.classList.toggle('d-none',vis>0);
  }
  search.addEventListener('input',debounce(apply,100));
  filter.addEventListener('change',apply);
  sort.addEventListener('change',apply);
  apply();
}

/* ── 13. CERTIFICATE MODAL ── */
function initCertModal(){
  // Section-local modals keyed by data-cert-modal attribute value
  const MODALS = {
    achievements: {
      modal:     document.getElementById('achievementsCertModal'),
      titleEl:   document.getElementById('achievementsCertModalTitle'),
      subEl:     document.getElementById('achievementsCertModalSubtitle'),
      contentEl: document.getElementById('achievementsCertModalContent'),
      openLink:  document.getElementById('achievementsCertModalOpenLink'),
      dlBtn:     document.getElementById('achievementsCertModalDownload'),
    },
    testimonials: {
      modal:     document.getElementById('testimonialsCertModal'),
      titleEl:   document.getElementById('testimonialsCertModalTitle'),
      subEl:     document.getElementById('testimonialsCertModalSubtitle'),
      contentEl: document.getElementById('testimonialsCertModalContent'),
      openLink:  document.getElementById('testimonialsCertModalOpenLink'),
      dlBtn:     document.getElementById('testimonialsCertModalDownload'),
    }
  };

  function closeAll(){
    Object.values(MODALS).forEach(m => {
      if (!m.modal) return;
      m.modal.classList.remove('is-open');
      m.modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => { if (m.contentEl) m.contentEl.innerHTML = ''; }, 250);
    });
    document.body.classList.remove('cert-modal-open');
  }

  // Close buttons inside modals
  document.querySelectorAll('.section-cert-close').forEach(btn => {
    btn.addEventListener('click', closeAll);
  });

  // Click backdrop to close
  Object.values(MODALS).forEach(m => {
    if (!m.modal) return;
    m.modal.addEventListener('click', e => { if (e.target === m.modal) closeAll(); });
    // Swipe down to close on touch devices
    let touchY = 0;
    const box = m.modal.querySelector('.section-cert-modal-box');
    if (box) {
      box.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
      box.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - touchY > 80) closeAll(); }, { passive: true });
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const anyOpen = Object.values(MODALS).some(m => m.modal?.classList.contains('is-open'));
      if (anyOpen) closeAll();
    }
  });

  // Open modal on [data-cert] button click
  document.querySelectorAll('[data-cert]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const certPath = (btn.dataset.cert || '').trim().replace(/\0/g, '');
      if (!certPath || /^(data:|javascript:|vbscript:|\/\/)/i.test(certPath) || !/^(https?:\/\/|\/[^/]|images\/)/.test(certPath)) return;
      const certName = btn.dataset.certName || 'Certificate';
      const modalKey = btn.dataset.certModal || 'achievements';
      const m = MODALS[modalKey];
      if (!m || !m.modal || !m.contentEl) return;

      const isPdf = /\.pdf$/i.test(certPath);

      if (m.titleEl) m.titleEl.textContent = certName;
      if (m.subEl)   m.subEl.textContent   = isPdf ? 'PDF preview' : 'Image preview';
      if (m.openLink){ m.openLink.href = certPath; }
      if (m.dlBtn)   { m.dlBtn.href = certPath; m.dlBtn.setAttribute('download', certName); }

      m.contentEl.innerHTML = '<div class="cert-spinner"><div class="cert-spinner-ring"></div><span>Loading certificate…</span></div>';

      if (isPdf) {
        m.contentEl.innerHTML = '';
        const obj = document.createElement('object');
        obj.data = certPath;
        obj.type = 'application/pdf';
        obj.style.cssText = 'width:100%;height:520px;border:none;border-radius:0.75rem;background:#fff;display:block;';
        obj.setAttribute('aria-label', certName);
        obj.innerHTML = `<div class="cert-error"><i class="fas fa-file-pdf"></i><p>PDF preview not available in this browser.</p><a href="${certPath}" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><i class="fas fa-external-link-alt me-1"></i>Open PDF</a></div>`;
        m.contentEl.appendChild(obj);
      } else {
        const img = new Image();
        img.alt = certName;
        img.style.cssText = 'width:100%;border-radius:0.75rem;display:none;';
        img.onload  = () => { m.contentEl.innerHTML = ''; img.style.display = 'block'; m.contentEl.appendChild(img); };
        img.onerror = () => { m.contentEl.innerHTML = `<div class="cert-error"><i class="fas fa-exclamation-circle"></i><p>Could not load preview.</p><a href="${certPath}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm"><i class="fas fa-external-link-alt me-1"></i>Open directly</a></div>`; };
        img.src = certPath;
      }

      m.modal.classList.add('is-open');
      m.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('cert-modal-open');
      const certBox = m.modal.querySelector('.section-cert-modal-box') || m.modal.querySelector('[tabindex="-1"]');
      if(certBox){ certBox.setAttribute('tabindex','-1'); requestAnimationFrame(()=>requestAnimationFrame(()=>certBox.focus({ preventScroll:true }))); }
    });
  });
}

/* ── 14. CONTACT ── */
function initContact(){
  const form=document.getElementById('contactForm'); if(!form) return;
  const btn=document.getElementById('contactSubmitBtn');
  const successEl=document.getElementById('contactSuccess');
  const errorEl=document.getElementById('contactError');

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!form.checkValidity()){
      form.classList.add('was-validated');
      form.querySelectorAll('input,textarea,select').forEach(el=>{
        el.setAttribute('aria-invalid', el.validity.valid ? 'false' : 'true');
      });
      form.querySelector(':invalid')?.focus();
      return;
    }
    form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));

    if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin me-2"></i>Sending…'; }
    successEl?.classList.add('d-none');
    errorEl?.classList.add('d-none');

    try{
      const res=await Promise.race([
        fetch(form.action,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}}),
        new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))
      ]);
      if(res.ok){
        form.reset(); form.classList.remove('was-validated');
        form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
        successEl?.classList.remove('d-none');
        successEl?.scrollIntoView({behavior:'smooth',block:'nearest'});
      } else { throw new Error('server '+res.status); }
    } catch(err){
      if(errorEl){
        errorEl.classList.remove('d-none');
        const hint = errorEl.querySelector('.error-hint');
        if(hint) hint.textContent = err.message==='timeout'
          ? 'Request timed out — check your connection and try again.'
          : 'Server error — please email me directly if this persists.';
      }
    } finally{
      if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane me-2"></i>Send Message'; }
    }
  });
}


/* ── 14b. PROJECT DETAIL MODAL ── */
function initProjectModal(){
  const modal     = document.getElementById('projectModal');
  const closeBtn  = document.getElementById('projModalClose');
  if(!modal) return;

  const titleEl   = document.getElementById('projModalTitle');
  const tagEl     = document.getElementById('projModalTag');
  const descEl    = document.getElementById('projModalDesc');
  const actionsEl = document.getElementById('projModalActions');

  function openModal(card){
    const title   = card.querySelector('.card-title')?.textContent?.trim() || '';
    const tag     = card.querySelector('.project-tag')?.textContent?.trim() || '';
    const desc    = card.querySelector('.card-text')?.textContent?.trim() || '';
    const actions = card.querySelector('.project-actions');

    if(titleEl) titleEl.textContent = title;
    if(tagEl)   tagEl.textContent   = tag;
    if(descEl)  descEl.textContent  = desc;
    if(actionsEl && actions) actionsEl.innerHTML = actions.innerHTML;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    closeBtn?.focus({ preventScroll: true });
  }
  function closeModal(){
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
  }

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&modal.classList.contains('is-open')) closeModal(); });

  // Make entire project card clickable — skip if clicking a link/button inside project-actions
  document.querySelectorAll('.project-card').forEach(card=>{
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label', card.querySelector('.card-title')?.textContent?.trim() || 'Project details');
    card.style.cursor='pointer';
    card.addEventListener('click', e=>{
      if(e.target.closest('.project-actions')) return;
      openModal(card);
    });
    card.addEventListener('keydown', e=>{
      if((e.key==='Enter'||e.key===' ') && !e.target.closest('.project-actions')) openModal(card);
    });
  });
}

/* ── 15. HIRE BANNER ── */
function initHireBanner(){
  const banner = document.getElementById('hireBanner');
  const closeBtn = document.getElementById('hireBannerClose');
  if(!banner || !closeBtn) return;
  // Respect previous dismissal in session
  if(sessionStorage.getItem('hireBannerDismissed')) banner.classList.add('dismissed');
  closeBtn.addEventListener('click', ()=>{
    banner.classList.add('dismissed');
    sessionStorage.setItem('hireBannerDismissed','1');
  });
}

/* ── TOAST ── */
function showToast(msg, icon='check-circle', color='#6ee7b7'){
  let t=document.getElementById('_toast');
  if(!t){ t=document.createElement('div'); t.id='_toast'; document.body.appendChild(t); }
  // Build DOM safely — no innerHTML with msg to prevent XSS
  t.textContent='';
  const ic=document.createElement('i');
  ic.className=`fas fa-${icon}`; ic.style.cssText=`color:${color};flex-shrink:0`; ic.setAttribute('aria-hidden','true');
  t.appendChild(ic);
  t.appendChild(document.createTextNode('\u00A0'+msg));
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid=setTimeout(()=>t.classList.remove('show'),2600);
}

/* ── 16. COPY EMAIL ── */
function initCopyEmail(){
  const btn=document.getElementById('copyEmailBtn');
  const emailSpan=document.querySelector('.contact-email-address');
  if(!btn) return;
  const doCopy=async()=>{
    try{
      const email = (emailSpan?.textContent || 'nveeravenkataganesh@gmail.com').trim();
      await navigator.clipboard.writeText(email);
      showToast('Email copied to clipboard!');
      btn.classList.add('copied');
      btn.innerHTML='<i class="fas fa-check" aria-hidden="true"></i> Copied!';
      setTimeout(()=>{ btn.classList.remove('copied'); btn.innerHTML='<i class="fas fa-copy" aria-hidden="true"></i> Copy'; },2000);
    } catch{
      btn.textContent='nveeravenkataganesh@gmail.com';
    }
  };
  btn.addEventListener('click',doCopy);
  emailSpan?.addEventListener('click',doCopy);
}

/* ── 17. TESTIMONIALS PAGINATOR + LEAVE A TESTIMONIAL ── */
function initTestimonialsCarousel(){
  const grid   = document.getElementById('tpGrid');
  const navEl  = document.getElementById('tpNav');
  const prevBtn= document.getElementById('tpPrev');
  const nextBtn= document.getElementById('tpNext');
  const pageInfo= document.getElementById('tpPageInfo');
  if(!grid) return;

  const PER_PAGE = 3;
  let cards = Array.from(grid.querySelectorAll('.tp-card'));
  let page  = 0;

  function totalPages(){ return Math.ceil(cards.length / PER_PAGE); }

  function render(){
    const tp = totalPages();
    cards.forEach((c,i)=>{
      const onPage = Math.floor(i / PER_PAGE) === page;
      c.classList.toggle('visible', onPage);
    });
    if(tp > 1){
      navEl.classList.add('visible');
      if(pageInfo) pageInfo.textContent = `Page ${page+1} of ${tp}`;
      if(prevBtn)  prevBtn.disabled = page === 0;
      if(nextBtn)  nextBtn.disabled = page === tp - 1;
    } else {
      navEl.classList.remove('visible');
    }
  }

  prevBtn?.addEventListener('click',()=>{ if(page>0){ page--; render(); } });
  nextBtn?.addEventListener('click',()=>{ if(page<totalPages()-1){ page++; render(); } });

  render();

  // Leave a Testimonial modal
  const openBtn  = document.getElementById('leaveTestimonialBtn');
  const modal    = document.getElementById('leaveTestimonialModal');
  const closeBtn = document.getElementById('ltmClose');
  const cancelBtn= document.getElementById('ltmCancel');
  const form     = document.getElementById('leaveTestimonialForm');
  const feedback = document.getElementById('ltmFeedback');

  function openModal(){
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden','false');
    document.getElementById('ltmName')?.focus({ preventScroll: true });
  }
  function closeModal(){
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden','true');
    form?.reset();
    if(feedback){ feedback.textContent=''; feedback.className='mb-2 ltm-feedback-hidden'; }
  }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && modal?.classList.contains('is-open')) closeModal(); });

  form?.addEventListener('submit', e=>{
    e.preventDefault();
    const name = document.getElementById('ltmName')?.value.trim();
    const msg  = document.getElementById('ltmMessage')?.value.trim();
    if(!name || !msg){
      if(feedback){
        feedback.textContent = 'Please fill in your name and testimonial.';
        feedback.className = 'mb-2 alert alert-warning py-2';
      }
      return;
    }
    // Show thank-you message (submissions reviewed before going live)
    if(feedback){
      feedback.textContent = 'Thank you! Your testimonial has been submitted for review.';
      feedback.className = 'mb-2 alert alert-success py-2';
    }
    form.querySelectorAll('input,textarea,button[type="submit"]').forEach(el=>el.disabled=true);
    setTimeout(closeModal, 2800);
  });
}

/* ── 18. STAT COUNTERS ── */
function initStatCounters(){
  const counters = document.querySelectorAll('.stat-counter');
  if(!counters.length) return;
  if(reducedMotion){
    counters.forEach(el=>{ el.textContent = el.dataset.target + (el.dataset.suffix||''); });
    return;
  }
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      obs.unobserve(e.target);
      const el = e.target;
      const target = parseInt(el.dataset.target,10);
      const suffix = el.dataset.suffix||'';
      const duration = 1200;
      const start = performance.now();
      function step(now){
        const p = Math.min((now-start)/duration,1);
        const ease = 1-Math.pow(1-p,3); // cubic ease-out
        el.textContent = Math.round(ease*target) + suffix;
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  },{threshold:0.6});
  counters.forEach(c=>obs.observe(c));
}

/* ── 19. URL HASH SYNC ── */
function initHashSync(){
  const sections = Array.from(document.querySelectorAll('main section[id]'));
  if(!sections.length) return;
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting && e.intersectionRatio >= 0.35){
        const id = e.target.id;
        history.replaceState(null,'','#'+id);
      }
    });
  },{threshold:0.35});
  sections.forEach(s=>obs.observe(s));
}

/* ── 20. HERO SPHERE (Three.js wireframe) ── */
function initHeroSphere(){
  const container = document.getElementById('heroSphere');
  if(!container || typeof THREE === 'undefined') return;

  const W = container.offsetWidth  || 280;
  const H = container.offsetHeight || 260;

  // Scene + camera
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.z = 3.2;

  // Renderer — transparent background so hero gradient shows through
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Outer wireframe icosahedron (main sphere)
  const outerGeo   = new THREE.IcosahedronGeometry(1, 5);
  const outerEdges = new THREE.EdgesGeometry(outerGeo);
  const outerMat   = new THREE.LineBasicMaterial({
    color: 0xa5b4fc,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
  });
  const outerMesh = new THREE.LineSegments(outerEdges, outerMat);
  scene.add(outerMesh);

  // Inner counter-rotating icosahedron (depth / glow)
  const innerGeo   = new THREE.IcosahedronGeometry(0.62, 3);
  const innerEdges = new THREE.EdgesGeometry(innerGeo);
  const innerMat   = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
  });
  const innerMesh = new THREE.LineSegments(innerEdges, innerMat);
  scene.add(innerMesh);

  // Floating dot particles orbiting the sphere
  const pCount    = 220;
  const pPositions = new Float32Array(pCount * 3);
  for(let i = 0; i < pCount; i++){
    const r     = 1.25 + Math.random() * 0.75;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    pPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pPositions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pPositions[i*3+2] = r * Math.cos(phi);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xa5b4fc,
    size: 0.022,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Mouse parallax
  let mx = 0, my = 0, tx = 0, ty = 0;
  const onMouseMove = e => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('mousemove', onMouseMove);

  // Resize
  const onResize = () => {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // ── Orbiting spaceship — detailed interceptor ────────────────────────────
  const _sv = (() => {
    const v = [];
    const L = (ax,ay,az,bx,by,bz) => v.push(ax,ay,az,bx,by,bz);
    // Sharp nose
    L( 1.0,  0,     0,     0.4,  0.1,   0   ); L( 1.0,  0,     0,     0.4, -0.1,   0   );
    L( 1.0,  0,     0,     0.4,  0,     0.08); L( 1.0,  0,     0,     0.4,  0,    -0.08);
    // Front cross-section
    L( 0.4,  0.1,   0,     0.4,  0,     0.08); L( 0.4,  0,     0.08,  0.4, -0.1,   0   );
    L( 0.4, -0.1,   0,     0.4,  0,    -0.08); L( 0.4,  0,    -0.08,  0.4,  0.1,   0   );
    // Cockpit canopy (raised ridge on top)
    L( 0.55, 0.1,   0,     0.15, 0.18,  0.09); L( 0.55, 0.1,   0,     0.15, 0.18, -0.09);
    L( 0.15, 0.18,  0.09,  0.15, 0.18, -0.09); L( 0.4,  0.1,   0,     0.55, 0.1,   0   );
    // Hull longitudinal (4 edges)
    L( 0.4,  0.1,   0,    -0.85, 0.1,   0   ); L( 0.4, -0.1,   0,    -0.85,-0.1,   0   );
    L( 0.4,  0,     0.08, -0.85, 0,     0.13); L( 0.4,  0,    -0.08, -0.85, 0,    -0.13);
    // Mid cross-section
    L(-0.2,  0.1,   0,    -0.2,  0,     0.12); L(-0.2,  0,     0.12, -0.2, -0.1,   0   );
    L(-0.2, -0.1,   0,    -0.2,  0,    -0.12); L(-0.2,  0,    -0.12, -0.2,  0.1,   0   );
    // Rear cross-section
    L(-0.85, 0.1,   0,    -0.85, 0,     0.13); L(-0.85, 0,     0.13, -0.85,-0.1,   0   );
    L(-0.85,-0.1,   0,    -0.85, 0,    -0.13); L(-0.85, 0,    -0.13, -0.85, 0.1,   0   );
    // Delta wings — right (+z)
    L( 0.3,  0,     0.1,   0.0,  0,     0.82); L( 0.0,  0,     0.82, -0.6,  0,     0.88);
    L(-0.6,  0,     0.88, -0.85, 0,     0.13); L(-0.2,  0,     0.13, -0.25, 0,     0.52);
    L(-0.25, 0,     0.52, -0.6,  0,     0.88); // rib
    // Winglet tip (upswept)
    L(-0.6,  0,     0.88, -0.72, 0.22,  0.82); L(-0.72, 0.22,  0.82, -0.85, 0,     0.13);
    // Delta wings — left (-z)
    L( 0.3,  0,    -0.1,   0.0,  0,    -0.82); L( 0.0,  0,    -0.82, -0.6,  0,    -0.88);
    L(-0.6,  0,    -0.88, -0.85, 0,    -0.13); L(-0.2,  0,    -0.13, -0.25, 0,    -0.52);
    L(-0.25, 0,    -0.52, -0.6,  0,    -0.88);
    L(-0.6,  0,    -0.88, -0.72, 0.22, -0.82); L(-0.72, 0.22, -0.82, -0.85, 0,    -0.13);
    // Engine pods — right
    L(-0.35, 0,     0.65, -0.35,-0.16,  0.65); L(-0.35,-0.16,  0.65, -0.95,-0.16,  0.68);
    L(-0.35,-0.16,  0.65, -0.35,-0.16,  0.82); L(-0.35,-0.16,  0.82, -0.95,-0.16,  0.82);
    L(-0.95,-0.16,  0.68, -0.95,-0.16,  0.82); L(-0.95,-0.16,  0.68, -0.95, 0,     0.65);
    // Engine pods — left
    L(-0.35, 0,    -0.65, -0.35,-0.16, -0.65); L(-0.35,-0.16, -0.65, -0.95,-0.16, -0.68);
    L(-0.35,-0.16, -0.65, -0.35,-0.16, -0.82); L(-0.35,-0.16, -0.82, -0.95,-0.16, -0.82);
    L(-0.95,-0.16, -0.68, -0.95,-0.16, -0.82); L(-0.95,-0.16, -0.68, -0.95, 0,    -0.65);
    // Main engine nozzles (2 rear)
    L(-0.85, 0.06,  0.06, -1.05, 0.06,  0.07); L(-0.85, 0.06, -0.06, -1.05, 0.06, -0.07);
    L(-1.05, 0.06,  0.07, -1.05, 0.06, -0.07);
    L(-0.85,-0.06,  0.06, -1.05,-0.06,  0.07); L(-0.85,-0.06, -0.06, -1.05,-0.06, -0.07);
    L(-1.05,-0.06,  0.07, -1.05,-0.06, -0.07);
    // Pod nozzles
    L(-0.95,-0.16,  0.68, -1.05,-0.16,  0.68); L(-0.95,-0.16,  0.82, -1.05,-0.16,  0.82);
    L(-1.05,-0.16,  0.68, -1.05,-0.16,  0.82);
    L(-0.95,-0.16, -0.68, -1.05,-0.16, -0.68); L(-0.95,-0.16, -0.82, -1.05,-0.16, -0.82);
    L(-1.05,-0.16, -0.68, -1.05,-0.16, -0.82);
    return new Float32Array(v);
  })();
  const shipGeo = new THREE.BufferGeometry();
  shipGeo.setAttribute('position', new THREE.BufferAttribute(_sv, 3));
  const ship = new THREE.LineSegments(shipGeo, new THREE.LineBasicMaterial({
    color: 0xb8e8ff, transparent: true, opacity: 0.92,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ship.scale.setScalar(0.22);
  scene.add(ship);

  // Twin engine glows (main nozzles + pod nozzles = 4 points)
  const _eBuf = new Float32Array(4 * 3);
  const eGeo  = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(_eBuf, 3));
  const eGlow = new THREE.Points(eGeo, new THREE.PointsMaterial({
    color: 0x67e8f9, size: 0.055, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(eGlow);
  // Pre-compute local nozzle positions (in ship local space × scale)
  const sc = 0.22;
  const _nozzles = [
    new THREE.Vector3(-1.05 * sc,  0.06 * sc,  0   ),
    new THREE.Vector3(-1.05 * sc, -0.06 * sc,  0   ),
    new THREE.Vector3(-1.05 * sc, -0.16 * sc,  0.75 * sc),
    new THREE.Vector3(-1.05 * sc, -0.16 * sc, -0.75 * sc),
  ];
  const _eWP = new THREE.Vector3();

  // Orbit trail ring (72-point ellipse matching ship path)
  const _tilt = Math.PI * 0.30;
  const _oPts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = 1.10 + 0.12 * Math.cos(a);
    _oPts.push(Math.cos(a) * r, Math.sin(a) * Math.sin(_tilt) * r, Math.sin(a) * Math.cos(_tilt) * r);
  }
  const orbitRingGeo = new THREE.BufferGeometry();
  orbitRingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(_oPts), 3));
  scene.add(new THREE.LineLoop(orbitRingGeo, new THREE.LineBasicMaterial({
    color: 0x818cf8, transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));

  // Exhaust trails — 4 lines, XLEN=8 points each
  const XLEN = 8;
  const _trails = _nozzles.map(() => {
    const buf = new Float32Array(XLEN * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.50,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(line);
    return { buf, geo };
  });

  // Nav lights — right winglet (red), left winglet (green)
  const _navR_buf = new Float32Array(3);
  const _navG_buf = new Float32Array(3);
  const _navRGeo = new THREE.BufferGeometry();
  const _navGGeo = new THREE.BufferGeometry();
  _navRGeo.setAttribute('position', new THREE.BufferAttribute(_navR_buf, 3));
  _navGGeo.setAttribute('position', new THREE.BufferAttribute(_navG_buf, 3));
  const navLightR = new THREE.Points(_navRGeo, new THREE.PointsMaterial({
    color: 0xff3333, size: 0.036, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  const navLightG = new THREE.Points(_navGGeo, new THREE.PointsMaterial({
    color: 0x33ff66, size: 0.036, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(navLightR); scene.add(navLightG);
  // Winglet tip positions in ship local space × scale
  const _navTips = [
    new THREE.Vector3(-0.72 * sc,  0.22 * sc,  0.82 * sc),
    new THREE.Vector3(-0.72 * sc,  0.22 * sc, -0.82 * sc),
  ];
  const _nWP = new THREE.Vector3();
  // ── END ship setup ───────────────────────────────────────────────────────

  // Animate
  const clock = new THREE.Clock();
  let rafId = null;
  (function frame(){
    rafId = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    tx += (mx - tx) * 0.04;
    ty += (my - ty) * 0.04;

    outerMesh.rotation.y = t * 0.14 + tx * 0.28;
    outerMesh.rotation.x = t * 0.07 + ty * 0.18;

    innerMesh.rotation.y = -t * 0.22 + tx * 0.18;
    innerMesh.rotation.x = -t * 0.11 + ty * 0.12;

    points.rotation.y = t * 0.06;
    points.rotation.x = t * 0.04;

    // ── Ship orbit — Kepler ellipse with full effects ──
    const baseAngle = t * 0.45;
    const oa  = baseAngle - 0.14 * Math.sin(baseAngle);  // Kepler speed variation
    const oR  = 1.10 + 0.12 * Math.cos(oa);              // elliptical radius 1.10–1.22
    const tilt = Math.PI * 0.30;
    ship.position.x = Math.cos(oa) * oR + tx * 0.10;
    ship.position.y = Math.sin(oa) * Math.sin(tilt) * oR + ty * 0.06;
    ship.position.z = Math.sin(oa) * Math.cos(tilt) * oR;
    // Face direction of travel (tangent to orbit)
    const vx = -Math.sin(oa);
    const vy =  Math.cos(oa) * Math.sin(tilt);
    const vz =  Math.cos(oa) * Math.cos(tilt);
    ship.rotation.y = -Math.atan2(vx, vz);
    ship.rotation.x =  Math.atan2(vy, Math.sqrt(vx * vx + vz * vz));
    ship.rotation.z = -Math.cos(oa) * 0.32 + Math.sin(t * 0.9) * 0.04; // correct bank + drift wobble
    ship.scale.setScalar(0.22 * (1 + Math.sin(t * 0.7) * 0.014));       // size shimmer
    ship.updateMatrixWorld(true);
    // 4 engine glows
    for (let n = 0; n < 4; n++) {
      _eWP.copy(_nozzles[n]).applyMatrix4(ship.matrixWorld);
      _eBuf[n * 3]     = _eWP.x;
      _eBuf[n * 3 + 1] = _eWP.y;
      _eBuf[n * 3 + 2] = _eWP.z;
    }
    eGeo.attributes.position.needsUpdate = true;
    eGlow.material.size = 0.05 + Math.sin(t * 12) * 0.012;
    // Exhaust trails — shift history, inject current nozzle world position
    for (let n = 0; n < 4; n++) {
      _eWP.copy(_nozzles[n]).applyMatrix4(ship.matrixWorld);
      const { buf, geo } = _trails[n];
      buf.copyWithin(3, 0, (XLEN - 1) * 3); // shift older points back
      buf[0] = _eWP.x; buf[1] = _eWP.y; buf[2] = _eWP.z;
      geo.attributes.position.needsUpdate = true;
    }
    // Nav lights — red/green alternate blink
    const blink = Math.sin(t * 5.0) > 0.2 ? 1.0 : 0.0;
    _nWP.copy(_navTips[0]).applyMatrix4(ship.matrixWorld);
    _navR_buf[0] = _nWP.x; _navR_buf[1] = _nWP.y; _navR_buf[2] = _nWP.z;
    _navRGeo.attributes.position.needsUpdate = true;
    navLightR.material.opacity = blink;
    _nWP.copy(_navTips[1]).applyMatrix4(ship.matrixWorld);
    _navG_buf[0] = _nWP.x; _navG_buf[1] = _nWP.y; _navG_buf[2] = _nWP.z;
    _navGGeo.attributes.position.needsUpdate = true;
    navLightG.material.opacity = 1.0 - blink;

    renderer.render(scene, camera);
  })();

  // Scroll fade — sphere fades out as user scrolls down
  const heroWrap=document.querySelector('.hero-sphere-wrap');
  const onSphereScroll = heroWrap ? ()=>{
    const pct=Math.min(window.scrollY/(window.innerHeight*0.7),1);
    heroWrap.style.opacity=String(1-pct*0.85);
    heroWrap.style.transform=`scale(${1-pct*0.1})`;
  } : null;
  if(onSphereScroll) window.addEventListener('scroll', onSphereScroll, {passive:true});

  // Clean up if galaxy stops (dark→light) — reuse same lifecycle
  window._heroSphereCleanup = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    if(onSphereScroll) window.removeEventListener('scroll', onSphereScroll);
    renderer.dispose();
  };
}

/* ── 21. FOOTER ── */
function initFooter(){
  const yr=document.getElementById('footerYear'); if(yr) yr.textContent=new Date().getFullYear();
}

/* ── 1b. 3D BACKGROUND (Three.js) — replaces 2D galaxy on desktop ── */
function init3DBackground() {
  // Mobile fallback — use 2D galaxy instead
  if (window.innerWidth < 768 || IS_TOUCH) {
    initGalaxy();
    return;
  }
  if (typeof THREE === 'undefined') {
    initGalaxy();
    return;
  }
  const canvas = document.getElementById('galaxyCanvas');
  if (!canvas) { initGalaxy(); return; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const rand = (a, b) => Math.random() * (b - a) + a;

  // ── Particle layers — dense galaxy field with z-drift for "passing stars" feel ──
  const layerDefs = [
    { count: 2200, color: 0xffffff, spread: 18, depth: 22, size: 0.16, opacity: 1.0,  speedMul: 1.0,  vz: 0.014 },
    { count: 1400, color: 0xa5b4fc, spread: 26, depth: 30, size: 0.11, opacity: 0.9,  speedMul: 0.65, vz: 0.008 },
    { count:  800, color: 0x67e8f9, spread: 36, depth: 40, size: 0.07, opacity: 0.75, speedMul: 0.35, vz: 0.004 },
  ];
  const particleGroups = layerDefs.map(def => {
    const positions = new Float32Array(def.count * 3);
    for (let i = 0; i < def.count; i++) {
      positions[i * 3]     = rand(-def.spread, def.spread);
      positions[i * 3 + 1] = rand(-def.spread, def.spread);
      positions[i * 3 + 2] = rand(-def.depth, 0);
    }
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr);
    const mat = new THREE.PointsMaterial({
      color: def.color, size: def.size, transparent: true,
      opacity: def.opacity, blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, geo, attr, speedMul: def.speedMul, origOp: def.opacity, vz: def.vz, spread: def.spread, depth: def.depth };
  });

  // ── Wire mesh plane ──
  const planeGeo  = new THREE.PlaneGeometry(300, 300, 15, 15);
  const planeMat  = new THREE.MeshBasicMaterial({
    color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.09,
  });
  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.position.set(0, -12, -30);
  scene.add(planeMesh);

  // ── Nebula blobs ──
  const nebulaColors = [0x6366f1, 0x06b6d4, 0x8b5cf6, 0x818cf8, 0x22d3ee];
  const nebulaOpacities = [0.045, 0.06, 0.07, 0.05, 0.08];
  nebulaColors.forEach((col, i) => {
    const geo = new THREE.SphereGeometry(rand(3, 7), 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: nebulaOpacities[i],
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(rand(-10, 10), rand(-6, 6), rand(-15, -5));
    scene.add(mesh);
  });

  // ── SPACESHIP ────────────────────────────────────────────────────────────
  // Build wireframe ship from explicit vertex pairs (no new allocs per frame)
  const _shipVerts = (() => {
    const v = [];
    const L = (ax,ay,az,bx,by,bz) => v.push(ax,ay,az,bx,by,bz);
    // Nose cone
    L( 1.0, 0,     0,     0.3,  0.13,  0   ); L( 1.0, 0,     0,     0.3, -0.13,  0   );
    L( 1.0, 0,     0,     0.3,  0,     0.1 ); L( 1.0, 0,     0,     0.3,  0,    -0.1 );
    // Front cross section
    L( 0.3, 0.13,  0,     0.3, -0.13,  0   ); L( 0.3,-0.13,  0,     0.3,  0,    -0.1 );
    L( 0.3, 0,    -0.1,   0.3,  0.13,  0   ); L( 0.3, 0.13,  0,     0.3,  0,     0.1 );
    L( 0.3, 0,     0.1,   0.3, -0.13,  0   );
    // Body sides front→rear
    L( 0.3, 0.13,  0,    -0.55, 0.13,  0   ); L( 0.3,-0.13,  0,    -0.55,-0.13,  0   );
    L( 0.3, 0,     0.1,  -0.55, 0,     0.1 ); L( 0.3, 0,    -0.1,  -0.55, 0,    -0.1 );
    // Rear cross section
    L(-0.55, 0.13, 0,    -0.55,-0.13,  0   ); L(-0.55,-0.13, 0,    -0.55, 0,    -0.1 );
    L(-0.55, 0,   -0.1,  -0.55, 0.13,  0   ); L(-0.55, 0.13, 0,    -0.55, 0,     0.1 );
    L(-0.55, 0,    0.1,  -0.55,-0.13,  0   );
    // Swept wings
    L( 0.1,  0.13, 0,    -0.3,  0.75,  0   ); L(-0.3,  0.75, 0,    -0.55, 0.13,  0   );
    L( 0.1, -0.13, 0,    -0.3, -0.75,  0   ); L(-0.3, -0.75, 0,    -0.55,-0.13,  0   );
    L(-0.3,  0.75, 0,    -0.2,  0.13,  0   ); L(-0.3, -0.75, 0,    -0.2, -0.13,  0   );
    // Engine nozzles
    L(-0.55, 0.08, 0,    -0.75, 0.08,  0   ); L(-0.55,-0.08, 0,    -0.75,-0.08,  0   );
    L(-0.75, 0.08, 0,    -0.75,-0.08,  0   );
    return new Float32Array(v);
  })();

  function makeShipLines(color, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(_shipVerts.slice(), 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  }

  // (Ambient orbiting ship moved into initHeroSphere — same Three.js scene as sphere)
  // Galaxy canvas only handles the warp flyby

  // ── Warp flyby ship ──
  const flyShip = makeShipLines(0xc4b5fd, 0.0);
  flyShip.scale.setScalar(0.52);
  scene.add(flyShip);

  // Flyby streak trail
  const TRAIL = 10;
  const _trailBuf = new Float32Array(TRAIL * 3);
  const trailGeo  = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(_trailBuf, 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    color:0x67e8f9, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false,
  }));
  scene.add(trailLine);

  const _flyPos   = new THREE.Vector3(0, 999, 0);
  const _flyVel   = new THREE.Vector3();
  let   flyActive = false, flyNextT = 5, flyTrailN = 0;
  // ── END SPACESHIP SETUP ──────────────────────────────────────────────────

  // ── Shooting stars (line segments) ──
  const shooters3D = [];
  function spawnShooter() {
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const pts = [];
    const sx = rand(-10, 10), sy = rand(2, 8), sz = rand(-5, 2);
    const angle = rand(0.35, 0.65);
    const len = rand(0.8, 2.2);
    pts.push(new THREE.Vector3(sx, sy, sz));
    pts.push(new THREE.Vector3(sx - Math.cos(angle) * len, sy - Math.sin(angle) * len, sz));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    shooters3D.push({
      line, mat, geo, pts,
      vx: Math.cos(angle) * rand(0.06, 0.18),
      vy: Math.sin(angle) * rand(0.06, 0.18),
      life: 1, decay: rand(0.025, 0.055),
    });
  }

  // ── Mouse parallax ──
  let mx = 0, my = 0;
  let _rafMx3D = false;
  const onMouseMove = e => {
    if(_rafMx3D) return; _rafMx3D = true;
    requestAnimationFrame(()=>{
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      _rafMx3D = false;
    });
  };
  if (!IS_TOUCH) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
  }

  // ── Scroll parallax ──
  let scrollY = window.scrollY;
  const onScroll = () => { scrollY = window.scrollY; };
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── Resize ──
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  let rafId = null;
  const paralaxSpeeds = [0.0012, 0.0007, 0.0004];

  function frame() {
    rafId = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    planeMesh.rotation.y = t * 0.008;
    planeMesh.rotation.x = t * 0.003;

    particleGroups.forEach((pg, i) => {
      // Slow galaxy rotation + mouse parallax
      pg.pts.rotation.y = t * 0.006 * pg.speedMul + mx * 0.05 * pg.speedMul;
      pg.pts.rotation.x = t * 0.003 * pg.speedMul + my * 0.025 * pg.speedMul;
      pg.pts.position.y = -scrollY * paralaxSpeeds[i];
      // Z-drift: move each star toward camera, wrap back when it passes z=0
      const pos = pg.attr.array;
      for (let j = 2; j < pos.length; j += 3) {
        pos[j] += pg.vz;
        if (pos[j] > 1) {
          pos[j - 2] = rand(-pg.spread, pg.spread);
          pos[j - 1] = rand(-pg.spread, pg.spread);
          pos[j]     = -pg.depth;
        }
      }
      pg.attr.needsUpdate = true;
    });

    // Shooting stars
    if (Math.random() < 0.016 && shooters3D.length < 6) spawnShooter();
    for (let i = shooters3D.length - 1; i >= 0; i--) {
      const s = shooters3D[i];
      s.life -= s.decay;
      s.mat.opacity = s.life * 0.85;
      s.pts[0].x += s.vx; s.pts[0].y += s.vy;
      s.pts[1].x += s.vx; s.pts[1].y += s.vy;
      s.geo.setFromPoints(s.pts);
      if (s.life <= 0) {
        scene.remove(s.line);
        s.geo.dispose(); s.mat.dispose();
        shooters3D.splice(i, 1);
      }
    }

    // ── Warp flyby — fires every 10-14 s (ambient ship is in hero sphere scene)
    if (!flyActive && t > flyNextT) {
      flyActive  = true;
      flyTrailN  = 0;
      flyNextT   = t + rand(10, 14);
      const side = Math.random() > 0.5 ? 1 : -1;
      _flyPos.set(-side * 16, rand(-2.5, 2.5), rand(-5, -2));
      _flyVel.set(side * 0.26, rand(-0.004, 0.004), 0);
      flyShip.rotation.y = side > 0 ? 0 : Math.PI;
      flyShip.material.opacity   = 0.88;
      trailLine.material.opacity = 0.75;
    }
    if (flyActive) {
      _flyPos.addScaledVector(_flyVel, 1);
      flyShip.position.copy(_flyPos);
      // Shift trail history forward
      for (let i = TRAIL - 1; i > 0; i--) {
        _trailBuf[i*3]   = _trailBuf[(i-1)*3];
        _trailBuf[i*3+1] = _trailBuf[(i-1)*3+1];
        _trailBuf[i*3+2] = _trailBuf[(i-1)*3+2];
      }
      _trailBuf[0] = _flyPos.x; _trailBuf[1] = _flyPos.y; _trailBuf[2] = _flyPos.z;
      flyTrailN = Math.min(flyTrailN + 1, TRAIL);
      trailGeo.setDrawRange(0, flyTrailN);
      trailGeo.attributes.position.needsUpdate = true;
      // Fade out near edges
      const dist = Math.abs(_flyPos.x);
      const fade = Math.max(0, 1 - Math.max(0, dist - 11) * 0.12);
      flyShip.material.opacity   = 0.88 * fade;
      trailLine.material.opacity = 0.75 * fade;
      if (dist > 18) {
        flyActive = false;
        flyShip.position.set(0, 999, 0);
        trailGeo.setDrawRange(0, 0);
        trailLine.material.opacity = 0;
      }
    }
    // ── End ship animation ────────────────────────────────────────────────

    renderer.render(scene, camera);
  }

  // Start loop immediately — ship should always be visible
  frame();

  // _galaxyCtrl: light mode dims/hides particles but keeps ship animating
  _galaxyCtrl = {
    start() {
      particleGroups.forEach(pg => { pg.pts.material.opacity = pg.origOp; });
      planeMat.opacity = 0.09;
    },
    stop() {
      // Dim particles in light mode but keep RAF running (ship stays visible)
      particleGroups.forEach(pg => { pg.pts.material.opacity = 0.0; });
      planeMat.opacity = 0.0;
      renderer.clear();
    },
  };

  // Dispose on unload
  window._galaxyCleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  };
}


/* ── PROJECT CARD TILT ── */
function initProjectCardTilt() {
  if (IS_TOUCH) return;

  document.querySelectorAll('.project-card .card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const rx = -(y / r.height - 0.5) * 12;
      const ry =  (x / r.width  - 0.5) * 12;
      card.style.transform  = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`;
      card.style.boxShadow  = '0 20px 60px rgba(0,0,0,0.3)';
      card.style.transition = 'none';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
      card.style.transform  = '';
      card.style.boxShadow  = '';
    });
  });
}

/* ── SECTION ENTRY BURST (GSAP onStart) ── */
function sectionEntryBurst(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const cvs  = document.createElement('canvas');
  cvs.width  = rect.width;
  cvs.height = rect.height;
  Object.assign(cvs.style, {
    position: 'fixed',
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    pointerEvents: 'none',
    zIndex: '9998',
  });
  document.body.appendChild(cvs);
  const ctx  = cvs.getContext('2d');
  const cx   = rect.width / 2, cy = rect.height / 2;
  const COLS = ['rgba(99,102,241,', 'rgba(6,182,212,', 'rgba(139,92,246,'];

  const particles = Array.from({ length: 60 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 3;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 2,
      a: 0.9,
      col: COLS[Math.floor(Math.random() * 3)],
    };
  });

  const start = performance.now();
  function draw(ts) {
    const elapsed = ts - start;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    let anyAlive = false;
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.a = Math.max(0, 0.9 - elapsed / 800);
      if (p.a > 0) {
        anyAlive = true;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col + p.a + ')'; ctx.fill();
      }
    });
    if (anyAlive && elapsed < 900) requestAnimationFrame(draw);
    else cvs.remove();
  }
  requestAnimationFrame(draw);
}

/* ── PROJECT THUMBNAILS ── */
function initProjectThumbs(){
  const S={
    cv:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#050d1a"/><stop offset="100%" stop-color="#0c2340"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-cv)"/><polygon points="95,152 205,152 240,68 60,68" fill="#111"/><line x1="95" y1="152" x2="60" y2="68" stroke="#444" stroke-width="1.5"/><line x1="205" y1="152" x2="240" y2="68" stroke="#444" stroke-width="1.5"/><line x1="150" y1="150" x2="150" y2="136" stroke="#f59e0b" stroke-width="2" stroke-dasharray="10,7"/><line x1="150" y1="124" x2="150" y2="110" stroke="#f59e0b" stroke-width="2" stroke-dasharray="10,7"/><line x1="150" y1="99" x2="150" y2="85" stroke="#f59e0b" stroke-width="2" stroke-dasharray="10,7"/><polygon points="100,152 150,152 153,78 88,72" fill="rgba(0,200,140,.17)" stroke="#00c88c" stroke-width="1.5" stroke-dasharray="4,3"/><polygon points="150,152 200,152 212,72 147,78" fill="rgba(0,180,255,.17)" stroke="#00b4ff" stroke-width="1.5" stroke-dasharray="4,3"/><rect x="248" y="10" width="36" height="27" rx="4" fill="none" stroke="#6ee7b7" stroke-width="1.5"/><circle cx="266" cy="23" r="7" fill="none" stroke="#6ee7b7" stroke-width="1.5"/><circle cx="266" cy="23" r="3" fill="#6ee7b7" opacity=".5"/><rect x="258" y="6" width="14" height="5" rx="2" fill="#6ee7b7" opacity=".7"/><circle cx="18" cy="16" r="1.2" fill="white" opacity=".45"/><circle cx="40" cy="8" r=".8" fill="white" opacity=".3"/><circle cx="55" cy="22" r="1" fill="white" opacity=".4"/><text x="8" y="144" font-size="7.5" fill="#00c88c" opacity=".7" font-family="monospace">LANE DETECT</text><text x="8" y="152" font-size="6.5" fill="#6ee7b7" opacity=".5" font-family="monospace">OpenCV · Hough · Canny</text></svg>`,

    health:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#06111f"/><stop offset="100%" stop-color="#0d2038"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-h)"/><line x1="0" y1="76" x2="300" y2="76" stroke="rgba(6,182,212,.1)" stroke-width="1"/><line x1="0" y1="50" x2="300" y2="50" stroke="rgba(6,182,212,.06)" stroke-width="1"/><line x1="0" y1="102" x2="300" y2="102" stroke="rgba(6,182,212,.06)" stroke-width="1"/><polyline points="0,76 35,76 50,76 62,28 74,116 86,76 105,76 117,76 129,38 141,110 152,76 300,76" fill="none" stroke="rgba(6,182,212,.3)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="0,76 35,76 50,76 62,28 74,116 86,76 105,76 117,76 129,38 141,110 152,76 300,76" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="240" y="16" width="44" height="44" rx="9" fill="rgba(239,68,68,.13)" stroke="rgba(239,68,68,.4)" stroke-width="1.5"/><rect x="257" y="24" width="10" height="28" rx="2" fill="#ef4444" opacity=".85"/><rect x="248" y="33" width="28" height="10" rx="2" fill="#ef4444" opacity=".85"/><circle cx="152" cy="76" r="5" fill="#06b6d4"/><circle cx="152" cy="76" r="10" fill="rgba(6,182,212,.2)"/><circle cx="14" cy="14" r="2" fill="rgba(6,182,212,.3)"/><circle cx="28" cy="26" r="1.5" fill="rgba(99,102,241,.3)"/><text x="8" y="144" font-size="7.5" fill="#06b6d4" opacity=".65" font-family="monospace">HEALTHCARE PORTAL</text><text x="8" y="152" font-size="6.5" fill="rgba(6,182,212,.4)" font-family="monospace">HTML · CSS · JavaScript</text></svg>`,

    ml:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-ml" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0d0620"/><stop offset="100%" stop-color="#1a0a38"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-ml)"/><line x1="30" y1="120" x2="270" y2="120" stroke="rgba(139,92,246,.25)" stroke-width="1"/><line x1="30" y1="20" x2="30" y2="120" stroke="rgba(139,92,246,.25)" stroke-width="1"/><line x1="30" y1="40" x2="270" y2="40" stroke="rgba(139,92,246,.08)" stroke-width="1"/><line x1="30" y1="70" x2="270" y2="70" stroke="rgba(139,92,246,.08)" stroke-width="1"/><line x1="30" y1="100" x2="270" y2="100" stroke="rgba(139,92,246,.08)" stroke-width="1"/><circle cx="55" cy="45" r="4" fill="#8b5cf6" opacity=".7"/><circle cx="78" cy="38" r="3.5" fill="#8b5cf6" opacity=".7"/><circle cx="90" cy="55" r="4" fill="#8b5cf6" opacity=".7"/><circle cx="110" cy="42" r="3" fill="#a78bfa" opacity=".7"/><circle cx="68" cy="62" r="3.5" fill="#8b5cf6" opacity=".6"/><circle cx="130" cy="90" r="4" fill="#f472b6" opacity=".7"/><circle cx="155" cy="100" r="3.5" fill="#f472b6" opacity=".7"/><circle cx="170" cy="85" r="4" fill="#f472b6" opacity=".7"/><circle cx="195" cy="95" r="3" fill="#f472b6" opacity=".65"/><circle cx="210" cy="105" r="4" fill="#f472b6" opacity=".7"/><circle cx="220" cy="80" r="3.5" fill="#f472b6" opacity=".6"/><line x1="30" y1="125" x2="265" y2="35" stroke="#6ee7b7" stroke-width="1.8" stroke-dasharray="6,4" opacity=".7"/><text x="200" y="35" font-size="8" fill="#6ee7b7" opacity=".7" font-family="monospace">boundary</text><text x="8" y="144" font-size="7.5" fill="#a78bfa" opacity=".7" font-family="monospace">DIABETES PREDICTION</text><text x="8" y="152" font-size="6.5" fill="rgba(167,139,250,.45)" font-family="monospace">Python · Scikit-learn · Pima</text></svg>`,

    dl:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-dl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#040e1e"/><stop offset="100%" stop-color="#081830"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-dl)"/><line x1="20" y1="76" x2="280" y2="76" stroke="rgba(99,102,241,.15)" stroke-width="1"/><path d="M20,76 C50,76 55,32 80,32 C105,32 110,118 135,118 C160,118 165,50 190,50 C215,50 220,105 245,105 C260,105 265,76 280,76" fill="none" stroke="#4f46e5" stroke-width="2" opacity=".85"/><path d="M20,80 C45,80 50,42 72,42 C94,42 99,110 121,110 C143,110 148,55 170,55 C192,55 197,100 219,100 C241,100 246,80 280,80" fill="none" stroke="#06b6d4" stroke-width="2" opacity=".75"/><path d="M20,72 C40,72 46,22 65,22 C84,22 89,128 108,128 C127,128 132,42 154,42 C176,42 181,112 203,112 C225,112 230,72 280,72" fill="none" stroke="#8b5cf6" stroke-width="1.5" opacity=".6"/><text x="230" y="30" font-size="7.5" fill="#4f46e5" opacity=".7" font-family="monospace">LSTM</text><text x="230" y="42" font-size="7.5" fill="#06b6d4" opacity=".7" font-family="monospace">GRU</text><text x="230" y="54" font-size="7.5" fill="#8b5cf6" opacity=".7" font-family="monospace">CNN</text><text x="8" y="144" font-size="7.5" fill="#06b6d4" opacity=".65" font-family="monospace">TRAFFIC PREDICTION</text><text x="8" y="152" font-size="6.5" fill="rgba(6,182,212,.4)" font-family="monospace">LSTM · GRU · CNN · Python</text></svg>`,

    db:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-db" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#03080f"/><stop offset="100%" stop-color="#071524"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-db)"/><ellipse cx="150" cy="38" rx="48" ry="13" fill="rgba(6,182,212,.12)" stroke="#06b6d4" stroke-width="1.5"/><path d="M102,38 L102,70" stroke="#06b6d4" stroke-width="1.5" opacity=".5"/><path d="M198,38 L198,70" stroke="#06b6d4" stroke-width="1.5" opacity=".5"/><ellipse cx="150" cy="70" rx="48" ry="13" fill="rgba(6,182,212,.12)" stroke="#06b6d4" stroke-width="1.5"/><path d="M102,70 L102,102" stroke="#4f46e5" stroke-width="1.5" opacity=".5"/><path d="M198,70 L198,102" stroke="#4f46e5" stroke-width="1.5" opacity=".5"/><ellipse cx="150" cy="102" rx="48" ry="13" fill="rgba(79,70,229,.12)" stroke="#4f46e5" stroke-width="1.5"/><path d="M102,102 L102,122" stroke="#8b5cf6" stroke-width="1.5" opacity=".5"/><path d="M198,102 L198,122" stroke="#8b5cf6" stroke-width="1.5" opacity=".5"/><ellipse cx="150" cy="122" rx="48" ry="13" fill="rgba(139,92,246,.12)" stroke="#8b5cf6" stroke-width="1.5"/><circle cx="245" cy="45" r="4" fill="#06b6d4" opacity=".5"/><circle cx="258" cy="38" r="3" fill="#4f46e5" opacity=".4"/><circle cx="240" cy="60" r="2.5" fill="#8b5cf6" opacity=".4"/><text x="8" y="144" font-size="7.5" fill="#06b6d4" opacity=".65" font-family="monospace">STUDENT DATABASE</text><text x="8" y="152" font-size="6.5" fill="rgba(6,182,212,.4)" font-family="monospace">Bootstrap · JavaScript · MySQL</text></svg>`,

    shop:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#061418"/><stop offset="100%" stop-color="#091e20"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-sh)"/><rect x="20" y="20" width="56" height="44" rx="5" fill="rgba(6,182,212,.1)" stroke="#06b6d4" stroke-width="1.2"/><rect x="84" y="20" width="56" height="44" rx="5" fill="rgba(16,185,129,.1)" stroke="#10b981" stroke-width="1.2"/><rect x="148" y="20" width="56" height="44" rx="5" fill="rgba(245,158,11,.1)" stroke="#f59e0b" stroke-width="1.2"/><rect x="20" y="72" width="56" height="44" rx="5" fill="rgba(139,92,246,.1)" stroke="#8b5cf6" stroke-width="1.2"/><rect x="84" y="72" width="56" height="44" rx="5" fill="rgba(239,68,68,.1)" stroke="#ef4444" stroke-width="1.2"/><rect x="148" y="72" width="56" height="44" rx="5" fill="rgba(236,72,153,.1)" stroke="#ec4899" stroke-width="1.2"/><circle cx="48" cy="42" r="10" fill="rgba(6,182,212,.2)"/><circle cx="112" cy="42" r="10" fill="rgba(16,185,129,.2)"/><circle cx="176" cy="42" r="10" fill="rgba(245,158,11,.2)"/><path d="M228,50 l8,0 l6,24 l28,0" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/><circle cx="241" cy="82" r="4" fill="#f59e0b" opacity=".8"/><circle cx="261" cy="82" r="4" fill="#f59e0b" opacity=".8"/><path d="M234,50 l2,-8 l30,0" fill="none" stroke="#f59e0b" stroke-width="1.5"/><text x="8" y="144" font-size="7.5" fill="#10b981" opacity=".65" font-family="monospace">INSTANT MARKET</text><text x="8" y="152" font-size="6.5" fill="rgba(16,185,129,.4)" font-family="monospace">HTML · Bootstrap · HCI</text></svg>`,

    access:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-ac" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#07091e"/><stop offset="100%" stop-color="#0e1230"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-ac)"/><circle cx="150" cy="28" r="10" fill="rgba(79,70,229,.2)" stroke="#4f46e5" stroke-width="1.8"/><line x1="150" y1="38" x2="100" y2="62" stroke="rgba(99,102,241,.4)" stroke-width="1.5"/><line x1="150" y1="38" x2="200" y2="62" stroke="rgba(99,102,241,.4)" stroke-width="1.5"/><circle cx="100" cy="70" r="9" fill="rgba(99,102,241,.18)" stroke="#818cf8" stroke-width="1.5"/><circle cx="200" cy="70" r="9" fill="rgba(99,102,241,.18)" stroke="#818cf8" stroke-width="1.5"/><line x1="100" y1="79" x2="68" y2="103" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><line x1="100" y1="79" x2="130" y2="103" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><line x1="200" y1="79" x2="172" y2="103" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><line x1="200" y1="79" x2="230" y2="103" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><circle cx="68" cy="110" r="7" fill="rgba(139,92,246,.15)" stroke="#a78bfa" stroke-width="1.2"/><circle cx="130" cy="110" r="7" fill="rgba(139,92,246,.15)" stroke="#a78bfa" stroke-width="1.2"/><circle cx="172" cy="110" r="7" fill="rgba(139,92,246,.15)" stroke="#a78bfa" stroke-width="1.2"/><circle cx="230" cy="110" r="7" fill="rgba(139,92,246,.15)" stroke="#a78bfa" stroke-width="1.2"/><text x="8" y="144" font-size="7.5" fill="#818cf8" opacity=".65" font-family="monospace">ACADEMIC ADVISOR</text><text x="8" y="152" font-size="6.5" fill="rgba(129,140,248,.4)" font-family="monospace">HTML · ARIA · WCAG</text></svg>`,

    ai:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-ai" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#060b14"/><stop offset="100%" stop-color="#0b1520"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-ai)"/><rect x="20" y="18" width="180" height="105" rx="6" fill="rgba(99,102,241,.08)" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><rect x="20" y="18" width="180" height="16" rx="6" fill="rgba(99,102,241,.15)"/><circle cx="30" cy="26" r="3" fill="#ef4444" opacity=".7"/><circle cx="41" cy="26" r="3" fill="#f59e0b" opacity=".7"/><circle cx="52" cy="26" r="3" fill="#10b981" opacity=".7"/><rect x="32" y="42" width="90" height="5" rx="2" fill="#4f46e5" opacity=".5"/><rect x="32" y="54" width="60" height="5" rx="2" fill="#06b6d4" opacity=".45"/><rect x="40" y="54" width="4" height="5" rx="1" fill="#f59e0b" opacity=".7"/><rect x="32" y="66" width="110" height="5" rx="2" fill="#4f46e5" opacity=".4"/><rect x="32" y="78" width="76" height="5" rx="2" fill="#8b5cf6" opacity=".4"/><rect x="32" y="90" width="88" height="5" rx="2" fill="#06b6d4" opacity=".35"/><rect x="32" y="102" width="52" height="5" rx="2" fill="#4f46e5" opacity=".4"/><circle cx="238" cy="50" r="14" fill="rgba(245,158,11,.1)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,3"/><path d="M231,50 L238,44 L245,50 L238,56 Z" fill="#f59e0b" opacity=".8"/><line x1="220" y1="38" x2="205" y2="78" stroke="rgba(245,158,11,.25)" stroke-width="1.2"/><line x1="255" y1="40" x2="265" y2="80" stroke="rgba(245,158,11,.2)" stroke-width="1.2"/><circle cx="205" cy="82" r="4" fill="rgba(245,158,11,.4)"/><circle cx="266" cy="84" r="4" fill="rgba(245,158,11,.4)"/><text x="8" y="144" font-size="7.5" fill="#f59e0b" opacity=".65" font-family="monospace">UI CODE ASSISTANT</text><text x="8" y="152" font-size="6.5" fill="rgba(245,158,11,.4)" font-family="monospace">AI · HCI · MVC · Fitts' Law</text></svg>`,

    edu:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-ed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#041410"/><stop offset="100%" stop-color="#082018"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-ed)"/><line x1="30" y1="20" x2="30" y2="118" stroke="rgba(16,185,129,.2)" stroke-width="1"/><line x1="30" y1="118" x2="260" y2="118" stroke="rgba(16,185,129,.2)" stroke-width="1"/><rect x="45" y="68" width="24" height="50" rx="3" fill="rgba(16,185,129,.2)" stroke="#10b981" stroke-width="1.2"/><rect x="85" y="48" width="24" height="70" rx="3" fill="rgba(6,182,212,.2)" stroke="#06b6d4" stroke-width="1.2"/><rect x="125" y="38" width="24" height="80" rx="3" fill="rgba(16,185,129,.25)" stroke="#10b981" stroke-width="1.2"/><rect x="165" y="55" width="24" height="63" rx="3" fill="rgba(6,182,212,.2)" stroke="#06b6d4" stroke-width="1.2"/><rect x="205" y="30" width="24" height="88" rx="3" fill="rgba(16,185,129,.28)" stroke="#10b981" stroke-width="1.2"/><circle cx="232" cy="22" r="12" fill="rgba(16,185,129,.15)" stroke="#10b981" stroke-width="1.5"/><path d="M227,22 L230,26 L238,17" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="57" cy="58" r="5" fill="#10b981" opacity=".6"/><circle cx="97" cy="38" r="5" fill="#06b6d4" opacity=".6"/><circle cx="137" cy="28" r="5" fill="#10b981" opacity=".6"/><circle cx="177" cy="45" r="5" fill="#06b6d4" opacity=".6"/><circle cx="217" cy="20" r="5" fill="#10b981" opacity=".6"/><text x="8" y="144" font-size="7.5" fill="#10b981" opacity=".65" font-family="monospace">AUTO GRADING</text><text x="8" y="152" font-size="6.5" fill="rgba(16,185,129,.4)" font-family="monospace">Analytics · Nielsen Heuristics</text></svg>`,

    portfolio:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-pf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a0618"/><stop offset="100%" stop-color="#120826"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-pf)"/><rect x="30" y="20" width="200" height="110" rx="8" fill="rgba(139,92,246,.08)" stroke="rgba(139,92,246,.3)" stroke-width="1.5"/><rect x="30" y="20" width="200" height="20" rx="8" fill="rgba(139,92,246,.15)"/><circle cx="44" cy="30" r="3.5" fill="#ef4444" opacity=".6"/><circle cx="56" cy="30" r="3.5" fill="#f59e0b" opacity=".6"/><circle cx="68" cy="30" r="3.5" fill="#10b981" opacity=".6"/><rect x="45" y="48" width="80" height="6" rx="2" fill="rgba(245,158,11,.4)"/><rect x="45" y="60" width="55" height="4" rx="2" fill="rgba(139,92,246,.3)"/><rect x="45" y="72" width="65" height="4" rx="2" fill="rgba(99,102,241,.3)"/><rect x="45" y="84" width="48" height="4" rx="2" fill="rgba(139,92,246,.25)"/><rect x="155" y="48" width="60" height="65" rx="4" fill="rgba(99,102,241,.1)" stroke="rgba(99,102,241,.2)" stroke-width="1"/><path d="M158,68 L185,52 L212,68" fill="rgba(245,158,11,.15)" stroke="#f59e0b" stroke-width="1.2"/><circle cx="185" cy="52" r="6" fill="rgba(245,158,11,.2)" stroke="#f59e0b" stroke-width="1.2"/><path d="M258,15 L260,21 L266,21 L261,25 L263,31 L258,27 L253,31 L255,25 L250,21 L256,21 Z" fill="#f59e0b" opacity=".6"/><path d="M275,35 L276,39 L280,39 L277,41 L278,45 L275,43 L272,45 L273,41 L270,39 L274,39 Z" fill="#a78bfa" opacity=".5"/><path d="M245,40 L246,43 L249,43 L247,44 L248,47 L245,46 L242,47 L243,44 L241,43 L244,43 Z" fill="#67e8f9" opacity=".45"/><text x="8" y="144" font-size="7.5" fill="#a78bfa" opacity=".65" font-family="monospace">PERSONAL PORTFOLIO</text><text x="8" y="152" font-size="6.5" fill="rgba(167,139,250,.4)" font-family="monospace">GSAP · Three.js · PWA</text></svg>`,

    gl3d:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#110508"/><stop offset="100%" stop-color="#1e0a10"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-gl)"/><polygon points="150,22 218,55 218,115 150,130 82,115 82,55" fill="rgba(239,68,68,.06)" stroke="#ef4444" stroke-width="1.5" opacity=".7"/><line x1="150" y1="22" x2="150" y2="78" stroke="#ef4444" stroke-width="1.2" opacity=".5"/><line x1="218" y1="55" x2="150" y2="78" stroke="#ef4444" stroke-width="1.2" opacity=".5"/><line x1="82" y1="55" x2="150" y2="78" stroke="#ef4444" stroke-width="1.2" opacity=".5"/><line x1="218" y1="115" x2="150" y2="78" stroke="#f59e0b" stroke-width="1.2" opacity=".35"/><line x1="82" y1="115" x2="150" y2="78" stroke="#f59e0b" stroke-width="1.2" opacity=".35"/><line x1="150" y1="130" x2="150" y2="78" stroke="#f59e0b" stroke-width="1.2" opacity=".35"/><circle cx="150" cy="78" r="4" fill="#ef4444" opacity=".6"/><circle cx="150" cy="22" r="3" fill="#f97316" opacity=".5"/><circle cx="218" cy="55" r="3" fill="#f97316" opacity=".5"/><circle cx="218" cy="115" r="3" fill="#fbbf24" opacity=".4"/><circle cx="82" cy="55" r="3" fill="#f97316" opacity=".5"/><circle cx="82" cy="115" r="3" fill="#fbbf24" opacity=".4"/><circle cx="150" cy="130" r="3" fill="#fbbf24" opacity=".4"/><text x="8" y="144" font-size="7.5" fill="#ef4444" opacity=".65" font-family="monospace">3D MODEL BUILDER</text><text x="8" y="152" font-size="6.5" fill="rgba(239,68,68,.4)" font-family="monospace">OpenGL · FLTK · PLY Mesh</text></svg>`,

    proc:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-pr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#020e06"/><stop offset="100%" stop-color="#061a0c"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-pr)"/><line x1="150" y1="130" x2="150" y2="95" stroke="#16a34a" stroke-width="2"/><line x1="150" y1="95" x2="120" y2="70" stroke="#16a34a" stroke-width="1.8"/><line x1="150" y1="95" x2="180" y2="70" stroke="#16a34a" stroke-width="1.8"/><line x1="120" y1="70" x2="98" y2="48" stroke="#16a34a" stroke-width="1.5"/><line x1="120" y1="70" x2="135" y2="45" stroke="#16a34a" stroke-width="1.5"/><line x1="180" y1="70" x2="165" y2="45" stroke="#16a34a" stroke-width="1.5"/><line x1="180" y1="70" x2="202" y2="48" stroke="#16a34a" stroke-width="1.5"/><line x1="98" y1="48" x2="82" y2="30" stroke="#22c55e" stroke-width="1.2"/><line x1="98" y1="48" x2="108" y2="28" stroke="#22c55e" stroke-width="1.2"/><line x1="135" y1="45" x2="125" y2="26" stroke="#22c55e" stroke-width="1.2"/><line x1="135" y1="45" x2="144" y2="26" stroke="#22c55e" stroke-width="1.2"/><line x1="165" y1="45" x2="156" y2="26" stroke="#22c55e" stroke-width="1.2"/><line x1="165" y1="45" x2="175" y2="26" stroke="#22c55e" stroke-width="1.2"/><line x1="202" y1="48" x2="192" y2="28" stroke="#22c55e" stroke-width="1.2"/><line x1="202" y1="48" x2="218" y2="30" stroke="#22c55e" stroke-width="1.2"/><polygon points="240,70 248,62 256,70" fill="#22c55e" opacity=".5"/><polygon points="258,55 264,49 270,55" fill="#22c55e" opacity=".4"/><polygon points="268,75 275,67 282,75" fill="#16a34a" opacity=".4"/><polygon points="255,88 261,82 267,88" fill="#22c55e" opacity=".35"/><text x="8" y="144" font-size="7.5" fill="#22c55e" opacity=".65" font-family="monospace">PROCEDURAL MODELING</text><text x="8" y="152" font-size="6.5" fill="rgba(34,197,94,.4)" font-family="monospace">L-System · Boids · OpenGL</text></svg>`,

    research:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-rs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0e0514"/><stop offset="100%" stop-color="#180820"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-rs)"/><line x1="30" y1="20" x2="30" y2="115" stroke="rgba(236,72,153,.2)" stroke-width="1"/><line x1="30" y1="115" x2="265" y2="115" stroke="rgba(236,72,153,.2)" stroke-width="1"/><rect x="50" y="50" width="20" height="65" rx="3" fill="rgba(236,72,153,.22)" stroke="#ec4899" stroke-width="1.2"/><rect x="80" y="65" width="20" height="50" rx="3" fill="rgba(139,92,246,.22)" stroke="#8b5cf6" stroke-width="1.2"/><rect x="130" y="42" width="20" height="73" rx="3" fill="rgba(236,72,153,.25)" stroke="#ec4899" stroke-width="1.2"/><rect x="160" y="58" width="20" height="57" rx="3" fill="rgba(139,92,246,.22)" stroke="#8b5cf6" stroke-width="1.2"/><rect x="210" y="35" width="20" height="80" rx="3" fill="rgba(236,72,153,.28)" stroke="#ec4899" stroke-width="1.2"/><rect x="240" y="50" width="20" height="65" rx="3" fill="rgba(139,92,246,.22)" stroke="#8b5cf6" stroke-width="1.2"/><text x="42" y="44" font-size="7" fill="#ec4899" opacity=".55" font-family="monospace">VR</text><text x="72" y="60" font-size="7" fill="#8b5cf6" opacity=".55" font-family="monospace">CO</text><text x="122" y="36" font-size="7" fill="#ec4899" opacity=".55" font-family="monospace">VI</text><text x="8" y="144" font-size="7.5" fill="#ec4899" opacity=".65" font-family="monospace">USER EVALUATION</text><text x="8" y="152" font-size="6.5" fill="rgba(236,72,153,.4)" font-family="monospace">ANOVA · Chi-squared · HCI</text></svg>`,

    home:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-hm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0e0900"/><stop offset="100%" stop-color="#1a1000"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-hm)"/><rect x="30" y="18" width="200" height="110" rx="4" fill="rgba(245,158,11,.05)" stroke="rgba(245,158,11,.3)" stroke-width="1.2"/><line x1="30" y1="78" x2="230" y2="78" stroke="rgba(245,158,11,.2)" stroke-width="1"/><line x1="120" y1="18" x2="120" y2="128" stroke="rgba(245,158,11,.2)" stroke-width="1"/><rect x="38" y="26" width="48" height="38" rx="3" fill="rgba(245,158,11,.12)" stroke="#f59e0b" stroke-width="1.2"/><rect x="130" y="26" width="38" height="28" rx="3" fill="rgba(251,191,36,.1)" stroke="#fbbf24" stroke-width="1.2"/><rect x="175" y="26" width="45" height="18" rx="3" fill="rgba(245,158,11,.08)" stroke="#f59e0b" stroke-width="1.2"/><rect x="38" y="86" width="34" height="32" rx="3" fill="rgba(16,185,129,.1)" stroke="#10b981" stroke-width="1.2"/><rect x="80" y="86" width="30" height="32" rx="3" fill="rgba(6,182,212,.1)" stroke="#06b6d4" stroke-width="1.2"/><rect x="130" y="88" width="90" height="30" rx="3" fill="rgba(245,158,11,.08)" stroke="#f59e0b" stroke-width="1.2"/><text x="44" y="47" font-size="7" fill="#f59e0b" opacity=".45" font-family="monospace">Sofa</text><text x="132" y="38" font-size="7" fill="#fbbf24" opacity=".45" font-family="monospace">Desk</text><text x="42" y="104" font-size="7" fill="#10b981" opacity=".45" font-family="monospace">Bed</text><circle cx="250" cy="60" r="20" fill="rgba(245,158,11,.06)" stroke="rgba(245,158,11,.3)" stroke-width="1.2" stroke-dasharray="5,3"/><path d="M240,55 C242,48 258,48 260,55 L256,72 L244,72 Z" fill="rgba(245,158,11,.2)"/><text x="8" y="144" font-size="7.5" fill="#f59e0b" opacity=".65" font-family="monospace">MAKE-IT-HOME</text><text x="8" y="152" font-size="6.5" fill="rgba(245,158,11,.4)" font-family="monospace">Simulated Annealing · Cost Fn</text></svg>`,

    gov:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-gv" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020a14"/><stop offset="100%" stop-color="#051520"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-gv)"/><rect x="20" y="14" width="260" height="16" rx="4" fill="rgba(14,165,233,.12)" stroke="rgba(14,165,233,.3)" stroke-width="1.2"/><rect x="24" y="18" width="60" height="8" rx="2" fill="rgba(14,165,233,.3)"/><rect x="90" y="20" width="40" height="4" rx="1" fill="rgba(14,165,233,.2)"/><rect x="20" y="38" width="80" height="50" rx="4" fill="rgba(14,165,233,.08)" stroke="rgba(14,165,233,.25)" stroke-width="1.2"/><rect x="26" y="44" width="40" height="4" rx="1" fill="rgba(14,165,233,.3)"/><rect x="26" y="52" width="60" height="28" rx="2" fill="rgba(14,165,233,.08)"/><polyline points="30,76 40,64 50,70 60,58 68,65 78,55" fill="none" stroke="#0ea5e9" stroke-width="1.5"/><rect x="108" y="38" width="80" height="50" rx="4" fill="rgba(16,185,129,.07)" stroke="rgba(16,185,129,.22)" stroke-width="1.2"/><rect x="114" y="44" width="40" height="4" rx="1" fill="rgba(16,185,129,.3)"/><rect x="114" y="54" width="28" height="26" rx="2" fill="rgba(16,185,129,.15)" stroke="#10b981" stroke-width="1"/><text x="118" y="67" font-size="9" fill="#10b981" opacity=".6" font-family="monospace">142</text><text x="118" y="79" font-size="7" fill="rgba(16,185,129,.4)" font-family="monospace">assets</text><rect x="196" y="38" width="80" height="50" rx="4" fill="rgba(139,92,246,.07)" stroke="rgba(139,92,246,.22)" stroke-width="1.2"/><rect x="202" y="44" width="40" height="4" rx="1" fill="rgba(139,92,246,.3)"/><rect x="202" y="54" width="62" height="8" rx="2" fill="rgba(139,92,246,.15)"/><rect x="202" y="66" width="50" height="8" rx="2" fill="rgba(139,92,246,.12)"/><rect x="202" y="78" width="56" height="8" rx="2" fill="rgba(139,92,246,.1)"/><rect x="20" y="96" width="256" height="20" rx="4" fill="rgba(14,165,233,.06)" stroke="rgba(14,165,233,.15)" stroke-width="1"/><text x="8" y="144" font-size="7.5" fill="#0ea5e9" opacity=".65" font-family="monospace">COUNTY INVENTORY (UIMS)</text><text x="8" y="152" font-size="6.5" fill="rgba(14,165,233,.4)" font-family="monospace">Django REST · React · Role-based</text></svg>`,

    civic:`<svg viewBox="0 0 300 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="pt-cv2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020c16"/><stop offset="100%" stop-color="#04152a"/></linearGradient></defs><rect width="300" height="152" fill="url(#pt-cv2)"/><circle cx="150" cy="60" r="16" fill="rgba(14,165,233,.15)" stroke="#0ea5e9" stroke-width="1.8"/><circle cx="80" cy="40" r="11" fill="rgba(14,165,233,.12)" stroke="#0ea5e9" stroke-width="1.4"/><circle cx="220" cy="40" r="11" fill="rgba(14,165,233,.12)" stroke="#0ea5e9" stroke-width="1.4"/><circle cx="60" cy="95" r="10" fill="rgba(16,185,129,.12)" stroke="#10b981" stroke-width="1.4"/><circle cx="240" cy="95" r="10" fill="rgba(16,185,129,.12)" stroke="#10b981" stroke-width="1.4"/><circle cx="150" cy="110" r="11" fill="rgba(99,102,241,.12)" stroke="#818cf8" stroke-width="1.4"/><circle cx="110" cy="105" r="9" fill="rgba(14,165,233,.1)" stroke="#0ea5e9" stroke-width="1.2"/><circle cx="190" cy="105" r="9" fill="rgba(14,165,233,.1)" stroke="#0ea5e9" stroke-width="1.2"/><line x1="150" y1="76" x2="80" y2="51" stroke="rgba(14,165,233,.3)" stroke-width="1.2"/><line x1="150" y1="76" x2="220" y2="51" stroke="rgba(14,165,233,.3)" stroke-width="1.2"/><line x1="80" y1="51" x2="60" y2="85" stroke="rgba(14,165,233,.2)" stroke-width="1"/><line x1="220" y1="51" x2="240" y2="85" stroke="rgba(14,165,233,.2)" stroke-width="1"/><line x1="150" y1="76" x2="150" y2="99" stroke="rgba(99,102,241,.3)" stroke-width="1.2"/><line x1="150" y1="76" x2="110" y2="96" stroke="rgba(14,165,233,.2)" stroke-width="1"/><line x1="150" y1="76" x2="190" y2="96" stroke="rgba(14,165,233,.2)" stroke-width="1"/><path d="M143,54 L157,54 L156,61 L150,65 L144,61 Z" fill="rgba(14,165,233,.3)"/><text x="8" y="144" font-size="7.5" fill="#0ea5e9" opacity=".65" font-family="monospace">BENEFITSCONNECT</text><text x="8" y="152" font-size="6.5" fill="rgba(14,165,233,.4)" font-family="monospace">Benefits Wizard · Analytics</text></svg>`
  };
  document.querySelectorAll('.project-thumb[data-type]').forEach(el=>{
    const svg=S[el.dataset.type];
    if(svg) el.innerHTML=svg;
  });
}

/* ── MAGNETIC ICONS ── */
function initMagneticIcons(){
  if(IS_TOUCH) return;
  document.querySelectorAll('.hero-socials a,.about-social-link,.footer-social a').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*0.4;
      const y=(e.clientY-r.top-r.height/2)*0.4;
      el.style.transform=`translate(${x}px,${y}px) scale(1.2)`;
      el.style.transition='transform 0.1s ease';
    });
    el.addEventListener('mouseleave',()=>{
      el.style.transform='';
      el.style.transition='transform 0.4s cubic-bezier(.34,1.56,.64,1)';
    });
  });
}

/* ── CURSOR GLOW ── */
function initCursorGlow(){
  if(IS_TOUCH) return;
  if(document.getElementById('cursorGlow')) return; // guard against duplicate init
  const glow=document.createElement('div');
  glow.id='cursorGlow';
  // Static styles set once; position driven via CSS vars --gx/--gy to avoid per-frame style recalc
  Object.assign(glow.style,{
    position:'fixed',width:'300px',height:'300px',
    borderRadius:'50%',
    background:'radial-gradient(circle,rgba(99,102,241,.12) 0%,transparent 70%)',
    pointerEvents:'none',zIndex:'1',
    transform:'translate(calc(var(--gx,0px) - 50%), calc(var(--gy,0px) - 50%))',
    transition:'opacity 0.3s ease',
    willChange:'transform',left:'0px',top:'0px',
  });
  document.body.appendChild(glow);
  let gx=0,gy=0,cx=0,cy=0;
  window.addEventListener('mousemove',e=>{cx=e.clientX;cy=e.clientY;},{passive:true});
  function animate(){
    gx+=(cx-gx)*0.08; gy+=(cy-gy)*0.08;
    glow.style.setProperty('--gx', gx+'px');
    glow.style.setProperty('--gy', gy+'px');
    requestAnimationFrame(animate);
  }
  animate();
  document.addEventListener('mouseleave',()=>{glow.style.opacity='0';});
  document.addEventListener('mouseenter',()=>{glow.style.opacity='1';});
}

/* ── BOOT ── */
// Detect which page we're on to skip irrelevant inits
const IS_GALLERY_PAGE = !!document.getElementById('galleryGrid');

document.addEventListener('DOMContentLoaded', () => {
  // Shared across all pages
  initScrollBar();
  initBackToTop();
  initHeader();
  initFooter();
  initMagneticIcons();
  initCursorGlow();

  if(IS_GALLERY_PAGE) return; // gallery.html has its own inline JS

  // Index-only inits
  initHeroSphere();
  init3DBackground();
  initTheme();
  initTyped();
  initTimeline();
  initSkills();
  initSkillCharts();
  initProjectFilter();
  initCertModal();
  initProjectModal();
  initContact();
  initPhotoTilt();
  initHeroParallax();
  initHireBanner();
  initCopyEmail();
  initTestimonialsCarousel();
  initStatCounters();
  initHashSync();
  initProjectCardTilt();
  initProjectThumbs();
});

// GSAP loads via defer — guaranteed available on window.load
window.addEventListener('load', () => {
  initAnimations();
});

// Three.js renderer cleanup on navigate/close to prevent battery drain
window.addEventListener('beforeunload', () => {
  window._heroSphereCleanup?.();
  window._galaxyCleanup?.();
});