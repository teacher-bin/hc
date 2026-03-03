/**
 * firebase-config.js
 * Firebase 초기화 및 Firestore 인스턴스 내보내기
 * ⚠️ 실제 배포 전 아래 firebaseConfig 값을 본인의 Firebase 콘솔에서 복사하여 교체하세요.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ 아래 값을 Firebase 콘솔 > 프로젝트 설정 > 앱 추가 > 웹에서 복사
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const INSTRUCTORS_COL = "instructors";
export const WORK_LOGS_COL = "work_logs";
