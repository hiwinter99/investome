# Investome

금융·투자 정보를 조회하고 국내주식 모의투자와 자산 관리를 해볼 수 있는 개인 프로젝트입니다.
React와 Spring Boot, PostgreSQL로 개발했으며, 외부 금융 API를 연동해 시세를 조회하고 가상 주문에 따른 잔액과 보유 종목을 처리했습니다.

- [백엔드 저장소 — Java / Spring Boot](https://github.com/hiwinter99/investome-backend)
- [서비스 바로가기](https://investome.vercel.app/)
- [포트폴리오 — 화면 및 구현 설명](https://kimdonggyu-portfolio.vercel.app/projects/investome)

## 주요 기능

- 국내·외 주식, 암호화폐, 환율, 원자재 시세와 금융 뉴스 조회
- 종목 상세 정보 및 TradingView 차트
- 회원가입·로그인, 게시판·댓글·추천
- 관심 종목과 개인 포트폴리오 관리
- 당일 코스피 TOP 30을 대상으로 하는 가상 자금 기반 모의투자

## 저장소와 시스템 구조

이 저장소에는 **React 화면과 Vercel Functions API**가 있습니다. Java/Spring Boot 백엔드는 [investome-backend](https://github.com/hiwinter99/investome-backend)라는 별도 저장소에서 관리합니다.

```text
React
  ├─ Spring Boot ─ PostgreSQL
  │    ├─ KIS API로 주문 처리에 사용할 현재가 조회
  │    └─ KIS WebSocket 시세 수신 → SSE로 브라우저에 전달
  └─ Vercel Functions ─ 뉴스·환율·일부 시세 API
```

- 프론트엔드: React, JavaScript, Vite
- API 중계: Vercel Functions, Node.js
- 백엔드: Java 17, Spring Boot, Spring Data JPA, Spring Security, JWT
- 데이터베이스: PostgreSQL
- 로컬 적용·실험: Redis, Nginx, k6

## 구현하면서 확인한 내용

### 외부 API 응답과 조회 실패 처리

공급자마다 다른 응답을 화면에서 사용할 공통 형식으로 변환했습니다. 조회 화면에서는 누락된 가격을 다른 조회로 보완하거나, 새 목록을 가져오지 못하면 이전에 저장한 목록을 사용합니다.

### 실시간 시세와 모의 주문

Spring Boot에서 KIS WebSocket으로 시세를 받아 SSE로 브라우저에 전달합니다. 가상 주문은 서버에서 현재가를 확인한 뒤 계좌 잠금과 트랜잭션으로 잔액·보유 수량·주문 이력을 함께 변경합니다. 같은 요청 ID의 주문은 기존 결과를 반환합니다.

백엔드 자동 테스트에서는 동시 중복 주문, 잔액을 초과하는 동시 주문, 주문 저장 실패 시 잔액·보유 수량의 롤백을 확인했습니다. 실제 증권사로 주문을 전송하는 기능은 아닙니다.

### Redis 공유 캐시와 로컬 요청 분배

암호화폐 TOP 30 목록을 Redis에 5분간 저장하도록 적용했습니다. 가짜 외부 응답을 사용하는 로컬 Node.js 두 프로세스의 순차 요청 실험에서는 메모리 캐시의 외부 조회 2회가 공유 캐시 사용 시 1회로 줄었습니다. Spring Boot에서도 Redis 저장과 재사용을 확인했습니다.

또한 로컬 Spring Boot 두 프로세스를 Nginx에 연결해 요청 분배와 한 프로세스 종료 후 다른 프로세스로의 연결 재시도를 확인했습니다. 이 실험들은 운영 환경의 처리량이나 무중단 운영을 보장하는 결과는 아닙니다.

## 로컬 실행

필수 도구는 Node.js 22.12 이상과 JDK 17입니다. 두 저장소를 같은 상위 폴더에 둡니다.

```text
GitHub/
  investome/
  investome-backend/
```

프론트 저장소에서 의존성을 설치합니다.

```sh
npm ci
```

백엔드에 개발용 PostgreSQL 연결과 JWT 설정을 준비한 뒤, 각각 별도 터미널에서 실행합니다.

```sh
npm run dev:backend
```

```sh
npm run dev
```

뉴스·일부 시세 API를 사용하려면 추가 터미널에서 실행합니다.

```sh
npm run dev:api
```

외부 API 기능에는 해당 서비스의 키가 필요합니다. API 비밀 키는 서버 환경변수로 설정하고 저장소에 커밋하지 않습니다. PostgreSQL 없이 모의투자를 확인하는 H2 미리보기와 자세한 설정은 [로컬 실행 안내](LAPTOP_SETUP.md)를 참고하세요.

## 검증과 관련 문서

```sh
# 프론트엔드 빌드
npm run build

# 백엔드 저장소에서 자동 테스트 실행
./mvnw test
```

- [프론트·백엔드 저장소 구분](BACKEND_DEVELOPMENT.md)
- [캐시 비교 실험](docs/CRYPTO_CACHE_EXPERIMENT.md)
- [Spring Boot와 Redis 로컬 연결](docs/SPRING_REDIS_LOCAL.md)
- [Nginx 로컬 요청 분배 실험](docs/NGINX_LOCAL.md)
