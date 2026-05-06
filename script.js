document.addEventListener("DOMContentLoaded", () => {
  const linksGrid = document.querySelector("#links-grid");
  const navItems = document.querySelectorAll(".nav-item");
  const digitalClock = document.getElementById("digital-clock");
  const statusSection = document.getElementById("status-section");
  const shortcutSection = document.getElementById("shortcut-section");
  const datayardSection = document.getElementById("datayard-section");
  const curriculumSection = document.getElementById("curriculum-section");
  const helppageSection = document.getElementById("helppage-section");
  const accountSection = document.getElementById("account-section");
  const busSection = document.getElementById("bus-section");
  const calendarSection = document.getElementById("calendar-section");
  const adminSection = document.getElementById("admin-section");
  const statusTabs = document.querySelectorAll(".status-tab");
  const statusPanels = document.querySelectorAll(".status-panel");
  const siteTitle = document.getElementById("site-title");

  // 사이트 제목 클릭 시 '홈' 탭으로 이동
  if (siteTitle) {
    siteTitle.addEventListener("click", () => {
      const homeBtn = document.querySelector('.nav-item[data-category="all"]');
      if (homeBtn) homeBtn.click();
    });
  }

  // Sidebar Visibility Control for Wide Tabs
  const leftSidebar = document.getElementById('left-sidebar');
  if (leftSidebar && navItems.length > 0) {
      navItems.forEach(btn => {
          btn.addEventListener('click', () => {
              const cat = btn.dataset.category;
              if (cat === 'curriculum' || cat === 'training') {
                  leftSidebar.classList.add('hidden');
              } else {
                  leftSidebar.classList.remove('hidden');
              }
          });
      });
  }

  let currentCategory = "all";
  let calendar = null; // FullCalendar 인스턴스

  // Helper: Check Admin Role
  const isAdmin = () => window.currentUserRole === 'admin' || window.currentUserRole === 'sub-admin';

  // 시간 업데이트 함수
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    if (digitalClock) {
      // 구조가 없으면 초기화
      if (!digitalClock.querySelector('.clock-time')) {
        digitalClock.innerHTML = `
          <span class="clock-ampm"></span>
          <div class="clock-time">
              <span class="hh"></span>
              <span class="clock-colon">:</span>
              <span class="mm"></span>
              <span class="clock-seconds"></span>
          </div>
        `;
      }
      
      // 텍스트만 업데이트 (애니메이션 상태 유지)
      digitalClock.querySelector('.clock-ampm').textContent = ampm;
      digitalClock.querySelector('.hh').textContent = String(hours).padStart(2, "0");
      digitalClock.querySelector('.mm').textContent = minutes;
      digitalClock.querySelector('.clock-seconds').textContent = seconds;
    }
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Initialize Shortcuts Logic on Load (Moved from Tab click)
  initShortcuts();

  // Helper: Format Date (YYYY-MM-DD)
  function formatDate(date, offsetDays = 0) {
    let d = new Date(date);
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Make formatDate global if needed or just use consistent logic
  window.formatDate = formatDate;

  // KoreanHolidayService moved to src/utils/holidays.js

  // 카드 렌더링 함수
  function renderCards() {
    linksGrid.innerHTML = "";

    const filteredData = linkData.filter((link) => {
      const matchesCategory =
        currentCategory === "all" || link.category === currentCategory;
      return matchesCategory;
    });

    filteredData.forEach((link) => {
      const card = document.createElement("a");
      card.href = link.url;
      card.target = "_blank";
      card.className = "link-card";

      card.innerHTML = `
                <div class="card-icon">
                    <i class="fas ${link.icon}"></i>
                </div>
                <div class="card-content">
                    <h3>${link.title}</h3>
                    <p>${link.description}</p>
                </div>
            `;

      linksGrid.appendChild(card);
    });
  }

  // 바로가기 상태 관리
  let isEditMode = false;
  let localShortcutData = []; 
  let collapsedGroups = new Set(); // Track collapsed group IDs
  let shortcutEditSource = 'personal'; // 'personal' or 'default' (admin only)

  // 자료마당 상태 관리
  let datayardEditMode = false;
  let localDatayardData = [];
  let datayardFileToUpload = null;
  let datayardActiveTab = 'upload';
  let datayardDriveFolderId = '';
  let datayardRenderSnapshot = null;

  // 초기화 및 Firebase 데이터 로드
  async function initShortcuts() {
    if (!window.db) {
       // Firebase 로드 대기
       window.addEventListener('firebase-ready', () => loadShortcutsFromFirebase());
       // fallback: 로컬 데이터 사용 (Firebase 로드 전까지)
       localShortcutData = JSON.parse(JSON.stringify(shortcutData));
       renderShortcuts();
    } else {
       await loadShortcutsFromFirebase();
    }
  }

  async function loadShortcutsFromFirebase() {
    const { db, firestoreUtils, auth } = window;
    if (!db || !firestoreUtils) return;

    try {
      const user = auth?.currentUser;
      let loadedData = [];

      // 1. 개인화된 바로가기 시도 (로그인된 경우)
      if (user && shortcutEditSource === 'personal') {
          const personalRef = firestoreUtils.collection(db, "users", user.uid, "myShortcuts");
          const personalSnap = await firestoreUtils.getDocs(firestoreUtils.query(personalRef));
          
          if (!personalSnap.empty) {
              personalSnap.forEach((doc) => {
                  loadedData.push({ id: doc.id, ...doc.data() });
              });
              console.log("Personal shortcuts loaded for:", user.email);
          }
      }

      // 2. 관리자 모드에서 'default' 선택했거나, 개인 데이터가 없는 경우 -> 글로벌 로드
      if (loadedData.length === 0) {
          const globalRef = firestoreUtils.collection(db, "shortcutGroups");
          const globalSnap = await firestoreUtils.getDocs(firestoreUtils.query(globalRef));
          
          globalSnap.forEach((doc) => {
              loadedData.push({ id: doc.id, ...doc.data() });
          });
          console.log("Global default shortcuts loaded (Source: " + shortcutEditSource + ")");
      }

      if (loadedData.length > 0) {
        loadedData.sort((a, b) => (a.order || 0) - (b.order || 0));
        localShortcutData = loadedData;
        
        if (window.innerWidth <= 768) {
            localShortcutData.forEach(g => collapsedGroups.add(g.id));
        }
      } else {
        // 완전 초기 상태 (데이터 무) -> window.shortcutData에서 로드 (data.js)
        localShortcutData = JSON.parse(JSON.stringify(window.shortcutData || []));
        localShortcutData.forEach((group, index) => {
            if(!group.id) group.id = 'group-' + Date.now() + '-' + index;
            group.order = index;
        });
      }
      renderShortcuts();
    } catch (err) {
      console.error("Shortcuts load error:", err);
      localShortcutData = JSON.parse(JSON.stringify(window.shortcutData || []));
      renderShortcuts();
    }
  }
  window.loadShortcutsFromFirebase = loadShortcutsFromFirebase;

  async function saveAllShortcutsToFirebase() {
      if (!window.db) return;
      const { db, firestoreUtils, auth } = window;
      const user = auth?.currentUser;

      let targetCollection = "";
      if (isAdmin() && shortcutEditSource === 'default') {
          targetCollection = "shortcutGroups";
      } else if (user) {
          targetCollection = `users/${user.uid}/myShortcuts`;
      } else {
          alert("로그인이 필요합니다.");
          return;
      }
      
      try {
          // 컬렉션 내의 모든 문서를 업데이트/생성
          for (const group of localShortcutData) {
              await firestoreUtils.setDoc(firestoreUtils.doc(db, targetCollection, group.id), group);
          }
          console.log("Saved to:", targetCollection);
      } catch (e) {
          console.error("Save error:", e);
          alert("저장 중 오류가 발생했습니다.");
      }
  }
  
  async function deleteGroupFromFirebase(groupId) {
      if (!window.db) return;
      const { db, firestoreUtils, auth } = window;
      const user = auth?.currentUser;

      let targetCollection = "";
      if (isAdmin() && shortcutEditSource === 'default') {
          targetCollection = "shortcutGroups";
      } else if (user) {
          targetCollection = `users/${user.uid}/myShortcuts`;
      } else {
          return;
      }
      
      await firestoreUtils.deleteDoc(firestoreUtils.doc(db, targetCollection, groupId));
  }

  // 바로가기 렌더링 함수 (Sortable 적용)
  function renderShortcuts() {
    const isAdminRole = isAdmin();
    const isLoggedIn = !!window.auth?.currentUser;
    
    // Admin Toggle HTML
    let sourceToggleHtml = "";
    if (isEditMode && isAdminRole) {
        sourceToggleHtml = `
            <div class="shortcut-source-toggle">
                <div class="source-btn ${shortcutEditSource==='personal'?'active':''}" onclick="window.switchShortcutSource('personal')">내 바로가기</div>
                <div class="source-btn ${shortcutEditSource==='default'?'active':''}" onclick="window.switchShortcutSource('default')">기본값(공용)</div>
            </div>
        `;
    }

    shortcutSection.innerHTML = `
      <div class="shortcut-controls">
        ${isEditMode 
          ? `
             ${sourceToggleHtml}
             <button id="add-group-btn" class="btn-secondary"><i class="fas fa-folder-plus"></i> 그룹 추가</button>
             <button id="save-order-btn" class="btn-success"><i class="fas fa-save"></i> 저장 완료</button>
             <button id="cancel-edit-btn" class="btn-cancel"><i class="fas fa-times"></i> 취소</button>`
          : (isLoggedIn ? `<button id="edit-mode-btn" class="btn-primary mobile-hide"><i class="fas fa-edit"></i> 바로가기 편집</button>` : '')
        }
      </div>
      <div id="shortcut-container" class="shortcut-grid ${isEditMode ? 'edit-mode' : ''}"></div>
    `;
    
    const container = shortcutSection.querySelector("#shortcut-container");

    // 이벤트 리스너 다시 연결
    if(isEditMode) {
        document.getElementById('save-order-btn').addEventListener('click', async () => {
            isEditMode = false;
            await saveAllShortcutsToFirebase();
            renderShortcuts();
        });
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            if(confirm('변경 사항을 저장하지 않고 편집을 종료하시겠습니까?')) {
                isEditMode = false;
                initShortcuts(); // 데이터 원복 (리로드)
            }
        });
        document.getElementById('add-group-btn').addEventListener('click', () => {
             openGroupModal();
        });
    } else {
        const editBtn = document.getElementById('edit-mode-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                isEditMode = true;
                renderShortcuts();
            });
        }
    }

    localShortcutData.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = "shortcut-group";
      groupEl.dataset.id = group.id;

      let itemsHtml = "";
      if (group.items && group.items.length > 0) {
        itemsHtml = group.items.map(item => {
          // Check for custom icon
          let iconHtml = `<i class="fas ${item.icon}"></i>`;
          if (item.iconType === 'custom' || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('data:')))) {
              iconHtml = `<img src="${item.icon}" alt="icon" class="custom-icon-img">`;
          }

          return `
          <div class="shortcut-item" data-id="${item.id}" data-url="${item.url}" data-title="${item.title}" data-icon="${item.icon}" data-icon-type="${item.iconType || 'preset'}">
            ${isEditMode ? `
              <button class="delete-btn" onclick="deleteShortcut('${group.id}', '${item.id}')"><i class="fas fa-times"></i></button>
              <button class="edit-btn" onclick="editShortcut('${group.id}', '${item.id}')"><i class="fas fa-pencil-alt"></i></button>
            ` : ''}
            <a href="${isEditMode ? 'javascript:void(0)' : item.url}" target="${isEditMode ? '' : '_blank'}" class="shortcut-link-content">
                <div class="shortcut-icon">
                    ${iconHtml}
                </div>
                <span>${item.title}</span>
            </a>
          </div>
        `;
        }).join("");
      }

      const isCollapsed = collapsedGroups.has(group.id) && !isEditMode;

      groupEl.innerHTML = `
        ${isEditMode ? `
            <div class="group-actions">
                <button class="group-action-btn edit" onclick="editGroup('${group.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="group-action-btn delete" onclick="deleteGroup('${group.id}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : ''}
        <h3 class="group-header ${isCollapsed ? 'collapsed' : ''}" onclick="toggleGroupCollapse('${group.id}')">
            ${group.category}
            <i class="fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} toggle-icon"></i>
        </h3>
        <div class="shortcut-items ${isCollapsed ? 'hidden' : ''}" id="group-items-${group.id}">
            ${itemsHtml}
        </div>
        ${isEditMode ? `<button class="add-item-btn" onclick="addShortcut('${group.id}')"><i class="fas fa-plus"></i> 바로가기 추가</button>` : ''}
      `;

      container.appendChild(groupEl);

      // Sortable 적용 (그룹 내 아이템 정렬)
      if (isEditMode) {
          Sortable.create(groupEl.querySelector('.shortcut-items'), {
              group: 'shared-items', // 그룹 간 이동 허용
              animation: 150,
              onEnd: function (evt) {
                  // 이동 후 데이터 업데이트 로직 필요
                  updateLocalDataFromDOM();
              }
          });
      }
    });

    // 그룹 순서 정렬
    if (isEditMode) {
        Sortable.create(container, {
            animation: 150,
            handle: 'h3', // 헤더를 잡고 이동
            onEnd: function (evt) {
                updateLocalDataFromDOM();
            }
        });
    }
  }
  
  // 그룹 접기 토글 함수
  window.toggleGroupCollapse = (groupId) => {
      // Disable collapse on desktop
      if (window.innerWidth > 768) return;

      if (isEditMode) return;
      if (collapsedGroups.has(groupId)) {
          collapsedGroups.delete(groupId);
      } else {
          collapsedGroups.add(groupId);
      }
      renderShortcuts();
  };

  // DOM 상태를 보고 localShortcutData 업데이트
  function updateLocalDataFromDOM() {
      const container = document.getElementById("shortcut-container");
      const newGroups = [];
      
      container.querySelectorAll('.shortcut-group').forEach((groupEl, gIndex) => {
          const groupId = groupEl.dataset.id;
          const category = groupEl.querySelector('h3').innerText;
          const items = [];
          
          groupEl.querySelectorAll('.shortcut-item').forEach((itemEl, iIndex) => {
             items.push({
                 id: itemEl.dataset.id,
                 title: itemEl.dataset.title,
                 url: itemEl.dataset.url,
                 icon: itemEl.dataset.icon
             });
          });
          
          newGroups.push({
              id: groupId,
              category: category,
              items: items,
              order: gIndex
          });
      });
      
      localShortcutData = newGroups;
  }

  // 전역 함수로 노출 (HTML onclick에서 접근 위해)
  window.deleteShortcut = (groupId, itemId) => {
      if(!confirm('정말 삭제하시겠습니까?')) return;
      const group = localShortcutData.find(g => g.id === groupId);
      if(group) {
          group.items = group.items.filter(i => i.id !== itemId);
          renderShortcuts();
      }
  };
  
  window.deleteGroup = async (groupId) => {
      if(!confirm('그룹과 내부 바로가기가 모두 삭제됩니다. 계속하시겠습니까?')) return;
      localShortcutData = localShortcutData.filter(g => g.id !== groupId);
      // Firebase에서도 삭제
      await deleteGroupFromFirebase(groupId); 
      renderShortcuts();
  };

  window.switchShortcutSource = async function(source) {
      if (shortcutEditSource === source) return;
      if (isEditMode && localShortcutData.length > 0) {
          if (!confirm("현재 변경 사항이 저장되지 않았습니다. 데이터를 새로 불러오시겠습니까?")) return;
      }
      shortcutEditSource = source;
      await loadShortcutsFromFirebase();
  };

  window.initShortcuts = initShortcuts; // 외부 노출

  // 모달 관련
  const shortcutModal = document.getElementById('shortcutModal');
  const groupModal = document.getElementById('groupModal');
  const shortcutForm = document.getElementById('shortcutForm');
  const groupForm = document.getElementById('groupForm');
  
  // 상태 변수
  let selectedIcon = 'fa-link';
  let selectedIconType = 'preset'; // preset or custom
  let customIconData = ''; // URL or Base64

  // 탭 전환 (단축키 모달용만 캡처하도록 변경)
  document.querySelectorAll('#shortcutModal .icon-tab').forEach(tab => {
      tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          
          document.querySelectorAll('#shortcutModal .icon-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          document.querySelectorAll('#shortcutModal .icon-tab-content').forEach(c => c.classList.remove('active'));
          const content = document.getElementById(`icon-tab-${target}`);
          if (content) content.classList.add('active');
          selectedIconType = target;
      });
  });

  // 아이콘 선택 이벤트 (단축키 모달용만 캡처 하도록 변경)
  document.querySelectorAll('#shortcutModal .icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
          document.querySelectorAll('#shortcutModal .icon-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedIcon = opt.dataset.icon;
          // 자동으로 탭 전환은 하지 않음 (사용자 의도 존중)
      });
  });

  // 이미지 파일 업로드 (Base64 변환 & 용량 체크)
  const fileInput = document.getElementById('shortcut-image-file');
  const urlInput = document.getElementById('shortcut-image-url');
  const base64Input = document.getElementById('shortcut-image-base64');
  const previewDiv = document.getElementById('image-preview');
  const previewImg = previewDiv.querySelector('img');
  const clearImgBtn = document.getElementById('clear-image');
  const radioInputs = document.querySelectorAll('input[name="image-source"]');

  // 라디오 버튼 변경 시 입력 필드 제어
  radioInputs.forEach(radio => {
      radio.addEventListener('change', (e) => {
          if(e.target.value === 'url') {
              urlInput.disabled = false;
              fileInput.disabled = true;
              urlInput.focus();
          } else {
              urlInput.disabled = true;
              fileInput.disabled = false;
          }
      });
  });
  
  // 초기 상태 설정
  fileInput.disabled = true;

  fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 20480) { // 20KB Limit
          alert('이미지 크기가 너무 큽니다. (20KB 이하 권장)\n작은 아이콘 이미지를 사용해주세요.');
          fileInput.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          customIconData = event.target.result;
          base64Input.value = customIconData;
          previewImg.src = customIconData;
          previewDiv.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
  });

  urlInput.addEventListener('input', (e) => {
      customIconData = e.target.value;
      if(customIconData) {
          previewImg.src = customIconData;
          previewDiv.classList.remove('hidden');
      } else {
          previewDiv.classList.add('hidden');
      }
  });

  clearImgBtn.addEventListener('click', () => {
      fileInput.value = '';
      urlInput.value = '';
      base64Input.value = '';
      customIconData = '';
      previewDiv.classList.add('hidden');
  });

  window.addShortcut = (groupId) => {
      shortcutModal.classList.add('active');
      document.getElementById('shortcutModalTitle').textContent = '바로가기 추가';
      document.getElementById('shortcut-group-id').value = groupId;
      document.getElementById('shortcut-id').value = '';
      document.getElementById('shortcut-title').value = '';
      document.getElementById('shortcut-url').value = '';
      
      // Reset Icon State
      resetIconState();
  };
  
  window.editShortcut = (groupId, itemId) => {
      const group = localShortcutData.find(g => g.id === groupId);
      const item = group.items.find(i => i.id === itemId);
      
      shortcutModal.classList.add('active');
      document.getElementById('shortcutModalTitle').textContent = '바로가기 수정';
      document.getElementById('shortcut-group-id').value = groupId;
      document.getElementById('shortcut-id').value = itemId;
      document.getElementById('shortcut-title').value = item.title;
      document.getElementById('shortcut-url').value = item.url;
      
      // Restore Icon State
      resetIconState();
      
      if (item.iconType === 'custom' || (item.icon && (item.icon.startsWith('http') || item.icon.startsWith('data:')))) {
          // Custom Image
          selectedIconType = 'custom';
          customIconData = item.icon;
          
          // Switch Tab
          const customTabBtn = document.querySelector('#shortcutModal .icon-tab[data-tab="custom"]');
          if (customTabBtn) customTabBtn.click(); 
          
          if(item.icon.startsWith('data:')) {
              // Base64
              radioInputs[1].checked = true;
              fileInput.disabled = false;
              urlInput.disabled = true;
              base64Input.value = item.icon;
          } else {
              // URL
              radioInputs[0].checked = true;
              fileInput.disabled = true;
              urlInput.disabled = false;
              urlInput.value = item.icon;
          }
          previewImg.src = item.icon;
          previewDiv.classList.remove('hidden');
          
      } else {
          // Preset Icon
          selectedIconType = 'preset';
          selectedIcon = item.icon || 'fa-link';
          const presetTabBtn = document.querySelector('#shortcutModal .icon-tab[data-tab="preset"]');
          if (presetTabBtn) presetTabBtn.click();
          
          document.querySelectorAll('#shortcutModal .icon-option').forEach(o => {
              if(o.dataset.icon === selectedIcon) o.classList.add('selected');
              else o.classList.remove('selected');
          });
      }
  };

  function resetIconState() {
      // Default to preset tab
      const presetTabBtn = document.querySelector('#shortcutModal .icon-tab[data-tab="preset"]');
      if (presetTabBtn) presetTabBtn.click();
      
      // Clear custom inputs
      fileInput.value = '';
      urlInput.value = '';
      base64Input.value = '';
      customIconData = '';
      previewDiv.classList.add('hidden');
      
      // Default Icon
      selectedIcon = 'fa-link';
      document.querySelectorAll('#shortcutModal .icon-option').forEach(o => o.classList.remove('selected'));
      const defaultIconOpt = document.querySelector('#shortcutModal .icon-option[data-icon="fa-link"]');
      if (defaultIconOpt) defaultIconOpt.classList.add('selected');
      
      // Reset Radios
      radioInputs[0].checked = true;
      urlInput.disabled = false;
      fileInput.disabled = true;
  }

  window.openGroupModal = (groupId = null) => {
      groupModal.classList.add('active');
      if(groupId) {
          const group = localShortcutData.find(g => g.id === groupId);
          document.getElementById('groupModalTitle').textContent = '그룹 수정';
          document.getElementById('group-id').value = groupId;
          document.getElementById('group-title').value = group.category;
      } else {
          document.getElementById('groupModalTitle').textContent = '그룹 추가';
          document.getElementById('group-id').value = '';
          document.getElementById('group-title').value = '';
      }
  };
  
  window.editGroup = (groupId) => {
      openGroupModal(groupId);
  };

  // 모달 닫기
  document.querySelectorAll('.close-shortcut-modal').forEach(btn => 
      btn.addEventListener('click', () => shortcutModal.classList.remove('active')));
  document.querySelectorAll('.close-group-modal').forEach(btn => 
      btn.addEventListener('click', () => groupModal.classList.remove('active')));

  // 바로가기 저장
  shortcutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const groupId = document.getElementById('shortcut-group-id').value;
      const itemId = document.getElementById('shortcut-id').value;
      const title = document.getElementById('shortcut-title').value;
      let url = document.getElementById('shortcut-url').value;
      
      if (!url.startsWith('http')) url = 'https://' + url;

      // Determine final icon
      let finalIcon = selectedIcon;
      let finalIconType = 'preset';
      
      if (selectedIconType === 'custom' && customIconData) {
          finalIcon = customIconData;
          finalIconType = 'custom';
      }

      const group = localShortcutData.find(g => g.id === groupId);
      if (itemId) {
          // 수정
          const item = group.items.find(i => i.id === itemId);
          item.title = title;
          item.url = url;
          item.icon = finalIcon;
          item.iconType = finalIconType;
      } else {
          // 추가
          group.items.push({
              id: 'item-' + Date.now(),
              title: title,
              url: url,
              icon: finalIcon,
              iconType: finalIconType
          });
      }
      shortcutModal.classList.remove('active');
      renderShortcuts();
  });

  // 그룹 저장
  groupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const groupId = document.getElementById('group-id').value;
      const title = document.getElementById('group-title').value;

      if (groupId) {
          const group = localShortcutData.find(g => g.id === groupId);
          group.category = title;
      } else {
          localShortcutData.push({
              id: 'group-' + Date.now(),
              category: title,
              items: [],
              order: localShortcutData.length
          });
      }
      groupModal.classList.remove('active');
      renderShortcuts();
  });

  // initShortcuts(); // 스크립트 로드 시 시작 (상단 64행에서 이미 호출됨)

  // ================= Status Section Editing Logic =================
  let isStatusEditMode = false;
  // ★★★ 데이터 보호: statusData는 항상 window.statusData를 통해 접근 ★★★
  // 이전 코드에서 let statusData = window.statusData 로 참조를 잡았다가
  // loadStatusData()에서 statusData = newObj 로 재할당하면 참조가 끊기는 문제가 있었음.
  // 이를 방지하기 위해 getter를 사용하여 항상 window.statusData를 참조하도록 함.
  if (!window.statusData || Object.keys(window.statusData).length === 0) {
      window.statusData = {};
  }
  // statusData 접근은 항상 window.statusData를 사용
  // 기존 코드 호환성을 위해 statusData 변수를 유지하되,
  // 재할당 시 반드시 window.statusData도 동기화
  let statusData = window.statusData;
  let activeTabId = null;
  let originalStatusData = null; // 취소용 원본 백업
  let _statusDataLoaded = false; // ★ 데이터 로드 완료 플래그
  let _statusInitInProgress = false; // ★ 초기화 중복 실행 방지
  // 실행 취소/다시 실행 히스토리 스택
  const tableEditHistory = { undo: [], redo: [] };
  const MAX_HISTORY = 30;

  async function initStatusEditing() {
      const statusSection = document.getElementById('status-section');
      if (!statusSection) return;

      // ★ 중복 초기화 방지: 이미 진행 중이면 리턴
      if (_statusInitInProgress) {
          console.log('[Status] initStatusEditing 이미 진행 중 - 스킵');
          return;
      }
      _statusInitInProgress = true;

      try {
          await loadStatusData();

          if (!activeTabId && Object.keys(statusData).length > 0) {
              const sorted = Object.entries(statusData).sort((a,b) => (a[1].order||0) - (b[1].order||0));
              activeTabId = sorted[0][0];
          }

          renderStatusTabs();
          renderStatusContent();

          if (!document.getElementById('status-controls-area')) {
              const controlsDiv = document.createElement('div');
              controlsDiv.className = 'status-controls';
              controlsDiv.id = 'status-controls-area';
              const header = document.getElementById('status-header');
              if (header) header.appendChild(controlsDiv);
          }
          renderStatusControls();

          // Ctrl+Z / Ctrl+Shift+Z 실행취소·다시실행 (편집 모드일 때만)
          if (!window._statusKeyListenerAdded) {
              window._statusKeyListenerAdded = true;
              document.addEventListener('keydown', (e) => {
                  if (!isStatusEditMode) return;
                  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                      if (e.shiftKey) { e.preventDefault(); redoTableEdit(); }
                      else           { e.preventDefault(); undoTableEdit(); }
                  }
              });
          }
      } finally {
          _statusInitInProgress = false;
      }
  }

  function renderStatusControls() {
      const area = document.getElementById('status-controls-area');
      if (!area) return;

      const activeTab = statusData[activeTabId];
      const currentCols = activeTab ? (activeTab.columns || 1) : 1;

      if (isStatusEditMode) {
          area.innerHTML = `
              <div class="layout-selector">
                  <span>단 배열:</span>
                  <select onchange="updateStatusLayout(this.value)">
                      <option value="1" ${currentCols==1?'selected':''}>1단 (기본)</option>
                      <option value="2" ${currentCols==2?'selected':''}>2단</option>
                      <option value="3" ${currentCols==3?'selected':''}>3단</option>
                  </select>
              </div>
              <button id="add-tab-master-btn" class="btn-secondary"><i class="fas fa-plus-square"></i> 탭 추가</button>
              <button id="save-status-btn" class="btn-success"><i class="fas fa-save"></i> 저장 완료</button>
              <button id="cancel-status-btn" class="btn-cancel"><i class="fas fa-times"></i> 취소</button>
          `;
          document.getElementById('save-status-btn').onclick = () => toggleStatusEditMode(true);
          document.getElementById('cancel-status-btn').onclick = () => {
              if (confirm('변경사항을 취소하시겠습니까?')) {
                  window.statusData = statusData = JSON.parse(JSON.stringify(originalStatusData));
                  isStatusEditMode = false;
                  renderStatusTabs();
                  renderStatusContent();
                  renderStatusControls();
              }
          };
          document.getElementById('add-tab-master-btn').onclick = addNewTab;
      } else {
          const isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'sub-admin';
          let htmlContent = `
              <button id="excel-download-btn" class="btn-secondary" onclick="exportStatusToExcel()" style="margin-right: 6px; background: #10b981; color: white; border-color: #059669;">
                  <i class="fas fa-file-excel"></i> 엑셀 다운로드
              </button>
          `;
          if (isAdmin) {
              htmlContent += `
                  <button id="edit-status-btn" class="btn-primary">
                      <i class="fas fa-edit"></i> 현황 편집
                  </button>
              `;
          }
          area.innerHTML = htmlContent;
          if (isAdmin) {
              document.getElementById('edit-status-btn').onclick = () => toggleStatusEditMode(false);
          }
      }
  }

  // Handle live role updates to refresh all admin controls
  window.addEventListener('user-role-updated', async () => {
      renderStatusControls();
      await loadShortcutsFromFirebase();
      if(window.initAccountEditing) initAccountEditing();
  });

  window.updateStatusLayout = (val) => {
      if (statusData[activeTabId]) {
          statusData[activeTabId].columns = parseInt(val);
          renderStatusContent();
      }
  };

  async function loadStatusData() {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      try {
          const q = firestoreUtils.query(firestoreUtils.collection(db, "statusTabs"));
          const querySnapshot = await firestoreUtils.getDocs(q);
          let loadedData = {};
          querySnapshot.forEach(doc => {
              const data = doc.data();
              if (data.jsonContent) {
                  try {
                      loadedData[doc.id] = JSON.parse(data.jsonContent);
                  } catch (e) {
                      loadedData[doc.id] = data;
                  }
              } else {
                  loadedData[doc.id] = data;
              }
          });

          if (Object.keys(loadedData).length === 0) {
              // ★ 데이터가 없는 경우에만 기본 템플릿 사용
              // 주의: 이 경우는 최초 사용 시에만 해당됨
              const defaultData = {
                  "staff": { 
                      title: "교직원 현황", order: 0, columns: 2, 
                      tables: [
                          { headers: ["번호", "직", "성명", "담당", "근무장소", "내선번호"], widths: [40, 60, 80, 150, 100, 80], rows: Array.from({length: 10}, () => ["", "", "", "", "", ""]) },
                          { headers: ["번호", "직", "성명", "담당", "근무장소", "내선번호"], widths: [40, 60, 80, 150, 100, 80], rows: Array.from({length: 10}, () => ["", "", "", "", "", ""]) }
                      ] 
                  },
                  "afterschool": { 
                      title: "돌봄, 방과후 강사 현황", order: 1, columns: 1, 
                      tables: [
                          { headers: ["번호", "강좌명", "성명", "수업장소", "요일", "교시", "대상", "비고"], widths: [40, 120, 80, 100, 60, 60, 100, 100], rows: Array.from({length: 10}, () => ["", "", "", "", "", "", "", ""]) }
                      ] 
                  },
                  "students": { 
                      title: "학생 현황", order: 2, columns: 2,
                      tables: [
                          { headers: ["학년", "반", "성명", "성별", "비고"], widths: [50, 50, 80, 60, 120], rows: Array.from({length: 10}, () => ["", "", "", "", ""]) },
                          { headers: ["학년", "반", "성명", "성별", "비고"], widths: [50, 50, 80, 60, 120], rows: Array.from({length: 10}, () => ["", "", "", "", ""]) }
                      ] 
                  },
                  "approval": { 
                      title: "주요 결재경로", order: 3, columns: 1, 
                      tables: [
                          { headers: ["구분", "담당", "교무부장", "행정실장", "교장"], widths: [80, 80, 100, 100, 100], rows: Array.from({length: 8}, () => ["", "", "", "", ""]) }
                      ] 
                  }
              };
              // ★★★ 참조 끊김 방지: 기존 객체를 비우고 새 데이터를 복사 ★★★
              Object.keys(statusData).forEach(k => delete statusData[k]);
              Object.assign(statusData, defaultData);
              window.statusData = statusData;
              console.log('[Status] 기본 템플릿 데이터 로드됨 (Firebase에 데이터 없음)');
          } else {
              // ★★★ 참조 끊김 방지: 기존 객체를 비우고 로드된 데이터를 복사 ★★★
              Object.keys(statusData).forEach(k => delete statusData[k]);
              Object.assign(statusData, loadedData);
              window.statusData = statusData;
              console.log('[Status] Firebase에서 데이터 로드 성공:', Object.keys(loadedData).length, '개 탭');
          }
          _statusDataLoaded = true; // ★ 로드 완료 표시
      } catch (e) {
          console.error("Status load error", e);
          // ★ 에러 시에도 기존 statusData를 절대 덮어쓰지 않음
          // 기존 데이터가 있으면 그대로 유지
          console.warn('[Status] 로드 에러 - 기존 데이터 유지');
      }
  }

  async function saveStatusDataToFirebase(silent = false) {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      
      try {
          // ★★★ 안전장치 1: 데이터가 로드되지 않은 상태에서는 절대 저장하지 않음 ★★★
          if (!_statusDataLoaded) {
              console.error('[Status] 데이터 보호: 데이터가 아직 로드되지 않아 저장을 거부합니다.');
              if (!silent) alert('데이터가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
              return;
          }

          // ★★★ 안전장치 2: statusData가 비어있으면 저장 거부 ★★★
          if (!statusData || Object.keys(statusData).length === 0) {
              console.error('[Status] 데이터 보호: statusData가 비어있어 저장을 거부합니다.');
              if (!silent) alert('데이터 보호를 위해 모든 현황 탭이 비어있는 상태로는 저장할 수 없습니다.');
              return;
          }

          // ★★★ 안전장치 3: 각 탭에 유효한 데이터가 있는지 검증 ★★★
          const validEntries = Object.entries(statusData).filter(([id, data]) => {
              return data && typeof data === 'object' && data.title && data.tables;
          });
          if (validEntries.length === 0) {
              console.error('[Status] 데이터 보호: 유효한 탭 데이터가 없어 저장을 거부합니다.');
              if (!silent) alert('유효한 현황 데이터가 없습니다. 저장을 중단합니다.');
              return;
          }

          syncStatusDataFromDOM();

          for (const [id, data] of Object.entries(statusData)) {
              if (!data || typeof data !== 'object') continue;
              const jsonContent = JSON.stringify(data);
              await firestoreUtils.setDoc(firestoreUtils.doc(db, "statusTabs", id), {
                  jsonContent: jsonContent,
                  updatedAt: new Date().toISOString()
              });
          }
          
          // ★★★ 안전장치 4: 삭제 로직 - 편집 모드에서 명시적으로 탭을 삭제한 경우만 처리 ★★★
          // 이전 코드는 statusData에 없는 모든 Firebase 문서를 자동 삭제했는데,
          // 이는 statusData가 비정상적으로 비어있을 때 전체 데이터를 날리는 원인이었음.
          // 이제는 편집 모드(isStatusEditMode)에서만 삭제를 허용하고,
          // 추가적으로 삭제 전에 데이터 검증을 수행함.
          if (isStatusEditMode) {
              const q = firestoreUtils.query(firestoreUtils.collection(db, "statusTabs"));
              const querySnapshot = await firestoreUtils.getDocs(q);
              const deletePromises = [];
              const deleteTargets = [];
              querySnapshot.forEach(docSnap => {
                  if (!statusData[docSnap.id]) {
                      deleteTargets.push(docSnap.id);
                      deletePromises.push(firestoreUtils.deleteDoc(firestoreUtils.doc(db, "statusTabs", docSnap.id)));
                  }
              });
              if (deletePromises.length > 0) {
                  console.log('[Status] 편집 모드에서 삭제된 탭:', deleteTargets);
                  await Promise.all(deletePromises);
              }
          }
          if (window.logUserAction) window.logUserAction('status', '저장', '학교 현황 데이터를 저장했습니다.');
          console.log('[Status] 저장 완료:', Object.keys(statusData).length, '개 탭');
          
      } catch (e) {
          console.error("Status save error details:", e);
          if (!silent) {
              const errorMsg = e.code ? `[${e.code}] ${e.message}` : e.message;
              alert(`데이터 저장 중 오류가 발생했습니다.\n상세내용: ${errorMsg}`);
          }
      }
  }

  // 현재 활성화된 탭의 입력을 statusData 객체에 동기화
  function syncStatusDataFromDOM() {
      if (!activeTabId || !statusData[activeTabId]) return;
      
      const tableEls = document.querySelectorAll('.status-table');
      tableEls.forEach(table => {
          const tIdx = parseInt(table.dataset.tid);
          if (isNaN(tIdx)) return;
          
          const tabTableData = statusData[activeTabId].tables[tIdx];
          if (!tabTableData) return;
          
          // Headers sync
          const headerInputs = table.querySelectorAll('thead .editable-input');
          if (headerInputs.length > 0) {
              headerInputs.forEach((input, hIdx) => {
                  tabTableData.headers[hIdx] = input.value !== undefined ? input.value : (input.innerText || "");
              });
          }
          
          // Rows sync
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach((tr, rIdx) => {
              const inputs = tr.querySelectorAll('.editable-input');
              if (!tabTableData.rows[rIdx]) {
                  tabTableData.rows[rIdx] = Array(tabTableData.headers.length).fill("");
              }
              inputs.forEach((input, cIdx) => {
                  tabTableData.rows[rIdx][cIdx] = input.value !== undefined ? input.value : (input.innerText || "");
              });
          });
      });
  }

  async function toggleStatusEditMode(save = false) {
      const btn = document.getElementById('save-status-btn');
      if (!isStatusEditMode) {
          // 편집 시작: 데이터 백업
          originalStatusData = JSON.parse(JSON.stringify(statusData));
          isStatusEditMode = true;
      } else if (save) {
          // 저장
          if (btn) {
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
              btn.disabled = true;
          }
          
          await saveStatusDataToFirebase();
          isStatusEditMode = false;
          
          if (btn) {
              btn.innerHTML = '<i class="fas fa-save"></i> 저장 완료';
              btn.disabled = false;
          }
      }
      renderStatusTabs();
      renderStatusContent();
      renderStatusControls();
  }

  function renderStatusTabs() {
      const container = document.getElementById('status-tabs-container');
      if (!container) return;
      container.innerHTML = '';
      container.className = isStatusEditMode ? 'status-tabs edit-mode' : 'status-tabs';

      const sorted = Object.entries(statusData).sort((a,b) => (a[1].order||0) - (b[1].order||0));
      
      sorted.forEach(([id, tab]) => {
          const btn = document.createElement('button');
          btn.className = id === activeTabId ? 'status-tab active' : 'status-tab';
          btn.innerHTML = isStatusEditMode 
              ? `${tab.title} <span class="delete-tab-btn" onclick="removeTab('${id}')"><i class="fas fa-times"></i></span>`
              : tab.title;

          btn.onclick = (e) => {
              if (e.target.closest('.delete-tab-btn')) return;
              if (isStatusEditMode) syncStatusDataFromDOM(); // 탭 이동 전 현재 탭의 인풋값 동기화
              activeTabId = id;
              renderStatusTabs();
              renderStatusContent();
          };
          container.appendChild(btn);
      });

      if (isStatusEditMode && window.Sortable) {
          new Sortable(container, {
              animation: 150,
              filter: '.delete-tab-btn',
              onEnd: () => {
                  const items = container.querySelectorAll('.status-tab');
                  items.forEach((item, index) => {
                      const tabName = item.textContent.trim();
                      const entry = Object.entries(statusData).find(e => e[1].title === tabName);
                      if (entry) statusData[entry[0]].order = index;
                  });
              }
          });
      }
  }

  function renderStatusContent() {
      const container = document.getElementById('status-panels-container');
      if (!container) return;
      container.innerHTML = '';
      if (!activeTabId || !statusData[activeTabId]) return;

      const tabData = statusData[activeTabId];
      const panel = document.createElement('div');
      panel.className = 'status-panel active';

      const gridCols = tabData.columns || 1;
      let html = `<div class="table-container"><div class="table-grid-wrapper table-grid-${gridCols}">`;

      tabData.tables.forEach((table, tIdx) => {
          const tableWidthCSS = table.customSized ? 'max-content' : '100%';
          html += `<div class="editable-table-wrapper" style="margin-bottom:2rem; width:100%; overflow:visible; ${isStatusEditMode ? 'margin-top:2.5rem;' : ''}">
            <table class="status-table ${isStatusEditMode ? 'editable-table' : ''}" data-tid="${tIdx}" style="width:${tableWidthCSS};">
              <thead><tr>`;

          // 열 헤더: float controls for delete and drag
          table.headers.forEach((h, hIndex) => {
              const w = table.widths && table.widths[hIndex] ? table.widths[hIndex] + 'px' : 'auto';
              if (isStatusEditMode) {
                  html += `<th data-col="${hIndex}" style="width:${w}; position:relative;"><div class="col-edit-floating"><span class="col-drag-handle" title="드래그하여 열 이동"><i class="fas fa-grip-horizontal"></i></span><button class="tbl-del-btn" onclick="statusDeleteCol('${activeTabId}',${tIdx},${hIndex})" title="이 열 삭제"><i class="fas fa-minus"></i></button></div><div class="header-inner"><div class="editable-input" contenteditable="true" onblur="statusData['${activeTabId}'].tables[${tIdx}].headers[${hIndex}]=this.innerText">${h}</div></div><div class="status-col-resizer" onmousedown="initStatusColResize(event, '${activeTabId}', ${tIdx}, ${hIndex})"></div></th>`;
              } else {
                  html += `<th data-col="${hIndex}" style="width:${w}"><div class="header-inner">${h}</div></th>`;
              }
          });

          html += `</tr></thead><tbody>`;

          table.rows.forEach((row, rIdx) => {
              html += `<tr data-row="${rIdx}">`;
              row.forEach((cell, cIndex) => {
                  html += `<td style="position:relative;">`;
                  if (isStatusEditMode && cIndex === 0) {
                      html += `<div class="row-edit-floating"><span class="row-drag-handle" title="드래그하여 행 이동"><i class="fas fa-grip-vertical"></i></span><button class="tbl-del-btn" onclick="statusDeleteRow('${activeTabId}',${tIdx},${rIdx})" title="이 행 삭제"><i class="fas fa-minus"></i></button></div>`;
                  }
                  html += isStatusEditMode
                      ? `<div class="editable-input" contenteditable="true" onblur="statusData['${activeTabId}'].tables[${tIdx}].rows[${rIdx}][${cIndex}]=this.innerText">${cell}</div>`
                      : cell;
                  html += `</td>`;
              });
              html += `</tr>`;
          });

          html += `</tbody></table>`;

          if (isStatusEditMode) {
              html += `<div class="table-controls">
                <button class="btn-mini" onclick="statusRowAction('${activeTabId}',${tIdx},'add')"><i class="fas fa-plus"></i> 행 추가</button>
                <button class="btn-mini" onclick="statusColAction('${activeTabId}',${tIdx},'add')"><i class="fas fa-plus"></i> 열 추가</button>
                <button class="btn-mini" onclick="statusEqualizeWidth('${activeTabId}',${tIdx})"><i class="fas fa-arrows-alt-h"></i> 너비 같게</button>
                <button class="btn-mini danger" onclick="removeTableFromTab('${activeTabId}',${tIdx})">표 삭제</button>
              </div>`;
          }
          html += `</div>`;
      });
      html += `</div></div>`;

      if (isStatusEditMode) {
          html += `<div class="add-table-container"><button class="add-tab-btn" style="margin-top:20px;" onclick="addTableToTab('${activeTabId}')"><i class="fas fa-table"></i> 표 추가하기</button></div>`;
      }

      panel.innerHTML = html;
      container.appendChild(panel);

      if (isStatusEditMode && window.Sortable) {
          // ① 행 드래그앤드롭 (Sortable on tbody)
          panel.querySelectorAll('.status-table tbody').forEach(tbody => {
              const tIdx = parseInt(tbody.closest('.status-table').dataset.tid);
              new Sortable(tbody, {
                  handle: '.row-drag-handle',
                  animation: 150,
                  ghostClass: 'status-row-ghost',
                  onStart: () => { syncStatusDataFromDOM(); pushTableHistory(activeTabId, tIdx); },
                  onEnd: (evt) => {
                      if (evt.oldIndex === evt.newIndex) return;
                      const tbl = statusData[activeTabId].tables[tIdx];
                      const moved = tbl.rows.splice(evt.oldIndex, 1)[0];
                      tbl.rows.splice(evt.newIndex, 0, moved);
                      renderStatusContent();
                  }
              });
          });

          // ② 열 드래그앤드롭 (Sortable on thead tr)
          panel.querySelectorAll('.status-table thead tr').forEach(theadTr => {
              const tIdx = parseInt(theadTr.closest('.status-table').dataset.tid);
              new Sortable(theadTr, {
                  handle: '.col-drag-handle',
                  filter: '[data-fixed]',
                  preventOnFilter: true,
                  animation: 150,
                  ghostClass: 'status-col-ghost',
                  onStart: () => { syncStatusDataFromDOM(); pushTableHistory(activeTabId, tIdx); },
                  onEnd: () => {
                      const fixedTh = theadTr.querySelector('th[data-fixed]');
                      if (fixedTh && fixedTh !== theadTr.firstElementChild) {
                          theadTr.insertBefore(fixedTh, theadTr.firstElementChild);
                      }
                      const ths = [...theadTr.querySelectorAll('th[data-col]')];
                      const newOrder = ths.map(th => parseInt(th.dataset.col));
                      const tbl = statusData[activeTabId].tables[tIdx];
                      const oldH = [...tbl.headers];
                      const oldW = tbl.widths ? [...tbl.widths] : null;
                      const oldRows = tbl.rows.map(r => [...r]);
                      tbl.headers = newOrder.map(i => oldH[i]);
                      if (oldW) tbl.widths = newOrder.map(i => oldW[i] || 100);
                      tbl.rows = oldRows.map(row => newOrder.map(i => row[i] || ''));
                      renderStatusContent();
                  }
              });
          });
      }
  }

  // Actions
  window.removeTab = (id) => {
      if (confirm('이 탭을 삭제하시겠습니까?')) {
          delete statusData[id];
          if (activeTabId === id) activeTabId = Object.keys(statusData)[0] || null;
          renderStatusTabs();
          renderStatusContent();
      }
  };

  window.addNewTab = () => {
      const title = prompt('새 탭 이름:');
      if (title) {
          const id = 'tab_' + Date.now();
          statusData[id] = { title, order: Object.keys(statusData).length, columns: 1, tables: [{ headers: ['제목1'], widths:[100], rows: [['']] }] };
          activeTabId = id;
          renderStatusTabs();
          renderStatusContent();
          renderStatusControls();
      }
  };

  window.addTableToTab = (tabId) => {
      statusData[tabId].tables.push({ headers: ['제목1'], widths: [100], rows: [['']] });
      renderStatusContent();
  };

  window.removeTableFromTab = (tabId, tIdx) => {
      if (confirm('이 표를 삭제하시겠습니까?')) {
          statusData[tabId].tables.splice(tIdx, 1);
          renderStatusContent();
      }
  };

  window.statusRowAction = (tabId, tIdx, type) => {
      syncStatusDataFromDOM();
      const table = statusData[tabId].tables[tIdx];
      if (type === 'add') {
          pushTableHistory(tabId, tIdx);
          table.rows.push(Array(table.headers.length).fill(''));
          renderStatusContent();
      }
  };

  window.statusColAction = (tabId, tIdx, type) => {
      syncStatusDataFromDOM();
      const table = statusData[tabId].tables[tIdx];
      if (type === 'add') {
          pushTableHistory(tabId, tIdx);
          table.headers.push('새 열');
          if (!table.widths) table.widths = Array(table.headers.length - 1).fill(100);
          table.widths.push(100);
          table.rows.forEach(r => r.push(''));
          renderStatusContent();
      }
  };

  window.statusDeleteRow = (tabId, tIdx, rowIdx) => {
      syncStatusDataFromDOM();
      const table = statusData[tabId].tables[tIdx];
      if (table.rows.length <= 0) return;
      pushTableHistory(tabId, tIdx);
      table.rows.splice(rowIdx, 1);
      renderStatusContent();
  };

  window.statusDeleteCol = (tabId, tIdx, colIdx) => {
      syncStatusDataFromDOM();
      const table = statusData[tabId].tables[tIdx];
      if (table.headers.length <= 0) return;
      pushTableHistory(tabId, tIdx);
      table.headers.splice(colIdx, 1);
      if (table.widths) table.widths.splice(colIdx, 1);
      table.rows.forEach(r => r.splice(colIdx, 1));
      renderStatusContent();
  };

  window.initStatusColResize = (e, tabId, tIdx, colIdx) => {
      e.stopPropagation();
      e.preventDefault();
      
      const th = e.target.closest('th');
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      
      const tableEl = th.closest('table');
      let startTableWidth = 0;
      
      if (tableEl) {
          // 크기가 튀는 것을 방지하기 위해 드래그 시작 시 모든 열의 너비를 명시적 픽셀로 고정
          const allThs = Array.from(tableEl.querySelectorAll('th'));
          allThs.forEach(t => {
              t.style.width = t.offsetWidth + 'px';
          });
          startTableWidth = tableEl.offsetWidth;
          tableEl.style.width = startTableWidth + 'px';
          // tableLayout은 기본 설정인 fixed를 그대로 유지하여 다른 열들이 자동 조절되어 끊기는 현상 방지
      }
      
      const onMouseMove = (moveEvent) => {
          const delta = moveEvent.pageX - startX;
          const newWidth = Math.max(30, startWidth + delta);
          
          th.style.width = newWidth + 'px';
          if (tableEl) {
              // 조절하는 열의 너비 변화량만큼 표 전체 너비도 동기화하여 미세하고 부드러운 조절 구현
              tableEl.style.width = Math.max(100, startTableWidth + (newWidth - startWidth)) + 'px';
          }
      };
      
      const onMouseUp = (upEvent) => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          if (statusData[tabId] && statusData[tabId].tables[tIdx]) {
              const table = statusData[tabId].tables[tIdx];
              if (!table.widths) table.widths = Array(table.headers.length).fill(100);
              
              // 드래그가 끝난 후 최종적으로 계산된 모든 열의 실제 너비를 저장
              if (tableEl) {
                  const allThs = Array.from(tableEl.querySelectorAll('th'));
                  allThs.forEach((t, i) => {
                      if (table.widths[i] !== undefined) {
                          table.widths[i] = t.offsetWidth;
                      }
                  });
              }
              table.customSized = true;
          }
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  // Undo / Redo
  function pushTableHistory(tabId, tIdx) {
      const snapshot = {
          tabId, tIdx,
          data: JSON.parse(JSON.stringify(statusData[tabId].tables[tIdx]))
      };
      tableEditHistory.undo.push(snapshot);
      if (tableEditHistory.undo.length > MAX_HISTORY) tableEditHistory.undo.shift();
      tableEditHistory.redo = [];
      showUndoToast();
  }

  function undoTableEdit() {
      if (tableEditHistory.undo.length === 0) { showUndoToast('더 이상 되돌릴 작업이 없습니다.', true); return; }
      syncStatusDataFromDOM();
      const snapshot = tableEditHistory.undo.pop();
      tableEditHistory.redo.push({
          tabId: snapshot.tabId, tIdx: snapshot.tIdx,
          data: JSON.parse(JSON.stringify(statusData[snapshot.tabId].tables[snapshot.tIdx]))
      });
      statusData[snapshot.tabId].tables[snapshot.tIdx] = snapshot.data;
      activeTabId = snapshot.tabId;
      renderStatusTabs();
      renderStatusContent();
      showUndoToast('실행 취소됨 (Ctrl+Shift+Z로 다시 실행)');
  }

  function redoTableEdit() {
      if (tableEditHistory.redo.length === 0) { showUndoToast('다시 실행할 작업이 없습니다.', true); return; }
      syncStatusDataFromDOM();
      const snapshot = tableEditHistory.redo.pop();
      tableEditHistory.undo.push({
          tabId: snapshot.tabId, tIdx: snapshot.tIdx,
          data: JSON.parse(JSON.stringify(statusData[snapshot.tabId].tables[snapshot.tIdx]))
      });
      statusData[snapshot.tabId].tables[snapshot.tIdx] = snapshot.data;
      activeTabId = snapshot.tabId;
      renderStatusTabs();
      renderStatusContent();
      showUndoToast('다시 실행됨');
  }

  function showUndoToast(msg = '', isWarn = false) {
      let toast = document.getElementById('status-undo-toast');
      if (!toast) {
          toast = document.createElement('div');
          toast.id = 'status-undo-toast';
          document.body.appendChild(toast);
      }
      if (!msg) return;
      toast.textContent = msg;
      toast.className = 'status-undo-toast ' + (isWarn ? 'warn' : 'info');
      toast.classList.add('visible');
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  window.statusEqualizeWidth = (tabId, tIdx) => {
      const table = statusData[tabId].tables[tIdx];
      if (table && table.headers.length > 0) {
          if (isStatusEditMode) syncStatusDataFromDOM();

          if (!table.widths) table.widths = Array(table.headers.length).fill(100);
          
          const totalWidth = table.widths.reduce((sum, w) => sum + (typeof w === 'number' ? w : 100), 0);
          const equalWidth = Math.max(50, Math.floor(totalWidth / table.headers.length));
          
          table.widths = Array(table.headers.length).fill(equalWidth);
          table.customSized = true;
          
          renderStatusContent();
      }
  };

  window.exportStatusToExcel = () => {
    // 엑셀 다운로드 임시 함수
    alert("엑셀 다운로드 기능은 시트라이브러리(SheetJS 등)가 필요합니다.");
  };

  window.addEventListener('firebase-ready', initStatusEditing);
  if (window.db) initStatusEditing();


  // ================= 자료마당 (Datayard) Logic =================
  
  // 초기화 및 Firebase 데이터 로드
  async function initDatayard() {
    if (!window.db) {
      window.addEventListener('firebase-ready', () => loadDatayardFromFirebase());
      // fallback
      localDatayardData = JSON.parse(JSON.stringify(datayardData));
      renderDatayard();
    } else {
      await loadDatayardFromFirebase();
    }
    // Force show edit button and its container if hidden
    setTimeout(() => {
        const btn = document.getElementById('datayard-edit-mode-btn');
        if(btn) {
            btn.classList.remove('hidden');
            btn.style.setProperty('display', 'inline-flex', 'important');
            
            // Ensure parent container is also visible (fixes mobile/responsive layout hiding it)
            const parent = btn.closest('.datayard-controls');
            if(parent) {
                parent.classList.remove('hidden');
                parent.style.setProperty('display', 'flex', 'important');
                parent.style.setProperty('gap', '10px', 'important');
                parent.style.setProperty('align-items', 'center', 'important');
            }
        }
    }, 500);
  }

  async function loadDatayardFromFirebase() {
    const { db, firestoreUtils } = window;
    try {
      const querySnapshot = await firestoreUtils.getDocs(firestoreUtils.collection(db, "datayardGroups"));
      let groups = [];
      querySnapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      
      if (groups.length === 0) {
        // 초대 데이터가 없으면 data.js에서 초기 데이터 로드 및 저장
        for (let i = 0; i < datayardData.length; i++) {
          const group = { ...datayardData[i], order: i };
          const docId = `group-${Date.now()}-${i}`;
          await firestoreUtils.setDoc(firestoreUtils.doc(db, "datayardGroups", docId), group);
          groups.push({ id: docId, ...group });
        }
      }
      
      groups.sort((a, b) => (a.order || 0) - (b.order || 0));
      localDatayardData = groups;
      renderDatayard();
    } catch (error) {
      console.error("Error loading datayard:", error);
      localDatayardData = JSON.parse(JSON.stringify(datayardData));
      renderDatayard();
    }
  }

  async function saveDatayardToFirebase() {
    const { db, firestoreUtils } = window;
    try {
      for (const group of localDatayardData) {
        await firestoreUtils.setDoc(firestoreUtils.doc(db, "datayardGroups", group.id), group);
      }
      if(window.logUserAction) window.logUserAction('datayard', '수정', '자료마당 전체 저장');
      alert("자료마당 변경사항이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving datayard:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  function renderDatayard() {
    const container = document.getElementById("datayard-container");
    if(!container) return;

    datayardRenderSnapshot = JSON.parse(JSON.stringify(localDatayardData));
    container.innerHTML = "";
    
    // Header (제목)는 datayardSection의 첫 부분에 이미 HTML로 들어가 있음.
    // 하지만 renderDatayard가 호출될 때마다 section 전체가 아닌 container만 갱신.

    localDatayardData.forEach((group, groupIndex) => {
      const card = document.createElement("div");
      card.className = "helppage-card-container datayard-group-card";
      card.dataset.id = group.id;

      card.innerHTML = `
        <div class="helppage-main-card">
          ${datayardEditMode ? `
          <!-- ── 편집모드: 2행 레이아웃 ── -->
          <div class="helppage-main-toggle" style="cursor:default;flex-direction:column;align-items:stretch;gap:0;padding:0.7rem 1rem 0;position:relative;z-index:1;">
            <!-- 행 1: 드래그 핸들 + 축소 아이콘 + 그룹명/설명 + 접기화살표 -->
            <div style="display:flex;align-items:center;gap:9px;">
              <i class="fas fa-grip-vertical datayard-sortable-handle group-handle" style="color:#94a3b8;flex-shrink:0;font-size:1rem;"></i>
              <div class="icon-box ${group.color || 'blue'}-bg" style="width:34px;height:34px;min-width:34px;border-radius:9px;font-size:0.88rem;flex-shrink:0;">
                <i class="fas ${group.icon || 'fa-folder'} ${group.color || 'blue'}-text"></i>
              </div>
              <div class="title-group" style="flex:1;min-width:0;">
                <h3 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${group.category}</h3>
                <p style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${group.description || group.category + ' 관련 자료 목록'}</p>
              </div>
              <i class="fas fa-chevron-down main-chevron" style="cursor:pointer;flex-shrink:0;color:#94a3b8;"></i>
            </div>
            <!-- 행 2: 액션 버튼 우측 정렬 -->
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;padding:0.45rem 0 0.55rem;">
              <button class="my-magic-edit-btn" title="그룹 수정" style="width:30px;height:30px;min-width:30px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748b;box-shadow:0 1px 3px rgba(0,0,0,0.06);flex-shrink:0;"><i class="fas fa-pen" style="font-size:0.8rem;"></i></button>
              <button class="my-magic-delete-btn" title="그룹 삭제" style="width:30px;height:30px;min-width:30px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#ef4444;box-shadow:0 1px 3px rgba(0,0,0,0.06);flex-shrink:0;"><i class="fas fa-trash" style="font-size:0.8rem;"></i></button>
              <button class="add-file-btn" title="자료 추가" style="width:30px;height:30px;min-width:30px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#10b981;box-shadow:0 1px 3px rgba(0,0,0,0.06);flex-shrink:0;"><i class="fas fa-plus" style="font-size:0.88rem;"></i></button>
            </div>
          </div>
          ` : `
          <!-- ── 일반모드: 단일행 레이아웃 ── -->
          <div class="helppage-main-toggle" style="cursor:pointer;">
            <div class="header-info">
              <div class="icon-box ${group.color || 'blue'}-bg">
                <i class="fas ${group.icon || 'fa-folder'} ${group.color || 'blue'}-text"></i>
              </div>
              <div class="title-group">
                <h3>${group.category}</h3>
                <p>${group.description || group.category + ' 관련 자료 목록'}</p>
              </div>
            </div>
            <div style="margin-left:auto;padding-left:10px;flex-shrink:0;">
              <i class="fas fa-chevron-down main-chevron" style="cursor:pointer;color:#94a3b8;"></i>
            </div>
          </div>
          `}
          
          <div id="${group.id}-content" class="hidden-content ${datayardEditMode ? '' : 'hidden'}">
            <div class="sub-sections-container">
              <div class="sub-items-list datayard-items-container" style="padding-left: 0;" data-group-id="${group.id}">
                ${group.items.map((item, itemIndex) => `
                  <div class="file-item-wrapper" data-index="${itemIndex}" data-item-key="${group.id}:${itemIndex}">
                    <a href="${item.url}" class="file-item" onclick="window.forceDownload(event, '${item.url}', '${item.title}')">
                      ${datayardEditMode ? '<i class="fas fa-grip-vertical datayard-sortable-handle item-handle"></i>' : ''}
                      <i class="fas fa-file-alt"></i>
                      <span>${item.title}</span>
                      <i class="fas fa-download link-icon" style="font-size: 0.85rem; opacity: 0.7;"></i>
                    </a>
                    ${datayardEditMode ? `
                      <div class="item-edit-actions">
                        <button class="edit-btn edit-item-btn" title="자료 수정"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn delete-item-btn" title="자료 삭제"><i class="fas fa-times"></i></button>
                      </div>
                    ` : ''}
                  </div>
                `).join("")}
                ${group.items.length === 0 ? '<p class="no-results">등록된 자료가 없습니다.</p>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;

      // 토글 이벤트
      const toggleArea = card.querySelector(".helppage-main-toggle");
      const content = card.querySelector(".hidden-content");
      const chevron = card.querySelector(".main-chevron");

      toggleArea.addEventListener("click", (e) => {
        // 버튼 클릭 시 토글 방지
        if (e.target.closest('button') || e.target.closest('.datayard-sortable-handle')) return;
        
        const isHidden = content.classList.contains("hidden");
        if (isHidden) {
          content.classList.remove("hidden");
          chevron.style.transform = "rotate(180deg)";
        } else {
          content.classList.add("hidden");
          chevron.style.transform = "rotate(0deg)";
        }
      });

      // 그룹 수정/삭제 이벤트
      if (datayardEditMode) {
        // 제목(텍스트 영역) 클릭 시에도 편집 모달 열기
        card.querySelector(".title-group").style.cursor = "pointer";
        card.querySelector(".title-group").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardGroupModal(group);
        });

        card.querySelector(".my-magic-edit-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardGroupModal(group);
        });

        card.querySelector(".my-magic-delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteDatayardGroup(group.id);
        });

        card.querySelector(".add-file-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          openDatayardItemModal(group.id);
        });

        // 아이템별 수정/삭제
        card.querySelectorAll(".file-item-wrapper").forEach(wrapper => {
          const itemIdx = wrapper.dataset.index;
          wrapper.querySelector(".edit-item-btn").addEventListener("click", (e) => {
            e.preventDefault();
            openDatayardItemModal(group.id, itemIdx);
          });
          wrapper.querySelector(".delete-item-btn").addEventListener("click", (e) => {
            e.preventDefault();
            deleteDatayardItem(group.id, itemIdx);
          });
        });

        // Item Sortable (group enables cross-group drag)
        new Sortable(card.querySelector(".datayard-items-container"), {
          group: { name: 'datayard-items', pull: true, put: true },
          handle: '.item-handle',
          animation: 150,
          ghostClass: 'sortable-ghost',
          onEnd: function() {
            updateDatayardOrderFromDOM();
          }
        });
      }

      container.appendChild(card);
    });

    // Group Sortable
    if (datayardEditMode) {
      new Sortable(container, {
        handle: '.group-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function() {
          updateDatayardOrderFromDOM();
        }
      });
    }
  }

  window.exportStatusToExcel = () => {
      if (!activeTabId || !statusData[activeTabId]) return;
      const tabData = statusData[activeTabId];
      if (!tabData.tables || tabData.tables.length === 0) {
          alert("추출할 표 데이터가 없습니다.");
          return;
      }

      try {
          let wb = XLSX.utils.book_new();
          const ws_data = [];
          
          tabData.tables.forEach((table, idx) => {
              if (idx > 0) {
                  ws_data.push([]); // 표 구분을 위한 빈 줄
                  ws_data.push([]);
              }
              if (table.headers) ws_data.push(table.headers);
              if (table.rows) {
                  table.rows.forEach(r => ws_data.push(r));
              }
          });
          
          let sheetName = tabData.title || "명부";
          if (sheetName.length > 31) sheetName = sheetName.substring(0, 31); // 엑셀 시트명은 최대 31자 제한
          
          const ws = XLSX.utils.aoa_to_sheet(ws_data);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          
          const today = new Date();
          const dateStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
          const fileName = `[${tabData.title}]명부_${dateStr}.xlsx`;
          
          XLSX.writeFile(wb, fileName);
      } catch (e) {
          console.error("Excel download error:", e);
          alert("엑셀 다운로드 중 오류가 발생했습니다.");
      }
  };

  function updateDatayardOrderFromDOM() {
    if (!datayardRenderSnapshot) return;
    const container = document.getElementById("datayard-container");
    const newGroups = [];

    container.querySelectorAll(".datayard-group-card").forEach((groupEl, gIndex) => {
      const groupId = groupEl.dataset.id;
      const originalGroup = localDatayardData.find(g => g.id === groupId);
      if (!originalGroup) return;

      const newItems = [];
      groupEl.querySelectorAll(".file-item-wrapper").forEach((itemEl) => {
        const itemKey = itemEl.dataset.itemKey;
        if (itemKey) {
          // Parse "sourceGroupId:sourceItemIndex" — works for cross-group drag
          const colonIdx = itemKey.lastIndexOf(':');
          const srcGroupId = itemKey.substring(0, colonIdx);
          const srcIdx = parseInt(itemKey.substring(colonIdx + 1), 10);
          const srcGroup = datayardRenderSnapshot.find(g => g.id === srcGroupId);
          if (srcGroup && srcGroup.items[srcIdx] !== undefined) {
            newItems.push(srcGroup.items[srcIdx]);
          }
        }
      });

      newGroups.push({ ...originalGroup, order: gIndex, items: newItems });
    });

    localDatayardData = newGroups;
  }

  // 모달 관련
  const dyGroupModal = document.getElementById('datayardGroupModal');
  const dyItemModal = document.getElementById('datayardItemModal');
  const dyGroupForm = document.getElementById('datayardGroupForm');
  const dyItemForm = document.getElementById('datayardItemForm');

  function openDatayardGroupModal(group = null) {
    dyGroupModal.classList.add('active');
    dyGroupForm.reset();
    
    const iconInput = document.getElementById('datayard-group-icon');
    const iconOptions = document.querySelectorAll('#datayard-group-icon-selector .icon-option');
    
    if(group) {
      document.getElementById('datayardGroupModalTitle').textContent = "그룹 수정";
      document.getElementById('datayard-group-id').value = group.id;
      document.getElementById('datayard-group-title').value = group.category;
      document.getElementById('datayard-group-desc').value = group.description || '';
      const currentIcon = group.icon || 'fa-folder';
      iconInput.value = currentIcon;
      document.getElementById('datayard-group-color').value = group.color || 'blue';

      // 아이콘 선택 상태 반영
      iconOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === currentIcon);
      });
    } else {
      document.getElementById('datayardGroupModalTitle').textContent = "그룹 추가";
      document.getElementById('datayard-group-id').value = "";
      document.getElementById('datayard-group-desc').value = '';
      iconInput.value = 'fa-folder';
      iconOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === 'fa-folder');
      });
    }
  }

  // 자료마당 그룹 아이콘 선택 이벤트
  document.querySelectorAll('#datayard-group-icon-selector .icon-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#datayard-group-icon-selector .icon-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('datayard-group-icon').value = opt.dataset.icon;
    });
  });

  function openDatayardItemModal(groupId, itemIdx = null) {
    dyItemModal.classList.add('active');
    dyItemForm.reset();
    datayardFileToUpload = null;
    document.getElementById('datayard-file-preview').classList.add('hidden');
    document.getElementById('datayard-upload-progress').classList.add('hidden');
    
    document.getElementById('datayard-item-group-id').value = groupId;
    
    if(itemIdx !== null) {
      const group = localDatayardData.find(g => g.id === groupId);
      const item = group.items[itemIdx];
      document.getElementById('datayardItemModalTitle').textContent = "자료 수정";
      document.getElementById('datayard-item-id').value = itemIdx;
      document.getElementById('datayard-item-title').value = item.title;
      document.getElementById('datayard-item-url').value = item.url;
      document.getElementById('datayard-item-url-input').value = item.url;
      
      // 파일인지 URL인지 대략적으로 판단하여 탭 활성화
      const isUploadedFile = item.url.includes('firebasestorage') || item.url.includes('drive.google.com') || item.url.includes('mybox');
      if(isUploadedFile) {
         switchDyItemTab('upload');
         // 기존 파일이 있다는 표시
         document.getElementById('datayard-file-name-display').textContent = "기존 파일 유지 (변경하려면 파일 선택)";
         document.getElementById('datayard-file-preview').classList.remove('hidden');
      } else {
         switchDyItemTab('url');
      }
    } else {
      document.getElementById('datayardItemModalTitle').textContent = "자료 추가";
      document.getElementById('datayard-item-id').value = "";
      document.getElementById('datayard-item-url').value = "";
      switchDyItemTab('upload');
    }
  }

  function deleteDatayardGroup(groupId) {
    if(confirm("이 그룹과 포함된 모든 자료를 삭제하시겠습니까?")) {
      const index = localDatayardData.findIndex(g => g.id === groupId);
      if(index > -1) {
        const deletedGroup = localDatayardData[index];
        localDatayardData.splice(index, 1);
        // Firebase 삭제
        if(window.db) {
          const { db, firestoreUtils } = window;
          firestoreUtils.deleteDoc(firestoreUtils.doc(db, "datayardGroups", groupId));
          if(window.logUserAction) window.logUserAction('datayard', '삭제', `그룹 삭제: ${deletedGroup.category}`);
        }
        renderDatayard();
      }
    }
  }

  function deleteDatayardItem(groupId, itemIdx) {
    if(confirm("이 자료를 삭제하시겠습니까?")) {
      const group = localDatayardData.find(g => g.id === groupId);
      if(group) {
        const deletedItem = group.items[itemIdx];
        group.items.splice(itemIdx, 1);
        if(window.logUserAction && deletedItem) window.logUserAction('datayard', '삭제', `자료 삭제: ${deletedItem.title} (그룹: ${group.category})`);
        renderDatayard();
      }
    }
  }

  function switchDyItemTab(tab) {
    datayardActiveTab = tab;
    document.querySelectorAll('.item-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.item-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `item-tab-${tab}`);
    });
  }

  // 모달 이벤트 리스너
  document.querySelectorAll('.close-datayard-group-modal').forEach(btn => btn.addEventListener('click', () => dyGroupModal.classList.remove('active')));
  document.querySelectorAll('.close-datayard-item-modal').forEach(btn => btn.addEventListener('click', () => dyItemModal.classList.remove('active')));
  
  document.querySelectorAll('.item-tab').forEach(tab => {
    tab.addEventListener('click', () => switchDyItemTab(tab.dataset.tab));
  });

  // 파일 업로드 처리
  const dyFileInput = document.getElementById('datayard-file-input');
  const dyFileDropZone = document.getElementById('datayard-file-drop-zone');
  
  dyFileDropZone.addEventListener('click', () => dyFileInput.click());
  dyFileInput.addEventListener('change', (e) => handleDyFile(e.target.files[0]));
  
  dyFileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dyFileDropZone.classList.add('drag-over');
  });
  dyFileDropZone.addEventListener('dragleave', () => dyFileDropZone.classList.remove('drag-over'));
  dyFileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dyFileDropZone.classList.remove('drag-over');
    handleDyFile(e.dataTransfer.files[0]);
  });

  function handleDyFile(file) {
    if(!file) return;
    datayardFileToUpload = file;
    document.getElementById('datayard-file-name-display').textContent = file.name;
    document.getElementById('datayard-file-preview').classList.remove('hidden');
    // 자동 제목 입력 (비어있을 경우)
    const titleInput = document.getElementById('datayard-item-title');
    if(!titleInput.value) {
      titleInput.value = file.name.split('.').slice(0, -1).join('.');
    }
  }

  document.getElementById('datayard-remove-file-btn').addEventListener('click', () => {
    datayardFileToUpload = null;
    document.getElementById('datayard-file-preview').classList.add('hidden');
    dyFileInput.value = '';
  });

  // 그룹 저장
  dyGroupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id    = document.getElementById('datayard-group-id').value;
    const title = document.getElementById('datayard-group-title').value;
    const desc  = document.getElementById('datayard-group-desc').value.trim();
    const icon  = document.getElementById('datayard-group-icon').value;
    const color = document.getElementById('datayard-group-color').value;

    if(id) {
      // 수정
      const group = localDatayardData.find(g => g.id === id);
      group.category    = title;
      group.description = desc;
      group.icon        = icon;
      group.color       = color;
      if(window.logUserAction) window.logUserAction('datayard', '수정', `그룹 정보 수정: ${title}`);
    } else {
      // 추가
      const newId = `group-${Date.now()}`;
      localDatayardData.push({
        id: newId,
        category: title,
        description: desc,
        icon: icon,
        color: color,
        items: [],
        order: localDatayardData.length
      });
      if(window.logUserAction) window.logUserAction('datayard', '생성', `새 그룹 생성: ${title}`);
    }
    dyGroupModal.classList.remove('active');
    renderDatayard();
  });

  // 아이템 저장
  dyItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('datayard-item-group-id').value;
    const itemId = document.getElementById('datayard-item-id').value;
    const title = document.getElementById('datayard-item-title').value;
    let url = document.getElementById('datayard-item-url-input').value;

    const group = localDatayardData.find(g => g.id === groupId);

    // 파일 업로드 모드인 경우 (Google Drive)
    if (datayardActiveTab === 'upload' && datayardFileToUpload) {
      if (!window.driveUpload) {
        alert("Google Drive 업로드 모듈이 준비되지 않았습니다. 페이지를 새로고침해 주세요.");
        return;
      }
      if (!datayardDriveFolderId) {
        alert("Google Drive 폴더 ID를 먼저 설정해 주세요.\n편집 모드에서 'Drive 폴더 ID' 항목을 채워주세요.");
        return;
      }

      const progressArea = document.getElementById('datayard-upload-progress');
      const progressFill = progressArea.querySelector('.progress-fill');
      const progressText = progressArea.querySelector('.progress-text');

      progressArea.classList.remove('hidden');
      progressText.textContent = "Google 인증 중...";

      try {
        url = await window.driveUpload.uploadFile(
          datayardFileToUpload,
          datayardDriveFolderId,
          (pct) => {
            progressFill.style.width = pct + '%';
            progressText.textContent = '업로드 중... (' + pct + '%)';
          }
        );
        progressFill.style.width = '100%';
        progressText.textContent = '업로드 완료! (100%)';
      } catch (err) {
        console.error("Drive upload error:", err);
        alert("파일 업로드 중 오류가 발생했습니다:\n" + err.message);
        return;
      }
    } else if (datayardActiveTab === 'upload' && itemId !== "") {
       // 수정 모드인데 파일을 새로 선택 안 했으면 기존 URL 유지
       url = document.getElementById('datayard-item-url').value;
    }

    if(itemId !== "") {
      // 수정
      group.items[itemId] = { title, url };
      if(window.logUserAction) window.logUserAction('datayard', '수정', `자료 수정: ${title} (그룹: ${group.category})`);
    } else {
      // 추가
      group.items.push({ title, url });
      if(window.logUserAction) window.logUserAction('datayard', '생성', `새 자료 추가: ${title} (그룹: ${group.category})`);
    }

    dyItemModal.classList.remove('active');
    renderDatayard();
  });

  // 자료마당 편집 모드 토글
  const dyEditBtn = document.getElementById('datayard-edit-mode-btn');
  const dyEditActions = document.getElementById('datayard-edit-actions');
  const dyAddGroupBtn = document.getElementById('datayard-add-group-btn');
  const dySaveOrderBtn = document.getElementById('datayard-save-order-btn');
  const dyCancelEditBtn = document.getElementById('datayard-cancel-edit-btn'); // New Cancel Button

  let datayardBackup = null;

  if (dyEditBtn) {
    dyEditBtn.addEventListener('click', async () => {
      datayardEditMode = true;
      datayardBackup = JSON.parse(JSON.stringify(localDatayardData));
      dyEditBtn.classList.add('hidden');
      dyEditActions.classList.remove('hidden');

      // Load Drive folder ID from Firestore
      if (window.db) {
        try {
          const { db, firestoreUtils } = window;
          const configDoc = await firestoreUtils.getDoc(firestoreUtils.doc(db, 'settings', 'datayardDriveConfig'));
          if (configDoc.exists()) datayardDriveFolderId = configDoc.data().folderId || '';
        } catch (e) { /* ignore */ }
      }
      const folderInput = document.getElementById('datayard-drive-folder-id');
      if (folderInput) folderInput.value = datayardDriveFolderId;

      renderDatayard();
    });
  }

  dyAddGroupBtn.addEventListener('click', () => openDatayardGroupModal());

  dySaveOrderBtn.addEventListener('click', async () => {
    // Save Drive folder ID
    const folderInput = document.getElementById('datayard-drive-folder-id');
    if (folderInput) {
      const newId = folderInput.value.trim();
      if (newId !== datayardDriveFolderId && window.db) {
        try {
          const { db, firestoreUtils } = window;
          await firestoreUtils.setDoc(firestoreUtils.doc(db, 'settings', 'datayardDriveConfig'), { folderId: newId });
          datayardDriveFolderId = newId;
        } catch (e) { console.warn('Drive config save failed:', e); }
      } else {
        datayardDriveFolderId = newId;
      }
    }

    datayardEditMode = false;
    dyEditActions.classList.add('hidden');
    if (dyEditBtn) dyEditBtn.classList.remove('hidden');
    await saveDatayardToFirebase();
    renderDatayard();
  });

  dyCancelEditBtn.addEventListener('click', () => {
    if (confirm("저장하지 않은 변경사항은 사라집니다. 편집을 취소하시겠습니까?")) {
      datayardEditMode = false;
      if (datayardBackup) {
        localDatayardData = JSON.parse(JSON.stringify(datayardBackup));
      }
      dyEditActions.classList.add('hidden');
      if (dyEditBtn) dyEditBtn.classList.remove('hidden');
      renderDatayard();
    }
  });

  window.initDatayard = initDatayard;

  // 온학교 e지원 렌더링 함수 (원본 사이트 구조 1:1 재현 및 격리)
  function renderHelppage() {
    helppageSection.innerHTML = `
      <iframe src="helppage/index.html" id="helppage-iframe" scrolling="no" style="width: 100%; min-height: 100vh; border: none; background: transparent; display: block; overflow: hidden; position: relative; z-index: 1;"></iframe>
    `;
    helppageSection.style.padding = "0";
    helppageSection.style.overflow = "hidden";
    helppageSection.style.display = "flex";
    helppageSection.style.flexDirection = "column";

    // iframe 리사이징 이벤트 수신 (이중 스크롤바 방지)
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'resize') {
        const iframe = document.getElementById('helppage-iframe');
        if (iframe) {
          iframe.style.height = e.data.height + 'px';
        }
      }
    });
  }



  // ================= FullCalendar Logic =================
  // ================= FullCalendar Logic =================
  async function initCalendar() {
    if (calendar) {
      calendar.updateSize();
      return;
    }

    const calendarEl = document.getElementById('calendar');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const viewBtns = document.querySelectorAll('.view-btn');
    
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    // Helper: Firebase 데이터 로드
    const fetchEvents = async () => {
      if (!window.db) {
        return new Promise(resolve => {
          window.addEventListener('firebase-ready', () => resolve(fetchFromFirestore()));
          if (window.db) resolve(fetchFromFirestore());
        });
      }
      return fetchFromFirestore();
    };

    const fetchFromFirestore = async () => {
      const { db, firestoreUtils } = window;
      let existingEvents = [];
      const essentialEvents = [
        // 국경일 & 공휴일 (2026)
        { id: 'h1', title: '신정', start: '2026-01-01', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h2', title: '설날 연휴', start: '2026-02-16', end: '2026-02-20', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h3', title: '삼일절', start: '2026-03-01', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h3_sub', title: '대체공휴일', start: '2026-03-02', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h4', title: '어린이날', start: '2026-05-05', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h5', title: '부처님오신날', start: '2026-05-24', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h5_sub', title: '대체공휴일', start: '2026-05-25', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h6', title: '현충일', start: '2026-06-06', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h7', title: '제헌절', start: '2026-07-17', backgroundColor: '#4a90e2', borderColor: '#4a90e2', display: 'block', isHoliday: false },
        { id: 'h8', title: '광복절', start: '2026-08-15', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h8_sub', title: '대체공휴일', start: '2026-08-17', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h9', title: '추석 연휴', start: '2026-09-24', end: '2026-09-28', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h10', title: '개천절', start: '2026-10-03', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h10_sub', title: '대체공휴일', start: '2026-10-05', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h11', title: '한글날', start: '2026-10-09', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        { id: 'h12', title: '크리스마스', start: '2026-12-25', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'block', isHoliday: true },
        
        // 법정 기념일 & 주요 기념일
        { id: 'a1', title: '식목일', start: '2026-04-05', backgroundColor: '#10b981', borderColor: '#10b981', display: 'block' },
        { id: 'a2', title: '4.19 혁명 기념일', start: '2026-04-19', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a3', title: '근로자의 날', start: '2026-05-01', backgroundColor: '#f59e0b', borderColor: '#f59e0b', display: 'block' },
        { id: 'a4', title: '어버이날', start: '2026-05-08', backgroundColor: '#ec4899', borderColor: '#ec4899', display: 'block' },
        { id: 'a5', title: '스승의 날', start: '2026-05-15', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', display: 'block' },
        { id: 'a6', title: '5.18 민주화 운동 기념일', start: '2026-05-18', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a7', title: '국군의 날', start: '2026-10-01', backgroundColor: '#64748b', borderColor: '#64748b', display: 'block' },
        { id: 'a8', title: '독도의 날', start: '2026-10-25', backgroundColor: '#4a90e2', borderColor: '#4a90e2', display: 'block' },

        // 24절기
        { id: 's1', title: '절기: 입춘', start: '2026-02-04', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's2', title: '절기: 우수', start: '2026-02-19', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's3', title: '절기: 경칩', start: '2026-03-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's4', title: '절기: 춘분', start: '2026-03-20', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's5', title: '절기: 청명', start: '2026-04-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's6', title: '절기: 곡우', start: '2026-04-20', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's7', title: '절기: 입하', start: '2026-05-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's8', title: '절기: 소만', start: '2026-05-21', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's9', title: '절기: 망종', start: '2026-06-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's10', title: '절기: 하지', start: '2026-06-21', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's11', title: '절기: 소서', start: '2026-07-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's12', title: '절기: 대서', start: '2026-07-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's13', title: '절기: 입추', start: '2026-08-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's14', title: '절기: 처서', start: '2026-08-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's15', title: '절기: 백로', start: '2026-09-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's16', title: '절기: 추분', start: '2026-09-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's17', title: '절기: 한로', start: '2026-10-08', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's18', title: '절기: 상강', start: '2026-10-23', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's19', title: '절기: 입동', start: '2026-11-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's20', title: '절기: 소설', start: '2026-11-22', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's21', title: '절기: 대설', start: '2026-12-07', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's22', title: '절기: 동지', start: '2026-12-22', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's23', title: '절기: 소한', start: '2027-01-05', backgroundColor: '#22c55e', display: 'list-item' },
        { id: 's24', title: '절기: 대한', start: '2027-01-20', backgroundColor: '#22c55e', display: 'list-item' }
      ];

      try {
        const querySnapshot = await firestoreUtils.getDocs(firestoreUtils.collection(db, "calendarEvents"));
        querySnapshot.forEach((docSnap) => {
          existingEvents.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // 필수 일정이 누락된 경우 Firebase에 추가
        const existingIds = new Set(existingEvents.map(e => e.id));
        const missingEvents = essentialEvents.filter(e => !existingIds.has(e.id));
        
        if (missingEvents.length > 0) {
          for (const ev of missingEvents) {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "calendarEvents", ev.id), ev);
            existingEvents.push(ev);
          }
        }
      } catch (err) {
        console.error("Firebase fetch error:", err);
      }
      return existingEvents;
    };

    const savedEvents = await fetchEvents();

    try {
      const calendarOptions = {
        views: {
          multiMonthAcademic: {
            type: 'multiMonth',
            duration: { months: 12 },
            titleFormat: (info) => {
              const year = info.date.year;
              const month = info.date.month + 1;
              return year === 2026 ? month + '월' : year + '년 ' + month + '월';
            }
          },
          multiMonth2: {
            type: 'multiMonth',
            duration: { months: 2 }
          }
        },
        initialView: 'dayGridMonth', // 기본 1달 보기
        initialDate: '2026-03-01',
        multiMonthMaxColumns: 3,
        locale: 'ko',
        editable: true,
        selectable: true,
        dragScroll: true,
        eventDragMinDistance: 5,
        windowResizeDelay: 100,
        dragRevertDuration: 0,
        headerToolbar: false,
        events: savedEvents,
        height: 'auto',
        
        dayCellContent: arg => arg.dayNumberText.replace('일', ''),
        select: info => openModal(info.startStr, info.endStr),
        eventClick: info => openModal(null, null, info.event),
        eventChange: async info => await saveEventToFirebase(info.event),
        
        // 날짜/뷰 변경 시 제목 업데이트
        datesSet: function(dateInfo) {
          const monthEl = document.getElementById('calendar-current-month');
          if (!monthEl) return;

          if (dateInfo.view.type === 'multiMonthAcademic') {
            monthEl.style.display = 'none'; // 전체보기 시 중복 방지
          } else {
            monthEl.style.display = 'block';
            // FullCalendar의 view.title을 활용 (예: "2026년 3월" 또는 "2026년 3월 – 4월")
            monthEl.textContent = dateInfo.view.title;
          }
        },
        
        dayCellClassNames: function(arg) {
          const dateStr = formatDate(arg.date);
          const events = arg.view.calendar.getEvents();
          const hasHoliday = events.some(event => {
            if (!event.extendedProps.isHoliday) return false;
            const eventStart = event.startStr.split('T')[0];
            let eventEnd = event.endStr ? event.endStr.split('T')[0] : eventStart;
            if (eventStart === eventEnd && !event.endStr) {
               const d = new Date(eventStart);
               d.setDate(d.getDate() + 1);
               eventEnd = formatDate(d);
            }
            return dateStr >= eventStart && dateStr < eventEnd;
          });
          return hasHoliday ? ['fc-day-has-holiday'] : [];
        }
      };

      calendar = new FullCalendar.Calendar(calendarEl, calendarOptions);
      calendar.render();

      // Ensure proper sizing after render
      setTimeout(() => { if(calendar) calendar.updateSize(); }, 200);

      // Force update when tab becomes visible
      const calendarSection = document.getElementById('calendar-section');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && !calendarSection.classList.contains('hidden')) {
                 setTimeout(() => { if(calendar) calendar.updateSize(); }, 100);
            }
        });
      });
      observer.observe(calendarSection, { attributes: true });

      // --- 통합 애니메이션 트리거 함수 ---
      const triggerTransition = (action) => {
        const wrapper = document.querySelector('.calendar-wrapper');
        wrapper.classList.add('view-transitioning');
        
        setTimeout(() => {
          action(); // 실제 이동/전환 수행
          if (calendar) calendar.updateSize(); // 레이아웃 재계산 강제
          
          setTimeout(() => {
            wrapper.classList.remove('view-transitioning');
            if (calendar) calendar.updateSize(); // 애니메이션 종료 후 최종 확인
          }, 300); // 페이드 인/스케일 업 시간
        }, 150); // 페이드 아웃/스케일 다운 대기 시간
      };

      // 보기 방식 전환 이벤트
      viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const viewName = btn.dataset.view;
          if (calendar.view.type === viewName) return;

          triggerTransition(() => {
            let cols = 1;
            if (viewName === 'multiMonth2') cols = 2;
            if (viewName === 'multiMonthAcademic') cols = 3;
            
            calendar.setOption('multiMonthMaxColumns', cols);
            calendar.changeView(viewName);
            
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (viewName === 'multiMonthAcademic') {
              prevBtn.classList.add('hidden');
              nextBtn.classList.add('hidden');
            } else {
              prevBtn.classList.remove('hidden');
              nextBtn.classList.remove('hidden');
            }
          });
        });
      });

      // 네비게이션 화살표 이벤트
      prevBtn.addEventListener('click', () => triggerTransition(() => calendar.prev()));
      nextBtn.addEventListener('click', () => triggerTransition(() => calendar.next()));

      // 통합 마우스 휠 네비게이션 (역동적 전환 효과 포함)
      const container = document.querySelector('.calendar-container');
      let isThrottled = false;
      
      container.addEventListener('wheel', (e) => {
        const currentView = calendar.view.type;
        if (currentView === 'multiMonthAcademic') return; 

        e.preventDefault();
        if (isThrottled) return;
        
        if (Math.abs(e.deltaY) > 20) {
          isThrottled = true;
          const direction = e.deltaY > 0 ? 'next' : 'prev';
          
          triggerTransition(() => {
            if (direction === 'next') calendar.next();
            else calendar.prev();
          });

          setTimeout(() => { isThrottled = false; }, 800); // 과도한 휠 조작 방지
        }
      }, { passive: false });

      setTimeout(() => { if (calendar) calendar.updateSize(); }, 500);

    } catch (err) {
      console.error('FullCalendar Error:', err);
    }
  }

  // Firebase 저장 도우미
  async function saveEventToFirebase(fcEvent) {
    if (!window.db) return;
    const { db, firestoreUtils } = window;
    try {
      await firestoreUtils.setDoc(firestoreUtils.doc(db, "calendarEvents", fcEvent.id), {
        title: fcEvent.title,
        start: fcEvent.startStr,
        end: fcEvent.endStr,
        backgroundColor: fcEvent.backgroundColor,
        borderColor: fcEvent.borderColor,
        isHoliday: fcEvent.extendedProps.isHoliday || false, // 공휴일 여부 저장
        description: fcEvent.extendedProps.description || ""
      });
      // 데이터 변경 후 달력 다시 그리기 (날짜 색상 업데이트용)
      calendar.view.calendar.releaseAfterRender = true;
      calendar.render();
      if (window.updateTodayWidget) window.updateTodayWidget(); // 위젯 업데이트
    } catch (err) {
      console.error("Firebase save error:", err);
    }
  }

  // 모달 관련 요소
  const eventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  const deleteBtn = document.getElementById('deleteEventBtn');
  const holidayCheckbox = document.getElementById('event-is-holiday');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const colorOptions = document.querySelectorAll('.color-option');
  let selectedColor = '#4a90e2';

  // 모달 열기
  function openModal(start, end, event = null) {
    eventModal.classList.add('active');
    eventForm.reset();
    
    if (event) {
      document.getElementById('modalTitle').textContent = '일정 수정';
      document.getElementById('event-id').value = event.id;
      document.getElementById('event-title').value = event.title;
      document.getElementById('event-start').value = formatDate(event.start);
      document.getElementById('event-end').value = event.end ? formatDate(event.end, -1) : formatDate(event.start);
      document.getElementById('event-description').value = event.extendedProps.description || '';
      holidayCheckbox.checked = event.extendedProps.isHoliday || false; // 체크박스 상태 복구
      selectedColor = event.backgroundColor;
      deleteBtn.classList.remove('hidden');
    } else {
      document.getElementById('modalTitle').textContent = '일정 등록';
      document.getElementById('event-id').value = '';
      document.getElementById('event-start').value = start;
      let endDate = new Date(end);
      endDate.setDate(endDate.getDate() - 1);
      document.getElementById('event-end').value = formatDate(endDate);
      holidayCheckbox.checked = false; // 기본값: 미체크
      deleteBtn.classList.add('hidden');
      selectedColor = '#4a90e2';
    }
    updateColorPicker();
  }

  function closeModal() {
    eventModal.classList.remove('active');
  }

  closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
  window.addEventListener('click', (e) => { if(e.target === eventModal) closeModal(); });

  colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedColor = opt.dataset.color;
      updateColorPicker();
    });
  });

  function updateColorPicker() {
    colorOptions.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.color === selectedColor);
    });
  }



  // 일정 저장 (등록/수정)
  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('event-id').value || Date.now().toString();
    const title = document.getElementById('event-title').value;
    const start = document.getElementById('event-start').value;
    const endInput = document.getElementById('event-end').value;
    const description = document.getElementById('event-description').value;
    const isHoliday = holidayCheckbox.checked;

    let endDate = new Date(endInput);
    endDate.setDate(endDate.getDate() + 1);
    const endFormatted = endDate.toISOString().split('T')[0];

    // 공휴일 체크 시 강제 빨간색, 아닐 경우 선택 색상 사용
    const finalColor = isHoliday ? '#ef4444' : selectedColor;

    const eventData = {
      id: id,
      title: title,
      start: start,
      end: endFormatted,
      backgroundColor: finalColor,
      borderColor: finalColor,
      extendedProps: { 
        description: description,
        isHoliday: isHoliday 
      }
    };

    const existingEvent = calendar.getEventById(id);
    if (existingEvent) {
      existingEvent.remove();
    }
    calendar.addEvent(eventData);
    
    // Firebase 저장
    await saveEventToFirebase(calendar.getEventById(id));
    closeModal();
    // 가시성 클래스 업데이트를 위해 렌더링 호출
    calendar.render();
  });

  // 일정 삭제
  deleteBtn.addEventListener('click', async () => {
    const id = document.getElementById('event-id').value;
    const event = calendar.getEventById(id);
    if (event && confirm('이 일정을 삭제하시겠습니까?')) {
      if (window.db) {
        const { db, firestoreUtils } = window;
        await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "calendarEvents", id));
      }
      event.remove();
      closeModal();
      calendar.render(); // 날짜 색상 복구
      if (window.updateTodayWidget) window.updateTodayWidget(); // 위젯 업데이트
    }
  });


    /* ================= 학교계정 (School Account) Logic ================= */
  let localAccountData = [];
  let accountEditMode = false;
  let currentAccountCategory = "기관 계정";
  let accountSortable = null;
  let accountGroupSortable = null;

  // 기본 카테고리 설정 (초기 로딩용)
  let accountCategories = [
    { id: "cat1", name: "기관 계정", desc: "학교 및 교육청 관련 주요 기관 계정 목록입니다.", icon: "fa-university", order: 0 },
    { id: "cat2", name: "쇼핑몰", desc: "업무 물품 구매를 위한 쇼핑몰 계정 목록입니다.", icon: "fa-shopping-cart", order: 1 },
    { id: "cat3", name: "메일 및 문자", desc: "공용 메일 및 문자 발송 서비스 계정 목록입니다.", icon: "fa-envelope", order: 2 },
    { id: "cat4", name: "교수학습", desc: "수업 및 학습 지원 도구 관련 계정 목록입니다.", icon: "fa-chalkboard-teacher", order: 3 },
    { id: "cat5", name: "기기 및 보안", desc: "학교 기기 관리 및 보안 관련 계정 목록입니다.", icon: "fa-shield-alt", order: 4 },
    { id: "cat6", name: "업무용 SW", desc: "행정 및 교육 업무용 소프트웨어 계정 목록입니다.", icon: "fa-laptop-code", order: 5 },
    { id: "cat7", name: "안전, 복지 업무", desc: "학생 안전 및 교직원 복지 관련 계정 목록입니다.", icon: "fa-heartbeat", order: 6 }
  ];

  window.initAccount = async function() {
    await loadAccountCategories();
    if (localAccountData.length === 0) {
      await loadAccountsFromFirebase();
    } else {
      renderAccountCards();
    }
    renderAccountSidebar();
    initAccountEditing();
  }

  async function loadAccountCategories() {
    const { db, firestoreUtils } = window;
    if (!db) return;
    try {
        const q = firestoreUtils.query(firestoreUtils.collection(db, "accountCategories"), firestoreUtils.orderBy("order"));
        const snapshot = await firestoreUtils.getDocs(q);
        if (!snapshot.empty) {
            accountCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading categories:", err);
    }
  }

  function renderAccountSidebar() {
    const menu = document.getElementById("account-category-menu");
    if (!menu) return;
    menu.innerHTML = "";
    
    accountCategories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `account-nav-item ${currentAccountCategory === cat.name ? 'active' : ''}`;
        btn.dataset.id = cat.id;
        
        btn.innerHTML = `
            <i class="fas ${cat.icon}"></i>
            <span class="nav-label">${cat.name}</span>
            ${accountEditMode ? `
                <div class="category-edit-btns">
                    <span class="cat-edit-btn" onclick="event.stopPropagation(); window.openAccountGroupModal('${cat.id}')"><i class="fas fa-cog"></i></span>
                </div>
            ` : ""}
        `;
        
        btn.onclick = () => {
            currentAccountCategory = cat.name;
            renderAccountSidebar();
            window.accountSearchQuery = "";
            renderAccountCards();
        };

        // 드롭 타겟 설정 (계정 이동용)
        btn.ondragover = (e) => {
            if (!accountEditMode || accountGroupSortable) return;
            e.preventDefault();
            btn.classList.add("drag-over");
        };
        btn.ondragleave = () => btn.classList.remove("drag-over");
        btn.ondrop = async (e) => {
            if (!accountEditMode || accountGroupSortable) return;
            e.preventDefault();
            btn.classList.remove("drag-over");
            const accountId = e.dataTransfer.getData("text/plain");
            if (accountId) {
                await moveAccountsToCategory([accountId], cat.name);
            }
        };
        menu.appendChild(btn);
    });

    if (accountEditMode && window.Sortable) {
        if (accountGroupSortable) accountGroupSortable.destroy();
        accountGroupSortable = new Sortable(menu, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async () => {
                const newOrder = Array.from(menu.children).map((child, idx) => ({
                    id: child.dataset.id,
                    order: idx
                }));
                const { db, firestoreUtils } = window;
                for (const item of newOrder) {
                    const cat = accountCategories.find(c => c.id === item.id);
                    if (cat) cat.order = item.order;
                    await firestoreUtils.updateDoc(firestoreUtils.doc(db, "accountCategories", item.id), { order: item.order });
                }
                accountCategories.sort((a, b) => a.order - b.order);
            }
        });
    } else {
        if (accountGroupSortable) {
            accountGroupSortable.destroy();
            accountGroupSortable = null;
        }
    }
  }

  // 키워드 검색 핸들러
  window.handleAccountSearch = (query) => {
    window.accountSearchQuery = (query || "").toLowerCase().trim();
    renderAccountCards();
  };

  function moveAccountsToCategory(ids, targetCat) {
    let movedCount = 0;
    localAccountData.forEach(acc => {
      if (ids.includes(acc.id)) {
        acc.category = targetCat;
        movedCount++;
      }
    });
    if (movedCount > 0) {
      alert(`${movedCount}개의 계정을 '${targetCat}' 그룹으로 이동했습니다.`);
      renderAccountCards();
    }
  }

  window.resetAccountView = () => {
    currentAccountCategory = "기관 계정";
    const sidebarBtns = document.querySelectorAll(".account-nav-item");
    sidebarBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.accountCat === currentAccountCategory);
    });
    renderAccountCards();
  };

  async function loadAccountsFromFirebase() {
    if (!window.db) {
      localAccountData = [];
      renderAccountCards();
      return;
    }
    const { db, firestoreUtils } = window;
    try {
      const q = firestoreUtils.query(firestoreUtils.collection(db, "schoolAccounts"));
      const querySnapshot = await firestoreUtils.getDocs(q);
      const loaded = [];
      querySnapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      loaded.sort((a, b) => (a.order || 0) - (b.order || 0));
      localAccountData = loaded;
      renderAccountCards();
    } catch (err) {
      console.error("Account load error:", err);
      renderAccountCards();
    }
  }

  function renderAccountCards() {
    const container = document.getElementById("account-card-container");
    const titleEl = document.getElementById("current-account-category-title");
    const descEl = document.getElementById("account-category-description");
    const moveControls = document.getElementById("account-bulk-move-controls");
    const editModeBtn = document.getElementById("account-edit-mode-btn");
    const editActions = document.getElementById("account-edit-actions");
    
    if (!container) return;

    // 편집 모드 상태에 따른 UI 가시성 동기화
    const userRole = window.currentUserRole || 'user';
    const isAdminUser = (userRole === 'admin' || userRole === 'sub-admin');

    if (accountEditMode) {
        if (moveControls) moveControls.classList.remove("hidden");
        if (editModeBtn) editModeBtn.classList.add("hidden");
        if (editActions) editActions.classList.remove("hidden");
    } else {
        if (moveControls) moveControls.classList.add("hidden");
        if (editActions) editActions.classList.add("hidden");
        // 편집 버튼은 관리자일 때만 노출
        if (editModeBtn) {
            if (isAdminUser) editModeBtn.classList.remove("hidden");
            else editModeBtn.classList.add("hidden");
        }
    }

    container.innerHTML = "";
    
    let filtered = [];
    const query = window.accountSearchQuery || "";
    
    try {
        if (query) {
            if (titleEl) titleEl.textContent = `전체 검색 결과: "${query}"`;
            if (descEl) {
                descEl.classList.remove("hidden");
                descEl.textContent = `"${query}" 검색 결과입니다.`;
                descEl.style.left = '0px'; // 검색 결과일 때는 좌측 고정
            }
            if (Array.isArray(localAccountData)) {
                filtered = localAccountData.filter(acc => {
                    if (!acc) return false;
                    // 데이터 타입에 상관없이 안전하게 문자열로 변환 후 비교
                    const s = String(acc.service || "").toLowerCase();
                    const u = String(acc.username || "").toLowerCase();
                    const n = String(acc.note || "").toLowerCase();
                    const k = String(acc.authCode || "").toLowerCase();
                    return s.includes(query) || u.includes(query) || n.includes(query) || k.includes(query);
                });
            }
        } else {
            if (titleEl) titleEl.textContent = currentAccountCategory;
            if (descEl) {
                descEl.classList.remove("hidden");
                const catObj = accountCategories.find(c => c.name === currentAccountCategory);
                descEl.textContent = catObj?.desc || "";
                
                // 위치 자동 배치 로직
                setTimeout(() => {
                    const activeBtn = document.querySelector('.account-nav-item.active');
                    const descContainer = document.getElementById('account-category-description-container');
                    if (activeBtn && descContainer) {
                        const btnRect = activeBtn.getBoundingClientRect();
                        const containerRect = descContainer.getBoundingClientRect();
                        let leftPos = btnRect.left - containerRect.left;
                        
                        // 화면 오른쪽을 넘어가지 않도록 방어 로직
                        if (leftPos + descEl.offsetWidth > containerRect.width) {
                            leftPos = containerRect.width - descEl.offsetWidth;
                        }
                        // 왼쪽도 벗어나지 않도록 보장
                        if (leftPos < 0) leftPos = 0;
                        
                        descEl.style.left = leftPos + 'px';
                    }
                }, 10);
            }
            if (Array.isArray(localAccountData)) {
                filtered = localAccountData.filter(acc => acc && (acc.category || "기관 계정") === currentAccountCategory);
            }
        }
    } catch (filterError) {
        console.error("Filter error:", filterError);
        container.innerHTML = `<div class="no-data-msg">검색 처리 중 오류가 발생했습니다.</div>`;
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="no-data-msg">${query ? '검색 결과가 없습니다.' : '등록된 계정 정보가 없습니다.'}</div>`;
    } else {
      filtered.forEach((acc, index) => {
        const card = document.createElement("div");
        card.className = `account-card ${accountEditMode ? 'edit-mode' : ''} animate-fade-in`;
        card.dataset.id = acc.id;
        card.draggable = accountEditMode;
        card.style.animationDelay = `${Math.min(index * 0.02, 0.4)}s`; // Staggered entry (max 0.4s)

        // 드래그 시작 시 ID 저장
        card.ondragstart = (e) => {
          if(!accountEditMode) return;
          e.dataTransfer.setData("text/plain", acc.id);
        };

        let logoHtml = "";
        if (acc.iconType === 'custom' || (acc.icon && (acc.icon.startsWith('http') || acc.icon.startsWith('data:')))) {
            logoHtml = `<img src="${acc.icon}" class="account-card-logo" onerror="this.src='./favicon.png'">`;
        } else if (acc.icon) {
            logoHtml = `<div class="account-card-logo-placeholder"><i class="fas ${acc.icon}"></i></div>`;
        } else if (acc.url && String(acc.url).startsWith('http')) {
            try {
                const host = new URL(acc.url).hostname;
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
                logoHtml = `<img src="${faviconUrl}" class="account-card-logo" onerror="this.src='./favicon.png'">`;
            } catch (urlError) {
                logoHtml = `<div class="account-card-logo-placeholder"><i class="fas fa-lock"></i></div>`;
            }
        } else {
            logoHtml = `<div class="account-card-logo-placeholder"><i class="fas fa-lock"></i></div>`;
        }

        card.innerHTML = `
          ${accountEditMode ? `<input type="checkbox" class="account-card-select" data-id="${acc.id}">` : ""}
          <div class="account-card-header">
            ${logoHtml}
            <div class="account-card-title">
              ${acc.service}
              ${acc.url ? `<a href="${acc.url}" target="_blank" class="account-card-link" title="사이트 이동"><i class="fas fa-external-link-alt"></i></a>` : ""}
            </div>
          </div>
          <div class="account-info-group">
            ${acc.showId !== false ? `
            <div class="account-info-row id-row" onclick="window.copyToClipboard('${acc.username || ''}', this, '${acc.service}', '아이디')">
              <span class="info-label id-lbl">ID</span>
              <div class="info-value-group">
                <span class="info-value">${acc.username || ''}</span>
                <button class="copy-btn"><i class="fas fa-copy"></i></button>
              </div>
            </div>
            ` : ''}
            ${acc.showPassword !== false ? `
            <div class="account-info-row pw-row" onclick="window.copyToClipboard('${acc.password || ''}', this, '${acc.service}', '비밀번호')">
              <span class="info-label pw-lbl">PW</span>
              <div class="info-value-group">
                <span class="info-value">${acc.password || ''}</span>
                <button class="copy-btn"><i class="fas fa-copy"></i></button>
              </div>
            </div>
            ` : ''}
            ${acc.authCode && acc.showAuthCode !== false ? `
            <div class="account-info-row key-row" onclick="window.copyToClipboard('${acc.authCode.replace(/'/g, "\\'")}', this, '${acc.service}', '인증코드')">
              <span class="info-label key-lbl">KEY</span>
              <div class="info-value-group">
                <span class="info-value" style="font-family:ui-monospace,monospace;letter-spacing:0.04em;font-size:0.82rem;">${acc.authCode}</span>
                <button class="copy-btn"><i class="fas fa-copy"></i></button>
              </div>
            </div>
            ` : ''}
          </div>
          ${acc.note || accountEditMode ? `
            <div class="account-card-footer">
              <div class="account-card-note">${acc.note || ""}</div>
              ${accountEditMode ? `
                <div class="account-card-actions">
                  <button class="btn-icon btn-edit-sm" onclick="openAccountModal('${acc.id}')"><i class="fas fa-edit"></i></button>
                  <button class="btn-icon btn-delete-sm" onclick="deleteAccount('${acc.id}')"><i class="fas fa-trash"></i></button>
                </div>
              ` : ""}
            </div>
          ` : ""}
        `;
        container.appendChild(card);
      });
    }

    if (accountEditMode) {
      initAdvancedSorting();
    } else if (accountSortable) {
      accountSortable.destroy();
      accountSortable = null;
    }
  }

  function initAdvancedSorting() {
    const container = document.getElementById("account-card-container");
    if (!container || typeof Sortable === "undefined") return;
    
    if (accountSortable) accountSortable.destroy();
    
    accountSortable = new Sortable(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      handle: '.account-card',
      onEnd: function () {
        // 현재 렌더링된 순서대로 localAccountData 업데이트
        const newOrderIds = Array.from(container.querySelectorAll(".account-card")).map(c => c.dataset.id);
        const otherCategoryAccounts = localAccountData.filter(acc => (acc.category || "기관 계정") !== currentAccountCategory);
        const currentCategoryAccounts = [];
        
        newOrderIds.forEach((id, idx) => {
          const acc = localAccountData.find(a => a.id === id);
          if (acc) {
            acc.order = idx;
            currentCategoryAccounts.push(acc);
          }
        });

        localAccountData = [...otherCategoryAccounts, ...currentCategoryAccounts];
      }
    });
  }

  function initAccountEditing() {
    const editModeBtn = document.getElementById("account-edit-mode-btn");
    const editActions = document.getElementById("account-edit-actions");
    const addBtn = document.getElementById("account-add-btn");
    const saveBtn = document.getElementById("account-save-btn");
    const cancelBtn = document.getElementById("account-cancel-btn");

    if (!editModeBtn) return;

    editModeBtn.onclick = () => {
      accountEditMode = true;
      editModeBtn.classList.add("hidden");
      editActions.classList.remove("hidden");
      
      // 일괄 이동 컨트롤 노출 및 드롭다운 채우기
      const moveControls = document.getElementById("account-bulk-move-controls");
      const moveSelect = document.getElementById("account-move-target-cat");
      if (moveControls && moveSelect) {
          moveControls.classList.remove("hidden");
          moveSelect.innerHTML = '<option value="">이동할 그룹 선택...</option>';
          accountCategories.forEach(cat => {
              const opt = document.createElement("option");
              opt.value = cat.name;
              opt.textContent = cat.name;
              moveSelect.appendChild(opt);
          });
      }
      
      renderAccountSidebar(); // 사이드바 편집 버튼 노출
      renderAccountCards();
    };

    addBtn.onclick = () => openAccountModal();

    cancelBtn.onclick = () => {
      if (confirm("변경사항을 취소하시겠습니까?")) {
        accountEditMode = false;
        editActions.classList.add("hidden");
        editModeBtn.classList.remove("hidden");
        
        // 일괄 이동 컨트롤 숨김
        const moveControls = document.getElementById("account-bulk-move-controls");
        if (moveControls) moveControls.classList.add("hidden");
        
        renderAccountSidebar(); // 사이드바 편집 버튼 숨김
        loadAccountsFromFirebase(); 
        loadAccountCategories(); // 카테고리도 다시 로드
      }
    };

    saveBtn.onclick = async () => {
      if (window.db) {
        const { db, firestoreUtils } = window;
        try {
          // 1. 계정 데이터 저장
          for (const acc of localAccountData) {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "schoolAccounts", acc.id), acc);
          }
          // 2. 카테고리 데이터는 개별 저장 기능에서 이미 처리되지만, 정렬 순서 보장을 위해 재저장
          for (const cat of accountCategories) {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "accountCategories", cat.id), {
                name: cat.name,
                desc: cat.desc,
                icon: cat.icon,
                order: cat.order
            });
          }
          
          alert("모든 변경사항이 저장되었습니다.");
          if (window.logUserAction) window.logUserAction('account', '저장', '계정 및 카테고리 설정을 저장했습니다.');
          
          accountEditMode = false;
          editActions.classList.add("hidden");
          editModeBtn.classList.remove("hidden");
          
          // 일괄 이동 컨트롤 숨김
          const moveControls = document.getElementById("account-bulk-move-controls");
          if (moveControls) moveControls.classList.add("hidden");
          
          renderAccountSidebar(); // 사이드바 편집 버튼 숨김
          renderAccountCards();
        } catch (err) {
          console.error(err);
          alert("저장 중 오류가 발생했습니다.");
        }
      }
    };

    const importBtn = document.getElementById("account-import-btn");
    const excelInput = document.getElementById("account-excel-input");
    if(importBtn && excelInput) {
        importBtn.onclick = () => excelInput.click();
        excelInput.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            handleAccountExcelImport(file);
            e.target.value = ''; 
        };
    }

    const templateBtn = document.getElementById("account-template-btn");
    if(templateBtn) {
        templateBtn.onclick = () => downloadAccountExcelTemplate();
    }
  }

  window.moveSelectedAccounts = () => {
    const targetCat = document.getElementById("account-move-target-cat").value;
    if (!targetCat) {
      alert("이동할 대상 그룹을 먼저 선택해주세요.");
      return;
    }

    const selectedCheckboxes = document.querySelectorAll(".account-card-select:checked");
    const idsToMove = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

    if (idsToMove.length === 0) {
      alert("이동할 계정을 하나 이상 선택해주세요.");
      return;
    }

    if (confirm(`선택한 ${idsToMove.length}개의 계정을 '${targetCat}' 그룹으로 이동하시겠습니까?`)) {
      moveAccountsToCategory(idsToMove, targetCat);
      alert(`이동되었습니다. '저장 완료' 버튼을 눌러야 최종 반영됩니다.`);
    }
  };

  function handleAccountExcelImport(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);

              if (jsonData.length === 0) {
                  alert("엑셀 파일에 데이터가 없습니다.");
                  return;
              }

              const newAccounts = jsonData.map((row, idx) => {
                  return {
                      id: "acc-" + Date.now() + "-" + idx,
                      category: row['카테고리'] || row['Category'] || "기관 계정",
                      service: row['서비스명'] || row['Service'] || "미지정 서비스",
                      url: row['URL'] || row['Link'] || "",
                      username: row['아이디'] || row['ID'] || "",
                      password: row['비밀번호'] || row['PW'] || "",
                      note: row['비고'] || row['Note'] || "",
                      order: localAccountData.length + idx
                  };
              });

              localAccountData = [...localAccountData, ...newAccounts];
              renderAccountCards();
              alert(`${newAccounts.length}개의 계정 정보가 추가되었습니다. '저장 완료'를 눌러야 반영됩니다.`);
          } catch (err) {
              console.error("Excel import error:", err);
              alert("엑셀 형식 오류입니다.");
          }
      };
      reader.readAsArrayBuffer(file);
  }

  function downloadAccountExcelTemplate() {
      const templateData = [
          { "카테고리": "기관 계정", "서비스명": "구글 워크스페이스", "URL": "https://google.com", "아이디": "admin", "비밀번호": "pass", "비고": "예시" },
          { "카테고리": "쇼핑몰", "서비스명": "G마켓", "URL": "https://gmarket.co.kr", "아이디": "id", "비밀번호": "pw", "비고": "구매용" }
      ];
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "서식");
      XLSX.writeFile(workbook, "학교계정_서식.xlsx");
  }

  // --- Account Item Icon Management ---
  const ACCOUNT_ICON_LIST = [
      "fa-university", "fa-school", "fa-shopping-cart", "fa-envelope", "fa-chalkboard-teacher", 
      "fa-shield-alt", "fa-laptop-code", "fa-heartbeat", "fa-book", "fa-briefcase", 
      "fa-globe", "fa-tools", "fa-user-graduate", "fa-bus", "fa-coffee", 
      "fa-star", "fa-cog", "fa-folder", "fa-file-alt", "fa-chart-bar",
      "fa-users", "fa-id-card", "fa-print", "fa-database", "fa-lock", "fa-key", "fa-link"
  ];

  let accountSelectedIcon = 'fa-lock';
  let accountSelectedIconType = 'preset';
  let accountCustomIconData = '';

  function renderAccountItemIconPicker(selectedIcon = "") {
      const grid = document.getElementById('account-icon-selector');
      if (!grid) return;
      grid.innerHTML = ACCOUNT_ICON_LIST.map(icon => `
          <div class="icon-option ${icon === selectedIcon ? 'selected' : ''}" data-icon="${icon}" onclick="window.selectAccountItemIcon('${icon}')">
              <i class="fas ${icon}"></i>
          </div>
      `).join('');
  }

  window.selectAccountItemIcon = (icon) => {
      accountSelectedIcon = icon;
      document.querySelectorAll('#account-icon-selector .icon-option').forEach(opt => {
          opt.classList.toggle('selected', opt.dataset.icon === icon);
      });
  };

  // --- Account Group Icon Picker ---
  function renderAccountGroupIconPicker(selectedIcon = "") {
      const grid = document.getElementById('account-group-icon-selector');
      if (!grid) return;
      grid.innerHTML = ACCOUNT_ICON_LIST.map(icon => `
          <div class="icon-option ${icon === selectedIcon ? 'selected' : ''}" data-icon="${icon}" onclick="window.selectAccountGroupIcon('${icon}')">
              <i class="fas ${icon}"></i>
          </div>
      `).join('');
      
      // Initialize preview
      const previewBox = document.getElementById('account-group-icon-preview');
      if (previewBox) {
          previewBox.innerHTML = selectedIcon ? `<i class="fas ${selectedIcon}"></i>` : '<i class="fas fa-question"></i>';
      }
  }

  window.selectAccountGroupIcon = (icon) => {
      document.getElementById('account-group-icon').value = icon;
      const previewBox = document.getElementById('account-group-icon-preview');
      if (previewBox) {
          previewBox.innerHTML = `<i class="fas ${icon}"></i>`;
      }
      
      document.querySelectorAll('#account-group-icon-selector .icon-option').forEach(opt => {
          opt.classList.toggle('selected', opt.dataset.icon === icon);
      });
  };

  // Sync text input changes to preview and picker
  document.getElementById('account-group-icon')?.addEventListener('input', (e) => {
      const icon = e.target.value.trim();
      const previewBox = document.getElementById('account-group-icon-preview');
      if (previewBox) {
          previewBox.innerHTML = `<i class="fas ${icon}"></i>`;
      }
      document.querySelectorAll('#account-group-icon-selector .icon-option').forEach(opt => {
          opt.classList.toggle('selected', opt.dataset.icon === icon);
      });
  });

  // Account Modal Tab Events
  document.querySelectorAll('#account-icon-type-tabs .icon-tab').forEach(tab => {
      tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          document.querySelectorAll('#account-icon-type-tabs .icon-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('#accountModal .icon-tab-content').forEach(c => c.classList.remove('active'));
          const content = document.getElementById(`account-icon-tab-${target}`);
          if (content) content.classList.add('active');
          accountSelectedIconType = target;
      });
  });

  // Account Custom Image Handlers
  const accImgFile = document.getElementById('account-image-file');
  const accImgUrl = document.getElementById('account-image-url');
  const accImgPreview = document.getElementById('account-image-preview');
  const accPreviewImg = accImgPreview?.querySelector('img');
  const accClearBtn = document.getElementById('account-clear-image');
  const accSourceRadios = document.querySelectorAll('input[name="account-image-source"]');

  accSourceRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
          if(e.target.value === 'url') {
              accImgUrl.disabled = false;
              accImgFile.disabled = true;
          } else {
              accImgUrl.disabled = true;
              accImgFile.disabled = false;
          }
      });
  });

  accImgFile?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20480) {
          alert('이미지 크기가 너무 큽니다. (20KB 이하 권장)');
          e.target.value = '';
          return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
          accountCustomIconData = event.target.result;
          if (accPreviewImg) accPreviewImg.src = accountCustomIconData;
          accImgPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
  });

  accImgUrl?.addEventListener('input', (e) => {
      accountCustomIconData = e.target.value.trim();
      if(accountCustomIconData && accPreviewImg) {
          accPreviewImg.src = accountCustomIconData;
          accImgPreview.classList.remove('hidden');
      } else {
          accImgPreview.classList.add('hidden');
      }
  });

  accClearBtn?.addEventListener('click', () => {
      if (accImgFile) accImgFile.value = '';
      if (accImgUrl) accImgUrl.value = '';
      accountCustomIconData = '';
      if (accImgPreview) accImgPreview.classList.add('hidden');
  });

  window.openAccountModal = (id = null) => {

    const modal = document.getElementById("accountModal");
    const form = document.getElementById("accountForm");
    const title = document.getElementById("accountModalTitle");
    
    form.reset();
    document.getElementById("account-id").value = id || "";
    
    // Reset States
    accountSelectedIcon = 'fa-lock';
    accountSelectedIconType = 'preset';
    accountCustomIconData = '';
    document.querySelector('#account-icon-type-tabs .icon-tab[data-tab="preset"]').click();
    if (accImgPreview) accImgPreview.classList.add('hidden');
    if (accImgFile) accImgFile.value = '';
    if (accImgUrl) accImgUrl.value = '';
    
    if (id) {
      title.textContent = "계정 정보 수정";
      const acc = localAccountData.find(a => a.id === id);
      if (acc) {
        document.getElementById("account-service").value = acc.service;
        document.getElementById("account-category").value = acc.category || "기관 계정";
        document.getElementById("account-url").value = acc.url || "";
        document.getElementById("account-username").value = acc.username;
        document.getElementById("account-password").value = acc.password;
        document.getElementById("account-authcode").value = acc.authCode || "";
        document.getElementById("account-note").value = acc.note || "";
        
        // Restore Icon State
        if (acc.iconType === 'custom') {
            accountSelectedIconType = 'custom';
            accountCustomIconData = acc.icon;
            document.querySelector('#account-icon-type-tabs .icon-tab[data-tab="custom"]').click();
            if (accImgUrl) accImgUrl.value = (acc.icon && !acc.icon.startsWith('data:')) ? acc.icon : '';
            if (accPreviewImg) accPreviewImg.src = acc.icon;
            accImgPreview.classList.remove('hidden');
        } else {
            accountSelectedIcon = acc.icon || 'fa-lock';
            renderAccountItemIconPicker(accountSelectedIcon);
        }
      }
    } else {
      title.textContent = "계정 정보 등록";
      document.getElementById("account-category").value = currentAccountCategory;
      renderAccountItemIconPicker('fa-lock');
    }
    // Restore toggle states
    const _acc = id ? localAccountData.find(a => a.id === id) : null;
    document.getElementById('account-show-id').checked       = _acc ? _acc.showId !== false : true;
    document.getElementById('account-show-password').checked = _acc ? _acc.showPassword !== false : true;
    document.getElementById('account-show-authcode').checked = _acc ? _acc.showAuthCode !== false : false;
    updateAccFieldVisibility();
    modal.classList.add("active");
  };

  document.getElementById("accountForm").onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById("account-id").value;
    const data = {
      service:      document.getElementById("account-service").value,
      category:     document.getElementById("account-category").value,
      url:          document.getElementById("account-url").value,
      username:     document.getElementById("account-username").value,
      password:     document.getElementById("account-password").value,
      authCode:     document.getElementById("account-authcode").value.trim(),
      showId:       document.getElementById("account-show-id").checked,
      showPassword: document.getElementById("account-show-password").checked,
      showAuthCode: document.getElementById("account-show-authcode").checked,
      note:         document.getElementById("account-note").value,
      iconType:     accountSelectedIconType,
      icon:         accountSelectedIconType === 'custom' ? accountCustomIconData : accountSelectedIcon
    };

    if (id) {
      const idx = localAccountData.findIndex(a => a.id === id);
      if (idx !== -1) localAccountData[idx] = { ...localAccountData[idx], ...data };
    } else {
      localAccountData.push({ id: "acc-" + Date.now(), ...data, order: localAccountData.length });
    }

    document.getElementById("accountModal").classList.remove("active");
    renderAccountCards();
  };

  window.deleteAccount = (id) => {
    if (confirm("삭제하시겠습니까?")) {
      localAccountData = localAccountData.filter(a => a.id !== id);
      renderAccountCards();
    }
  };

  window.copyToClipboard = (text, element, serviceName, type) => {
    navigator.clipboard.writeText(text).then(() => {
      if(window.logUserAction) window.logUserAction('account', '복사', `${serviceName} ${type}`);
      const valGroup = element.querySelector('.info-value-group');
      if (valGroup) {
        const originalHtml = valGroup.innerHTML;
        valGroup.innerHTML = `<span class="info-value copied" style="color:var(--primary-color)">복사됨!</span>`;
        element.classList.add("copied-flash");
        setTimeout(() => {
          valGroup.innerHTML = originalHtml;
          element.classList.remove("copied-flash");
        }, 1000);
      }
    });
  };

  // Close modal listeners
  document.querySelectorAll(".close-account-modal").forEach(btn => {
    btn.onclick = () => document.getElementById("accountModal").classList.remove("active");
  });

  function updateAccFieldVisibility() {
    const showId       = document.getElementById('account-show-id').checked;
    const showPw       = document.getElementById('account-show-password').checked;
    const showAuthCode = document.getElementById('account-show-authcode').checked;
    const idInput      = document.getElementById('account-username');
    const pwInput      = document.getElementById('account-password');
    const authGroup    = document.getElementById('account-authcode-group');
    const authInput    = document.getElementById('account-authcode');

    idInput.style.opacity = showId ? '1' : '0.35';
    idInput.required      = showId;
    pwInput.style.opacity = showPw ? '1' : '0.35';
    pwInput.required      = showPw;
    if (authGroup) authGroup.style.display = showAuthCode ? '' : 'none';
    if (authInput) authInput.disabled = !showAuthCode;
  }

  ['account-show-id', 'account-show-password', 'account-show-authcode'].forEach(chkId => {
    const el = document.getElementById(chkId);
    if (el) el.addEventListener('change', updateAccFieldVisibility);
  });


  window.openAccountGroupModal = (id = null) => {
    const modal = document.getElementById("account-group-modal");
    const form = document.getElementById("account-group-form");
    const title = document.getElementById("account-group-modal-title");
    const deleteBtn = document.getElementById("account-group-delete-btn");
    
    form.reset();
    document.getElementById("account-group-id").value = id || "";
    
    if (id) {
        title.textContent = "그룹 편집";
        deleteBtn.classList.remove("hidden");
        const cat = accountCategories.find(c => c.id === id);
        if (cat) {
            document.getElementById("account-group-name").value = cat.name;
            document.getElementById("account-group-icon").value = cat.icon;
            document.getElementById("account-group-desc").value = cat.desc || "";
            renderAccountGroupIconPicker(cat.icon);
        }
    } else {
        title.textContent = "그룹 등록";
        deleteBtn.classList.add("hidden");
        document.getElementById("account-group-icon").value = "fa-folder"; // Default icon
        renderAccountGroupIconPicker("fa-folder");
    }
    modal.classList.add("active");
  };

  window.closeAccountGroupModal = () => {
      document.getElementById("account-group-modal").classList.remove("active");
  };

  window.saveAccountGroup = async () => {
    if (event) event.preventDefault();
    const id = document.getElementById("account-group-id").value;
    const name = document.getElementById("account-group-name").value.trim();
    const icon = document.getElementById("account-group-icon").value.trim();
    const desc = document.getElementById("account-group-desc").value.trim();
    
    if (!name) return alert("그룹명을 입력하세요.");
    
    const { db, firestoreUtils } = window;
    
    if (id) {
        const cat = accountCategories.find(c => c.id === id);
        if (cat) {
            cat.name = name;
            cat.icon = icon;
            cat.desc = desc;
            if (db) await firestoreUtils.updateDoc(firestoreUtils.doc(db, "accountCategories", id), { name, icon, desc });
        }
    } else {
        const newId = "cat-" + Date.now();
        const newCat = { id: newId, name, icon, desc, order: accountCategories.length };
        accountCategories.push(newCat);
        if (db) await firestoreUtils.setDoc(firestoreUtils.doc(db, "accountCategories", newId), { name, icon, desc, order: newCat.order });
    }
    
    window.closeAccountGroupModal();
    if (typeof renderAccountSidebar === 'function') renderAccountSidebar();
    if (window.logUserAction) window.logUserAction('account', '그룹수정', `그룹명: ${name}`);
  };

  window.handleDeleteAccountGroupFromModal = async () => {
    const id = document.getElementById("account-group-id").value;
    if (!id) return;
    
    const cat = accountCategories.find(c => c.id === id);
    if (!cat) return;
    
    if (confirm(`'${cat.name}' 그룹을 정말 삭제하시겠습니까? 속한 계정은 남아있습니다.`)) {
        const { db, firestoreUtils } = window;
        accountCategories = accountCategories.filter(c => c.id !== id);
        if (db) await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "accountCategories", id));
        window.closeAccountGroupModal();
        if (typeof renderAccountSidebar === 'function') renderAccountSidebar();
    }
  };

  function saveAllEvents() {
    // Firebase 연동으로 인해 더 이상 필요하지 않으나 하위 호환성을 위해 유지
  }

  // 카테고리 클릭 이벤트
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // 1. 방향 결정 (Direction Calculation)
      const oldActive = document.querySelector('.nav-item.active');
      let direction = 'none';
      
      if (oldActive && oldActive !== item) {
          const allTabs = Array.from(document.querySelectorAll('.nav-item'));
          const visibleTabs = allTabs.filter(t => getComputedStyle(t).display !== 'none');
          
          const oldIndex = visibleTabs.indexOf(oldActive);
          const newIndex = visibleTabs.indexOf(item);
          
          if (oldIndex !== -1 && newIndex !== -1) {
             if (newIndex > oldIndex) direction = 'right'; // Next Tab (Swipe Left)
             else direction = 'left'; // Prev Tab (Swipe Right)
          }
      }

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      currentCategory = item.getAttribute("data-category");
      document.body.setAttribute('data-tab', currentCategory); // Added for theme backgrounds

      // Log User Action
      if(window.logUserAction) window.logUserAction(currentCategory);

      // 모든 섹션 숨기기 및 애니메이션 클래스 초기화
      const allSections = [
        linksGrid, 
        statusSection, 
        curriculumSection,
        datayardSection, 
        helppageSection, 
        accountSection,
        busSection,
        calendarSection,
        adminSection,
        document.getElementById("intro-section")
      ];
      
      allSections.forEach(sec => {
        if (sec) {
            sec.classList.add("hidden");
            sec.classList.remove('animate-slide-in-right', 'animate-slide-in-left');
        }
      });
      
      document.documentElement.classList.remove("intro-active");
      document.body.classList.toggle('hide-widget', currentCategory === 'curriculum');

      let targetSection = null;

      if (currentCategory === "status") {
        statusSection.classList.remove("hidden");
        targetSection = statusSection;
        // ★ 이미 로드된 데이터가 있으면 렌더링만 수행 (불필요한 재초기화 방지)
        if (_statusDataLoaded && Object.keys(statusData).length > 0) {
            renderStatusTabs();
            renderStatusContent();
            renderStatusControls();
        } else {
            initStatusEditing();
        } 
      } else if (currentCategory === "curriculum") {
        curriculumSection.classList.remove("hidden");
        targetSection = curriculumSection;
      } else if (currentCategory === "datayard") {
        datayardSection.classList.remove("hidden");
        targetSection = datayardSection;
        initDatayard();
      } else if (currentCategory === "support") {
        helppageSection.classList.remove("hidden");
        targetSection = helppageSection;
        renderHelppage();
      } else if (currentCategory === "account") {
        accountSection.classList.remove("hidden");
        targetSection = accountSection;
        initAccount();
      } else if (currentCategory === "bus") {
        busSection.classList.remove("hidden");
        targetSection = busSection;
        initBus();
      } else if (currentCategory === "calendar") {
        calendarSection.classList.remove("hidden");
        targetSection = calendarSection;
        initCalendar();
      } else if (currentCategory === "admin") {
        adminSection.classList.remove("hidden");
        targetSection = adminSection;
        window.switchAdminView('dashboard');
      } else if (currentCategory === "all") {
        const intro = document.getElementById("intro-section");
        intro.classList.remove("hidden");
        targetSection = intro;
        document.documentElement.classList.add("intro-active");
      } else if (currentCategory === "training" || currentCategory === "meal") {
        // Handled entirely by switchTab — do nothing here
      } else {
        linksGrid.classList.remove("hidden");
        targetSection = linksGrid;
        renderCards();
      }
      
      // 2. 애니메이션 적용 (Apply Animation) - 모바일 전용
      if (targetSection && direction !== 'none' && window.innerWidth <= 768) {
          // Force Reflow
          void targetSection.offsetWidth;
          
          if (direction === 'right') {
              targetSection.classList.add('animate-slide-in-right');
          } else {
              targetSection.classList.add('animate-slide-in-left');
          }
      }
    });
  });

  // 초기 렌더링 (소개 섹션 표시)
  document.getElementById("intro-section").classList.remove("hidden");
  document.documentElement.classList.add("intro-active");


  // ================= Intro Section Canvas Animation =================
  function initIntroCanvas() {
    const canvas = document.getElementById("intro-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    const particleCount = 40;
    
    let mouse = { x: -100, y: -100 };

    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect) return;
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.alpha = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Mouse attraction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          this.x += dx * 0.01;
          this.y += dy * 0.01;
        }

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(74, 144, 226, ${this.alpha})`;
        ctx.fill();
      }
    }

    function resize() {
      if (!canvas.offsetWidth) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    }

    function animate() {
      if (!document.getElementById("intro-section") || document.getElementById("intro-section").classList.contains("hidden")) {
        requestAnimationFrame(animate);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(74, 144, 226, ${0.2 * (1 - dist / 100)})`;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    resize();
    animate();
  }

  // ================= Intro Smooth Scroll & Animation =================
  function initIntroAnimations() {
    const introSection = document.getElementById("intro-section");
    const steps = document.querySelectorAll(".intro-step");
    if (!introSection || steps.length === 0) return;

    // 1. Intersection Observer for fade-in effect
    const observerOptions = {
        root: null, // Viewport
        threshold: 0.1
    };

    const stepObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            } else {
                entry.target.style.opacity = "0.3";
                entry.target.style.transform = "translateY(20px)";
            }
        });
    }, observerOptions);

    steps.forEach(step => {
        // Initial state
        step.style.opacity = "0.3";
        step.style.transform = "translateY(20px)";
        step.style.transition = "all 1s cubic-bezier(0.2, 0.8, 0.2, 1)";
        stepObserver.observe(step);
    });

    // 2. Wheel event smoothing for Desktop
    let isScrolling = false;
    introSection.addEventListener('wheel', (e) => {
        if (isScrolling) return;
        
        // Prevent default only if we are actually at a snap point
        // and intent is clear (deltaY is significant)
        if (Math.abs(e.deltaY) < 30) return;

        isScrolling = true;
        setTimeout(() => { isScrolling = false; }, 1000); // Throttling
    }, { passive: true });
  }

  // Initialize
  initIntroAnimations();
  initIntroCanvas();
  initTodayWidget();

  // ================= Today Widget Logic =================
  function initTodayWidget() {
    const todayMonthDay = document.getElementById('today-month-day');
    const todayWeekday = document.getElementById('today-weekday');
    const eventList = document.getElementById('today-event-list');
    const addBtn = document.getElementById('widget-add-btn');
    const todayWidget = document.getElementById('school-today-widget');
    const toggleBtn = document.getElementById('today-toggle-btn');
    const header = document.getElementById('today-widget-header');

    if (!todayMonthDay || !eventList) return;
    
    // Toggle Logic
    const toggleCollapse = (e) => {
        // Prevent toggling when clicking buttons inside header
        if (e && e.target.closest('button')) return;
        
        todayWidget.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        if (todayWidget.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    };
    
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            // Manually trigger logic directly for the button
            todayWidget.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            icon.className = todayWidget.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        };
    }
    
    if (header) {
        header.onclick = toggleCollapse;
    }

    // Data Store
    let allRawEvents = [];
    let isWidgetSyncSetup = false;
    // 카테고리 접기/펼치기 상태 유지 (리렌더링 후에도 보존)
    const widgetCatState = {};

    // 1. Render Function (Pure rendering based on current date & stored data)
    const renderTodayWidget = () => {
        const now = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        
        // Update Date Display
        todayMonthDay.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일(${days[now.getDay()]})`;
        
        // Filter Events for Today
        const todayStr = formatDate(now);
        const todayEvents = [];

        // 1. Fetch Auto Events (Holidays/Terms)
        let autoEvents = [];
        if (window.KoreanHolidayService) {
            autoEvents = window.KoreanHolidayService.getAutoEvents(now.getFullYear(), now.getMonth());
        }
        
        // Merge DB events and Auto events (Deduplicate: Prefer DB events if ID conflicts)
        const dbEventIds = new Set(allRawEvents.map(e => e.id));
        const uniqueAutoEvents = autoEvents.filter(e => !dbEventIds.has(e.id));
        const combinedEvents = [...allRawEvents, ...uniqueAutoEvents];

        combinedEvents.forEach(data => {
             const start = data.start;
             let end = data.end || start;
             
             // 1. Date Check
             if (todayStr >= start && todayStr <= end) {
                 // 2. Individual Filtering for 'doc' type
                 if (data.eventType === 'doc') {
                     const userTasks = window.currentUserTasks || [];
                     const docInCharges = (data.inCharge || "").split(',').map(s => s.trim()).filter(Boolean);
                     
                     // Show if any of the doc's in-charge tasks matches any of user's assigned tasks
                     const isMyDoc = docInCharges.some(task => userTasks.includes(task));
                     
                     if (isMyDoc) {
                         todayEvents.push(data);
                     }
                 } else {
                     // Other types (edu, staff, life) are shown to everyone as before
                     todayEvents.push(data);
                 }
             }
        });

        // SORT by orderIndex
        todayEvents.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        // 1. Special Day (Life) in Header
        const specialDays = todayEvents
            .filter(ev => ev.eventType === 'life' && ev.title && ev.title.trim() !== '')
            .map(ev => ev.title);
            
        const uniqueSpecialDays = [...new Set(specialDays)];

        if (uniqueSpecialDays.length > 0) {
            todayWeekday.textContent = uniqueSpecialDays.join(', ');
            todayWeekday.style.color = "#3b82f6"; // Changed to Blue
        } else {
            todayWeekday.textContent = "";
        }

        // 2. Render List
        const categories = [
            { id: 'edu', label: '일정', icon: 'fa-chalkboard-teacher', types: ['edu'] },
            { id: 'staff', label: '교직원 복무', icon: 'fa-user-clock', types: ['staff'] },
            { id: 'doc', label: '처리할 공문', icon: 'fa-file-signature', types: ['doc'] }
        ];

        eventList.innerHTML = '';
        const otherEvents = todayEvents.filter(ev => ev.eventType !== 'life');

        let pendingBusData = [];
        if (typeof canManageBus === 'function' && canManageBus() && typeof localBusData !== 'undefined') {
             pendingBusData = localBusData.filter(r => r.isAccepted !== true && r.status !== '운행완료');
             pendingBusData.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || ''));
        }

        if (otherEvents.length === 0 && pendingBusData.length === 0) {
            const li = document.createElement('li');
            li.className = 'no-event';
            li.textContent = '오늘 주요 학사일정 및 대기 항목이 없습니다.';
            eventList.appendChild(li);
        } else {
            categories.forEach(cat => {
                if (cat.id === 'doc') {
                     // ================= Render Pending Bus Widget Data (Above "처리할 공문") =================
                     if (pendingBusData.length > 0) {
                          const catKey = 'bus-pending';
                          const isCollapsed = widgetCatState[catKey] || false;

                          const titleDiv = document.createElement('div');
                          titleDiv.className = `category-title${isCollapsed ? ' collapsed' : ''}`;
                          titleDiv.innerHTML = `<i class="fas fa-bus"></i> 접수대기 중<i class="fas fa-chevron-down cat-toggle-icon"></i>`;
                          eventList.appendChild(titleDiv);

                          const groupDiv = document.createElement('div');
                          groupDiv.className = `category-group${isCollapsed ? ' collapsed' : ''}`;

                          // Toggle click handler
                          titleDiv.onclick = () => {
                              const nowCollapsed = groupDiv.classList.toggle('collapsed');
                              titleDiv.classList.toggle('collapsed', nowCollapsed);
                              widgetCatState[catKey] = nowCollapsed;
                          };
                          
                          pendingBusData.forEach(req => {
                               const li = document.createElement('li');
                               li.className = 'event-item type-bus';
                               
                               const formattedDate = req.date ? req.date.substring(5).replace('-', '.') : '';
                               const destination = req.destination || '목적지 미상';
                               
                               li.innerHTML = `<i class="fas fa-bus" style="color:#6366f1;"></i><span>${formattedDate} ${destination}</span>`;
                               
                               let info = [];
                               if (req.timeRange) info.push(`<li><b>시간:</b> ${req.timeRange}</li>`);
                               if (req.leadTeacher) info.push(`<li><b>인솔:</b> ${req.leadTeacher}</li>`);
                               info.push(`<li><b>탑승:</b> ${(parseInt(req.studentCount)||0)+(parseInt(req.teacherCount)||0)}명</li>`);
                               if (req.purpose) info.push(`<li><b>목적:</b> ${req.purpose}</li>`);

                               if (info.length > 0) {
                                   const tooltipContent = `<ul class="tooltip-list">${info.join('')}</ul>`;
                                   li.onmouseenter = (e) => showFloatingTooltip(e, tooltipContent);
                                   li.onmouseleave = hideFloatingTooltip;
                               }

                               li.onclick = () => {
                                   const navBus = document.querySelector('[data-category="bus"]');
                                   if (navBus) navBus.click();
                                   setTimeout(() => {
                                       if (typeof window.openBusModal === 'function') window.openBusModal(req.id);
                                   }, 50);
                               };

                               groupDiv.appendChild(li);
                          });
                          eventList.appendChild(groupDiv);
                     }
                }

                const catEvents = otherEvents.filter(ev => cat.types.includes(ev.eventType));
                
                if (catEvents.length > 0) {
                    const catKey = cat.id;
                    const isCollapsed = widgetCatState[catKey] || false;

                    const titleDiv = document.createElement('div');
                    titleDiv.className = `category-title${isCollapsed ? ' collapsed' : ''}`;
                    titleDiv.innerHTML = `<i class="fas ${cat.icon}"></i> ${cat.label}<i class="fas fa-chevron-down cat-toggle-icon"></i>`;
                    eventList.appendChild(titleDiv);

                    const groupDiv = document.createElement('div');
                    groupDiv.className = `category-group${isCollapsed ? ' collapsed' : ''}`;

                    // Toggle click handler
                    titleDiv.onclick = () => {
                        const nowCollapsed = groupDiv.classList.toggle('collapsed');
                        titleDiv.classList.toggle('collapsed', nowCollapsed);
                        widgetCatState[catKey] = nowCollapsed;
                    };

                    catEvents.forEach(ev => {
                        const li = document.createElement('li');
                        const isCompleted = ev.eventType === 'doc' && ev.isCompleted;
                        li.className = `event-item type-${ev.eventType} ${ev.isHoliday ? 'is-holiday' : ''} ${isCompleted ? 'completed' : ''}`;
                        
                        let displayText = ev.title;
                        if (ev.eventType === 'staff') {
                            // Add space between Name and Status
                            displayText = `${ev.title} (${ev.staffStatus || '미정'})`;
                        }
                        
                        // Icon Logic
                        let iconClass = 'fa-check';
                        if (ev.isHoliday) iconClass = 'fa-flag';
                        else if (ev.eventType === 'staff') iconClass = 'fa-user-check'; // Specific icon for staff
                        else if (ev.eventType === 'edu') iconClass = 'fa-chalkboard';
                        else if (ev.eventType === 'doc') {
                            iconClass = isCompleted ? 'fa-check-circle' : 'fa-file-alt';
                        }

                        li.innerHTML = `<i class="fas ${iconClass}"></i><span>${displayText}</span>`;

                        // Tooltip Construction (HTML List for Detail View)
                        let info = [];
                        if (ev.eventType === 'edu') {
                            if (ev.time) info.push(`<li><b>시간:</b> ${ev.time}</li>`);
                            if (ev.place) info.push(`<li><b>장소:</b> ${ev.place}</li>`);
                            if (ev.target) info.push(`<li><b>대상:</b> ${ev.target}</li>`);
                            if (ev.inCharge) info.push(`<li><b>담당:</b> ${ev.inCharge}</li>`);
                        } else if (ev.eventType === 'staff') {
                            info.push(`<li><b>이름:</b> ${ev.title}</li>`); 
                            info.push(`<li><b>복무:</b> ${ev.staffStatus || '미정'}</li>`);
                            if (ev.place) info.push(`<li><b>장소:</b> ${ev.place}</li>`);
                            if (ev.time) info.push(`<li><b>시간:</b> ${ev.time}</li>`);
                        } else if (ev.eventType === 'doc') {
                            if (ev.inCharge) info.push(`<li><b>담당:</b> ${ev.inCharge}</li>`);
                        }
                        
                        // Only add tooltip event if there IS info to show
                        const tooltipContent = info.length > 0 ? `<ul class="tooltip-list">${info.join('')}</ul>` : "";
                        
                        if (info.length > 0) {
                            li.onmouseenter = (e) => showFloatingTooltip(e, tooltipContent);
                            li.onmouseleave = hideFloatingTooltip;
                        }

                        li.onclick = () => {
                            const navCurr = document.querySelector('[data-category="curriculum"]');
                            if (navCurr) navCurr.click();
                        };
                        groupDiv.appendChild(li);
                    });
                    eventList.appendChild(groupDiv);
                }
            });
        }
    };

    // 2. Sync Setup
    const setupTodayWidgetSync = () => {
        if (!window.db || isWidgetSyncSetup) return;
     // Expose for external updates (profile change, etc.)
    window.renderTodayWidget = renderTodayWidget;

    // Listen for user data updates to refresh widget
    window.addEventListener('user-role-updated', () => {
        renderTodayWidget();
    });

    // 2. Initial Setup
    isWidgetSyncSetup = true;
        const { db, firestoreUtils } = window;

        // Listen for updates
        firestoreUtils.onSnapshot(firestoreUtils.collection(db, "curriculum_events"), (querySnapshot) => {
            allRawEvents = [];
            querySnapshot.forEach((docSnap) => {
                allRawEvents.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderTodayWidget();
        });
    };

    // Tooltip Logic (Global Element)
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'widget-floating-tooltip';
    document.body.appendChild(tooltipEl);

    function showFloatingTooltip(e, content) {
        if(!content) return;
        tooltipEl.innerHTML = content; // Changed to innerHTML for HTML content
        tooltipEl.style.display = 'block'; 
        
        // Measure tooltip
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const targetRect = e.target.getBoundingClientRect();
        
        // Position: Right of the target, Vertically centered
        // targetRect.right + gap
        const x = targetRect.right + 12; 
        // targetRect.top + half_height - half_tooltip_height
        const y = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        
        tooltipEl.style.left = x + 'px';
        tooltipEl.style.top = y + 'px';
        
        requestAnimationFrame(() => {
           tooltipEl.classList.add('active');
        });
    }

    function hideFloatingTooltip() {
        tooltipEl.classList.remove('active');
        tooltipEl.style.display = 'none';
    }

    // Init
    if (window.db) setupTodayWidgetSync();
    window.addEventListener('firebase-ready', setupTodayWidgetSync);
    
    // Add Button
    addBtn.onclick = () => {
        const todayStr = formatDate(new Date());
        const navCurr = document.querySelector('[data-category="curriculum"]');
        if (navCurr) navCurr.click();
        if (typeof window.openCurrModal === 'function') window.openCurrModal(todayStr);
    };

    // Auto Refresh (Hourly)
    setInterval(renderTodayWidget, 3600000);
    renderTodayWidget(); // Initial Render

    // Expose for compatibility (manual triggers just re-render local data)
    window.updateTodayWidget = renderTodayWidget;
  }

  // ================= Notice Widget Logic =================
  async function initNoticeBoard() {
    const noticeWidget = document.getElementById('notice-widget');
    const noticeContent = document.getElementById('notice-widget-content');
    const addPostBtn = document.getElementById('notice-add-btn');
    const toggleBtn = document.getElementById('notice-toggle-btn');
    const header = document.getElementById('notice-widget-header');

    const modal = document.getElementById('boardPostModal');
    const form = document.getElementById('boardPostForm');
    const closeModalBtns = document.querySelectorAll('.close-board-modal');
    const editor = document.getElementById('post-content-editor');
    const authorChipsContainer = document.getElementById('post-author-chips');
    const selectedAuthorInput = document.getElementById('selected-post-author');
    const customAuthorInput = document.getElementById('post-author-custom');
    const colorTrigger = document.getElementById('color-trigger');
    const colorPopover = document.getElementById('color-popover');
    const colorOptions = document.querySelectorAll('#color-popover .color-option');
    const fileDropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('post-file-input');
    const filePreview = document.getElementById('file-preview-area');
    const fileNameDisplay = document.getElementById('file-name-display');
    const removeFileBtn = document.getElementById('remove-file-btn');

    let selectedColor = '#fff9c4';
    let selectedFile = null;

    if (!noticeContent) return;

    // Toggle Collapse
    const toggleCollapse = (e) => {
        // Prevent if clicking add button
        if (e && e.target.closest('#notice-add-btn')) return;
        
        noticeWidget.classList.toggle('collapsed');
        const icon = toggleBtn.querySelector('i');
        if (noticeWidget.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    };
    
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        toggleCollapse(e);
    };
    header.onclick = toggleCollapse; // Click anywhere on header to toggle

    // --- 2. Author Chips Population ---
    const authors = ["교장", "행정실장", "1·2학년", "3학년", "4학년", "5학년", "6학년", "유치원", "교무", "영양", "차장", "운전주무관", "교무행정원", "직접 입력"];
    
    const renderAuthorChips = () => {
        authorChipsContainer.innerHTML = '';
        authors.forEach((author) => {
            const chip = document.createElement('div');
            chip.className = 'author-chip';
            if (selectedAuthorInput.value === author) chip.classList.add('selected');
            chip.textContent = author;
            chip.onclick = () => {
                selectedAuthorInput.value = author;
                document.querySelectorAll('.author-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
                
                if (author === '직접 입력') {
                    customAuthorInput.style.display = 'block';
                    customAuthorInput.focus();
                } else {
                    customAuthorInput.style.display = 'none';
                }
            };
            authorChipsContainer.appendChild(chip);
        });
    };

    // --- 4. Color Picker Popover Logic ---
    colorTrigger.onclick = (e) => {
        e.stopPropagation();
        colorPopover.classList.toggle('active');
    };

    document.addEventListener('click', (e) => {
        if (!colorTrigger.contains(e.target) && !colorPopover.contains(e.target)) {
            colorPopover.classList.remove('active');
        }
    });

    colorOptions.forEach(opt => {
      opt.onclick = () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedColor = opt.dataset.color;
        colorTrigger.style.backgroundColor = selectedColor;
        colorPopover.classList.remove('active');
      };
    });

    // --- 3. File Upload Logic ---
    const handleFile = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('파일 크기는 10MB 이하만 가능합니다.');
            return;
        }
        selectedFile = file;
        fileNameDisplay.textContent = file.name;
        filePreview.classList.remove('hidden');
        fileDropZone.classList.add('hidden');
    };

    fileDropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => handleFile(e.target.files[0]);

    fileDropZone.ondragover = (e) => {
        e.preventDefault();
        fileDropZone.classList.add('dragover');
    };
    fileDropZone.ondragleave = () => fileDropZone.classList.remove('dragover');
    fileDropZone.ondrop = (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    };

    removeFileBtn.onclick = () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        fileDropZone.classList.remove('hidden');
    };

    // 2. Load and Render Posts
    const loadBoard = async () => {
      if (!window.db) return;
      const { db, firestoreUtils } = window;
      try {
        const q = firestoreUtils.query(firestoreUtils.collection(db, "boardPosts"));
        const querySnapshot = await firestoreUtils.getDocs(q);
        
        const posts = [];
        querySnapshot.forEach(doc => {
          posts.push({ id: doc.id, ...doc.data() });
        });
        
        posts.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        renderPosts(posts);
        initSortable();
      } catch (err) {
        console.error("Board load error:", err);
      }
    };

    let sortableInstance = null;
    const initSortable = () => {
      const list = noticeContent.querySelector('.notice-list');
      if (!list) return;
      
      if (sortableInstance) sortableInstance.destroy();
      
      if (window.Sortable) {
          sortableInstance = new Sortable(list, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onStart: () => list.classList.add('sorting'),
            onEnd: async (evt) => {
              list.classList.remove('sorting');
              if (evt.oldIndex === evt.newIndex) return;
              
              const items = Array.from(list.querySelectorAll('.notice-item'));
              const { db, firestoreUtils } = window;
              
              try {
                // Batch update or individual updates
                // For simplicity here, individual updates
                const promises = items.map((item, index) => {
                  const id = item.dataset.id;
                  return firestoreUtils.setDoc(firestoreUtils.doc(db, "boardPosts", id), { order: index }, { merge: true });
                });
                await Promise.all(promises);

                // Log Action
                if (window.logUserAction) window.logUserAction('board', '순서변경', '메모 순서 변경');
              } catch (err) {
                console.error("Order save error:", err);
              }
            }
          });
      }
    };

    const renderPosts = (posts) => {
      noticeContent.innerHTML = '<div class="notice-list"></div>';
      const list = noticeContent.querySelector('.notice-list');
      
      if (posts.length === 0) {
        list.innerHTML = '<div class="no-event">등록된 소식이 없습니다.</div>';
        return;
      }
      
      posts.forEach(post => {
        const item = document.createElement('div');
        item.className = `notice-item status-${post.status || 'normal'}`;
        item.dataset.id = post.id;
        if (post.color) item.style.backgroundColor = post.color;
        
        // Date parsing helper
        const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : '';
        const author = post.author || '익명';
        const strippedContent = (post.content || '').replace(/<[^>]*>?/gm, ''); // stripped html

        // Tag Generation
        let statusTag = '';
        if (post.status === 'important') statusTag = '<span class="status-pill pill-important"><i class="fas fa-star"></i> 중요</span>';
        if (post.status === 'urgent') statusTag = '<span class="status-pill pill-urgent"><i class="fas fa-exclamation-circle"></i> 긴급</span>';

        item.innerHTML = `
            <div class="notice-header-row">
                <div class="notice-profile-wrapper">
                    <span class="notice-author">${author}</span>
                    ${statusTag}
                </div>
                <span class="notice-date">${date}</span>
                <div class="notice-actions">
                    <button class="notice-action-btn copy" title="복사" onclick="event.stopPropagation(); window.copyBoardPost('${post.id}', this)"><i class="fas fa-copy"></i></button>
                    <button class="notice-action-btn delete" title="삭제" onclick="event.stopPropagation(); window.deleteBoardPost('${post.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="notice-content-preview">
                ${strippedContent}
            </div>
            <div class="notice-footer-row">
                <div class="notice-meta-info">
                   ${post.fileUrl ? `<span class="notice-meta-item"><i class="fas fa-paperclip"></i> 파일</span>` : ''}
                   ${(post.comments && post.comments.length > 0) ? `<span class="notice-meta-item"><i class="fas fa-comment"></i> ${post.comments.length}</span>` : ''}
                </div>
            </div>
        `;
        
        // Click to view/edit
        item.onclick = (e) => {
             // Avoid triggering if clicking actions (handled by stopPropagation, but safe guard)
             if (e.target.closest('.notice-action-btn')) return;
             window.editBoardPost(post.id);
        };
        
        list.appendChild(item);
      });
    };

    // 5. Modal Controls
    const openAddModal = () => {
      form.reset();
      editor.innerHTML = '';
      selectedFile = null;
      filePreview.classList.add('hidden');
      fileDropZone.classList.remove('hidden');
      document.getElementById('post-id').value = '';
      document.getElementById('boardModalTitle').textContent = '메모 작성';
      
      selectedAuthorInput.value = '교장';
      renderAuthorChips();
      customAuthorInput.style.display = 'none';
      customAuthorInput.value = '';

      selectedColor = '#fff9c4';
      colorTrigger.style.backgroundColor = selectedColor;
      colorOptions.forEach(o => {
          if(o.dataset.color === selectedColor) o.classList.add('selected');
          else o.classList.remove('selected');
      });

      modal.classList.add('active');
    };

    if (addPostBtn) {
      addPostBtn.onclick = openAddModal;
    }

    closeModalBtns.forEach(btn => {
      btn.onclick = () => modal.classList.remove('active');
    });

    // 6. Save Post
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('post-id').value;
      const content = editor.innerHTML.trim();
      
      let author = selectedAuthorInput.value;
      if (author === '직접 입력') {
          author = customAuthorInput.value.trim() || '익명';
      }

      const status = document.querySelector('input[name="post-status"]:checked').value;
      
      if (!content || content === '<br>') {
          alert('내용을 입력해 주세요.');
          return;
      }

      const { db, firestoreUtils, storage, storageUtils } = window;
      try {
        let fileUrl = null;
        let fileName = null;

        if (selectedFile) {
            const fileRef = storageUtils.ref(storage, `boardFiles/${Date.now()}_${selectedFile.name}`);
            const uploadSnap = await storageUtils.uploadBytes(fileRef, selectedFile);
            fileUrl = await storageUtils.getDownloadURL(uploadSnap.ref);
            fileName = selectedFile.name;
        }

        const postData = {
          content,
          author,
          status,
          color: selectedColor,
          updatedAt: new Date().toISOString()
        };

        if (fileUrl) {
            postData.fileUrl = fileUrl;
            postData.fileName = fileName;
        }

        if (id) {
          await firestoreUtils.setDoc(firestoreUtils.doc(db, "boardPosts", id), postData, { merge: true });
        } else {
          postData.createdAt = new Date().toISOString();
          postData.comments = [];
          
          const currentPostsSnap = await firestoreUtils.getDocs(firestoreUtils.collection(db, "boardPosts"));
          postData.order = currentPostsSnap.size;
          
          // Fix: Create doc ref correctly for compat SDK
          const newDocRef = firestoreUtils.collection(db, "boardPosts").doc();
          await firestoreUtils.setDoc(newDocRef, postData);
        }
        
        // Log Action
        if (window.logUserAction) {
             const action = id ? '수정' : '생성';
             const summary = content.replace(/<[^>]*>/g, '').substring(0, 20);
             window.logUserAction('board', action, `메모 ${action}: ${summary}...`);
        }

        modal.classList.remove('active');
        loadBoard();
      } catch (err) {
        console.error("Board save error:", err);
        alert("저장 중 오류가 발생했습니다.");
      }
    };

    // Exposed Global Functions for dynamic HTML
    window.deleteBoardPost = async (id) => {
      if (!confirm('메모를 삭제하시겠습니까?')) return;
      const { db, firestoreUtils } = window;
      try {
        await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "boardPosts", id));

        // Log Action
        if (window.logUserAction) window.logUserAction('board', '삭제', '메모 삭제');

        loadBoard();
      } catch (err) {
        console.error("Delete error:", err);
      }
    };

    window.editBoardPost = async (id) => {
      const { db, firestoreUtils } = window;
      try {
        const q = firestoreUtils.query(firestoreUtils.collection(db, "boardPosts"));
        const snap = await firestoreUtils.getDocs(q);
        let target = null;
        snap.forEach(d => { if(d.id === id) target = d.data(); });
        
        if (target) {
          document.getElementById('post-id').value = id;
          editor.innerHTML = target.content;
          
          if (authors.includes(target.author)) {
               selectedAuthorInput.value = target.author;
               customAuthorInput.style.display = 'none';
          } else {
               selectedAuthorInput.value = '직접 입력';
               customAuthorInput.style.display = 'block';
               customAuthorInput.value = target.author;
          }
          renderAuthorChips();
          
          const statusRadios = document.querySelectorAll('input[name="post-status"]');
          statusRadios.forEach(radio => {
            if (radio.value === (target.status || 'normal')) radio.checked = true;
          });

          selectedColor = target.color || '#fff9c4';
          colorTrigger.style.backgroundColor = selectedColor;
          colorOptions.forEach(o => {
              if(o.dataset.color === selectedColor) o.classList.add('selected');
              else o.classList.remove('selected');
          });

          document.getElementById('boardModalTitle').textContent = '메모 수정';
          modal.classList.add('active');
        }
      } catch (err) {}
    };

    window.addBoardComment = async (postId) => {
      const nameInput = document.getElementById(`comment-author-${postId}`);
      const textInput = document.getElementById(`comment-input-${postId}`);
      const author = nameInput.value.trim() || '익명';
      const text = textInput.value.trim();
      
      if (!text) return;

      const { db, firestoreUtils } = window;
      try {
          const docRef = firestoreUtils.doc(db, "boardPosts", postId);
          const snap = await firestoreUtils.getDocs(firestoreUtils.query(firestoreUtils.collection(db, "boardPosts")));
          let postData = null;
          snap.forEach(d => { if(d.id === postId) postData = d.data(); });

          if (postData) {
              const comments = postData.comments || [];
              comments.push({
                  author,
                  text,
                  createdAt: new Date().toISOString()
              });
              await firestoreUtils.setDoc(docRef, { comments }, { merge: true });
              textInput.value = '';
              loadBoard();
          }
      } catch (err) {
          console.error("Comment add error:", err);
      }
    };

    if (window.db) loadBoard();
    window.addEventListener('firebase-ready', loadBoard);
  }

  initNoticeBoard();

  // ================= Bus Request Section Logic (Spreadsheet Version) =================
  let localBusData = [];
  let busSortConfig = { field: 'date', direction: 'asc' }; // 정렬 설정
  let busTableFilter = 'pending'; // 'pending' | 'completed' | 'done'

  // Bus Dashboard State
  let busDashboardYear = new Date().getFullYear();
  let busDashboardMonth = new Date().getMonth() + 1;
  let busDashboardSelectedDate = null; // YYYY-MM-DD

  function canManageBus() {
      const isGlobalAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'sub-admin';
      const isDriver = window.currentUserPosition === '주무관' && 
                       Array.isArray(window.currentUserTasks) && 
                       window.currentUserTasks.includes('운전');
      return isGlobalAdmin || isDriver;
  }

  // ================= Pending Bus Widget (Admin/Driver Only) =================
  let isPendingBusWidgetSyncSetup = false;
  
  function setupPendingBusWidgetSync() {
      // 위젯 통합으로 인해 이 부분은 단순히 firebase-ready 리스너 역할만 담당
      if (!window.db || isPendingBusWidgetSyncSetup) return;
      isPendingBusWidgetSyncSetup = true;

      const { db, firestoreUtils } = window;
      firestoreUtils.onSnapshot(firestoreUtils.collection(db, "busRequests"), (querySnapshot) => {
          const loaded = [];
          querySnapshot.forEach(doc => {
              loaded.push({ id: doc.id, ...doc.data() });
          });
          localBusData = loaded;

          if (typeof sortBusData === 'function') sortBusData();
          if (typeof renderBusTable === 'function' && window.currentCategory === "bus") renderBusTable();
          
          if (typeof renderTodayWidget === 'function') renderTodayWidget(); // 트리거!
      });
  }
  // ============================================================================

  async function initBus() {
    if (localBusData.length === 0) {
      await loadBusRequestsFromFirebase();
    } else {
      renderBusTable();
    }
    autoPromoteToCompleted(); // 날짜 경과 접수완료→운행완료 자동 전환
    initBusEditing();
    initBusSorting(); // 정렬 리스너 초기화
    initBusDashboardLogic(); // 대시보드 로직 초기화
  }

  async function loadBusRequestsFromFirebase() {
    if (!window.db) {
      localBusData = [];
      renderBusTable();
      return;
    }
    const { db, firestoreUtils } = window;
    try {
      const q = firestoreUtils.query(firestoreUtils.collection(db, "busRequests"));
      const querySnapshot = await firestoreUtils.getDocs(q);
      const loaded = [];
      querySnapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() });
      });
      
      localBusData = loaded;
      sortBusData(); // 초기 정렬 적용
      renderBusTable();
    } catch (err) {
      console.error("Bus load error:", err);
      renderBusTable();
    }
  }

  function sortBusData() {
    localBusData.sort((a, b) => {
      let valA, valB;

      if (busSortConfig.field === 'total') {
        valA = (parseInt(a.teacherCount) || 0) + (parseInt(a.studentCount) || 0);
        valB = (parseInt(b.teacherCount) || 0) + (parseInt(b.studentCount) || 0);
      } else {
        valA = a[busSortConfig.field] || "";
        valB = b[busSortConfig.field] || "";
        
        // 숫자형 데이터 처리
        if (['busCount', 'teacherCount', 'studentCount'].includes(busSortConfig.field)) {
          valA = parseInt(valA) || 0;
          valB = parseInt(valB) || 0;
        }
      }

      if (valA < valB) return busSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return busSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function initBusSorting() {
    const headers = document.querySelectorAll("#bus-section .bus-table th[data-sort]");
    headers.forEach(header => {
      header.onclick = () => {
        const field = header.dataset.sort;
        if (busSortConfig.field === field) {
          busSortConfig.direction = busSortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
          busSortConfig.field = field;
          busSortConfig.direction = 'asc';
        }

        // UI 업데이트: 아이콘 변경
        headers.forEach(h => {
          h.classList.remove('active-sort');
          const icon = h.querySelector('i');
          if (icon) icon.className = 'fas fa-sort';
        });

        header.classList.add('active-sort');
        const currentIcon = header.querySelector('i');
        if (currentIcon) {
          currentIcon.className = busSortConfig.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }

        sortBusData();
        renderBusTable();
      };
    });
  }

  // 날짜 경과 접수완료 → 운행완료 자동 전환
  async function autoPromoteToCompleted() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    for (const req of localBusData) {
      // 접수완료 상태이면서 날짜가 지난 건만 운행완료로 전환
      if (req.isAccepted === true && req.status !== '운행완료' && req.date && req.date < todayStr) {
        req.status = '운행완료';
        // Firebase 동기화
        if (window.db) {
          const { db, firestoreUtils } = window;
          try {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "busRequests", req.id), {
              status: '운행완료'
            }, { merge: true });
          } catch (err) {
            console.error("Auto promote error:", err);
          }
        }
      }
    }
    renderBusTable();
  }

  function renderBusTable() {
    const tableBody = document.getElementById("bus-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    // 필터 상태에 따라 데이터 분리 (3가지)
    const filteredData = localBusData.filter(r => {
      if (busTableFilter === 'done') return r.status === '운행완료';
      if (busTableFilter === 'completed') return r.isAccepted === true && r.status !== '운행완료';
      return r.isAccepted !== true; // pending
    });

    // 필터 버튼 UI 업데이트 (활성/비활성)
    const completedBtn = document.getElementById('bus-filter-completed-btn');
    const doneBtn = document.getElementById('bus-filter-done-btn');
    if (completedBtn) {
      if (busTableFilter === 'completed') {
        completedBtn.innerHTML = '<i class="fas fa-list-check"></i><span>접수 중인 목록</span>';
        completedBtn.classList.add('active');
      } else {
        completedBtn.innerHTML = '<i class="fas fa-check-double"></i><span>접수완료 목록</span>';
        completedBtn.classList.remove('active');
      }
    }
    if (doneBtn) {
      if (busTableFilter === 'done') {
        doneBtn.innerHTML = '<i class="fas fa-list-check"></i><span>접수 중인 목록</span>';
        doneBtn.classList.add('active');
      } else {
        doneBtn.innerHTML = '<i class="fas fa-flag-checkered"></i><span>운행완료 목록</span>';
        doneBtn.classList.remove('active');
      }
    }

    // 빈 목록 안내
    if (filteredData.length === 0) {
      const emptyMeta = {
        pending:   { icon: 'fa-inbox',          text: '접수 중인 배차 신청 내역이 없습니다.' },
        completed: { icon: 'fa-check-circle',   text: '접수완료된 배차 내역이 없습니다.' },
        done:      { icon: 'fa-flag-checkered', text: '운행완료된 배차 내역이 없습니다.' }
      };
      const m = emptyMeta[busTableFilter];
      tableBody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.95rem;">
        <i class="fas ${m.icon}" style="font-size:2rem; display:block; margin-bottom:0.6rem; opacity:0.35;"></i>
        ${m.text}
      </td></tr>`;
      if (typeof renderBusDashboard === 'function') renderBusDashboard();
      return;
    }

    filteredData.forEach((req) => {
      const tr = document.createElement("tr");
      tr.dataset.id = req.id;
      
      const total = (parseInt(req.teacherCount) || 0) + (parseInt(req.studentCount) || 0);
      const isAccepted = req.isAccepted === true;
      const isDone = req.status === '운행완료';
      const statusText = isDone ? '운행완료' : (isAccepted ? '접수완료' : '접수중');
      const badgeClass = isDone ? 'done' : (isAccepted ? 'completed' : 'pending');

      // 운행완료 뷰에서는 체크박스 비활성화, 수정/삭제도 제한
      const checkboxDisabled = isDone ? 'disabled' : '';
      
      tr.innerHTML = `
        <td class="text-center">
            <input type="checkbox" class="bus-checkbox" ${isAccepted ? 'checked' : ''} ${checkboxDisabled}
                   onchange="window.toggleBusStatus('${req.id}', this.checked)">
        </td>
        <td class="text-center">
            <span class="badge-bus-status ${badgeClass}" id="status-badge-${req.id}">
                ${statusText}
            </span>
        </td>
        <td class="text-center">${req.date}</td>
        <td class="text-center">${req.timeRange || ""}</td>
        <td class="text-center">${req.region || ""}</td>
        <td class="text-center">${req.busType || ""}</td>
        <td class="text-center">${req.busCount || ""}</td>
        <td>${req.destination || ""}</td>
        <td class="text-center">${req.useSchoolBus || ""}</td>
        <td class="text-center">${req.leadTeacher || ""}</td>
        <td class="text-center">${req.teacherCount || "0"}</td>
        <td class="text-center">${req.studentCount || "0"}</td>
        <td class="text-center"><span class="total-display">${total}</span></td>
        <td class="bus-purpose-cell">${req.purpose || ""}</td>
        <td class="text-center">
          <div class="bus-actions">
            <button class="btn-icon btn-edit-sm" onclick="window.openBusModal('${req.id}')" title="수정"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-delete-sm" onclick="removeBusRow('${req.id}')" title="삭제"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    
    // 테이블이 다시 그려질 때 대시보드도 갱신
    if (typeof renderBusDashboard === 'function') {
        renderBusDashboard();
    }
  }

  function initBusDashboardLogic() {
      const tabsContainer = document.getElementById('bus-month-tabs');
      if (tabsContainer) {
          const months = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
          tabsContainer.innerHTML = months.map(m => `<button class="bus-month-tab" data-month="${m}">${m}월</button>`).join('');
          
          tabsContainer.querySelectorAll('.bus-month-tab').forEach(btn => {
              btn.addEventListener('click', (e) => {
                  const m = parseInt(e.target.dataset.month);
                  busDashboardMonth = m;
                  
                  const now = new Date();
                  const schoolYear = (now.getMonth() + 1 < 3) ? now.getFullYear() - 1 : now.getFullYear();
                  busDashboardYear = (m < 3) ? schoolYear + 1 : schoolYear;
                  
                  busDashboardSelectedDate = null;
                  renderBusDashboard();
              });
          });
      }

      const prevBtn = document.getElementById('bus-cal-prev-btn');
      if (prevBtn) {
          prevBtn.onclick = () => {
              busDashboardMonth--;
              if(busDashboardMonth < 1) { busDashboardMonth = 12; busDashboardYear--; }
              busDashboardSelectedDate = null;
              renderBusDashboard();
          };
      }

      const nextBtn = document.getElementById('bus-cal-next-btn');
      if (nextBtn) {
          nextBtn.onclick = () => {
              busDashboardMonth++;
              if(busDashboardMonth > 12) { busDashboardMonth = 1; busDashboardYear++; }
              busDashboardSelectedDate = null;
              renderBusDashboard();
          };
      }

      const quickAddBtn = document.getElementById('bus-quick-add-btn');
      if (quickAddBtn) {
          quickAddBtn.onclick = () => {
              // 현재 선택된 날짜가 있으면 그 날짜로, 없으면 이달의 1일 또는 오늘 날짜 권장
              const targetDate = busDashboardSelectedDate || `${busDashboardYear}-${String(busDashboardMonth).padStart(2,'0')}-01`;
              window.openBusModal(null, targetDate); // openBusModal이 날짜 인자를 받도록 처리 필요 여부 확인
          };
      }
  }

  function renderBusDashboard() {
      // 1. Update Tabs
      document.querySelectorAll('.bus-month-tab').forEach(btn => {
          if (parseInt(btn.dataset.month) === busDashboardMonth) {
              btn.classList.add('active');
          } else {
              btn.classList.remove('active');
          }
      });

      const monthTitle = document.getElementById('bus-cal-month-title');
      if (monthTitle) monthTitle.textContent = `${busDashboardMonth}월`;

      // 2. Update Calendar
      const daysContainer = document.getElementById('bus-calendar-days');
      if(!daysContainer) return;
      daysContainer.innerHTML = '';
      
      const firstDay = new Date(busDashboardYear, busDashboardMonth - 1, 1);
      const lastDay = new Date(busDashboardYear, busDashboardMonth, 0);
      const startingDay = firstDay.getDay(); // 0(Sun) ~ 6(Sat)
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      const dataDays = new Set();
      localBusData.forEach(req => {
          if (!req.date) return;
          const [y, m, d] = req.date.split('-');
          if (parseInt(y) === busDashboardYear && parseInt(m) === busDashboardMonth) {
              dataDays.add(parseInt(d));
          }
      });

      for (let i = 0; i < startingDay; i++) {
          daysContainer.innerHTML += `<div class="bus-day-cell empty"></div>`;
      }
      
      for (let i = 1; i <= lastDay.getDate(); i++) {
          const cellDay = new Date(busDashboardYear, busDashboardMonth - 1, i).getDay();
          let classes = ['bus-day-cell'];
          if (cellDay === 0) classes.push('sun');
          if (cellDay === 6) classes.push('sat');
          
          const dateStr = `${busDashboardYear}-${String(busDashboardMonth).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          
          if (dateStr === todayStr) classes.push('today');
          if (dateStr === busDashboardSelectedDate) classes.push('selected');
          if (dataDays.has(i)) classes.push('has-data');
          
          const div = document.createElement('div');
          div.className = classes.join(' ');
          div.textContent = i;
          div.dataset.date = dateStr;
          
          div.onclick = () => {
              if (busDashboardSelectedDate === dateStr) {
                  busDashboardSelectedDate = null;
              } else {
                  busDashboardSelectedDate = dateStr;
              }
              renderBusDashboard(); 
          };
          daysContainer.appendChild(div);
      }

      // 3. Update Summary List
      const listContainer = document.getElementById('bus-schedule-items');
      const listTitle = document.getElementById('bus-schedule-title');
      
      const headerBg = document.getElementById('bus-sch-header-bg');
      const scenery = document.getElementById('bus-scenery');
      
      const monthMeta = {
          3: { cls: 'month-3', emoji: '🎒' },
          4: { cls: 'month-4', emoji: '🌸' },
          5: { cls: 'month-5', emoji: '🎁' },
          6: { cls: 'month-6', emoji: '🌱' },
          7: { cls: 'month-7', emoji: '🌊' },
          8: { cls: 'month-8', emoji: '☀️' },
          9: { cls: 'month-9', emoji: '🌾' },
          10: { cls: 'month-10', emoji: '🍁' },
          11: { cls: 'month-11', emoji: '🍂' },
          12: { cls: 'month-12', emoji: '🎄' },
          1: { cls: 'month-1', emoji: '🌅' },
          2: { cls: 'month-2', emoji: '🎓' }
      };

      const meta = monthMeta[busDashboardMonth] || { cls: 'month-3', emoji: '🌸' };
      
      if (headerBg) {
          headerBg.className = `bus-sch-header ${meta.cls}`;
      }
      if (scenery) {
          scenery.textContent = meta.emoji;
      }
      
      let filteredData = localBusData.filter(r => {
          if(!r.date) return false;
          const [y, m] = r.date.split('-');
          return parseInt(y) === busDashboardYear && parseInt(m) === busDashboardMonth;
      });

      if (listTitle) listTitle.textContent = `이달의 배차 현황`;
      
      if (!listContainer) return;
      listContainer.innerHTML = '';
      
      if (filteredData.length === 0) {
          listContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3.5rem 1rem; font-size: 1rem; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <i class="fas fa-calendar-times" style="font-size: 2.5rem; opacity: 0.3; color: var(--primary-color);"></i>
                <div style="font-family: 'Gaegu', cursive; font-size: 1.4rem; font-weight: 500;">이 날은 배차 신청 내역이 없어요!</div>
                <button class="btn-primary" style="margin-top: 5px; padding: 6px 15px; font-size: 0.85rem;" onclick="document.getElementById('bus-quick-add-btn').click()">지금 신청하기</button>
            </div>`;
          return;
      }
      
      filteredData.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

      let firstSelectedItem = null;
      filteredData.forEach(req => {
          const isDone = req.status === '운행완료';
          const isCompleted = req.isAccepted;
          const badgeClass = isDone ? 'done' : (isCompleted ? 'completed' : 'pending');
          const badgeText = isDone ? '운행완료' : (isCompleted ? '접수완료' : '접수중');
          const time = req.timeRange || '';
          
          const isSelected = req.date === busDashboardSelectedDate;
          const item = document.createElement('div');
          item.className = 'bus-sch-item' + (isSelected ? ' selected' : '');
          if (isSelected && !firstSelectedItem) firstSelectedItem = item;
          let adminActionHtml = '';
          if(canManageBus() && !isDone) {
               const actionBtnText = isCompleted ? '접수취소' : '접수완료';
               const bgType = isCompleted ? '#ef4444' : '#3b82f6';
               const hoverType = isCompleted ? '#dc2626' : '#2563eb';
               const icon = isCompleted ? 'fa-times' : 'fa-check';
               adminActionHtml = `<button type="button" class="btn-sm" style="margin-left:auto; background:${bgType}; color:#ffffff; border:none; font-size:0.75rem; padding:5px 12px; border-radius:6px; z-index:10; font-weight:700; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.15); transition:all 0.2s; display:flex; align-items:center; gap:5px;" onmouseover="this.style.background='${hoverType}'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='${bgType}'; this.style.transform='none';" onclick="event.stopPropagation(); window.toggleBusStatus('${req.id}', ${!isCompleted})"><i class="fas ${icon}"></i>${actionBtnText}</button>`;
          }

          item.innerHTML = `
            <div class="bus-sch-item-info" style="display:flex; flex-direction:column; width:100%;">
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px; width: 100%;">
                <span class="badge-bus-status ${badgeClass}" style="width: fit-content;">${badgeText}</span>
                <span class="bus-sch-item-title" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${req.date.substring(5).replace('-','.')} ${req.destination}</span>
                ${adminActionHtml}
              </div>
              <div class="bus-sch-item-meta" style="margin-left: 2px;">
                ${time} | 인솔: ${req.leadTeacher || '미정'} | 탑승 ${parseInt(req.studentCount||0)+parseInt(req.teacherCount||0)}명
              </div>
            </div>
            ${adminActionHtml ? '' : '<i class="fas fa-chevron-right" style="color: var(--primary-color);"></i>'}
          `;
          item.onclick = () => window.openBusModal(req.id);
          listContainer.appendChild(item);
      });

      if (firstSelectedItem) {
          setTimeout(() => {
              firstSelectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
      }
  }

  window.updateBusField = (id, field, value) => {
    const data = localBusData.find(r => r.id === id);
    if (data) data[field] = value;
  };

  window.updateBusTotal = (id, field, value) => {
    const data = localBusData.find(r => r.id === id);
    if (data) {
      data[field] = value;
      const total = (parseInt(data.teacherCount) || 0) + (parseInt(data.studentCount) || 0);
      const display = document.getElementById(`total-${id}`);
      if (display) display.textContent = total;
    }
  };

  window.toggleBusStatus = async (id, isChecked) => {
    const data = localBusData.find(r => r.id === id);
    if (data) {
        data.isAccepted = isChecked;
        data.status = isChecked ? "접수완료" : "접수중";
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', isChecked ? '접수' : '취소', `${data.date} ${data.destination}행 배차 ${data.status}`);
        }

        // Firebase 저장 추가
        if (window.db) {
            const { db, firestoreUtils } = window;
            try {
                await firestoreUtils.setDoc(firestoreUtils.doc(db, "busRequests", id), { 
                    isAccepted: isChecked, 
                    status: data.status 
                }, { merge: true });
            } catch (err) {
                console.error("Bus status save error:", err);
            }
        }

        // Update UI Badge
        const badge = document.getElementById(`status-badge-${id}`);
        if (badge) {
            badge.textContent = data.status;
            badge.className = `badge-bus-status ${isChecked ? 'completed' : 'pending'}`;
        }
        
        // 테이블 재렌더링 (필터에 따라 항목이 즉시 이동)
        renderBusTable();

        // Update Dashboard
        if (typeof renderBusDashboard === 'function') {
            renderBusDashboard();
        }
    }
  };

  // 필터 설정 함수 (3단계: pending / completed / done)
  window.setBusFilter = (filter) => {
    // 같은 필터를 다시 누르면 기본(pending)으로 복귀
    busTableFilter = busTableFilter === filter ? 'pending' : filter;
    renderBusTable();
  };

  function initBusEditing() {
    const busForm = document.getElementById("busForm");
    const busModal = document.getElementById("busModal");
    const closeBusModalBtns = document.querySelectorAll(".close-bus-modal");

    // Populate Time Selects
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const mins = ['00', '10', '20', '30', '40', '50'];
    
    const hSelects = ['bus-start-hour', 'bus-end-hour'];
    const mSelects = ['bus-start-min', 'bus-end-min'];
    
    hSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = hours.map(h => `<option value="${h}">${h}</option>`).join('');
    });
    mSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = mins.map(m => `<option value="${m}">${m}</option>`).join('');
    });

    // Modal Close
    closeBusModalBtns.forEach(btn => {
      btn.onclick = () => busModal.classList.remove("active");
    });

    // Form Submit
    if (busForm) {
      busForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("bus-id").value || "bus-" + Date.now();
        
        const sh = document.getElementById("bus-start-hour").value;
        const sm = document.getElementById("bus-start-min").value;
        const eh = document.getElementById("bus-end-hour").value;
        const em = document.getElementById("bus-end-min").value;
        
        const startTime = `${sh}:${sm}`;
        const endTime = `${eh}:${em}`;
        
        const newReq = {
          id: id,
          date: document.getElementById("bus-date").value,
          startTime: startTime,
          endTime: endTime,
          timeRange: `${startTime}~${endTime}`,
          region: document.getElementById("bus-region").value,
          busType: document.getElementById("bus-type").value,
          busCount: document.getElementById("bus-count").value,
          destination: document.getElementById("bus-destination").value,
          useSchoolBus: document.getElementById("bus-use-school").value,
          leadTeacher: document.getElementById("bus-teacher-name").value,
          teacherCount: document.getElementById("bus-teacher-count").value,
          studentCount: document.getElementById("bus-student-count").value,
          purpose: document.getElementById("bus-purpose").value,
          isAccepted: false,
          status: "접수중"
        };

        // Firebase 즉시 저장
        if (window.db) {
          const { db, firestoreUtils } = window;
          try {
            await firestoreUtils.setDoc(firestoreUtils.doc(db, "busRequests", id), newReq);
          } catch (err) {
            console.error("Save error:", err);
            alert("저장 중 오류가 발생했습니다.");
            return;
          }
        }

        const existingIdx = localBusData.findIndex(r => r.id === id);
        const actionType = existingIdx !== -1 ? '수정' : '신청';
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', actionType, `${newReq.date} ${newReq.destination}행 배차 ${actionType}`);
        }

        if (existingIdx !== -1) {
            localBusData[existingIdx] = { ...localBusData[existingIdx], ...newReq };
        } else {
            localBusData.unshift(newReq);
        }

        busModal.classList.remove("active");
        renderBusTable();
      };
    }
  }

  window.openBusModal = (id = null, targetDate = null) => {
    const modal = document.getElementById("busModal");
    const form = document.getElementById("busForm");
    const title = document.getElementById("busModalTitle");
    const adminActions = document.getElementById("bus-modal-admin-actions");
    
    form.reset();
    document.getElementById("bus-id").value = id || "";

    if (adminActions) {
      adminActions.innerHTML = '';
      adminActions.classList.add('hidden');
    }
    
    if (id) {
      title.textContent = "배차 신청 수정";
      const data = localBusData.find(r => r.id === id);
      if (data) {
        document.getElementById("bus-date").value = data.date;
        
        if (data.startTime) {
          const [sh, sm] = data.startTime.split(':');
          document.getElementById("bus-start-hour").value = sh;
          document.getElementById("bus-start-min").value = sm;
        }
        if (data.endTime) {
          const [eh, em] = data.endTime.split(':');
          document.getElementById("bus-end-hour").value = eh;
          document.getElementById("bus-end-min").value = em;
        }

        document.getElementById("bus-region").value = data.region || "관내";
        document.getElementById("bus-type").value = data.busType || "중형(16~35인)";
        document.getElementById("bus-count").value = data.busCount || "1";
        document.getElementById("bus-destination").value = data.destination || "";
        document.getElementById("bus-use-school").value = data.useSchoolBus || "Y";
        document.getElementById("bus-teacher-name").value = data.leadTeacher || "";
        document.getElementById("bus-teacher-count").value = data.teacherCount || "0";
        document.getElementById("bus-student-count").value = data.studentCount || "0";
        document.getElementById("bus-purpose").value = data.purpose || "";

        // Admin Actions inside Modal
        if (canManageBus() && data.status !== '운행완료' && adminActions) {
            adminActions.classList.remove('hidden');
            const isCompleted = data.isAccepted;
            const actionBtnText = isCompleted ? '접수취소' : '접수완료';
            const bgType = isCompleted ? '#ef4444' : '#3b82f6';
            const hoverType = isCompleted ? '#dc2626' : '#2563eb';
            const icon = isCompleted ? 'fa-times' : 'fa-check';
            adminActions.innerHTML = `<button type="button" class="btn-sm" style="background:${bgType}; color:#ffffff; border:none; font-size:0.85rem; padding:7px 16px; border-radius:8px; font-weight:700; cursor:pointer; box-shadow:0 3px 8px rgba(0,0,0,0.15); transition:all 0.2s; display:flex; align-items:center; gap:6px;" onmouseover="this.style.background='${hoverType}'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='${bgType}'; this.style.transform='none';" onclick="window.toggleBusStatusFromModal('${id}', ${!isCompleted})"><i class="fas ${icon}"></i>${actionBtnText}</button>`;
        }
      }
    } else {
      title.textContent = "배차 신청";
      document.getElementById("bus-date").value = targetDate || new Date().toISOString().split('T')[0];
      document.getElementById("bus-start-hour").value = "08";
      document.getElementById("bus-start-min").value = "30";
      document.getElementById("bus-end-hour").value = "16";
      document.getElementById("bus-end-min").value = "30";
    }
    
    modal.classList.add("active");
  };

  window.toggleBusStatusFromModal = async (id, isChecked) => {
      await window.toggleBusStatus(id, isChecked);
      document.getElementById("busModal").classList.remove("active");
  };

  window.removeBusRow = async (id) => {
    if (confirm("해당 행을 삭제하시겠습니까?")) {
      const idx = localBusData.findIndex(r => r.id === id);
      if (idx !== -1) {
        const deletedData = localBusData[idx];
        if (window.db) {
          const { db, firestoreUtils } = window;
          try {
            await firestoreUtils.deleteDoc(firestoreUtils.doc(db, "busRequests", id));
          } catch (err) {
            console.error("Delete error:", err);
            alert("삭제 중 오류가 발생했습니다.");
            return;
          }
        }
        
        // Log action
        if(window.logUserAction) {
            window.logUserAction('bus', '삭제', `${deletedData.date} ${deletedData.destination}행 배차 삭제`);
        }

        localBusData.splice(idx, 1);
        renderBusTable();
      }
    }
  };

  window.addEventListener('firebase-ready', () => {
    setupPendingBusWidgetSync();
  });

  // 사이트 제목 클릭 시 홈으로 이동
  const sideTitle = document.querySelector('.side-site-title');
  if (sideTitle) {
    sideTitle.addEventListener('click', () => {
      const homeBtn = document.querySelector('.nav-item[data-category="all"]');
      if (homeBtn) homeBtn.click();
    });
  }

  // --- Board Post Copy Function ---
  window.copyBoardPost = (id, element) => {
    const card = element.closest('.board-card');
    const content = card.querySelector('.card-text-content').innerText;
    
    navigator.clipboard.writeText(content).then(() => {
      // Visual feedback
      const originalIcon = element.innerHTML;
      if (element.tagName === 'BUTTON') {
        element.innerHTML = '<i class="fas fa-check"></i>';
        element.style.color = '#10b981';
      } else {
        // If text content was clicked
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = '메모가 복사되었습니다.';
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('active'), 10);
        setTimeout(() => {
          toast.classList.remove('active');
          setTimeout(() => toast.remove(), 300);
        }, 2000);
      }
      
      if (element.tagName === 'BUTTON') {
        setTimeout(() => {
          element.innerHTML = originalIcon;
          element.style.color = '';
        }, 2000);
      }
    }).catch(err => {
      console.error('Copy failed', err);
    });
  };

  // --- Theme Toggle Logic ---
  const themeToggle = document.querySelector('#checkbox');
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme === 'dark-mode') {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.checked = true;
  }

  if (themeToggle) {
    themeToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light-mode');
      }
    });
  }

  // --- Header Scroll Effect ---
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
  // --- Mobile Swipe Navigation (Removed duplicate listener) ---

  // ============================================
  // LOGIN & REGISTER LOGIC (ADDED)
  // ============================================

  // 1. Firebase Initialize (Compat)
  const firebaseConfig = {
    apiKey: "AIzaSyCQmDCL-PuN2A9AgOzIpObCeNtvIFDJmhU",
    authDomain: "studio-8412089884-f8185.firebaseapp.com",
    projectId: "studio-8412089884-f8185",
    storageBucket: "studio-8412089884-f8185.firebasestorage.app",
    messagingSenderId: "928283224778",
    appId: "1:928283224778:web:01cb08827402140aace233"
  };

  let auth, db;

  try {
      // Wait for firebase script to load if not ready
      if (typeof firebase !== 'undefined') {
          if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
          }
          
          // CRITICAL: If modular Firebase is already present, DO NOT overwrite it.
          // Instead, polyfill the compat methods (.collection) onto the modular instance.
          if (window.db && window.firestoreUtils && !window.db.collection) {
              console.log("Modular Firebase detected. Adding compatibility layer...");
              const mDb = window.db;
              const mUtils = window.firestoreUtils;
              
              // Polyfill .collection for modular db
              window.db.collection = function(name) {
                  const collRef = mUtils.collection(mDb, name);
                  const wrapQuery = (q) => ({
                      where: (f, o, v) => wrapQuery(mUtils.query(q, mUtils.where(f, o, v))),
                      orderBy: (f, d) => wrapQuery(mUtils.query(q, mUtils.orderBy(f, d))),
                      limit: (n) => wrapQuery(mUtils.query(q, mUtils.limit(n))),
                      get: () => mUtils.getDocs(q),
                      onSnapshot: (cb) => mUtils.onSnapshot(q, cb)
                  });

                  return {
                      ...wrapQuery(collRef),
                      doc: (id) => {
                          const docRef = mUtils.doc(mDb, name, id);
                          return {
                              get: () => mUtils.getDoc(docRef),
                              set: (v) => mUtils.setDoc(docRef, v),
                              update: (v) => mUtils.updateDoc(docRef, v),
                              delete: () => mUtils.deleteDoc(docRef),
                              onSnapshot: (cb) => mUtils.onSnapshot(docRef, cb)
                          };
                      },
                      add: (v) => mUtils.addDoc(collRef, v)
                  };
              };
          } else if (!window.db) {
              // Standard Compat Init (only if no modular)
              window.auth = firebase.auth();
              window.db = firebase.firestore();
          }

          if (!window.firestoreUtils) {
              // Compat Mapper for legacy scripts if modular utils are missing
              window.firestoreUtils = {
                  collection: (d, n) => d.collection(n),
                  doc: (d, c, i) => i ? d.collection(c).doc(i) : d, 
                  getDocs: (q) => q.get(), 
                  getDoc: async (d) => {
                      const snap = await d.get();
                      if (snap && typeof snap.exists !== 'function') {
                          const val = snap.exists;
                          snap.exists = () => val;
                      }
                      return snap;
                  },
                  setDoc: (d, v) => d.set(v),
                  updateDoc: (d, v) => d.update(v),
                  deleteDoc: (d) => d.delete(),
                  orderBy: (field, dir) => ({ type: 'orderBy', field, dir }),
                  limit: (n) => ({ type: 'limit', val: n }),
                  where: (field, op, val) => ({ type: 'where', field, op, val }),
                  query: (q, ...args) => {
                      let queryRef = q;
                      args.forEach(arg => {
                          if (arg.type === 'orderBy') queryRef = queryRef.orderBy(arg.field, arg.dir);
                          else if (arg.type === 'limit') queryRef = queryRef.limit(arg.val);
                          else if (arg.type === 'where') queryRef = queryRef.where(arg.field, arg.op, arg.val);
                      });
                      return queryRef;
                  },
                  onSnapshot: (q, cb) => q.onSnapshot(cb)
              };
          }
          
          auth = window.auth;
          db = window.db;
          
          window.dispatchEvent(new Event('firebase-ready'));
      }
  } catch (e) {
      console.error("Firebase Init Error:", e);
  }



  /* ============================================
     ADMIN PAGE ENHANCEMENTS (Stats, Logs, Bin)
     ============================================ */
  
  // 1. Admin Top Navigation & View Switching
  window.switchAdminView = (viewId) => {
    // Updated selector for new top menu buttons
    const navItems = document.querySelectorAll('.admin-nav-btn[data-view]');
    const views = document.querySelectorAll('.admin-view');
    const headerTitle = document.getElementById('admin-view-title');
    const headerDesc = document.getElementById('admin-view-desc');

    const viewInfo = {
      'dashboard': { title: '대시보드', desc: '관리자 현황 및 통계' },
      'users': { title: '교직원 현황', desc: '가입 승인 및 회원 정보 관리' },
      'logs': { title: '관리자 로그', desc: '관리자 및 시스템 활동 기록' },
      'user-logs': { title: '사용자 로그', desc: '사용자들의 주요 활동 내역' },
      'bin': { title: '휴지통', desc: '삭제된 회원 복구 및 영구 삭제' },
      'menus': { title: '메뉴 관리', desc: '메인 메뉴 및 위젯 표시 설정' },
      'overlay': { title: '메인버튼 관리', desc: '화면 우측 상단에 떠 있는 버튼들(예: 구글시트 배차신청)을 관리합니다.' }
    };

    // Update Nav
    navItems.forEach(n => {
        if(n.dataset.view === viewId) n.classList.add('active');
        else n.classList.remove('active');
    });

    // Update View
    views.forEach(v => {
      v.classList.remove('active');
      if(v.id === `admin-view-${viewId}`) v.classList.add('active');
    });

    // Update Header
    if(headerTitle && viewInfo[viewId]) {
        headerTitle.textContent = viewInfo[viewId].title;
        headerDesc.textContent = viewInfo[viewId].desc;
    }

    // Trigger Data Load needed for specific views
    if(viewId === 'dashboard') window.loadUserStats(); // New: Dashboard statistics
    if(viewId === 'logs') window.loadAdminLogs();
    if(viewId === 'user-logs') window.loadUserLogs();
    if(viewId === 'bin') window.loadRecycleBin();
    if(viewId === 'menus') window.renderMenuSettings();
  };

  window.initAdminNav = () => {
    // Initialize navigation clicks (if not inline onclick)
    // Currently using inline onclick="switchAdminView(...)" in HTML, so strictly not needed,
    // but good for clean initialization or if removed inline.
    // The previous implementation added listeners.
    const navItems = document.querySelectorAll('.admin-nav-btn[data-view]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        window.switchAdminView(item.dataset.view);
      });
    });
  };

  window.downloadUserCSV = () => {
     // Retrieve adminUsers from somewhere or re-fetch?
     // adminUsers is in index.html module scope. We can't access it easily unless we expose it.
     // But wait, renderAdminTable uses it. 
     // We can try to access the table rows directly or fetch again.
     // Fetching again is safer.
     if(!db) return;
     
     // Ask for confirmation
     if(!confirm("전체 회원 명부를 CSV로 다운로드하시겠습니까? (개인정보 보호 주의)")) return;

     db.collection("users").orderBy("createdAt", "desc").get().then(snap => {
         let csv = "\uFEFF이름,이메일,소속,직위,담임여부(반),권한,가입일,상태\n";
         snap.forEach(doc => {
             const u = doc.data();
             if(u.deleted) return; // Skip deleted

             const classInfo = u.isHomeroom ? (u.classInfo || 'O') : 'X';
             const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '';
             const status = u.approved ? '승인' : '대기';
             
             // Escape commas
             const clean = (s) => (s || '').replace(/,/g, ' ');
             
             csv += `${clean(u.name)},${clean(u.email)},${clean(u.school)},${clean(u.position)},${clean(classInfo)},${u.role},${date},${status}\n`;
         });
         
         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
         const link = document.createElement("a");
         const url = URL.createObjectURL(blob);
         link.setAttribute("href", url);
         link.setAttribute("download", `회원명부_${new Date().toLocaleDateString()}.csv`);
         link.style.visibility = 'hidden';
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         
         if(window.logAdminAction) window.logAdminAction("명부 다운로드", "전체 회원 명부 CSV 다운로드");
     });
  };

  // 2. Dashboard Statistics & Recent Logs Update
  window.updateAdminDashboard = (users) => {
      // Users is the list of ACTIVE users (not deleted)
      const total = users.length;
      const teachers = users.filter(u => u.position && (u.position.includes('교사') || u.position.includes('부장'))).length;
      const pending = users.filter(u => !u.approved).length;
      
      const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
      
      setTxt('stat-total-users', total);
      setTxt('stat-total-teachers', teachers);
      setTxt('stat-pending-users', pending);
      
      // Async fetch for deleted count
      if(db) {
         db.collection("users").where("deleted", "==", true).get()
         .then(snap => {
             setTxt('stat-deleted-users', snap.size);
         });

         // Fetch Recent Logs for Widget
         const logList = document.getElementById('dashboard-recent-logs');
         if(logList) {
             db.collection("adminLogs").orderBy('timestamp', 'desc').limit(5).get()
             .then(snap => {
                 if(snap.empty) {
                     logList.innerHTML = '<li class="empty-log">최근 활동이 없습니다.</li>';
                     return;
                 }
                 let html = '';
                 snap.forEach(doc => {
                     const log = doc.data();
                     const time = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                     html += `
                        <li class="log-item">
                            <div class="log-icon"><i class="fas fa-history"></i></div>
                            <div class="log-content">
                                <span class="log-text"><strong>${log.admin}</strong>: ${log.details}</span>
                                <span class="log-time">${time}</span>
                            </div>
                        </li>
                     `;
                 });
                 logList.innerHTML = html;
             });
         }
      }
  };

  // 3. Activity Logging (Admin)
  window.logAdminAction = async (action, details) => {
      if(!db) return;
      const user = auth.currentUser;
      const adminName = user ? (user.displayName || user.email) : 'System';

      try {
          await db.collection("adminLogs").add({
              action: action,
              details: details,
              admin: adminName,
              timestamp: new Date().toISOString()
          });
      } catch(e) { console.error("Logging failed", e); }
  };

  // 3.1 User Activity Logging (New)
  window.logUserAction = async (category, action = '조회', detail = '') => {
      if(!db || !auth.currentUser) return; // Only log logged-in users
      const user = auth.currentUser;
      const userName = user.displayName || user.email;
      const viewNames = {
          'all': '홈',
          'status': '학교현황',
          'account': '학교계정',
          'curriculum': '학사일정',
          'bus': '배차신청',
          'datayard': '자료마당',
          'support': '온학교 e지원',
          'training': '연수관리',
          'admin': '관리자 페이지'
      };
      
      const targetName = viewNames[category] || category;

      try {
           await db.collection("userLogs").add({
              user: userName,
              uid: user.uid,
              action: action,
              target: detail || targetName,
              timestamp: new Date().toISOString(),
              category: category
          });
      } catch(e) { console.error("User logging failed", e); }
  };

  // 4. Logs Viewer
  let adminLogsData = [];
  let adminLogsPage = 1;
  const logsPerPage = 10;

  window.loadAdminLogs = async function(page = 1) {
      const targetTbody = document.getElementById('admin-log-list');
      const pagination = document.getElementById('admin-log-pagination');
      if(!targetTbody) return;
      
      adminLogsPage = page;
      targetTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
      if(pagination) pagination.innerHTML = '';

      if(!db) {
          targetTbody.innerHTML = '<tr><td colspan="5" class="text-center">DB 연결 실패</td></tr>';
          return;
      }
      
      try {
          if (adminLogsData.length === 0 || page === 1) {
              const q = db.collection("adminLogs").orderBy('timestamp', 'desc').limit(200);
              const snap = await q.get();
              adminLogsData = [];
              snap.forEach(doc => adminLogsData.push(doc.data()));
          }
          
          if(adminLogsData.length === 0) {
              targetTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">기록된 로그가 없습니다.</td></tr>';
              return;
          }

          const totalPages = Math.ceil(adminLogsData.length / logsPerPage);
          const start = (page - 1) * logsPerPage;
          const end = start + logsPerPage;
          const paginatedLogs = adminLogsData.slice(start, end);

          let html = '';
          paginatedLogs.forEach(log => {
              const date = new Date(log.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              
              let target = '-';
              if(log.details && log.details.includes('(')) {
                  const match = log.details.match(/([^(]+)\(([^)]+)\)/);
                  if(match) target = match[1].trim();
              }

              html += `
                <tr>
                    <td style="font-size: 0.85rem; color: #64748b;">${dateStr}</td>
                    <td style="font-weight: 600;">${log.admin || 'System'}</td>
                    <td><span class="badge" style="background: #e0e7ff; color: #4338ca;">${log.action}</span></td>
                    <td style="color: #475569;">${target}</td> 
                    <td style="text-align: left; color: #334155;">${log.details}</td>
                </tr>
              `;
          });
          targetTbody.innerHTML = html;
          renderPagination(pagination, totalPages, page, 'loadAdminLogs');

      } catch(e) {
          console.error("Logs Error:", e);
          targetTbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">로그 로드 실패: ${e.message}</td></tr>`;
      }
  };

  let userLogsData = [];
  let userLogsPage = 1;

  window.loadUserLogs = async function(page = 1) {
      const targetTbody = document.getElementById('admin-user-log-list');
      const pagination = document.getElementById('admin-user-log-pagination');
      if(!targetTbody) return;
      
      userLogsPage = page;
      
      // Get filter values
      const startDate = document.getElementById('filter-user-log-start')?.value;
      const endDate = document.getElementById('filter-user-log-end')?.value;
      const filterName = document.getElementById('filter-user-log-name')?.value.trim().toLowerCase();
      const filterAction = document.getElementById('filter-user-log-action')?.value;
      const filterCategory = document.getElementById('filter-user-log-category')?.value;

      targetTbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
      if(pagination) pagination.innerHTML = '';

      if(!window.db) {
          targetTbody.innerHTML = '<tr><td colspan="5" class="text-center">DB 연결 실패</td></tr>';
          return;
      }
      
      try {
          const { db, firestoreUtils } = window;
          
          if (userLogsData.length === 0 || page === 1) {
              let q = firestoreUtils.query(
                  firestoreUtils.collection(db, "userLogs"),
                  firestoreUtils.orderBy('timestamp', 'desc'),
                  firestoreUtils.limit(500) 
              );
              
              const snap = await firestoreUtils.getDocs(q);
              userLogsData = [];
              snap.forEach(doc => userLogsData.push({ id: doc.id, ...doc.data() }));
          }

          // Client-side Filtering
          let filteredLogs = userLogsData.filter(log => {
              if (startDate) {
                  const s = new Date(startDate + "T00:00:00");
                  if (new Date(log.timestamp) < s) return false;
              }
              if (endDate) {
                  const e = new Date(endDate + "T23:59:59");
                  if (new Date(log.timestamp) > e) return false;
              }
              if (filterName && !log.user?.toLowerCase().includes(filterName)) return false;
              if (filterAction && log.action !== filterAction) return false;
              if (filterCategory && log.category !== filterCategory) return false;
              return true;
          });

          if(filteredLogs.length === 0) {
              targetTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">필터 결과에 해당하는 로그가 없습니다.</td></tr>';
              return;
          }

          const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
          const start = (page - 1) * logsPerPage;
          const end = start + logsPerPage;
          const paginatedLogs = filteredLogs.slice(start, end);

          let html = '';
          paginatedLogs.forEach(log => {
              const date = new Date(log.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              
              let actionClass = 'badge-blue';
              if (['삭제', '취소'].includes(log.action)) actionClass = 'badge-red';
              else if (['생성', '신청', '접수'].includes(log.action)) actionClass = 'badge-green';
              else if (['수정', '이동'].includes(log.action)) actionClass = 'badge-orange';
              
              const detailsHtml = log.details ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${log.details}</div>` : '';
              const catName = log.category || '-'; // Define catName here

              html += `
                <tr>
                    <td style="font-size: 0.85rem; color: #64748b;">${dateStr}</td>
                    <td style="font-weight: 600;">${log.user || 'Unknown'}</td>
                    <td><span class="badge ${actionClass}">${log.action}</span></td>
                    <td style="color: #475569;">
                        ${log.target || '-'}
                        ${detailsHtml}
                    </td> 
                    <td style="text-align: left; color: #334155;">${catName}</td>
                </tr>
              `;
          });
          targetTbody.innerHTML = html;
          renderPagination(pagination, totalPages, page, 'loadUserLogs');

      } catch(e) {
          console.error("User Logs Error:", e);
          targetTbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">로그 로드 실패: ${e.message}</td></tr>`;
      }
  };

  function renderPagination(container, totalPages, currentPage, callbackName) {
      if(!container || totalPages <= 1) return;
      
      let html = '';
      // Prev
      html += `<button onclick="${callbackName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
      
      // Page numbers (Simple logic: show max 5 surrounding current)
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + 4);
      if (end - start < 4) start = Math.max(1, end - 4);

      for(let i = start; i <= end; i++) {
          html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
      }
      
      // Next
      html += `<button onclick="${callbackName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
      
      container.innerHTML = html;
  }

  window.resetUserLogFilters = function() {
      if(document.getElementById('filter-user-log-start')) document.getElementById('filter-user-log-start').value = '';
      if(document.getElementById('filter-user-log-end')) document.getElementById('filter-user-log-end').value = '';
      if(document.getElementById('filter-user-log-name')) document.getElementById('filter-user-log-name').value = '';
      if(document.getElementById('filter-user-log-action')) document.getElementById('filter-user-log-action').value = '';
      if(document.getElementById('filter-user-log-category')) document.getElementById('filter-user-log-category').value = '';
      window.loadUserLogs();
  };

  // 5. Recycle Bin (Deleted Users)
  window.loadRecycleBin = async function() {
      // index.html has id="admin-bin-list"
      const tbody = document.getElementById('admin-bin-list');
      if(!tbody) return;
      
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';

      if(!db) return;
      
      try {
          const snap = await db.collection("users").where("deleted", "==", true).get();
          
          if(snap.empty) {
              tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">휴지통이 비었습니다.</td></tr>';
              return;
          }

          let html = '';
          snap.forEach(docSnap => {
              const u = docSnap.data();
              if(!u) return;

              html += `
                <tr>
                    <td>${u.deletedAt ? new Date(u.deletedAt).toLocaleDateString() : '-'}</td>
                    <td>${u.name || '이름 없음'}</td>
                    <td>${u.email || '-'}</td>
                    <td><span class="badge badge-position">${u.position || '-'}</span></td>
                    <td><span class="badge badge-red">삭제됨</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="btn-icon btn-restore-sm" onclick="restoreUser('${docSnap.id}', '${u.name}')" title="복구">
                                <i class="fas fa-trash-restore"></i>
                            </button>
                            <button class="btn-icon btn-reject-sm" onclick="permanentDeleteUser('${docSnap.id}', '${u.name}')" title="영구 삭제">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
              `;
          });
          tbody.innerHTML = html;
      } catch(e) {
          console.error(e);
          tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500">로드 실패: ${e.message}</td></tr>`;
      }
  };

  // 6. User Management Actions (Soft Delete & Restore)
  window.softDeleteUser = async (uid, name) => {
      if(!confirm(`[${name}] 회원을 삭제하시겠습니까?\n휴지통으로 이동되며 복구할 수 있습니다.`)) return;
      if(!db) return;
      
      try {
          await db.collection("users").doc(uid).update({
              deleted: true,
              deletedAt: new Date().toISOString(),
              approved: false
          });
          window.logAdminAction('회원 삭제', `${name} (${uid}) 회원을 휴지통으로 이동`);
          alert('휴지통으로 이동되었습니다.');
          // UI update is handled by onSnapshot in index.html (it removes it from main list)
          // Dashboard numbers update automatically via onSnapshot -> loadAdminData -> updateAdminDashboard
      } catch(e) {
          alert("삭제 실패: " + e.message);
      }
  };

  window.restoreUser = async (uid, name) => {
      if(!confirm(`[${name}] 회원을 복구하시겠습니까?`)) return;
      if(!db) return;
      
      try {
          await db.collection("users").doc(uid).update({
              deleted: false,
              deletedAt: null,
              approved: true // Restore as approved for convenience
          });
          window.logAdminAction('회원 복구', `${name} (${uid}) 회원 복구`);
          loadRecycleBin(); 
      } catch(e) {
          alert("복구 실패: " + e.message);
      }
  };

  window.permanentDeleteUser = async (uid, name) => {
     if(!confirm(`[${name}] 회원을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다!`)) return;
     if(!db) return;

     try {
         await db.collection("users").doc(uid).delete();
         window.logAdminAction('영구 삭제', `${name} (${uid}) 회원 영구 삭제`);
         loadRecycleBin();
     } catch(e) {
         alert("삭제 실패: " + e.message);
     }
  };

  // Initialize Admin Nav on Load
  window.initAdminNav();

  // === 7. User Activity Statistics Logic (New) ===
  let statsChart = null;
  let statsData = []; // Aggregated data [{label, count, rawDate}]
  let currentStatsPeriod = 'daily'; // daily, weekly, monthly

  // Set default dates: Last 1 week
  const initStatsDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    const startEl = document.getElementById('stats-start-date');
    const endEl = document.getElementById('stats-end-date');
    if(startEl) startEl.value = start.toISOString().split('T')[0];
    if(endEl) endEl.value = end.toISOString().split('T')[0];
  };

  window.loadUserStats = async function() {
    if(!window.db) return;
    const { db, firestoreUtils } = window;
    
    // Check if dates are set
    const sEl = document.getElementById('stats-start-date');
    if(sEl && !sEl.value) initStatsDates();

    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    try {
        // Query userLogs for the period
        // For efficiency, we query by timestamp. 
        // Note: Missing index might cause error, fallback handled by getting last 1000 logs if needed.
        let q = firestoreUtils.query(
            firestoreUtils.collection(db, "userLogs"),
            firestoreUtils.where("timestamp", ">=", startDate + "T00:00:00"),
            firestoreUtils.where("timestamp", "<=", endDate + "T23:59:59"),
            firestoreUtils.orderBy("timestamp", "asc")
        );
        
        let snap;
        try {
            snap = await firestoreUtils.getDocs(q);
        } catch (e) {
            console.warn("Stats Index error, falling back to limited fetch", e);
            q = firestoreUtils.query(firestoreUtils.collection(db, "userLogs"), firestoreUtils.limit(2000));
            snap = await firestoreUtils.getDocs(q);
        }

        const logs = [];
        snap.forEach(doc => logs.push(doc.data()));
        
        processStatsData(logs, startDate, endDate);
        renderUserStatsChart();
        renderUserStatsTable();
    } catch (e) {
        console.error("Stats load failed", e);
    }
  };

  function processStatsData(logs, start, end) {
    const periodData = {};
    const s = new Date(start);
    const e = new Date(end);
    let prevYear = null;

    let curr = new Date(s);
    while (curr <= e) {
        let key = "";
        if (currentStatsPeriod === 'daily') {
            key = (curr.getMonth() + 1).toString().padStart(2, '0') + "." + curr.getDate().toString().padStart(2, '0');
        } else if (currentStatsPeriod === 'weekly') {
            // '2월 1주' format
            const month = curr.getMonth() + 1;
            const weekNum = getWeekOfMonth(curr);
            key = month + "월 " + weekNum + "주";
        } else {
            // Smart monthly format: '2026년 1월', then '2월', then '2027년 1월'
            const year = curr.getFullYear();
            const month = curr.getMonth() + 1;
            
            if (prevYear === null || (year !== prevYear && month === 1)) {
                key = year + "년 " + month + "월";
            } else {
                key = month + "월";
            }
            prevYear = year;
        }
        if (!periodData[key]) periodData[key] = new Set();
        
        if (currentStatsPeriod === 'daily') curr.setDate(curr.getDate() + 1);
        else if (currentStatsPeriod === 'weekly') curr.setDate(curr.getDate() + 7);
        else curr.setMonth(curr.getMonth() + 1);
    }

    logs.forEach(log => {
        const d = new Date(log.timestamp);
        if (d < s || d > new Date(end + "T23:59:59")) return;

        let key = "";
        if (currentStatsPeriod === 'daily') {
            key = (d.getMonth() + 1).toString().padStart(2, '0') + "." + d.getDate().toString().padStart(2, '0');
        } else if (currentStatsPeriod === 'weekly') {
            key = (d.getMonth() + 1) + "월 " + getWeekOfMonth(d) + "주";
        } else {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            // We need to find the correct key that was created in the initialization loop
            // The logic must match exactly how we built periodData keys
            // Re-running the logic is tricky due to prevYear, so we use a simpler approach
             key = month + "월";
             if (month === 1 || Object.keys(periodData).find(k => k.includes(year + "년") && k.includes(month + "월"))) {
                 const fullKey = year + "년 " + month + "월";
                 if(periodData[fullKey]) key = fullKey;
             }
        }
        
        if (periodData[key]) periodData[key].add(log.uid || log.user);
    });

    statsData = Object.keys(periodData).map(key => ({
        label: key,
        count: periodData[key].size
    }));
  }

  function getWeekOfMonth(date) {
    const day = date.getDate();
    return Math.ceil(day / 7);
  }

  function renderUserStatsChart() {
    const ctx = document.getElementById('userStatsChart');
    if(!ctx) return;

    const innerContainer = ctx.closest('.stats-chart-scroll-inner');
    const wrapper = innerContainer?.parentElement;
    
    if (innerContainer && wrapper) {
        // Point width 20px for high density as requested
        const pointWidth = 20; 
        const minWidth = wrapper.clientWidth - 5;
        const totalContentWidth = statsData.length * pointWidth;
        const finalWidth = Math.max(minWidth, totalContentWidth);
        innerContainer.style.width = finalWidth + 'px';
    }

    const data = {
        labels: statsData.map(d => d.label),
        datasets: [{
            label: '액티브 유저 수',
            data: statsData.map(d => d.count),
            borderColor: '#3b82f6',
            backgroundColor: (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                return gradient;
            },
            borderWidth: 2,
            tension: 0, // Sharp jagged peaks for professional "activity" look
            fill: true,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 1.5,
            pointRadius: statsData.length > 50 ? 0 : 2, // Hide points if very dense
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#3b82f6'
        }]
    };

    if (statsChart) statsChart.destroy();
    
    statsChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 5, right: 30, top: 10, bottom: 5 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    padding: 10,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` 활동: ${context.parsed.y}명`
                    }
                }
            },
            scales: {
                x: {
                    grid: { 
                        display: true,
                        color: 'rgba(226, 232, 240, 0.3)',
                        drawTicks: false
                    },
                    border: { display: false },
                    ticks: { 
                        color: '#94a3b8', 
                        font: { size: 9 },
                        maxRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 30, // Show labels every ~120px spaces
                        maxTicksLimit: 20
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(226, 232, 240, 0.5)',
                        drawTicks: false,
                        lineWidth: 1
                    },
                    border: { display: false },
                    suggestedMax: Math.max(...statsData.map(d => d.count)) + 2,
                    ticks: { 
                        stepSize: 1, 
                        color: '#94a3b8', 
                        font: { size: 10 },
                        padding: 10
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });

    // Smart Scroll: latest data
    setTimeout(() => {
        if (wrapper) {
            wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'auto' });
        }
    }, 50);
  }

  function renderUserStatsTable() {
    const head = document.getElementById('stats-table-head');
    const body = document.getElementById('stats-table-body');
    if(!head || !body) return;

    head.innerHTML = `<tr>${statsData.map(d => `<th style="text-align: center;">${d.label}</th>`).join('')}</tr>`;
    body.innerHTML = `<tr>${statsData.map(d => `<td style="text-align: center;">${d.count}</td>`).join('')}</tr>`;
  }

  window.updateStatsPeriod = function(period, btn) {
    currentStatsPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.loadUserStats();
  };

  window.updateStatsFromSelect = function() {
    const val = document.getElementById('stats-month-select').value;
    const end = new Date();
    const start = new Date();
    
    if (val === '1주') {
        start.setDate(start.getDate() - 7);
    } else {
        start.setMonth(start.getMonth() - parseInt(val));
    }
    
    document.getElementById('stats-start-date').value = start.toISOString().split('T')[0];
    document.getElementById('stats-end-date').value = end.toISOString().split('T')[0];
    window.loadUserStats();
  };

  window.updateStatsFromDate = function() {
    window.loadUserStats();
  };

  window.downloadStatsExcel = function() {
    if(!statsData || statsData.length === 0) return;
    
    // Convert to Excel format
    const rows = [
        ["기간", "액티브 유저 수"],
        ...statsData.map(d => [d.label, d.count])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ActiveUsers");
    
    const fileName = `ActiveUserStats_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };




  // === 8. Robust File Download Helper (Bypasses Browser Previewers) ===
  window.forceDownload = async function(e, url, title) {
    if (e) e.preventDefault();
    
    // Log the action for statistics
    if (window.logUserAction) {
      window.logUserAction('datayard', '다운로드', title);
    }

    let downloadUrl = url;

    // A. Detect and Convert Google Drive 'view' Links to 'uc?export=download'
    if (url.includes('drive.google.com')) {
        const driveRegex = /\/file\/d\/(.+?)\/(view|edit|open)/;
        const match = url.match(driveRegex);
        if (match && match[1]) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
        } else if (url.includes('id=')) {
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch) downloadUrl = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
        }
    } else if (url.includes('docs.google.com')) {
        // Detect Google Docs/Sheets/Slides links and convert to direct download export URLs
        const docsRegex = /\/(document|spreadsheets|presentation)\/d\/(.+?)\/(edit|view|open|preview)/;
        const match = url.match(docsRegex);
        if (match && match[1] && match[2]) {
            const type = match[1];
            const docId = match[2];
            if (type === 'spreadsheets') {
                downloadUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;
            } else if (type === 'document') {
                downloadUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;
            } else if (type === 'presentation') {
                downloadUrl = `https://docs.google.com/presentation/d/${docId}/export/pptx`;
            }
        }
    }

    // B. Attempt Blob-based download to bypass browser's built-in preview/PDF viewer
    // 구글 문서/드라이브 링크는 고유의 다운로드 프로토콜(파일 확장자, 파일명 자동 지정)이 있으므로 자체 렌더링을 피함
    const isGoogleLinks = downloadUrl.includes('drive.google.com') || downloadUrl.includes('docs.google.com');
    
    if (!isGoogleLinks) {
        try {
            const response = await fetch(downloadUrl);
            if (response.ok) {
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = title || 'download';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
                return;
            }
        } catch (err) {
            console.warn("Direct blob fetch failed (likely CORS), falling back to location-based download:", err);
        }
    }

    // C. Fallback for non-CORS sources (또는 구글 링크 원본 다운로드)
    window.location.href = downloadUrl;
  };

    // === Tab Switching Logic ===
    window.switchTab = function(category) {
        // 1. Hide all main sections
        const sections = [
            'status-section', 
            'intro-section', 
            'datayard-section', 
            'curriculum-section', 
            'helppage-section', 
            'account-section', 
            'bus-section', 
            'calendar-section', 
            'admin-section', 
            'training-section',
            'meal-section'
        ];
        
        sections.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.classList.add('hidden');
                el.style.display = 'none'; 
            }
        });

        // 2. Remove active class from nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // 3. Show selected section
        let targetId = '';
        switch(category) {
            case 'status': targetId = 'status-section'; break;
            case 'all': targetId = 'intro-section'; break; // Home maps to intro section
            case 'datayard': targetId = 'datayard-section'; break;
            case 'curriculum': targetId = 'curriculum-section'; break;
            case 'support': targetId = 'helppage-section'; break; 
            case 'account': targetId = 'account-section'; break;
            case 'bus': targetId = 'bus-section'; break;
            case 'calendar': targetId = 'calendar-section'; break; 
            case 'admin': targetId = 'admin-section'; break;
            case 'training': targetId = 'training-section'; break;
            case 'meal': targetId = 'meal-section'; if(window.renderMealView) window.renderMealView(); break;
        }

        const targetEl = document.getElementById(targetId);
        
        // Background mode control
        if (category === 'meal') {
            document.body.classList.add('meal-tab-mode');
        } else {
            document.body.classList.remove('meal-tab-mode');
        }

        if(targetEl) {
            targetEl.classList.remove('hidden');
            targetEl.style.display = 'block';
            
            // Lazy Load / Refresh
            if(category === 'curriculum') {
                window.shouldScrollToToday = true;
                if(window.renderCurriculum) window.renderCurriculum();
            }
            if(category === 'calendar' && calendar) calendar.render();
            if(category === 'training' && window.initTraining) {
                if (!window.trainingInitialized) {
                    window.initTraining();
                    window.trainingInitialized = true;
                } else if (typeof window.loadTrainings === 'function') {
                    window.loadTrainings();
                }
            }
            if(category === 'meal' && window.renderWeeklyView) {
                window.renderWeeklyView();
            }
        }

        // Reset scroll AFTER layout is finalized
        const mainEl = document.querySelector('main');
        if (mainEl) mainEl.scrollTop = 0;

        // 4. Set active nav item
        const navBtn = document.querySelector(`.nav-item[data-category="${category}"]`);
        if(navBtn) {
            navBtn.classList.add('active');
            
            // Auto-scroll the nav menu to keep active item in view (Mobile)
            const navContainer = document.getElementById('category-nav');
            if (navContainer && window.innerWidth <= 768) {
                const scrollLeftPos = navBtn.offsetLeft - (navContainer.offsetWidth / 2) + (navBtn.offsetWidth / 2);
                navContainer.scrollTo({ left: Math.max(0, scrollLeftPos), behavior: 'smooth' });
            }
        }

        // 5. Update State
        window.currentCategory = category;

        // 6. Update Body Background Theme (for full-page background)
        document.body.classList.remove('bg-theme-training', 'bg-theme-admin', 'bg-theme-support');
        
        const helppageBg = document.getElementById('helppage-bg-elements');
        if (helppageBg) {
            if (category === 'support') {
                helppageBg.classList.remove('hidden');
                document.body.classList.add('bg-theme-support');
            } else {
                helppageBg.classList.add('hidden');
            }
        }
        
        if (category === 'training') document.body.classList.add('bg-theme-training');
        if (category === 'admin') document.body.classList.add('bg-theme-admin');
    };

    // Attach Event Listeners to Nav Items (Ensures all buttons work)
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Prevent default just in case
            const category = btn.dataset.category;
            if (category) {
                window.switchTab(category);
            }
        });
    });

    // ================= Mobile Swipe Navigation =================
    const mainContainer = document.querySelector('main');
    let touchStartX = 0;
    let touchStartY = 0;
    const minSwipeDistance = 50;
    let isSwiping = false;

    if (mainContainer) {
        mainContainer.addEventListener('touchstart', (e) => {
            if (e.changedTouches && e.changedTouches.length > 0) {
                touchStartX = e.changedTouches[0].screenX;
                touchStartY = e.changedTouches[0].screenY;
            }
        }, {passive: true});

        mainContainer.addEventListener('touchend', (e) => {
            // Only active on mobile view
            if (window.innerWidth > 768) return;

            if (!e.changedTouches || e.changedTouches.length === 0) return;

            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            if (isSwiping) return;

            // 1. Ignore if vertical scroll is dominant
            if (Math.abs(diffX) < Math.abs(diffY)) return;

            // 2. Ignore short swipes
            if (Math.abs(diffX) < minSwipeDistance) return;

            // 3. Ignore if swiping on a horizontally scrollable element
            let target = e.target;
            let isScrollable = false;
            
            // Traverse up to find scrollable parent
            while (target && target !== mainContainer && target !== document.body) {
                // Check if element is scrollable
                if (target.scrollWidth > target.clientWidth) {
                     const style = window.getComputedStyle(target);
                     if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                         isScrollable = true;
                         break;
                     }
                }
                target = target.parentElement;
            }
            if (isScrollable) return;

            // 4. Navigate Tabs (Find visible nav items, exclude admin)
            const navItems = Array.from(document.querySelectorAll('.nav-item'));
            const contentItems = navItems.filter(btn => !btn.classList.contains('hidden') && window.getComputedStyle(btn).display !== 'none' && btn.dataset.category !== 'admin');
            
            const activeBtn = document.querySelector('.nav-item.active');
            if (!activeBtn) return;

            // Find index in the *filtered* visible list
            const currentIndex = contentItems.indexOf(activeBtn);
            if (currentIndex === -1) return;

            let navigated = false;

            if (diffX < 0) {
                // Swipe Left -> Go Next (Right Tab)
                if (currentIndex < contentItems.length - 1) {
                    const nextBtn = contentItems[currentIndex + 1];
                    nextBtn.click();
                    navigated = true;
                }
            } else {
                // Swipe Right -> Go Prev (Left Tab)
                if (currentIndex > 0) {
                    const prevBtn = contentItems[currentIndex - 1];
                    prevBtn.click();
                    navigated = true;
                }
            }

            if (navigated) {
                isSwiping = true;
                setTimeout(() => {
                    isSwiping = false;
                }, 300);
            }
        }, {passive: true});
    }

});

