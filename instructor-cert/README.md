# 📋 외부강사 활동 확인서 관리 시스템

초등학교 외부강사의 출강 기록을 관리하고, A4 규격 활동 확인서를 발급하는 웹 서비스입니다.

---

## 📁 프로젝트 구조

```
instructor-cert/
├── index.html              ← 메인 관리 페이지 (강사 등록 + 출강 기록)
├── certificate.html        ← A4 증명서 출력 페이지
├── css/
│   ├── style.css           ← 공통 스타일 (라이트/다크 모드, 반응형)
│   └── print.css           ← 인쇄 전용 스타일 (@media print 포함)
├── js/
│   └── firebase-config.js  ← Firebase 초기화 설정 (참고용)
├── schema/
│   └── sample-data.json    ← Firestore 스키마 + 샘플 데이터 문서
└── README.md
```

---

## 🚀 빠른 시작

### 1. Firebase 프로젝트 생성
1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트 생성
2. Firestore Database 활성화 (테스트 모드로 시작)
3. 웹 앱 추가 → `firebaseConfig` 값 복사

### 2. Firebase 설정 적용
`index.html` 파일 하단의 `firebaseConfig` 객체를 본인 값으로 교체:

```js
const firebaseConfig = {
  apiKey: "실제_API_KEY",
  authDomain: "실제_도메인.firebaseapp.com",
  projectId: "실제_프로젝트_ID",
  ...
};
```

### 3. 실행
- 로컬: VS Code의 **Live Server** 확장 또는 `npx serve .` 사용
- 배포: Firebase Hosting 또는 GitHub Pages 사용 가능

---

## 🗄️ Firestore 스키마

### `instructors` 컬렉션 (강사 인적사항)
| 필드 | 타입 | 설명 |
|------|------|------|
| `name_korean` | string | 성명(한글) |
| `name_chinese` | string | 성명(한자) |
| `birth_date` | string | 생년월일 (YYYY-MM-DD) |
| `position` | string | 직위 (기본: "외부강사") |
| `address` | string | 주소 |
| `created_at` | string | 생성 일시 |
| `updated_at` | string | 수정 일시 |

### `work_logs` 컬렉션 (월별 출강 기록)
| 필드 | 타입 | 설명 |
|------|------|------|
| `instructor_id` | string | 강사 문서 ID (FK) |
| `school_name` | string | 소속 학교명 |
| `program_name` | string | 프로그램명 |
| `year` | number | 연도 |
| `month` | number | 월 (1~12) |
| `start_date` | string | 출강 시작일 |
| `end_date` | string | 출강 종료일 |
| `hours` | number | 시수 |
| `guidance_notes` | string | 지도 사항 |

> **문서 ID 규칙**: `{instructor_id}_{YYYY}_{MM}` (예: `ABC123_2025_03`)
> 결정론적 ID를 사용하여 중복 저장 방지 및 조회 효율화

---

## 📄 인쇄 방법

1. 관리 페이지에서 강사 선택 → **확인서 발급** 탭 이동
2. 기간 설정 후 **미리보기 생성** 클릭
3. **인쇄 / PDF 저장** 버튼 클릭
4. 인쇄 다이얼로그에서 용지 크기: **A4**, 여백: **없음** 설정

---

## 🔒 Firestore 보안 규칙 (배포 시 적용 권장)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 로그인한 사용자만 읽기/쓰기 허용
    match /instructors/{doc} {
      allow read, write: if request.auth != null;
    }
    match /work_logs/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```
