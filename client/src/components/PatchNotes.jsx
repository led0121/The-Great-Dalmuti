import React from 'react';

const PATCH_NOTES = [
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
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 h-full overflow-y-auto max-h-[600px]">
            <h2 className="text-xl font-bold mb-4 text-purple-300 border-b border-gray-600 pb-2">📜 Patch Notes</h2>
            <div className="space-y-6">
                {PATCH_NOTES.map((note, index) => (
                    <div key={index} className="text-sm">
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="font-bold text-white text-lg">{note.version}</span>
                            <span className="text-gray-400 text-xs">{note.date}</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                            {note.changes.map((change, i) => (
                                <li key={i}>{change}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="mt-4 text-xs text-gray-500 text-center">
                Dev Note: Update PATCH_NOTES in PatchNotes.jsx
            </div>
        </div>
    );
}
