const COLLECTION_NAME = "specialEduData";
let currentMonth = new Date().getMonth() + 1;
// 계기교육 특성상 3월부터 내년 2월을 한 학년도로 봄
const monthOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
let allData = [];
let isAdmin = false;

// Google Drive link conversion helper
function getForcedDownloadLink(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.includes("drive.google.com")) {
        let fileId = "";
        if (url.includes("/file/d/")) {
            fileId = url.split("/file/d/")[1].split("/")[0];
        } else if (url.includes("id=")) {
            fileId = url.split("id=")[1].split("&")[0];
        }
        if (fileId) return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
}

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initAuth();
    initApp();
});

// Theme Management
function initTheme() {
    const themeToggle = document.getElementById("theme-toggle");
    const html = document.documentElement;
    const icon = themeToggle.querySelector("i");
    
    // Load saved theme or system preference
    const savedTheme = localStorage.getItem("special-edu-theme") || 
                       (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    
    setTheme(savedTheme);

    themeToggle.addEventListener("click", () => {
        const newTheme = html.getAttribute("data-theme") === "light" ? "dark" : "light";
        setTheme(newTheme);
    });

    function setTheme(theme) {
        html.setAttribute("data-theme", theme);
        localStorage.setItem("special-edu-theme", theme);
        icon.className = theme === "light" ? "fas fa-moon" : "fas fa-sun";
    }
}

// Member Auth & Access Control
async function initAuth() {
    const { auth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, db, doc, getDoc } = window.firebaseApi;
    const loginBtn = document.getElementById("admin-login-btn");
    const controls = document.getElementById("admin-controls");
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    isAdmin = true;
                    loginBtn.classList.add("hidden");
                    controls.classList.remove("hidden");
                    await loadData();
                } else {
                    alert("가로내 온라인 연구실 회원만 이용 가능합니다.");
                    signOut(auth);
                }
            } catch (error) {
                console.error("Auth error:", error);
                isAdmin = false;
                renderData();
            }
        } else {
            isAdmin = false;
            loginBtn.classList.remove("hidden");
            controls.classList.add("hidden");
            allData = [];
            renderData();
        }
    });

    loginBtn.addEventListener("click", () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => alert("로그인 실패: " + err.message));
    });

    document.getElementById("admin-logout-btn").addEventListener("click", () => {
        if(confirm("로그아웃 하시겠습니까?")) signOut(auth);
    });
}

function initApp() {
    renderMonthTabs();
    setupCalendarControls();
    setupModal();
}

function renderMonthTabs() {
    const container = document.getElementById("month-tabs");
    container.innerHTML = "";
    
    monthOrder.forEach(m => {
        const btn = document.createElement("button");
        btn.className = `month-tab ${m === currentMonth ? "active" : ""}`;
        btn.textContent = `${m}월`;
        btn.onclick = () => {
            currentMonth = m;
            updateActiveTab();
            renderData();
        };
        container.appendChild(btn);
    });
}

function setupCalendarControls() {
    document.getElementById("cal-prev-btn").onclick = () => {
        let idx = monthOrder.indexOf(currentMonth);
        currentMonth = (idx > 0) ? monthOrder[idx - 1] : monthOrder[monthOrder.length - 1];
        updateActiveTab();
        renderData();
    };
    document.getElementById("cal-next-btn").onclick = () => {
        let idx = monthOrder.indexOf(currentMonth);
        currentMonth = (idx < monthOrder.length - 1) ? monthOrder[idx + 1] : monthOrder[0];
        updateActiveTab();
        renderData();
    };
}

function updateActiveTab() {
    document.querySelectorAll(".month-tab").forEach(tab => {
        tab.classList.toggle("active", tab.textContent === `${currentMonth}월`);
    });
}

