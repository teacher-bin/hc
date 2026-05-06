/**
 * Google Drive File Upload Utility — Datayard
 *
 * Token priority (highest → lowest):
 *  1. Firebase Auth Google credential access token (stored in sessionStorage
 *     after signInWithPopup). This token belongs to the Firebase project where
 *     Drive API IS enabled — avoids the 403 "project 282957432666" issue.
 *  2. GIS-based token (fallback, requires Drive API enabled in project 282957432666).
 *
 * Call window.driveUpload.setToken(accessToken) after Firebase signInWithPopup
 * to prime the cache so no extra auth popup is needed.
 */

(function () {
    const GIS_CLIENT_ID = '282957432666-6b0t3u7k2fub1f1fdlr418mnneeo4tks.apps.googleusercontent.com';
    const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
    const SS_TOKEN   = 'gd_access_token';
    const SS_EXPIRY  = 'gd_token_expiry';

    let gisTokenClient = null;

    // ── Token storage (sessionStorage) ─────────────────────────────────────
    function storeToken(token) {
        try {
            sessionStorage.setItem(SS_TOKEN,  token);
            // Google OAuth tokens last 1 h; use 55-min window to be safe
            sessionStorage.setItem(SS_EXPIRY, String(Date.now() + 55 * 60 * 1000));
        } catch (_) {}
    }

    function readStoredToken() {
        try {
            const token  = sessionStorage.getItem(SS_TOKEN);
            const expiry = parseInt(sessionStorage.getItem(SS_EXPIRY) || '0', 10);
            if (token && Date.now() < expiry) return token;
        } catch (_) {}
        clearStoredToken();
        return null;
    }

    function clearStoredToken() {
        try { sessionStorage.removeItem(SS_TOKEN); sessionStorage.removeItem(SS_EXPIRY); } catch (_) {}
    }

    // ── GIS fallback ────────────────────────────────────────────────────────
    function getUserEmail() {
        try { return window.auth?.currentUser?.email || ''; } catch (_) { return ''; }
    }

    function requestGisToken() {
        return new Promise((resolve, reject) => {
            if (!window.google?.accounts?.oauth2) {
                reject(new Error('Google Identity Services가 로드되지 않았습니다. 페이지를 새로고침해 주세요.'));
                return;
            }
            if (!gisTokenClient) {
                gisTokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: GIS_CLIENT_ID,
                    scope: DRIVE_SCOPE,
                    callback: ''
                });
            }
            gisTokenClient.callback = (resp) => {
                if (resp.error) { reject(new Error('Google 인증 오류: ' + resp.error)); return; }
                storeToken(resp.access_token);
                resolve(resp.access_token);
            };
            // hint → pre-fill with already signed-in Google account (skips account selector)
            // prompt:'' → silent if scope already granted, minimal popup otherwise
            gisTokenClient.requestAccessToken({ prompt: '', hint: getUserEmail() });
        });
    }

    // ── Token acquisition ───────────────────────────────────────────────────
    async function getAccessToken(forceRefresh) {
        if (!forceRefresh) {
            const stored = readStoredToken();
            if (stored) return stored;
        }
        clearStoredToken();
        return requestGisToken();
    }

    // ── Upload ──────────────────────────────────────────────────────────────
    async function buildMultipartBody(file, folderId) {
        const boundary = '-------GDriveBoundary' + Date.now();
        const encoder  = new TextEncoder();
        const metadata = { name: file.name, parents: folderId ? [folderId] : [] };

        const metaPart = encoder.encode(
            '--' + boundary + '\r\n' +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) + '\r\n' +
            '--' + boundary + '\r\n' +
            'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n'
        );
        const close       = encoder.encode('\r\n--' + boundary + '--');
        const fileContent = await file.arrayBuffer();

        const body = new Uint8Array(metaPart.length + fileContent.byteLength + close.length);
        body.set(metaPart, 0);
        body.set(new Uint8Array(fileContent), metaPart.length);
        body.set(close, metaPart.length + fileContent.byteLength);

        return { body, boundary };
    }

    async function callUploadApi(token, body, boundary) {
        return fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                body: body
            }
        );
    }

    /**
     * Upload a file to Google Drive and make it publicly readable.
     * @param {File}     file
     * @param {string}   folderId  Google Drive folder ID
     * @param {function} onProgress  0–100
     * @returns {Promise<string>}  https://drive.google.com/file/d/{id}/view
     */
    async function uploadFileToDrive(file, folderId, onProgress) {
        let token = await getAccessToken(false);
        if (onProgress) onProgress(20);

        const { body, boundary } = await buildMultipartBody(file, folderId);
        if (onProgress) onProgress(45);

        let resp = await callUploadApi(token, body, boundary);

        // 401 → token expired; clear cache, try fresh token once
        if (resp.status === 401) {
            clearStoredToken();
            token = await getAccessToken(true);
            if (onProgress) onProgress(50);
            resp = await callUploadApi(token, body, boundary);
        }

        if (!resp.ok) {
            const text = await resp.text();

            // 403 accessNotConfigured → Drive API not enabled in the OAuth project
            if (resp.status === 403 && text.includes('accessNotConfigured')) {
                throw new Error(
                    'Google Drive API가 활성화되지 않았습니다.\n\n' +
                    '해결 방법 (프로젝트 번호 282957432666 기준):\n' +
                    '① console.cloud.google.com 접속\n' +
                    '② 화면 상단 프로젝트 선택 → 프로젝트 번호 282957432666 선택\n' +
                    '③ 좌측 메뉴 → API 및 서비스 → 라이브러리\n' +
                    '④ "Google Drive API" 검색 → 사용 설정\n' +
                    '⑤ 2~3분 후 다시 시도\n\n' +
                    '※ Firebase 프로젝트가 아닌 GIS OAuth 전용 프로젝트입니다.'
                );
            }

            throw new Error('Drive 업로드 실패 (' + resp.status + '): ' + text.substring(0, 300));
        }

        const fileData = await resp.json();
        if (onProgress) onProgress(80);

        // Make file publicly readable (anyone with link)
        await fetch('https://www.googleapis.com/drive/v3/files/' + fileData.id + '/permissions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'anyone', role: 'reader' })
        });

        if (onProgress) onProgress(100);
        return 'https://drive.google.com/file/d/' + fileData.id + '/view';
    }

    // ── Public API ──────────────────────────────────────────────────────────
    window.driveUpload = {
        uploadFile: uploadFileToDrive,
        /**
         * Prime the token cache with the access token from Firebase Auth
         * GoogleAuthProvider.credentialFromResult(result).accessToken
         * Must be called right after signInWithPopup succeeds.
         */
        setToken: storeToken
    };
})();
