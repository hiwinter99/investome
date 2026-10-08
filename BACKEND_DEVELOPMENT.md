# 백엔드 저장소 구분

- 프론트엔드 운영 소스: `hiwinter99/investome`, Vercel.
- 백엔드 운영 소스: `hiwinter99/investome-backend`, Render.
- 기본 로컬 배치: `investome`와 `investome-backend`를 같은 상위 폴더에 둡니다.
- 이 PC의 백엔드: `/Users/hiwinter99/Documents/GitHub/investome-backend`.
- 다른 위치는 `INVESTOME_BACKEND_DIR`으로 지정합니다. 실행 안내는 `LAPTOP_SETUP.md`를 참고하세요.
- 예전 `investome/backend/`는 모의투자 초기 개발 사본으로, 중복을 없애기 위해 제거했습니다.
- 초기 학습 문서는 `docs/archive/PAPER_TRADING_GUIDE.md`, 제거 전 로컬 백업은 `work/backend-archive-2026-10-04/backend.tar.gz`입니다.
- 백엔드 수정은 별도 저장소에서 수행하고 `git remote -v`로 대상 저장소를 확인합니다.
- 2026-10-01 모의투자 통합 기록: `f1c6ae4` (investome-backend). 현재 로컬 main과 일치합니다.
- 문서에 기록된 Render 설정: Source=investome-backend, Branch=main, Root Directory=빈 값, Dockerfile=Dockerfile.
- 현재 Render 배포 커밋은 이번 정리에서 확인하지 않았습니다.

기존 통합 기록에는 테스트 46개 통과가 기재돼 있습니다. 이번 폴더 정리에서 서버 테스트를 다시 실행하지 않았습니다.
로컬 H2 모의계좌/테스트 계정을 운영 PostgreSQL로 옮기지 않습니다.