async function loadData() {
    const { db, collection, getDocs, query, orderBy } = window.firebaseApi;
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy("date", "asc"));
        const snapshot = await getDocs(q);
        allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (allData.length === 0) {
            allData.push({
                id: "demo-item", month: 3, date: "03.01", title: "삼일절 (데모)",
                imageUrl: "https://vbook.vivasam.com/268991/contents/image/page_01_01.jpg",
                checklist: "- 3·1 운동의 전개 과정 이해\n- 태극기 게양 방법 실전 학습\n- 독립 운동가들에 대한 감사 일기",
                linkPdf: "#", linkHwp: "#", linkAnswer: "#", forceDownload: false
            });
        }
        renderData();
    } catch (e) {
        console.error("Data load failed:", e);
    }
}

function renderData() {
    const contentArea = document.getElementById("content-area");
    
    if (!isAdmin) {
        contentArea.innerHTML = `
            <div class="edu-card" style="justify-content:center; text-align:center; padding: 5rem 0;">
                <div class="card-main">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--accent); margin-bottom: 1.5rem;"></i>
                    <h2 style="font-size: 1.75rem;">가로내 회원 전용 공간입니다</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">로그인 후 다양한 계기수업 자료를 만나보세요.</p>
                </div>
            </div>`;
        renderCalendar([]);
        return;
    }

    const filtered = allData.filter(d => parseInt(d.month) === currentMonth);
    filtered.sort((a,b) => a.date.localeCompare(b.date));

    renderCalendar(filtered);
    contentArea.innerHTML = "";

    if (filtered.length === 0) {
        contentArea.innerHTML = `<div class="edu-card" style="justify-content:center; opacity:0.6;"><p>등록된 계기수업 자료가 없습니다.</p></div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "edu-card";
        card.id = `card-${item.id}`;
        
        const checklists = Array.isArray(item.checklist) ? item.checklist : (item.checklist || "").split("\n").filter(c => c.trim());
        
        let buttonsHtml = "";
        const resources = item.resources || [];
        
        // Resource type mapping
        const typeMap = {
            "한글": { icon: "fas fa-file-word", class: "hwp" },
            "PDF": { icon: "fas fa-file-pdf", class: "pdf" },
            "PPT": { icon: "fas fa-file-powerpoint", class: "ppt" },
            "사진": { icon: "fas fa-file-image", class: "img" },
            "영상": { icon: "fas fa-video", class: "vid" },
            "기타": { icon: "fas fa-file", class: "etc" }
        };

        if (resources.length > 0) {
            resources.forEach(res => {
                if (res.url && res.url.trim()) {
                    const finalUrl = res.forceDownload ? getForcedDownloadLink(res.url) : res.url;
                    // Standard types for styling, but use res.type for label
                    const standardTypes = ["한글", "PDF", "PPT", "사진", "영상"];
                    const styleKey = standardTypes.includes(res.type) ? res.type : "기타";
                    const typeInfo = typeMap[styleKey] || typeMap["기타"];
                    
                    buttonsHtml += `
                        <a href="${finalUrl}" ${res.forceDownload ? "download" : "target='_blank'"} class="btn-link ${typeInfo.class}">
                            <i class="${typeInfo.icon}"></i> ${res.type}
                        </a>`;
                }
            });
        } else {
            // Legacy data fallback
            if (item.linkPdf) {
                const pdfLink = item.downPdf ? getForcedDownloadLink(item.linkPdf) : item.linkPdf;
                buttonsHtml += `<a href="${pdfLink}" ${item.downPdf ? "download" : "target='_blank'"} class="btn-link pdf"><i class="fas fa-file-pdf"></i> PDF</a>`;
            }
            if (item.linkHwp) {
                const hwpLink = item.downHwp ? getForcedDownloadLink(item.linkHwp) : item.linkHwp;
                buttonsHtml += `<a href="${hwpLink}" ${item.downHwp ? "download" : "target='_blank'"} class="btn-link hwp"><i class="fas fa-file-word"></i> 한글</a>`;
            }
            if (item.linkAnswer) {
                const ansLink = item.downAnswer ? getForcedDownloadLink(item.linkAnswer) : item.linkAnswer;
                buttonsHtml += `<a href="${ansLink}" ${item.downAnswer ? "download" : "target='_blank'"} class="btn-link ans"><i class="fas fa-check-circle"></i> 예시답안</a>`;
            }
            if (item.linkVideo) {
                buttonsHtml += `<a href="${item.linkVideo}" target="_blank" class="btn-link vid"><i class="fas fa-video"></i> 영상</a>`;
            }
        }

        const imageHtml = `
            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <div class="card-img-wrapper">
                    <img src="${item.imageUrl || ''}" alt="" onerror="this.src='https://via.placeholder.com/200x260?text=No+Image';">
                </div>
                ${item.source ? `<div class="card-source">${item.source}</div>` : ''}
            </div>`;

        const adminControls = isAdmin ? `
            <div class="card-admin">
                <button class="btn-circle" onclick="editItem('${item.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-circle" onclick="deleteItem('${item.id}')" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
            </div>` : '';

        card.innerHTML = `
            ${adminControls}
            <div class="card-main">
                <div class="card-header">
                    <div class="card-title">
                        <h2>${item.title} <span class="date">${item.date}</span></h2>
                    </div>
                    <div class="card-footer" style="margin-top:0; padding-top:0;">${buttonsHtml}</div>
                </div>
                <div class="checklist-box">
                    <div class="checklist-label"><i class="fas fa-star"></i> 활동 안내</div>
                    <ul class="checklist-items">
                        ${checklists.map(c => `<li>${c}</li>`).join("")}
                    </ul>
                </div>
            </div>
            ${imageHtml}
        `;
        contentArea.appendChild(card);
    });
}

// === Calendar ===
function getCalendarYear(month) {
    const now = new Date();
    const currentM = now.getMonth() + 1;
    let schoolY = (currentM < 3) ? now.getFullYear() - 1 : now.getFullYear();
    return (month < 3) ? schoolY + 1 : schoolY;
}

function renderCalendar(filteredData) {
    const year = getCalendarYear(currentMonth);
    document.getElementById("cal-month-title").textContent = `${currentMonth}월`;
    
    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === year && (now.getMonth() + 1) === currentMonth);
    const todayDate = now.getDate();

    const firstDay = new Date(year, currentMonth - 1, 1).getDay();
    const lastDate = new Date(year, currentMonth, 0).getDate();
    const calendarDays = document.getElementById("calendar-days");
    calendarDays.innerHTML = "";
    
    for(let i=0; i<firstDay; i++) calendarDays.innerHTML += `<div class="day-cell empty"></div>`;
    
    for(let d=1; d<=lastDate; d++) {
        const dateStr = `${currentMonth.toString().padStart(2, '0')}.${d.toString().padStart(2, '0')}`;
        const hasData = filteredData.some(item => item.date === dateStr);
        const dayOfWeek = new Date(year, currentMonth - 1, d).getDay();
        
        const div = document.createElement("div");
        const isToday = isCurrentMonth && d === todayDate;
        div.className = `day-cell ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''} ${hasData ? 'has-data' : ''} ${isToday ? 'today' : ''}`;
        div.textContent = d;
        if (isToday) div.title = "오늘";
        div.onclick = () => {
             document.querySelectorAll(".day-cell").forEach(c => c.classList.remove("selected"));
             div.classList.add("selected");
             highlightScheduleItems(dateStr);
        };
        calendarDays.appendChild(div);
    }
    renderScheduleList("all", filteredData);
}

function renderScheduleList(dateStr, filteredData) {
    const listDiv = document.getElementById("schedule-items");
    const badge = document.getElementById("schedule-date-badge");
    
    badge.textContent = "바로가기";
    badge.style.cursor = "default";
    badge.onclick = null;

    // 항상 전체 목록 표시
    const items = filteredData;

    // 아이템 수에 따라 레이아웃 클래스 동적 적용 (5개부터 압축)
    if (items.length >= 5) {
        listDiv.classList.add("compact-grid");
    } else {
        listDiv.classList.remove("compact-grid");
    }

    listDiv.innerHTML = "";
    
    if (items.length === 0) {
        listDiv.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-muted);">자료가 없습니다.</div>`;
        return;
    }
    
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "sch-item";
        div.dataset.date = item.date; // 강조를 위한 데이터 속성 추가
        div.innerHTML = `<span>${item.title}(${item.date})</span> <i class="fas fa-chevron-right"></i>`;
        div.onclick = () => {
             const card = document.getElementById(`card-${item.id}`);
             if(card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.borderColor = "var(--primary)";
                setTimeout(() => card.style.borderColor = "var(--border)", 1500);
             }
        };
        listDiv.appendChild(div);
    });
}