// === 7. Menu & Widget Management (Global Scope for Timing) ===
window.menuSettings = {
    menus: {
        'status': true,
        'account': true,
        'curriculum': true,
        'bus': true,
        'datayard': true,
        'support': true,
        'training': true,
        'meal': true,
        'kigyo': true
    },
    widgets: {
        'school-today-widget': true,
        'notice-widget': true
    }
};

let menuSettingsUnsubscribe = null;

window.loadMenuSettings = async () => {
    // 안전한 폴링 대기 로직 적용
    const waitForDB = () => {
        return new Promise(resolve => {
            const check = () => {
                if (window.db && window.firebaseReady && window.firestoreUtils) resolve();
                else setTimeout(check, 100);
            };
            check();
        });
    };
    
    await waitForDB();

    const db = window.db;
    const firestoreUtils = window.firestoreUtils;
    if (!db || !firestoreUtils) return;

    // 이미 리스너가 실행 중이면 중복 실행 방지
    if (menuSettingsUnsubscribe) return;

    try {
        const docRef = firestoreUtils.doc(db, "menu_visibility", "current");
        
        // 실시간 리스너 적용 (모든 유저에게 즉시 반영되도록)
        menuSettingsUnsubscribe = firestoreUtils.onSnapshot(docRef, (docSnap) => {
            console.log("Menu settings sync received");
            if (docSnap && typeof docSnap.exists === 'function' && docSnap.exists()) {
                const data = docSnap.data();
                if(data.menus) window.menuSettings.menus = { ...window.menuSettings.menus, ...data.menus };
                if(data.widgets) window.menuSettings.widgets = { ...window.menuSettings.widgets, ...data.widgets };
                console.log("Applied synced menu settings:", window.menuSettings);
            } else {
                console.log("No remote menu settings found, using defaults.");
            }
            window.applyMenuSettings();
        }, (err) => {
            console.error("Firestore menu settings listener error:", err);
            // 권한 문제 등이 발생하더라도 기본값으로 UI 적용
            window.applyMenuSettings();
        });
    } catch (e) {
        console.error("Failed to initialize menu settings listener:", e);
        window.applyMenuSettings();
    }
};

