import React from 'react';

const PATCH_NOTES = [
    {
        version: "v1.9.0",
        date: "2026-02-19",
        changes: [
            "새로운 게임 모드 3종 추가: 무정부 상태(세금 없음), 조커의 반란(무작위 랭크 조커), 블라인드(상대 패 수 비공개).",
            "게임 모드 UI 개선: 각 모드의 한글 이름과 상세 설명 툴팁을 추가하여 더욱 직관적으로 변경했습니다.",
            "모드 공개 연출 강화: 게임 시작 시 화려한 애니메이션과 함께 적용된 모드를 안내합니다.",
            "버그 수정 및 안정성 개선: 모드 적용 로직을 서버에서 검증하도록 강화했습니다."
        ]
    },
    {
        version: "v1.8.0",
        date: "2026-02-16",
        changes: [
            "게임 안정성 대폭 향상: 플레이어 이탈 시 자동 처리 로직(자리 선정 자동화, 세금 징수 예외 처리 등)을 강화했습니다.",
            "세금 징수 로직 개편: 중간에 플레이어가 나가도 세금 징수 대상이 유지되도록 구조를 변경하여 게임 진행이 멈추지 않습니다.",
            "UI/UX 개선: 내 손패 위치 이동(좌측 하단), 가로 스크롤 적용, 카드 개수 표시, 오프라인 배지 표시 로직 수정.",
            "방 관리 기능: 게임 중 모든 플레이어가 나가면 방이 즉시 삭제되도록 개선했습니다."
        ]
    },
    {
        version: "v1.7.0",
        date: "2026-02-11",
        changes: [
            "세금 징수 방식 변경: 농노(꼴찌)가 자동으로 가장 좋은 카드를 바치는 대신, 직접 바칠 카드를 선택하도록 변경되었습니다.",
            "방 설정 기능 개선: 방장이 대기실에서 턴 제한 시간을 설정할 수 있도록 변경되었습니다.",
            "방 나가기 버튼이 추가되었습니다.",
            "30분 이상 활동이 없는 방은 자동으로 삭제되도록 개선되었습니다."
        ]
    },
    {
        version: "v1.6.0",
        date: "2026-02-09",
        changes: [
            "혁명 기능 안정화: 조커 버리기 및 등급 교체 로직이 정상 작동하도록 수정했습니다.",
            "세금 징수 UI 개선: 달무티(1등)가 반환할 카드를 정상적으로 선택할 수 있도록 수정했습니다.",
            "카드 분배 방식 개선: 카드는 무작위로 분배되지만, 손패에서는 보기 좋게 자동 정렬됩니다.",
            "관전자 모드 강화: 관전자는 이제 모든 플레이어의 패를 볼 수 있습니다.",
            "채팅창 크기 조절 기능 및 UI 개선 (마지막 플레이어 이름 가로 표시)을 적용했습니다."
        ]
    },
    {
        version: "v1.5.0",
        date: "2026-02-05",
        changes: [
            "조커 2장으로 혁명을 선포하는 기능을 추가했습니다. (혁명 시 세금 면제)",
            "사용자 닉네임을 최대 16글자로 제한하는 기능을 추가했습니다.",
            "첫 번째 라운드에서도 세금 징수와 혁명이 가능하도록 게임 규칙을 수정했습니다.",
            "혁명 선포 시 조커 2장이 즉시 버려지도록 로직을 개선했습니다."
        ]
    },
    {
        version: "v1.4.0",
        date: "2026-02-04",
        changes: [
            "한국어와 영어 다국어 지원(i18n) 기능을 추가했습니다.",
            "우측 상단에 언어 변경 버튼을 추가하여 실시간 언어 전환이 가능해졌습니다.",
            "신분(계급)에 따라 카드를 교환하는 '세금 징수' 단계를 구현했습니다.",
            "농노(꼴찌)가 자동으로 가장 좋은 카드를 세금으로 내도록 시스템을 구축했습니다."
        ]
    },
    {
        version: "v1.3.0",
        date: "2026-02-04",
        changes: [
            "게임 도중 참여하는 관전자가 다음 라운드에 합류하는 기능을 추가했습니다.",
            "대기자와 농노가 자리를 두고 경쟁하는 '도전자 페이즈'를 구현했습니다.",
            "관전자 모드 UI를 개선하여 현재 진행 상황을 알 수 있도록 수정했습니다."
        ]
    },
    {
        version: "v1.2.0",
        date: "2026-02-03",
        changes: [
            "대기실에서 생성된 방 목록을 볼 수 있는 기능을 추가했습니다.",
            "카드 뒷면을 클릭하여 초기 계급을 정하는 '자리 선정' 단계를 추가했습니다.",
            "원형 테이블 형태로 좌석 배치를 시각적으로 개선했습니다."
        ]
    },
    {
        version: "v1.0.0",
        date: "2026-02-02",
        changes: [
            "위대한 달무티 게임의 기본 로직을 구현했습니다.",
            "방 생성, 입장, 채팅 등 멀티플레이어 기본 기능을 구축했습니다."
        ]
    }
];

export default function PatchNotes() {
    return (
        <div className="backdrop-blur-lg bg-slate-900/60 p-6 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] border border-slate-700/50 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full mix-blend-screen filter blur-[80px] pointer-events-none"></div>

            <h2 className="text-xl font-extrabold mb-4 pb-4 border-b border-slate-700/50 relative z-10 flex items-center gap-2">
                <span>📜</span>
                <span className="bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text tracking-tight">Patch Notes</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar relative z-10 relative">
                {PATCH_NOTES.map((note, index) => (
                    <div key={index} className="text-sm bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/50 transition-all duration-300">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-slate-100 text-lg bg-slate-900/50 px-2 py-0.5 rounded-md shadow-inner">
                                {note.version}
                            </span>
                            <span className="text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md text-xs font-semibold border border-purple-500/20">
                                {note.date}
                            </span>
                        </div>
                        <ul className="list-disc list-outside ml-4 space-y-1.5 text-slate-300/90 marker:text-purple-400">
                            {note.changes.map((change, i) => (
                                <li key={i} className="leading-snug">{change}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-500 text-center font-medium relative z-10">
                Latest Updates & Details
            </div>
        </div>
    );
}
