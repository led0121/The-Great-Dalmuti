import React from 'react';

const PATCH_NOTES = [
    {
        version: "v1.3.0",
        date: "2026-02-04",
        changes: [
            "ADDED: Spectator Mode - Watch games in progress while waiting",
            "ADDED: Challenger Phase - New players compete with Great Peon for rank",
            "FIXED: Game Start logic for small groups (Min 2 players)",
            "ADDED: Room List & Patch Notes UI"
        ]
    },
    {
        version: "v1.2.0",
        date: "2026-02-04",
        changes: [
            "ADDED: Room List View - See all active rooms in lobby",
            "ADDED: Seat Selection Phase - Draw cards to decide initial ranks",
            "IMPROVED: Round Table UI - Players seated in a circle",
            "IMPROVED: Strict Card Validation - Invalid cards are grayed out",
            "FIXED: Game Start logic for small groups (Min 2 players)"
        ]
    },
    {
        version: "v1.1.0",
        date: "2026-02-03",
        changes: [
            "ADDED: Taxation Phase - Automatic and Manual card exchange",
            "ADDED: Market Phase - Real-time card trading",
            "ADDED: In-Game Help (Rules Modal)",
            "IMPROVED: Chat Window is now draggable"
        ]
    },
    {
        version: "v1.0.0",
        date: "2026-02-02",
        changes: [
            "Initial Release",
            "Basic Game Logic (Dalmuti Rules)",
            "Lobby & Room Management"
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
