// overlay.js
// 메인 화면 플로팅 버튼 및 오버레이 링크 기능 관리

let overlayButtonsList = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Firebase에서 설정 불러오기
    window.addEventListener('firebase-ready', () => {
        setTimeout(loadOverlayButtonsConfig, 600);
    });

        // 만약 이미 firebase가 준비된 상태라면 (script.js보다 늦게 로드됨)
    if (window.firebaseReady && window.db) {
        loadOverlayButtonsConfig();
    }

    // Modal Events
    const form = document.getElementById('overlayButtonForm');
    if(form) {
        form.addEventListener('submit', handleOverlayButtonSubmit);
    }
    
    // Category Tab Logic for Overlay Icons
    const overlayCategoryTabs = document.querySelectorAll('#overlayButtonModal .icon-tab[data-category]');
    const overlayCategoryContents = document.querySelectorAll('#overlayButtonModal .overlay-category-content');

    overlayCategoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            overlayCategoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.dataset.category;
            overlayCategoryContents.forEach(c => {
                if(c.id === `overlay-cat-${category}`) {
                    c.style.display = 'block';
                } else {
                    c.style.display = 'none';
                }
            });
        });
    });

    const overlayIconFinalInput = document.getElementById('overlay-btn-icon-final');

    // Preset Icon Selection
    const overlayIconOptions = document.querySelectorAll('#overlayButtonModal .icon-option');
    overlayIconOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            overlayIconOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            overlayIconFinalInput.value = opt.dataset.icon;
        });
    });
    
    // ESC키로 오버레이 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeIframeOverlay();
        }
    });

    // 배경 클릭 시 오버레이 닫기
    const overlay = document.getElementById('main-iframe-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeIframeOverlay();
            }
        });
    }
});

async function loadOverlayButtonsConfig() {
    if (!window.db) return;
    try {
        const docSnap = await window.firestoreUtils.getDoc(window.firestoreUtils.doc(window.db, "settings", "overlayButtons"));
        if (docSnap.exists() && docSnap.data().list) {
            overlayButtonsList = docSnap.data().list;
        } else {
            // 기본값 설정 (사용자 요청에 따른 구글시트 링크)
            overlayButtonsList = [
                {
                    id: 'btn-default-1',
                    title: '구글 시트 열기',
                    url: 'https://docs.google.com/spreadsheets/d/1UdS8FsjoaZaxUmaaR0vHDEwXGPbD4aWE4YQlDJY_RGg/edit?usp=sharing',
                    icon: 'fas fa-table',
                    color: 'green'
                }
            ];
            // Admin 계정이 접근했을 때 시드 데이터를 저장할 수도 있으나, 여기서는 읽기만 하므로 생략
        }
        renderFloatingButtons();
        if(document.getElementById('admin-overlay-buttons-list')) {
            renderAdminOverlayButtons(); // Admin View가 있다면 렌더링
        }
    } catch (e) {
        console.error("Failed to load overlay buttons config", e);
    }
}

async function saveOverlayButtonsConfig() {
    if (!window.db) return;
    try {
        await window.firestoreUtils.setDoc(window.firestoreUtils.doc(window.db, "settings", "overlayButtons"), { list: overlayButtonsList });
        renderFloatingButtons();
        renderAdminOverlayButtons();
    } catch (e) {
        console.error(e);
        alert("버튼 설정 저장에 실패했습니다.");
    }
}

// ---------------- Admin UI ----------------
window.openOverlayButtonModal = function(id = null) {
    const modal = document.getElementById('overlayButtonModal');
    if (!modal) return;
    
    const idInput = document.getElementById('overlay-btn-id');
    const titleInput = document.getElementById('overlay-btn-title');
    const urlInput = document.getElementById('overlay-btn-url');
    const colorInput = document.getElementById('overlay-btn-color');

    if (id) {
        const btn = overlayButtonsList.find(b => b.id === id);
        if (btn) {
            idInput.value = btn.id;
            titleInput.value = btn.title;
            urlInput.value = btn.url;
            document.getElementById('overlay-btn-icon-final').value = btn.icon || 'fas fa-table';
            colorInput.value = btn.color || 'blue';
            document.getElementById('overlayButtonModalTitle').textContent = "오버레이 버튼 수정";
        }
    } else {
        idInput.value = '';
        titleInput.value = '';
        urlInput.value = '';
        colorInput.value = 'green';
        document.getElementById('overlayButtonModalTitle').textContent = "오버레이 버튼 추가";
        document.getElementById('overlay-btn-icon-final').value = 'fas fa-table';
    }

    // Modal 열릴 때 아이콘 상태 초기화
    let finalIconVal = document.getElementById('overlay-btn-icon-final').value;
    const isUrl = finalIconVal.startsWith('http');
    
    // 만약 기존 데이터가 URL 형식이라면, 강제로 기본 아이콘으로 초기화
    if (isUrl) {
        finalIconVal = 'fas fa-table';
        document.getElementById('overlay-btn-icon-final').value = finalIconVal;
    }

    document.querySelectorAll('#overlayButtonModal .icon-option').forEach(opt => opt.classList.remove('selected'));
    const selOpt = document.querySelector(`#overlayButtonModal .icon-option[data-icon="${finalIconVal}"]`);
    if (selOpt) {
        selOpt.classList.add('selected');

        // 선택된 아이콘의 부모 카테고리 탭 자동 활성화
        const parentCategory = selOpt.closest('.overlay-category-content');
        if (parentCategory) {
            const catId = parentCategory.id.replace('overlay-cat-', '');
            const tabToActivate = document.querySelector(`#overlayButtonModal .icon-tab[data-category="${catId}"]`);
            if (tabToActivate) {
                tabToActivate.click();
            }
        }
    } else {
        // 기본 탭 활성화 (일반/문서)
        const defaultTab = document.querySelector(`#overlayButtonModal .icon-tab[data-category="general"]`);
        if(defaultTab) defaultTab.click();
    }

    modal.classList.add('active');
};

