/**
 * DMAsistan — main.js
 * Vanilla JavaScript — No frameworks, no dependencies
 * Handles: Navbar, Scroll Reveal, FAQ Accordion, Pricing Toggle, Chat Animation
 */

/* =============================================
   1. NAVBAR — Sticky + Scroll Effect
   ============================================= */
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileLinks = document.querySelectorAll('.mobile-link');

window.addEventListener('scroll', () => {
  if (!navbar) return;
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Hamburger toggle
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
  });

  // Close mobile menu when a link is clicked
  if (mobileLinks && mobileLinks.length) {
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
}

/* =============================================
   2. SCROLL REVEAL — Intersection Observer
   ============================================= */
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Staggered delay for sibling elements
      const siblings = entry.target.parentElement.querySelectorAll('.reveal');
      let delay = 0;
      siblings.forEach((el, index) => {
        if (el === entry.target) delay = index * 80;
      });
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, Math.min(delay, 300));
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

/* =============================================
   3. FAQ ACCORDION
   ============================================= */
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');

  if (!question) return;

  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    // Close all others
    faqItems.forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        const otherAns = other.querySelector('.faq-answer');
        if (otherAns) otherAns.style.maxHeight = null;
      }
    });

    // Toggle current
    if (isOpen) {
      item.classList.remove('open');
      answer.style.maxHeight = null;
    } else {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

/* =============================================
   4. PRICING TOGGLE — Monthly / Yearly
   ============================================= */
const billingToggle = document.getElementById('billingToggle');
const monthlyLabel = document.getElementById('monthlyLabel');
const yearlyLabel  = document.getElementById('yearlyLabel');
const priceAmounts = document.querySelectorAll('.monthly-price');

if (billingToggle) {
  billingToggle.addEventListener('change', () => {
    const isYearly = billingToggle.checked;

    if (monthlyLabel) monthlyLabel.classList.toggle('active', !isYearly);
    if (yearlyLabel) yearlyLabel.classList.toggle('active', isYearly);

    priceAmounts.forEach(el => {
      const monthly = el.getAttribute('data-monthly');
      const yearly  = el.getAttribute('data-yearly');

      if (!monthly) return; // Free plan — stays 0

      if (isYearly && yearly) {
        el.textContent = Number(yearly).toLocaleString('tr-TR');
      } else {
        el.textContent = Number(monthly).toLocaleString('tr-TR');
      }
    });
  });
}

/* =============================================
   5. CHAT ANIMATION — Phone Mockup Auto-Loop
   ============================================= */
function animateChatMessages() {
  const messages = document.querySelectorAll('#chatMessages .msg, #chatMessages .quick-replies');

  messages.forEach((el, i) => {
    // Reset
    el.style.opacity = '0';
    el.style.animation = 'none';

    setTimeout(() => {
      el.style.animation = '';
      const delay = el.style.animationDelay || `${i * 1}s`;
      el.style.animationDelay = delay;
    }, 100);
  });
}

// Re-trigger chat animation every 8 seconds
animateChatMessages();
setInterval(animateChatMessages, 9000);

/* =============================================
   6. SMOOTH SCROLL for anchor links
   ============================================= */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80; // navbar height
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* =============================================
   7. STAT COUNTER ANIMATION
   ============================================= */
function animateCounter(el, target, duration = 1800) {
  const start = performance.now();
  const isLarge = target > 1000000;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);

    if (isLarge) {
      el.textContent = (current / 1000000000).toFixed(1) + ' Milyar+';
    } else {
      el.textContent = current.toLocaleString('tr-TR') + '+';
    }

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.getAttribute('data-target'));
      if (isNaN(target)) return;
      animateCounter(el, target);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

/* =============================================
   8. BUTTON HOVER RIPPLE EFFECT
   ============================================= */
document.querySelectorAll('.btn-gradient, .btn-ghost, .btn-outline').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.5s linear;
      pointer-events: none;
    `;

    // Add ripple keyframe if not exists
    if (!document.getElementById('rippleStyle')) {
      const style = document.createElement('style');
      style.id = 'rippleStyle';
      style.textContent = `
        @keyframes ripple {
          to { transform: scale(3); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    this.style.position = 'relative';
    this.style.overflow = 'hidden';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

/* =============================================
   9. QUICK REPLY BUTTONS — Interactive
   ============================================= */
document.querySelectorAll('.qr-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    this.style.background = 'rgba(124,58,237,0.6)';
    this.style.borderColor = 'rgba(124,58,237,0.8)';
    setTimeout(() => {
      this.style.background = '';
      this.style.borderColor = '';
    }, 800);
  });
});

/* =============================================
   10. ACTIVE NAV LINK on scroll
   ============================================= */
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navAnchors.forEach(a => {
        a.style.color = a.getAttribute('href') === `#${id}` ? '#fff' : '';
        a.style.background = a.getAttribute('href') === `#${id}` ? 'rgba(255,255,255,0.06)' : '';
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

/* =============================================
   11. PAGE LOAD — initial hero reveal
   ============================================= */
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), i * 120);
  });
});