// 달력 날짜 클릭 시 해당 항목 강조
function highlightScheduleItems(dateStr) {
    document.querySelectorAll(".sch-item").forEach(item => {
        item.style.transition = "all 0.4s";
        item.style.borderColor = "transparent";
        item.style.boxShadow = "none";

        if (item.dataset.date === dateStr) {
            item.style.borderColor = "var(--primary)";
            item.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.3)";
            item.style.transform = "scale(1.02)";
            
            // 일정 시간 후 강조 해제 (선택 사항, 유지를 원하시면 이 부분 제거)
            setTimeout(() => {
                item.style.borderColor = "transparent";
                item.style.boxShadow = "none";
                item.style.transform = "scale(1)";
            }, 2000);
        }
    });
}

// === Modal ===
function setupModal() {
    const modal = document.getElementById("edit-modal");
    const form = document.getElementById("edit-form");
    const resourceList = document.getElementById("resource-list");
    const addResourceBtn = document.getElementById("btn-add-resource");

    addResourceBtn.onclick = () => addResourceItem();

    function addResourceItem(data = { type: "한글", url: "", forceDownload: true }) {
        const standardTypes = ["한글", "PDF", "PPT", "사진", "영상"];
        const isCustom = data.type && !standardTypes.includes(data.type) && data.type !== "기타";
        const displayType = isCustom ? "기타" : data.type;

        const div = document.createElement("div");
        div.className = "resource-item";
        div.innerHTML = `
            <div class="resource-item-top">
                <div style="display:flex; align-items:center; gap:12px;">
                    <label class="switch">
                        <input type="checkbox" class="res-force" ${data.forceDownload ? "checked" : ""}><span class="slider"></span>
                    </label>
                    <span style="font-size:0.75rem; color:var(--text-muted);">직접 다운로드 (ON 권장)</span>
                </div>
                <button type="button" class="btn-remove-resource"><i class="fas fa-times"></i></button>
            </div>
            <div class="resource-inputs">
                <select class="res-type">
                    <option value="한글" ${displayType === "한글" ? "selected" : ""}>한글</option>
                    <option value="PDF" ${displayType === "PDF" ? "selected" : ""}>PDF</option>
                    <option value="PPT" ${displayType === "PPT" ? "selected" : ""}>PPT</option>
                    <option value="사진" ${displayType === "사진" ? "selected" : ""}>사진</option>
                    <option value="영상" ${displayType === "영상" ? "selected" : ""}>영상</option>
                    <option value="기타" ${displayType === "기타" ? "selected" : ""}>기타(직접입력)</option>
                </select>
                <input type="text" class="res-custom-type ${displayType === "기타" ? "" : "hidden"}" 
                       placeholder="자료 제목(예: 활동지)" value="${isCustom ? data.type : ""}">
                <input type="text" class="res-url" placeholder="자료 링크를 입력하세요" value="${data.url}">
            </div>
        `;

        const typeSelect = div.querySelector(".res-type");
        const customInput = div.querySelector(".res-custom-type");
        
        typeSelect.onchange = () => {
            if (typeSelect.value === "기타") {
                customInput.classList.remove("hidden");
                div.querySelector(".resource-inputs").classList.add("has-custom");
            } else {
                customInput.classList.add("hidden");
                div.querySelector(".resource-inputs").classList.remove("has-custom");
            }
        };

        if (displayType === "기타") div.querySelector(".resource-inputs").classList.add("has-custom");
        
        div.querySelector(".btn-remove-resource").onclick = () => div.remove();
        resourceList.appendChild(div);
    }

    document.getElementById("add-item-btn").onclick = () => {
        form.reset();
        resourceList.innerHTML = "";
        document.getElementById("edit-id").value = "";
        document.getElementById("modal-title").textContent = "신규 자료 등록";
        document.getElementById("edit-month").value = currentMonth;
        // 기본 자료 항목 1개 추가
        addResourceItem();
        modal.classList.remove("hidden");
    };

    document.getElementById("close-modal-btn").onclick = () => modal.classList.add("hidden");
    document.getElementById("cancel-modal-btn").onclick = () => modal.classList.add("hidden");

    form.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-id").value;
        
        // 자료 항목 수집
        const resources = [];
        document.querySelectorAll(".resource-item").forEach(item => {
            let type = item.querySelector(".res-type").value;
            const customType = item.querySelector(".res-custom-type").value.trim();
            if (type === "기타" && customType) type = customType;
            
            const url = item.querySelector(".res-url").value.trim();
            const forceDownload = item.querySelector(".res-force").checked;
            if (url) resources.push({ type, url, forceDownload });
        });

        const data = {
            month: parseInt(document.getElementById("edit-month").value),
            date: document.getElementById("edit-date").value.trim(),
            title: document.getElementById("edit-title").value.trim(),
            imageUrl: document.getElementById("edit-image").value.trim(),
            checklist: document.getElementById("edit-checklist").value.trim(),
            source: document.getElementById("edit-source").value.trim(),
            resources: resources,
            updatedAt: new Date().toISOString()
        };

        try {
            const { db, collection, addDoc, doc, updateDoc } = window.firebaseApi;
            if (id && id !== "demo-item") {
                await updateDoc(doc(db, COLLECTION_NAME, id), data);
            } else {
                await addDoc(collection(db, COLLECTION_NAME), data);
            }
            modal.classList.add("hidden");
            loadData();
            alert("자료가 안전하게 저장되었습니다.");
        } catch (err) {
            alert("저장 오류: " + err.message);
        }
    };

    // 전역 함수로 등록 (editItem에서 사용)
    window.addResourceItem = addResourceItem;
}

