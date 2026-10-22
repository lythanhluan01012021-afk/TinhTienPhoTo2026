/**
 * Gorilla Glassmorphism & Smart Department Hover Engine
 * Hiệu ứng kính Gorilla Glass trong suốt, thông minh, êm dịu, không chớp giật
 */

// Bảng màu kính đá quý đặc trưng chuẩn hóa theo từng Tổ Chuyên Môn
export const DEPARTMENT_GLASS_THEMES = {
  'Tổ Toán': {
    bg: 'linear-gradient(135deg, rgba(27, 94, 190, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(27, 94, 190, 0.45)',
    glow: 'rgba(27, 94, 190, 0.22)',
    accent: '#1b5ebe'
  },
  'Tổ Tin Học': {
    bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(6, 182, 212, 0.45)',
    glow: 'rgba(6, 182, 212, 0.22)',
    accent: '#0891b2'
  },
  'Tổ Ngoại Ngữ': {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(16, 185, 129, 0.45)',
    glow: 'rgba(16, 185, 129, 0.22)',
    accent: '#059669'
  },
  'Tổ Ngữ Văn': {
    bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(244, 63, 94, 0.45)',
    glow: 'rgba(244, 63, 94, 0.22)',
    accent: '#e11d48'
  },
  'Tổ Lý - CNCN': {
    bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(99, 102, 241, 0.45)',
    glow: 'rgba(99, 102, 241, 0.22)',
    accent: '#4f46e5'
  },
  'Tổ Sinh - CNNN': {
    bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(20, 184, 166, 0.45)',
    glow: 'rgba(20, 184, 166, 0.22)',
    accent: '#0d9488'
  },
  'Tổ Hóa Học': {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(245, 158, 11, 0.45)',
    glow: 'rgba(245, 158, 11, 0.22)',
    accent: '#d97706'
  },
  'Tổ Lịch Sử': {
    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(217, 119, 6, 0.45)',
    glow: 'rgba(217, 119, 6, 0.22)',
    accent: '#b45309'
  },
  'Tổ Địa Lí': {
    bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(14, 165, 233, 0.45)',
    glow: 'rgba(14, 165, 233, 0.22)',
    accent: '#0284c7'
  },
  'Tổ GDKT & Pháp Luật': {
    bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(139, 92, 246, 0.45)',
    glow: 'rgba(139, 92, 246, 0.22)',
    accent: '#7c3aed'
  },
  'Tổ GDQP - Thể Chất': {
    bg: 'linear-gradient(135deg, rgba(225, 29, 72, 0.14), rgba(255, 255, 255, 0.65))',
    border: 'rgba(225, 29, 72, 0.45)',
    glow: 'rgba(225, 29, 72, 0.22)',
    accent: '#be123c'
  }
};

// Bảng màu ngẫu nhiên cho các nút bấm & thẻ hệ thống chung
export const GORILLA_JEWEL_PALETTES = Object.values(DEPARTMENT_GLASS_THEMES);

let isInitialized = false;

export const initGorillaGlassHover = () => {
  if (isInitialized || typeof document === 'undefined') return;
  isInitialized = true;

  const selector = `
    .neu-card, 
    .neu-card-sm, 
    .neu-btn, 
    .neu-chip, 
    .excel-table tbody tr, 
    .grand-total-card, 
    .teacher-list-card,
    .class-chip,
    .nav-tab,
    .stat-card
  `;

  let activeHoverTarget = null;

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest(selector);
    if (!target) {
      activeHoverTarget = null;
      return;
    }

    // Khắc phục thông minh: Nếu con trỏ chuột vẫn đang di chuyển bên trong cùng một phần tử
    // (từ tên chữ sang icon hoặc subtitle), KHÔNG đổi màu lại để tránh rối mắt và giật màu liên tục!
    if (target === activeHoverTarget) return;
    activeHoverTarget = target;

    let palette;
    const dept = target.getAttribute('data-dept');
    
    // Nếu là Giáo viên: Dùng màu kính đồng nhất, thanh lịch theo Tổ chuyên môn
    if (dept && DEPARTMENT_GLASS_THEMES[dept]) {
      palette = DEPARTMENT_GLASS_THEMES[dept];
    } else {
      // Đối với các nút, thẻ chung: Chọn 1 màu kính hài hòa khi mới rê chuột vào
      palette = GORILLA_JEWEL_PALETTES[Math.floor(Math.random() * GORILLA_JEWEL_PALETTES.length)];
    }
    
    target.style.setProperty('--gorilla-bg', palette.bg);
    target.style.setProperty('--gorilla-border', palette.border);
    target.style.setProperty('--gorilla-glow', palette.glow);
    target.style.setProperty('--gorilla-accent', palette.accent);
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    const fromTarget = e.target.closest(selector);
    const toTarget = e.relatedTarget ? e.relatedTarget.closest(selector) : null;
    if (fromTarget && fromTarget !== toTarget) {
      if (activeHoverTarget === fromTarget) {
        activeHoverTarget = null;
      }
    }
  }, { passive: true });
};