window.closeOverlayButtonModal = function() {
    const modal = document.getElementById('overlayButtonModal');
    if(modal) modal.classList.remove('active');
};

async function handleOverlayButtonSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('overlay-btn-id').value;
    const title = document.getElementById('overlay-btn-title').value.trim();
    const url = document.getElementById('overlay-btn-url').value.trim();
    const finalIcon = document.getElementById('overlay-btn-icon-final').value.trim();
    const color = document.getElementById('overlay-btn-color').value;

    if (!title || !url) return alert("필수 항목을 입력하세요.");

    if (id) {
        // Update
        const idx = overlayButtonsList.findIndex(b => b.id === id);
        if(idx >= 0) {
            overlayButtonsList[idx] = { id, title, url, icon: finalIcon, color };
        }
    } else {
        // Add
        overlayButtonsList.push({
            id: 'btn-' + Date.now(),
            title, url, icon: finalIcon, color
        });
    }

    await saveOverlayButtonsConfig();
    window.closeOverlayButtonModal();
}

window.deleteOverlayButton = async function(id) {
    if(!confirm("이 버튼을 삭제하시겠습니까?")) return;
    overlayButtonsList = overlayButtonsList.filter(b => b.id !== id);
    await saveOverlayButtonsConfig();
};

let overlayButtonSortable = null;

