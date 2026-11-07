# Nginx 로컬 요청 분배 실험

구조: `127.0.0.1:18080 (Nginx) → 18081 (Spring A) / 18082 (Spring B) → 공유 Redis`.

## 실행

Redis, Java 17, Node.js, Nginx가 설치되어 있어야 합니다. 각 명령은 별도 터미널 탭에서 실행하며, 프로젝트 루트에서 시작합니다.

Redis가 실행 중인지 `redis-cli ping`으로 확인합니다. 실행 중이 아니면 별도 탭에서 `redis-server`를 실행합니다.

서버 A:

```sh
CRYPTO_REDIS_ENABLED=true PREVIEW_PORT=18081 npm run dev:backend:preview
```

A의 시작 완료 후 서버 B:

```sh
CRYPTO_REDIS_ENABLED=true PREVIEW_PORT=18082 npm run dev:backend:preview
```

같은 Spring Boot 코드를 별도 프로세스로 실행합니다. H2 파일과 JWT 키는 포트별로 분리해 충돌을 피합니다. 공유 DB/인증 실험이 아니므로 코인 조회 API만 프록시합니다. Redis 키는 두 서버가 같은 `investome:spring:crypto:top30:v1`을 사용합니다.

Nginx 준비 및 문법 검사:

```sh
mkdir -p work/nginx-local
nginx -t -e stderr -p "$PWD/work/nginx-local/" -c "$PWD/config/nginx-local.conf"
```

Nginx 실행(이 탭은 켜둡니다):

```sh
nginx -e stderr -p "$PWD/work/nginx-local/" -c "$PWD/config/nginx-local.conf" -g 'daemon off;'
```

확인용 탭에서 여러 번 요청:

```sh
curl -s -D - -o /dev/null http://127.0.0.1:18080/api/crypto-top30
```

HTTP 상태와 `X-Backend`를 확인합니다. 정상 두 서버에서는 `18081`, `18082`가 번갈아 표시됩니다. 응답이 200이어도 외부 API 실패로 빈 목록일 수 있으므로 실제 데이터 검증이 필요하면 `-o /dev/null`을 빼고 본문도 확인합니다.

## 2026-11-07 수동 확인 결과

- 사용자 로컬에서 4회 요청의 `X-Backend`가 18081/18082로 번갈아 표시됨을 확인했습니다.
- B를 종료한 뒤 `X-Backend: 127.0.0.1:18082, 127.0.0.1:18081`을 확인했습니다. B 연결 실패 후 A로 재시도한 순서입니다. 최종 HTTP 상태는 대화에서 별도로 확인되지 않았으므로 성공 여부는 응답 상태로 추가 확인해야 합니다.
- Nginx 설정 문법 검사와 Node.js 실행 스크립트 문법 검사를 통과했습니다.

Nginx의 기본 연결 오류/타임아웃 재시도를 사용하는 실험이며 별도 Java 재시도 코드나 Redis의 장애 조치 기능이 아닙니다. 능동적 상태 검사나 모든 종류의 오류에 대한 재시도를 구현한 것은 아닙니다. 로컬 단일 컴퓨터에서 기능을 검증했으며 처리량 증가나 고가용성을 입증한 결과는 아닙니다. Nginx 자체도 단일 프로세스 구성입니다.

## 종료 및 재개

B를 다시 켜려면 위 B 명령을 재실행합니다. 장애 상태가 잠시 유지돼 곧바로 분배가 재개되지 않을 수 있습니다. 전체 종료는 각 실행 탭에서 Ctrl+C를 누릅니다. 로그·PID·임시 데이터는 Git에서 제외된 `work/nginx-local/` 아래에 생성됩니다.
