# 로컬 개발 실행

## 저장소 배치

프론트와 백엔드를 같은 상위 폴더에 둡니다.

```text
GitHub/
  investome/
  investome-backend/
```

백엔드가 없으면 상위 폴더에서:

```sh
git clone https://github.com/hiwinter99/investome-backend.git
```

다른 위치는 `INVESTOME_BACKEND_DIR` 환경변수로 지정합니다.
필수 도구: Git, Node.js 22.12 이상, JDK 17. 두 저장소의 변경 사항은 각각 관리합니다.

## 일반 개발

`investome`에서 `npm ci`로 프론트 의존성을 설치합니다.
별도 백엔드의 개발용 PostgreSQL 연결과 `JWT_SECRET`을 설정한 뒤:

```sh
npm run dev:backend
```

별도 터미널에서 `npm run dev`를 실행합니다. Vite는 Spring API를 기본 `localhost:8080`으로 전달합니다.
뉴스·일부 시세용 Vercel API는 추가 터미널에서 `npm run dev:api`를 실행합니다.
일반 백엔드 실행은 별도 저장소의 application.yml을 사용하며 ddl-auto=update이므로 개발용 DB를 연결하세요.

## 모의투자 로컬 미리보기

PostgreSQL 없이 별도 H2 파일 DB로 실행할 수 있습니다. 운영 DB와 기존 계정 데이터는 사용하지 않습니다.
`investome`의 `.env.local`에 KIS_APP_KEY와 KIS_APP_SECRET을 직접 설정하면 실행 스크립트가 서버에 전달합니다.
키에 VITE_ 접두사를 붙이지 않습니다.

첫 번째 터미널:

```sh
npm run dev:backend:preview
```

Windows에서는 루트의 `start-paper-preview.ps1`도 사용할 수 있습니다.
미리보기는 127.0.0.1:18081에서 실행하며 로컬에서만 Turnstile 검증을 생략합니다.
DB와 JWT 키는 Git에서 제외되는 `work/local-preview/`에 보관합니다. 새 테스트 계정을 생성하세요.

두 번째 터미널 (macOS/Linux):

```sh
VITE_API_BASE_URL=http://127.0.0.1:18081 VITE_TURNSTILE_SITE_KEY='' npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Windows에서는 기존 루트의 `start-paper-frontend.ps1`를 사용합니다.
화면: http://127.0.0.1:5176/paper
뉴스·일부 시세는 별도 Vercel API 실행이 필요할 수 있습니다.

## 검증

프론트 저장소에서 `npm run build`, 별도 백엔드 저장소에서 `./mvnw test`를 실행합니다.
Windows 백엔드는 `.\mvnw.cmd test`를 사용합니다.

## 예전 개발 사본

중복 `backend/` 폴더는 제거했습니다.
초기 학습 기록은 `docs/archive/PAPER_TRADING_GUIDE.md`에 보관했습니다.
이 PC에서 제거 전 전체 사본은 `work/backend-archive-2026-10-04/backend.tar.gz`에 있습니다.
`work/`는 Git에 포함되지 않으므로 이 백업은 다른 PC로 자동 전달되지 않습니다.