function renderAdminOverlayButtons() {
    const tbody = document.getElementById('admin-overlay-buttons-list');
    if(!tbody) return;
    
    if (overlayButtonsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">등록된 버튼이 없습니다.</td></tr>`;
        return;
    }

    let html = '';
    overlayButtonsList.forEach((btn) => {
        let iconHtml = btn.icon.startsWith('http') 
            ? `<img src="${btn.icon}" style="width:24px; height:24px; object-fit:cover; border-radius:4px; margin-right:8px;">`
            : `<i class="${btn.icon}" style="font-size:1.2rem; margin-right:8px; width:24px; text-align:center;"></i>`;
            
        html += `
            <tr data-id="${btn.id}">
                <td style="text-align: left; padding-left: 12px;">
                    <div style="display:inline-flex; align-items:center;">
                        <span class="drag-handle" style="cursor:grab; margin-right:12px; color:#94a3b8;"><i class="fas fa-grip-vertical"></i></span>
                        <strong style="${btn.isActive === false ? 'color:#94a3b8; text-decoration:line-through;' : ''}">${btn.title}</strong>
                    </div>
                </td>
                <td style="text-align: center;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; ${btn.isActive === false ? 'opacity:0.5;' : ''}">${iconHtml}</div>
                </td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align: center;">
                    <a href="${btn.url}" target="_blank" class="overlay-admin-link" style="${btn.isActive === false ? 'color:#94a3b8; pointer-events:none;' : ''}">${btn.url}</a>
                </td>
                <td style="text-align: center;">
                    <label class="switch" style="transform: scale(0.85); margin: 0; display: inline-block; vertical-align: middle;">
                        <input type="checkbox" onchange="window.toggleOverlayButtonStatus('${btn.id}', this.checked)" ${btn.isActive !== false ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; gap: 8px; justify-content: center;">
                        <button class="btn-edit-sm btn-icon" onclick="window.openOverlayButtonModal('${btn.id}')" title="수정" style="background:#f1f5f9; color:#3b82f6; border-radius:4px; padding:6px; transition:all 0.2s;"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete-sm btn-icon" onclick="window.deleteOverlayButton('${btn.id}')" title="삭제" style="background:#f1f5f9; color:#ef4444; border-radius:4px; padding:6px; transition:all 0.2s;"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    if (overlayButtonSortable) overlayButtonSortable.destroy();
    overlayButtonSortable = new Sortable(tbody, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async function () {
            const newOrderIds = Array.from(tbody.querySelectorAll('tr')).map(tr => tr.dataset.id);
            const newList = [];
            newOrderIds.forEach(id => {
                const item = overlayButtonsList.find(b => b.id === id);
                if (item) newList.push(item);
            });
            overlayButtonsList = newList;
            await saveOverlayButtonsConfig();
        }
    });
}

window.toggleOverlayButtonStatus = async function(id, isActive) {
    const btn = overlayButtonsList.find(b => b.id === id);
    if (btn) {
        btn.isActive = isActive;
        await saveOverlayButtonsConfig();
    }
};

// ---------------- USER UI ----------------

let activeTargetBtnId = null;

function renderFloatingButtons() {
    const container = document.getElementById('overlay-buttons-container');
    if (!container) return;

    // 만약 관리자가 메뉴 표시 설정을 통해 숨겼는지 체크 가능하나 일단 전체 표출
    container.innerHTML = '';

    overlayButtonsList.forEach(btnInfo => {
        // 토글 버튼에서 OFF로 설정된 경우 렌더링 패스
        if (btnInfo.isActive === false) return;

        const btn = document.createElement('button');
        btn.className = `floating-overlay-btn color-${btnInfo.color || 'green'}`;
        btn.dataset.id = btnInfo.id;
        
        let i;
        if ((btnInfo.icon || '').startsWith('http')) {
            i = document.createElement('img');
            i.src = btnInfo.icon;
            i.style.width = '20px';
            i.style.height = '20px';
            i.style.objectFit = 'cover';
            i.style.borderRadius = '4px';
        } else {
            i = document.createElement('i');
            i.className = btnInfo.icon || 'fas fa-link';
        }
        
        const span = document.createElement('span');
        span.textContent = btnInfo.title;
        
        btn.appendChild(i);
        btn.appendChild(span);
        
        btn.addEventListener('click', () => {
            toggleIframeOverlay(btnInfo.id, btnInfo.url, btn);
        });

        container.appendChild(btn);
    });
}

function toggleIframeOverlay(id, url, btnEl) {
    const overlay = document.getElementById('main-iframe-overlay');
    const frame = document.getElementById('main-overlay-frame');
    
    // 이미 열려 있는 해당 버튼 클릭 시 닫기
    if (activeTargetBtnId === id) {
        closeIframeOverlay();
        return;
    }

    // 다른 버튼들의 디자인 초기화 및 비활성화 처리
    document.querySelectorAll('.floating-overlay-btn').forEach(b => {
        b.classList.remove('active-mode');
        // 오버레이가 열릴 때는 모든 버튼을 일단 인액티브로 만듦
        b.classList.add('inactive-mode');
    });

    // 현재 버튼 액티브 디자인 적용 및 비활성화 해제
    btnEl.classList.remove('inactive-mode');
    btnEl.classList.add('active-mode');

    // 사이드바 자동 숨김
    const sidebar = document.getElementById('overlay-sidebar');
    if (sidebar) sidebar.classList.add('collapsed');

    // 구글 문서/시트 링크의 경우, iframe 공식 임베드 파라미터(embedded=true) 적용
    // rm=minimal 등의 비공식 파라미터는 구글 보안 정책과 충돌하여 로그인 요구 가능성이 있음
    let finalUrl = url;
    if (url.includes('docs.google.com')) {
        try {
            const urlObj = new URL(url);
            // rm=minimal 제거 (비공식 파라미터로 로그인 강제 유발 가능)
            urlObj.searchParams.delete('rm');
            // 공식 임베드 파라미터 적용 - iframe 안에서의 로그인 요구를 최소화함
            urlObj.searchParams.set('embedded', 'true');
            finalUrl = urlObj.toString();
        } catch(e) {
            finalUrl = url;
        }
    }

    // iframe 초기화 후 로드 (이전 세션 캐시 방지)
    frame.src = 'about:blank';
    setTimeout(() => {
        frame.src = finalUrl;
    }, 50);

    overlay.classList.add('active');
    activeTargetBtnId = id;
}


window.closeIframeOverlay = function() {
    const overlay = document.getElementById('main-iframe-overlay');
    if (overlay) overlay.classList.remove('active');
    document.querySelectorAll('.floating-overlay-btn').forEach(b => {
        b.classList.remove('active-mode', 'inactive-mode');
    });
    activeTargetBtnId = null;

    // 사이드바 자동 숨김 해제
    const sidebar = document.getElementById('overlay-sidebar');
    if (sidebar) sidebar.classList.remove('collapsed');
    
    // 안의 프레임 비우기 (메모리 해제 및 재생 방지)
    const frame = document.getElementById('main-overlay-frame');
    if(frame) {
        setTimeout(() => { frame.src = ''; }, 400); // 닫히는 애니메이션 후
    }
};

window.toggleOverlaySidebar = function() {
    const sidebar = document.getElementById('overlay-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
};
