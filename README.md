# Investome

## 📌 프로젝트 소개

주식, 암호화폐, 환율 등 금융·투자 정보를 조회하고, 가상 자금으로 국내주식 모의투자를 해볼 수 있는 개인 프로젝트입니다.

평소 관심이 있던 금융 분야를 개발과 연결해 보고 싶어 직접 기획하고 개발했습니다.

## 🔗 링크

- [Investome 방문하기](https://investome.vercel.app/)
- [포트폴리오](https://kimdonggyu-portfolio.vercel.app/projects/investome)
- [백엔드 GitHub](https://github.com/hiwinter99/investome-backend)

## 🛠️ 사용 기술

- Front-end: React, JavaScript, Vite
- Back-end: Java, Spring Boot, Spring Security, JPA
- Database: PostgreSQL
- 외부 API 처리: Vercel Functions
- 캐시·로컬 실험: Redis, Nginx, k6

## ✨ 주요 기능

- 회원가입 / 로그인
- 국내·외 주식, 암호화폐, 환율, 원자재 시세 조회
- 금융 뉴스 및 TradingView 차트
- 게시판 / 댓글 / 추천
- 관심 종목 / 포트폴리오 관리
- 국내주식 모의투자 / 잔액·보유 종목·주문 내역 조회

## 💻 핵심 구현

- 외부 금융 API의 서로 다른 응답을 공통 형식으로 변환하고, 조회 실패 시 이전 목록으로 대체했습니다.
- KIS WebSocket으로 받은 시세를 SSE로 브라우저에 전달했습니다.
- 모의투자 주문에 요청 ID와 계좌 잠금을 적용하고, 잔액·보유 수량·주문 이력을 함께 처리했습니다.
- Redis 공유 캐시를 적용하고, 로컬 두 프로세스의 순차 요청에서 외부 조회가 2회에서 1회로 줄어드는 것을 확인했습니다.

## 👤 담당

개인 프로젝트로 기획, 화면 구성, 프론트엔드·백엔드 개발과 배포를 진행했습니다.

## 📂 실행 및 테스트

- [로컬 실행 방법](https://github.com/hiwinter99/investome/blob/main/LAPTOP_SETUP.md)
- [캐시 비교 실험](https://github.com/hiwinter99/investome/blob/main/docs/CRYPTO_CACHE_EXPERIMENT.md)
- [백엔드 구현 및 테스트 안내](https://github.com/hiwinter99/investome-backend)
