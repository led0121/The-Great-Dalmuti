import { motion } from 'framer-motion'

export default function Card({ card, isSelected, onClick, isPlayable = true, size = 'normal' }) {
    // Rank Colors
    const getRankColor = (rank) => {
        if (rank === 13) return 'bg-purple-600 border-purple-400' // Joker
        if (rank === 1) return 'bg-yellow-500 border-yellow-300' // Dalmuti
        if (rank <= 4) return 'bg-red-600 border-red-400'
        if (rank <= 8) return 'bg-blue-600 border-blue-400'
        if (rank <= 11) return 'bg-green-600 border-green-400'
        return 'bg-gray-500 border-gray-400' // Peon (12)
    }

    // Sprite logic: 4 columns, 4 rows (1-12 + Joker)
    // Grid 4x4
    const getSpritePosition = (rank) => {
        let index = rank - 1; // 0-based index for 1..12
        if (rank === 13) index = 12; // Joker is 13th item (index 12)

        const col = index % 4;
        const row = Math.floor(index / 4);

        // Assuming 4x4 grid, percentage is 0%, 33.33%, 66.66%, 100%
        // background-position x y
        const x = col * (100 / 3);
        const y = row * (100 / 3); // 4 rows? Wait.
        // If there are 4 columns, the positions are 0, 33.3, 66.6, 100.
        // If there are 4 rows, same.
        // Let's verify row count. 13 items needs 4 rows (4, 4, 4, 1).
        // Row 0: 1,2,3,4. Row 1: 5,6,7,8. Row 2: 9,10,11,12. Row 3: 13,.,.,.

        return `${x}% ${y}%`;
    }

    const baseClasses = "rounded-lg shadow-md border-2 flex flex-col items-center justify-between select-none cursor-pointer transition-transform relative overflow-hidden text-center p-1 bg-[#f0e6d2]"
    const sizeClasses = size === 'small' ? 'w-14 h-20 text-xs' : 'w-32 h-48 text-xl'
    const stateClasses = isSelected ? 'ring-4 ring-yellow-400 -translate-y-4 z-10' : 'hover:-translate-y-2'
    // const rankColor = getRankColor(card.rank) // Unused

    return (
        <motion.div
            layoutId={card.id}
            onClick={onClick}
            className={`${baseClasses} ${sizeClasses} ${stateClasses} ${!isPlayable ? 'opacity-50 grayscale' : ''}`}
            style={{ borderColor: card.rank === 13 ? '#9333ea' : '#854d0e' }} // Override border
            whileHover={{ y: -5 }} // Just move up, don't scale
            whileTap={{ y: 0 }}
        >
            {/* Top Number */}
            <div className="w-full flex justify-between px-1 font-bold text-gray-900 border-b border-gray-300/50 pb-1">
                <span>{card.rank === 13 ? 'J' : card.rank}</span>
                <span className="text-[0.6em] opacity-70 self-center">
                    {card.rank === 1 ? 'Dalmuti' : card.rank === 12 ? 'Peon' : ''}
                </span>
            </div>

            {/* Image Area */}
            <div
                className="w-full h-full bg-no-repeat rounded-sm my-1 filter sepia-[.3] contrast-125"
                style={{
                    backgroundImage: 'url(/cards_sprite.png)',
                    backgroundSize: '400% 400%', // 4 columns -> 400% width
                    backgroundPosition: getSpritePosition(card.rank)
                }}
            />

            {/* Bottom Number (Inverted) */}
            <div className="w-full text-right px-1 font-bold text-gray-900 rotate-180 border-b border-gray-300/50 pb-1">
                {card.rank === 13 ? 'J' : card.rank}
            </div>
        </motion.div>
    )
}
