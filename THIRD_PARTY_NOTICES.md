# 제3자 오픈소스 고지

이 문서는 EasyFlow 프론트엔드에 실제로 포함한 제3자 구성요소와 라이선스를 기록한다.

## rhwp / @rhwp/editor

- 프로젝트: [edwardkim/rhwp](https://github.com/edwardkim/rhwp)
- 포함 용도: 브라우저에서 HWP/HWPX 열기, 편집, HWP/HWPX 수정본 내보내기
- 라이선스: MIT
- 저작권: Copyright (c) 2025-2026 Edward Kim
- 래퍼 버전: `@rhwp/editor 0.8.2`
- 래퍼 위치: `assets/vendor/rhwp-editor/`
- 편집기 정적 배포본 위치: `rhwp/`
- 편집기 배포본 반입일: 2026-08-16
- 전체 제3자 고지: [rhwp THIRD_PARTY_LICENSES.md](https://github.com/edwardkim/rhwp/blob/main/THIRD_PARTY_LICENSES.md)

반입본 식별값:

- `rhwp/assets/index-s2CVbjxO.js`(상대 배포 경로 수정본): `F7EDD6E02B800F5CD63FFDE0D02F0C39BF0C933A1806F6D56D113AD9ADD7FEAE`
- `rhwp/assets/index-BZuFhS-Y.css`(상대 이미지 경로 수정본): `11698AFC6CA3891A72FF881E80A6A77139AFB157E0ED6F60A001AF7EA741EFEE`
- `rhwp/assets/rhwp_bg-B2jQnVzD.wasm`: `E09E8463291F3ADED87BB8FEBDD21610E80B5159329666F114329E10195EA229`
- `assets/vendor/rhwp-editor/index.js`(자체 호스팅 기본 주소 수정본): `2C13CB2AC414A3A96E184D85F798AB23F144D2A1A9CC8CCC25A5789F19F21457`
- `assets/vendor/rhwp-editor/transport.js`: `4FB91D20383C07D1D311A9CB5C5D799967158A11F58D83E6F84E507FA7FD3FE9`

편집기 정적 배포본에는 MIT 또는 Apache-2.0 계열 Rust/프론트엔드 의존성과 다음 오픈 폰트가 포함된다. 배포 전에 위 upstream 제3자 고지 원문과 `rhwp/fonts/`를 함께 보존해야 한다.

- Pretendard, Noto Sans KR, Noto Serif KR, 나눔고딕, 나눔명조, 고운바탕, 고운돋움, D2Coding 등: SIL Open Font License 1.1
- 일부 추가 번들 폰트는 upstream `THIRD_PARTY_LICENSES.md`에 적힌 각 라이선스를 따른다.

현재 구현은 편집기와 통신 래퍼를 동일 웹앱에 자체 호스팅한다. 선택한 문서 바이트를 제3자 편집 서버로 보내지 않는다. 파일은 브라우저 안에서 처리하며, 저장은 사용자가 내려받는 새 파일로 수행한다.

EasyFlow 수정 사항은 배포 위치가 사이트 루트 또는 하위 경로여도 동작하도록 정적 HTML·manifest·service
worker·JS·CSS의 `/rhwp/` 절대 경로를 상대 경로로 바꾸고, `@rhwp/editor`의 기본 Studio 주소를
동일 웹앱의 `rhwp/index.html`로 고정한 것이다. 원본 편집 동작과 저작권 표시는 변경하지 않았다.
반입 당시 upstream `index-s2CVbjxO.js`의 SHA-256은
`B8A277A0C0F87F554B037BF1887A9B7E15677A8A60AE322914B04C4F28CB4D31`이다.
반입 당시 upstream `@rhwp/editor/index.js`의 SHA-256은
`058A1420077A12723C88CF2CC7F78A76C887DA91048669F1042D360F447353A7`이다.

### MIT License

Copyright (c) 2025-2026 Edward Kim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 상표 및 비제휴 고지

"한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표다. EasyFlow와 rhwp는 한글과컴퓨터와 제휴, 후원 또는 승인 관계가 없다.
