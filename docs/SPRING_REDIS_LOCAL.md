# Spring Boot 코인 Redis 캐시 — 로컬 연결

Redis 서버를 켜둡니다. 기존 Node.js 실험과 달리 이 경로는 `investome-backend`의 Java 코드를 실행합니다. PostgreSQL 운영 데이터 대신 기존 미리보기 명령의 별도 H2 DB를 사용합니다.

백엔드 실행(프론트 저장소 루트):

```sh
CRYPTO_REDIS_ENABLED=true npm run dev:backend:preview
```

별도 터미널에서 Vite 개발 서버 실행:

```sh
CRYPTO_BACKEND_URL=http://127.0.0.1:18081 npm run dev
```

이미 Vite가 켜져 있다면 종료하고 위 명령으로 다시 실행합니다. 브라우저에서는 터미널에 표시된 로컬 Vite 주소를 엽니다. `VITE_RANKING_API_BASE_URL`이 외부 주소로 설정돼 있으면 개발 프록시를 우회하므로 코인 실험 중에는 비워둡니다. 다른 API의 프록시는 그대로이므로 다른 기능에는 별도 서버가 필요할 수 있습니다.

코인 탭에서 실제 외부 코인 API를 조회한 뒤, 별도 터미널에서 확인합니다:

```sh
redis-cli TTL investome:spring:crypto:top30:v1
redis-cli GET investome:spring:crypto:top30:v1
```

성공하면 TTL은 300초 이하의 양수이고 GET은 코인 목록 JSON 배열입니다. `-2`이면 키가 없으며 외부 조회 실패, Redis 설정, 만료 여부를 확인합니다. 외부 API 호출은 인터넷 상태와 공급자 제한에 영향을 받습니다.

기본값은 Redis 비활성화 + 기존 60초 메모리 캐시입니다. 활성화하면 Redis를 먼저 읽고, 캐시 미스 시 외부 조회 결과를 5분 저장합니다. Redis 장애 시에는 기존 메모리 캐시를 사용하고, 외부 API도 실패하면 프로세스에 남은 이전 목록을 반환합니다. Redis에는 별도 Spring 키를 사용해 Node.js 키의 JSON 형식과 충돌하지 않습니다. 메모리 이전 목록은 재시작 후 유지되지 않습니다.

프로세스 내부의 동시 갱신은 synchronized로 직렬화하며 분산 잠금은 없습니다. Redis 장애 중 반복 접속 비용과 동기식 조회의 대기 비용이 있으므로 이번 작업을 운영 성능 개선으로 주장하지 않습니다. 운영 Redis 설정이나 배포 경로는 이 명령으로 변경되지 않습니다.
