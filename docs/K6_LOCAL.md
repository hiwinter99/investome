# k6: Spring 코인 조회 부하 비교

설치: `brew install k6`. 프로젝트 루트에서 실행합니다. Redis, Spring A(18081), B(18082), Nginx(18080)는 `NGINX_LOCAL.md`대로 켜둡니다. B 종료 실험 뒤에는 반드시 B를 다시 실행합니다.

```sh
mkdir -p work/k6
k6 run -e MODE=single --summary-export=work/k6/single.json scripts/load-crypto.k6.js
k6 run -e MODE=balanced --summary-export=work/k6/balanced.json scripts/load-crypto.k6.js
```

각 실행은 20개 가상 사용자가 30초 동안 응답 직후 다음 요청을 보내는 closed model입니다. 실제 사용자 20명의 행동이나 초당 고정 요청량을 재현하지 않습니다. setup에서 단일 모드는 A, 분배 모드는 A/B를 직접 확인하고 코인 조회 경로를 예열합니다. 빈 목록/잘못된 응답은 실패로 처리합니다. 이 작업은 실제 외부 API 조회를 소량 발생시킬 수 있습니다. Redis TTL이 충분히 남았는지 실행 전 확인하면 캐시 만료가 섞이는 것을 피하기 좋습니다.

비교 항목: 초당 요청 수(`http_reqs`), p95 응답 시간(`http_req_duration`), HTTP 오류(`http_req_failed`), 데이터 검증(`checks`). setup 요청도 기본 전체 통계에 포함됩니다. `phase:load` 하위 집계의 오류/검증을 함께 확인합니다. 분배 모드는 A/B 응답 카운터가 모두 양수이고 재시도 카운터가 0인지 검증해 장애 중 한 서버만 동작하는 비교를 방지합니다.

단일 경로는 Spring에 직접 요청하고 분배 경로는 Nginx를 추가로 거칩니다. 따라서 서버 수와 프록시 비용을 함께 바꾼 입문 실험이며 서버 수만의 효과를 분리한 비교는 아닙니다. Redis 사용 여부는 이 부하 스크립트만으로 보장하지 않으므로 시작 환경과 Redis 키를 따로 확인해야 합니다. 단일 컴퓨터의 CPU/메모리/Redis를 공유하며 Java의 JIT 예열과 실행 순서도 영향을 줍니다. 두 서버가 반드시 빠르다고 기대하거나 최대 운영 처리량으로 해석하지 않습니다. 필요하면 A/B 순서를 바꿔 반복 측정합니다.

운영 서버/외부 URL로 바꿔 부하를 보내지 않도록 대상은 코드에 로컬 주소로 고정했습니다. 아직 성능 측정 결과는 기록하지 않았습니다.
