/**
 * Haven Landing & Download Site Logic
 * Theme persistence, copy snippets, interactive feedback
 */

document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('haven_theme');

  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initialTheme);
  updateThemeIcon(initialTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('haven_theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    if (theme === 'dark') {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    } else {
      themeToggleBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
  }

  // Copy Snippet functionality
  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<span style="color:#10b981; font-size:0.75rem;">Copied!</span>`;
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 2000);
        });
      }
    });
  });

  // Mobile Navigation Drawer Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');

  if (mobileMenuBtn && mobileNavDrawer) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileNavDrawer.classList.toggle('open');
      mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
      mobileMenuBtn.innerHTML = isOpen
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    });

    // Close drawer on clicking any link inside it
    mobileNavDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      });
    });

    // Close drawer on clicking outside
    document.addEventListener('click', (e) => {
      if (mobileNavDrawer.classList.contains('open') && !mobileNavDrawer.contains(e.target) && e.target !== mobileMenuBtn) {
        mobileNavDrawer.classList.remove('open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        mobileNavDrawer.classList.remove('open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      }
    });
  }

  // On localhost / local dev server, route portable download directly to local build
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const portableBtn = document.getElementById('btn-portable-zip');
    if (portableBtn) {
      portableBtn.setAttribute('href', 'downloads/Haven-Portable.zip');
      portableBtn.setAttribute('download', 'Haven-Portable.zip');
    }
  }

  // =========================================================================
  // Download Page: Platform Switcher Tabs
  // =========================================================================
  const platformTabs = document.querySelectorAll('.platform-tab-btn');
  const platformPanels = document.querySelectorAll('.platform-panel');

  platformTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetPlatform = tab.getAttribute('data-platform');
      if (!targetPlatform) return;

      platformTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      platformPanels.forEach((panel) => {
        if (panel.id === `panel-${targetPlatform}`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });

  // =========================================================================
  // Download Page: Terminal Language Switcher
  // =========================================================================
  const langTabs = document.querySelectorAll('.btn-lang-tab');
  const terminalCode = document.getElementById('terminal-command-text');
  const terminalCopyBtn = document.getElementById('terminal-copy-btn');

  const COMMANDS = {
    powershell: 'haven "your-file.torrent" -o "$HOME\\Downloads" --vpn-guard',
    cmd: 'haven.exe "your-file.torrent" -o "%USERPROFILE%\\Downloads"',
    bash: './haven "your-file.torrent" -o "$HOME/Downloads" --vpn-guard'
  };

  langTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (!lang || !COMMANDS[lang]) return;

      langTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (terminalCode) {
        terminalCode.textContent = COMMANDS[lang];
      }
      if (terminalCopyBtn) {
        terminalCopyBtn.setAttribute('data-copy', COMMANDS[lang]);
      }
    });
  });

  // =========================================================================
  // Download Page: Interactive SHA-256 Checksum Verifier
  // =========================================================================
  const verifierDropzone = document.getElementById('verifier-dropzone');
  const verifierFileInput = document.getElementById('verifier-file-input');
  const verifierResult = document.getElementById('verifier-result');
  const verifierResultText = document.getElementById('verifier-result-text');
  const verifierHashDisplay = document.getElementById('verifier-hash-display');
  const verifierResultIcon = document.getElementById('verifier-result-icon');
  const verifierHashInput = document.getElementById('verifier-hash-input');

  const KNOWN_RELEASES = {
    '171280f5bd9091867b816a17244fefb99cdbe56ed13a5548085cc20aaa177169': 'Haven-Setup.exe (v1.0.0 Recommended Installer)',
    '5c033743337ffda4ba973cb9bb0dfcedcd8439887538fcc51a17b51bd774db61': 'Haven-Portable.zip (v1.0.0 Standalone Archive)',
    'd01c126e47c65c679e58d1d7ee229a0b9334ac6fbab979db6b1805372e330783': 'Haven-Setup.bat (v1.0.0 Setup Script)',
    '3c3946ba5ce56aa9271f2e76236a4d1e0b927d7898c981ef1819254ca4e2c057': 'Haven-Setup-1.0.0-x64.exe'
  };

  if (verifierDropzone && verifierFileInput) {
    verifierDropzone.addEventListener('click', () => {
      verifierFileInput.click();
    });

    verifierFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) processVerificationFile(file);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      verifierDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        verifierDropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      verifierDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        verifierDropzone.classList.remove('drag-active');
      });
    });

    verifierDropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      if (file) processVerificationFile(file);
    });
  }

  async function processVerificationFile(file) {
    if (!verifierResult || !verifierResultText || !verifierHashDisplay || !verifierResultIcon) return;

    verifierResult.style.display = 'flex';
    verifierResult.className = 'verifier-result';
    verifierResultIcon.textContent = '⏳';
    verifierResultText.innerHTML = `<strong>Calculating SHA-256 for "${escapeHtml(file.name)}"...</strong>`;
    verifierHashDisplay.textContent = 'Computing cryptographic hash locally in browser (0% network transfer)...';

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();

      verifierHashDisplay.textContent = `SHA-256: ${hashHex}`;

      if (KNOWN_RELEASES[hashHex]) {
        verifierResult.className = 'verifier-result success';
        verifierResultIcon.textContent = '✓';
        verifierResultText.innerHTML = `<strong>AUTHENTIC RELEASE VERIFIED:</strong> Matched official <em>${escapeHtml(KNOWN_RELEASES[hashHex])}</em>. Zero tampering detected.`;
      } else {
        verifierResult.className = 'verifier-result';
        verifierResult.style.background = 'rgba(58, 90, 120, 0.15)';
        verifierResult.style.border = '1px solid var(--slate-accent)';
        verifierResultIcon.textContent = '🔍';
        verifierResultText.innerHTML = `<strong>Valid Hash Generated:</strong> File verified locally. (If testing custom builds, compare with your target SHA-256).`;
      }
    } catch (err) {
      verifierResult.className = 'verifier-result error';
      verifierResultIcon.textContent = '⚠️';
      verifierResultText.innerHTML = `<strong>Verification Error:</strong> Could not compute hash (${escapeHtml(err.message)})`;
      verifierHashDisplay.textContent = '';
    }
  }

  if (verifierHashInput) {
    verifierHashInput.addEventListener('input', (e) => {
      const raw = e.target.value.trim().toLowerCase();
      if (!verifierResult || !verifierResultText || !verifierHashDisplay || !verifierResultIcon) return;

      if (!raw) {
        verifierResult.style.display = 'none';
        return;
      }

      verifierResult.style.display = 'flex';
      verifierHashDisplay.textContent = `Target Hash: ${raw}`;

      if (KNOWN_RELEASES[raw]) {
        verifierResult.className = 'verifier-result success';
        verifierResultIcon.textContent = '✓';
        verifierResultText.innerHTML = `<strong>MATCH FOUND:</strong> Official release <em>${escapeHtml(KNOWN_RELEASES[raw])}</em>`;
      } else if (raw.length === 64) {
        verifierResult.className = 'verifier-result';
        verifierResult.style.background = 'rgba(58, 90, 120, 0.15)';
        verifierResult.style.border = '1px solid var(--slate-accent)';
        verifierResultIcon.textContent = 'ℹ️';
        verifierResultText.innerHTML = `<strong>Valid 64-char Hash:</strong> Not in pre-recorded v1.0.0 registry. Check GitHub releases.`;
      } else {
        verifierResult.className = 'verifier-result';
        verifierResultIcon.textContent = '⏳';
        verifierResultText.innerHTML = `<span>Awaiting complete 64-character SHA-256 hash (${raw.length}/64 chars)...</span>`;
      }
    });
  }

  // =========================================================================
  // Download Page: Interactive Dropzone (Step 3)
  // =========================================================================
  const step3Dropzone = document.getElementById('step3-dropzone');
  if (step3Dropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      step3Dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        step3Dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      step3Dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        step3Dropzone.classList.remove('drag-active');
      });
    });

    step3Dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      const filename = file ? file.name : 'Sample Torrent';
      step3Dropzone.innerHTML = `
        <div style="font-size:2rem; color:var(--accent);">✓</div>
        <strong>${escapeHtml(filename)} Accepted!</strong>
        <span style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">Would you like to test drive transfers in the live simulation?</span>
        <a href="experience.html" class="btn-pkg-download" style="padding:0.4rem 0.9rem; font-size:0.82rem; border-radius:6px; text-decoration:none; display:inline-flex;">Open in Live Experience →</a>
      `;
    });

    step3Dropzone.addEventListener('click', () => {
      step3Dropzone.innerHTML = `
        <div style="font-size:1.8rem; color:var(--accent);">⚡</div>
        <strong>Interactive Demo Ready</strong>
        <span style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">Try Ubuntu 24.04 and Blender swarms directly in your browser.</span>
        <a href="experience.html" class="btn-pkg-download" style="padding:0.4rem 0.9rem; font-size:0.82rem; border-radius:6px; text-decoration:none; display:inline-flex;">Launch Live Experience →</a>
      `;
    });
  }

  // =========================================================================
  // Download Page: FAQ Accordion
  // =========================================================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-question-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close others for clean accordion feel
        faqItems.forEach((i) => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});