window.applyMenuSettings = () => {
    console.log("Applying Menu Settings UI...");
    // Apply Menus
    const kigyoIdMap = { 'kigyo': 'nav-kigyo-btn' };
    for (const [key, isVisible] of Object.entries(window.menuSettings.menus)) {
        const btn = kigyoIdMap[key]
            ? document.getElementById(kigyoIdMap[key])
            : document.querySelector(`.nav-item[data-category="${key}"]`);
        if (btn) {
            if (isVisible) {
                btn.classList.remove('hidden');
                btn.style.display = '';
            } else {
                btn.classList.add('hidden');
                btn.style.setProperty('display', 'none', 'important');
            }
        }
    }

    // Apply Widgets
    for (const [id, isVisible] of Object.entries(window.menuSettings.widgets)) {
        const widget = document.getElementById(id);
        if (widget) {
            if (isVisible) {
                widget.classList.remove('hidden');
                widget.style.display = '';
            } else {
                widget.classList.add('hidden');
                widget.style.setProperty('display', 'none', 'important');
            }
        }
    }
    
    // Re-trigger resize to adjust layout
    window.dispatchEvent(new Event('resize'));
};

window.renderMenuSettings = () => {
    const menuContainer = document.getElementById('admin-menu-toggle-list');
    const widgetContainer = document.getElementById('admin-widget-toggle-list');
    
    const menuNames = {
        'status': '학교현황',
        'account': '학교계정',
        'curriculum': '학사일정',
        'bus': '배차신청',
        'datayard': '자료마당',
        'support': '온학교 e지원',
        'training': '연수관리',
        'meal': '급식정보',
        'kigyo': '계기교육'
    };
    
    const widgetNames = {
        'school-today-widget': '오늘의 일정',
        'notice-widget': '알립니다 (메모/공지)'
    };

    const renderToggleItem = (type, key, name, isChecked) => {
        const statusLabel = isChecked ? '공개' : '비공개';
        const activeClass = isChecked ? 'is-active' : '';
        
        return `
          <div class="menu-toggle-item ${activeClass}" data-key="${key}">
              <span class="item-name">${name}</span>
              <div class="toggle-control-group">
                  <span class="status-text">${statusLabel}</span>
                  <label class="switch">
                      <input type="checkbox" onchange="toggleMenuVisibility('${type}', '${key}', this.checked, this)" ${isChecked ? 'checked' : ''}>
                      <span class="slider round"></span>
                  </label>
              </div>
          </div>
        `;
    };

    if (menuContainer) {
        menuContainer.innerHTML = Object.entries(menuNames).map(([key, name]) => {
            const isChecked = window.menuSettings.menus[key] !== false; 
            return renderToggleItem('menus', key, name, isChecked);
        }).join('');
    }

    if (widgetContainer) {
         widgetContainer.innerHTML = Object.entries(widgetNames).map(([key, name]) => {
            const isChecked = window.menuSettings.widgets[key] !== false; 
            return renderToggleItem('widgets', key, name, isChecked);
        }).join('');
    }
};