window.editItem = (id) => {
    const item = allData.find(d => d.id === id);
    if(!item) return;
    document.getElementById("edit-id").value = item.id;
    document.getElementById("edit-month").value = item.month;
    document.getElementById("edit-date").value = item.date;
    document.getElementById("edit-title").value = item.title;
    document.getElementById("edit-image").value = item.imageUrl || "";
    document.getElementById("edit-checklist").value = item.checklist || "";
    document.getElementById("edit-source").value = item.source || "";
    
    // 리소스 목록 초기화 및 로드
    const resourceList = document.getElementById("resource-list");
    resourceList.innerHTML = "";
    
    if (item.resources && item.resources.length > 0) {
        item.resources.forEach(res => window.addResourceItem(res));
    } else {
        // 기존 데이터 호환 로드
        if (item.linkPdf) window.addResourceItem({ type: "PDF", url: item.linkPdf, forceDownload: !!item.downPdf });
        if (item.linkHwp) window.addResourceItem({ type: "한글", url: item.linkHwp, forceDownload: !!item.downHwp });
        if (item.linkAnswer) window.addResourceItem({ type: "기타", url: item.linkAnswer, forceDownload: !!item.downAnswer });
        if (item.linkVideo) window.addResourceItem({ type: "영상", url: item.linkVideo, forceDownload: false });
    }

    document.getElementById("modal-title").textContent = "자료 내용 수정";
    document.getElementById("edit-modal").classList.remove("hidden");
};

window.deleteItem = async (id) => {
    if(!confirm("정말 삭제하시겠습니까?")) return;
    try {
        const { db, doc, deleteDoc } = window.firebaseApi;
        if (id !== "demo-item") await deleteDoc(doc(db, COLLECTION_NAME, id));
        loadData();
    } catch(e) { alert("삭제 실패"); }
};
