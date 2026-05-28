# 가로내 온라인 연구실 — Claude 작업 지침

## 프로젝트 개요
경남교육청 소속 학교 인트라넷. 주요 파일: `index.html`, `script.js`, `style.css`, `curriculum.js`.  
컴포넌트 CSS는 `src/components/` 하위에 분리되어 있음.

---

## 절대 규칙

- **디자인·기능·구조를 훼손하지 말 것.** 기존 레이아웃, 애니메이션, 색상 체계를 임의로 변경 금지.
- **연동된 기능을 망가뜨리지 말 것.** 탭 전환, 메뉴 관리, 알림, 캘린더, 급식 위젯 등 상호 연결된 요소에 주의.
- **Firestore 데이터를 절대 삭제·초기화하지 말 것.** DB 관련 코드 수정 시 읽기 전용 작업만 권장.
- **기능 추가나 불필요한 리팩터링을 자의적으로 하지 말 것.** 요청된 범위 내에서만 수정.

---

## 다크모드

- 반드시 `body.dark-mode` 클래스 선택자를 사용할 것.
- `@media (prefers-color-scheme: dark)` **사용 금지** — OS 테마를 감지해 앱 토글과 무관하게 적용되어 충돌 발생.
- 흰색 광택(specular) `::before` 그라데이션은 다크모드에서 `rgba(255,255,255,0.03~0.04)` 수준으로 억제.
  ```css
  /* 올바른 예 */
  body.dark-mode .some-card::before {
      background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 55%);
  }
  ```

---

## 스크롤 구조

- `body`는 `overflow: hidden` — `window.scrollY`는 항상 0.
- **실제 스크롤 컨테이너는 `<main>`** 요소.
- 탭 전환 시 스크롤 초기화: `document.querySelector('main').scrollTop = 0`
- 반드시 DOM 변경(섹션 표시) **이후**에 실행할 것. 이전에 실행하면 레이아웃 리플로우로 무효화됨.

---

## 탭 전환 (이중 리스너 구조)

`script.js`에 구 리스너(line ~3460)와 신규 `switchTab()` 함수(line ~6421) 두 개가 동시에 동작함.

- `급식정보(meal)`, `연수관리(training)` 탭은 `switchTab`이 전담 처리.
- 구 리스너는 이 두 탭에 대해 **아무것도 하지 않도록** 분기 처리되어 있음.
  ```javascript
  } else if (currentCategory === "training" || currentCategory === "meal") {
      // switchTab이 전담 — 여기서 아무것도 하지 않음
  } else {
      linksGrid.classList.remove("hidden");
  }
  ```
- 이 구조를 변경하면 위젯 "더보기" 클릭 vs 탭 직접 클릭 간 위치 불일치가 재발함.

---

## 메뉴 관리 시스템 (`window.menuSettings`)

- `window.menuSettings.menus` 기본값 객체에 없는 키는 `applyMenuSettings()`에서 처리되지 않음.
- 새 탭 추가 시 반드시 기본값과 `menuNames`에 함께 등록:
  ```javascript
  // 기본값
  window.menuSettings = { menus: { 'meal': true, 'kigyo': true, ... } };

  // renderMenuSettings 내 이름 맵
  const menuNames = { 'kigyo': '계기교육', 'meal': '급식정보', ... };
  ```
- `data-category` 속성이 없는 버튼(예: 계기교육)은 `id` 기반 조회로 처리:
  ```javascript
  const kigyoIdMap = { 'kigyo': 'nav-kigyo-btn' };
  ```
  → `index.html`의 계기교육 버튼에 `id="nav-kigyo-btn"` 부여됨.

---

## 섹션 컨테이너 margin-top

음수 `margin-top`을 사용하면 내용이 고정 내비게이션 바 뒤로 숨어 버튼이 가려짐.  
각 섹션 컨테이너의 권장값:
- `.meal-container`: `margin-top: 0.5rem`
- `.training-container`: `margin-top: 0.5rem !important`

---

## FullCalendar (curriculum.js)

- `displayEventTime: false` — 달력 보기에서 시간 표시 전면 숨김 (시간 확인은 상세보기로).
- `eventDataTransform`에서 `time` 필드가 없거나 빈 문자열이면 `allDay: true` 강제 설정 (구 데이터 호환).
  ```javascript
  eventDataTransform: function(eventData) {
      if (eventData.isAuto) eventData.editable = false;
      if (!eventData.time || eventData.time === '') eventData.allDay = true;
      return eventData;
  }
  ```
- 달력 헤더(요일명 행)는 이벤트 셀보다 높은 z-index 필요 (`z-index: 200`).  
  `overflow: visible` 설정으로 인해 이벤트가 헤더 위를 덮는 현상 방지.
- `overflow: visible`은 툴팁/팝업 클리핑 방지를 위해 의도적으로 설정된 값 — 제거 금지.

---

## 파일 구조 (핵심)

```
index.html          — 메인 HTML, 모든 섹션 포함
script.js           — 전역 로직 (탭 전환, 메뉴 관리, 위젯 등)
style.css           — 전역 스타일
curriculum.js       — 학사일정 (FullCalendar) 전담
src/components/     — 섹션별 분리 CSS
  account_section.css
  meal_section.css
  training_section.css
  datayard_section.css
  curriculum_confirm.css
  ...
```

외부 스크립트(Sortable.js 등)는 `<head>` 또는 `<body>` 어느 한 곳에만 로드할 것 — 중복 금지.

---

## 정리 작업 시 주의사항

- `.bak`, `.bak2` 백업 파일은 삭제해도 무방.
- 사용하지 않는 임시 파일(`temp_*.js`, `*_LOG.md` 등)도 삭제 가능.
- **CSS 규칙 중복 제거 시**: 더 아래쪽(나중에 선언된)의 완전한 규칙을 남기고, 위쪽의 불완전한 중복을 제거.
- 기능·디자인 검증 전 데이터 관련 파일(`models.json` 등 DB 스키마) 삭제 시 반드시 확인.
