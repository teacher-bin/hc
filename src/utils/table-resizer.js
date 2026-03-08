// Table Column Resizer with Callback Support
window.initTableResizing = function(onResizeEndCallback) {
  const tables = document.querySelectorAll('.status-table');

  tables.forEach(table => {
    // Ensure table layout is fixed
    table.style.tableLayout = 'fixed';
    
    // Get headers
    const headers = Array.from(table.querySelectorAll('th'));
    
    headers.forEach((header, index) => {
      // Skip if handle already exists
      if (header.querySelector('.resize-handle')) return;

      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.style.cssText = `
          position: absolute;
          top: 0;
          right: -5px;
          bottom: 0px;
          width: 10px;
          cursor: col-resize;
          z-index: 10;
          touch-action: none;
      `;
      // Ensure header is relative
      if(getComputedStyle(header).position === 'static') {
          header.style.position = 'relative';
      }
      header.appendChild(handle);

      // Event Listeners
      handle.addEventListener('mousedown', (e) => startResize(e, header, index, table, onResizeEndCallback));
    });
  });
}

function startResize(e, header, index, table, callback) {
  e.preventDefault();
  e.stopPropagation();

  if (!table.dataset.resized) {
      const headers = Array.from(table.querySelectorAll('th'));
      const currentWidths = headers.map(h => h.offsetWidth);
      headers.forEach((h, i) => {
          h.style.width = currentWidths[i] + 'px';
      });
      table.style.width = 'max-content';
      table.style.minWidth = '0';
      table.dataset.resized = 'true';
  }

  const startX = e.pageX;
  const startWidth = header.offsetWidth;
  let currentWidth = startWidth;
  let rafId = null;

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  header.classList.add('resizing');

  function onMouseMove(moveEvent) {
    if (rafId) cancelAnimationFrame(rafId);
    
    rafId = requestAnimationFrame(() => {
      const diff = moveEvent.pageX - startX;
      currentWidth = Math.max(30, startWidth + diff); // Min width 30px
      header.style.width = `${currentWidth}px`;
    });
  }

  function onMouseUp() {
    cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    header.classList.remove('resizing');

    // Trigger Callback with final width
    if (callback) {
      callback(table, index, currentWidth);
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