window.toggleMenuVisibility = (type, key, checked, element) => {
    if (type === 'menus') window.menuSettings.menus[key] = checked;
    else if (type === 'widgets') window.menuSettings.widgets[key] = checked;

    if(element) {
        const container = element.closest('.menu-toggle-item');
        const statusText = container.querySelector('.status-text');
        
        if (checked) {
            container.classList.add('is-active');
            statusText.textContent = '공개';
        } else {
            container.classList.remove('is-active');
            statusText.textContent = '비공개';
        }
    }
};

window.saveMenuSettings = async () => {
    const db = window.db;
    const firestoreUtils = window.firestoreUtils;
    if(!db || !firestoreUtils) return;
    if(!confirm("설정을 저장하고 모든 사용자에게 즉시 적용하시겠습니까?")) return;
    
    try {
        // 컬렉션 명을 settings에서 menu_visibility로 변경하여 권한 이슈 회피 시도
        await firestoreUtils.setDoc(firestoreUtils.doc(db, "menu_visibility", "current"), window.menuSettings);
        // onSnapshot에 의해 applyMenuSettings가 자동으로 호출되겠지만, 즉각적인 피드백을 위해 한 번 더 호출 가능
        window.applyMenuSettings();
        alert("설정이 저장되었습니다. 모든 사용자의 화면에 즉시 반영됩니다.");
        if(window.logAdminAction) window.logAdminAction("메뉴 설정 변경", "메뉴 및 위젯 표시 설정 업데이트 (Global)");
    } catch (e) {
        console.error("Error saving settings:", e);
        alert("설정 저장 중 오류가 발생했습니다. 권한 문제일 수 있습니다.");
    }
};

// Initial Call
window.loadMenuSettings();
