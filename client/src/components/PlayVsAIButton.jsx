import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronDown } from 'lucide-react';

const PlayVsAIButton = ({ onSelectDifficulty }) => {
    const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);

    return (
        <div className="relative w-full h-[74px]">
            {/* HARD BUTTON (z-10) */}
            <motion.button
                animate={{
                    left: showDifficultyPicker ? "calc(60% + 6px)" : "0%",
                    opacity: showDifficultyPicker ? 1 : 0
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: showDifficultyPicker ? 0.15 : 0 }}
                style={{ width: "calc(40% - 6px)" }}
                onClick={() => { setShowDifficultyPicker(false); onSelectDifficulty('hard'); }}
                className="absolute top-0 bottom-0 z-10 cursor-pointer flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface-secondary/80 hover:bg-surface-elevated hover:border-accent-emerald/30 outline-none transition-colors overflow-hidden whitespace-nowrap"
            >
                <p className="text-sm font-semibold text-text-primary">Hard</p>
                <p className="text-[10px] text-text-muted mt-0.5">Unbeatable AI</p>
            </motion.button>

            {/* MEDIUM BUTTON (z-20) */}
            <motion.button
                animate={{
                    left: showDifficultyPicker ? "calc(25% + 3px)" : "0%",
                    opacity: showDifficultyPicker ? 1 : 0
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: showDifficultyPicker ? 0.25 : 0 }}
                style={{ width: "calc(35% - 5px)" }}
                onClick={() => { setShowDifficultyPicker(false); onSelectDifficulty('medium'); }}
                className="absolute top-0 bottom-0 z-20 cursor-pointer flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface-secondary/80 hover:bg-surface-elevated hover:border-accent-emerald/30 outline-none transition-colors overflow-hidden whitespace-nowrap"
            >
                <p className="text-sm font-semibold text-text-primary">Medium</p>
                <p className="text-[10px] text-text-muted mt-0.5">Some strategy</p>
            </motion.button>

            {/* MAIN TOGGLE BUTTON (z-30) */}
            <motion.button
                animate={{ width: showDifficultyPicker ? "calc(25% - 5px)" : "100%" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setShowDifficultyPicker(v => !v)}
                className="group absolute left-0 top-0 bottom-0 z-30 cursor-pointer bg-background border border-border-subtle rounded-xl outline-none transition-[border-color,transform] hover:border-accent-emerald/30 overflow-hidden active:scale-[0.99]"
            >
                {/* Solid blocking layer with hover states */}
                <div className="absolute inset-0 bg-surface-secondary/50 group-hover:bg-surface-secondary transition-colors pointer-events-none" />

                {/* Unified Flex Container */}
                <div className="absolute inset-0 flex items-center px-4">
                    
                    {/* Single Unified Bot Icon */}
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-accent-emerald/10 flex items-center justify-center shadow-sm">
                        <Bot className="w-5 h-5 text-accent-emerald" />
                    </div>

                    {/* Back Arrow (Visible only when Open, right of Bot) */}
                    <motion.div
                        initial={false}
                        animate={{ 
                            width: showDifficultyPicker ? 16 : 0,
                            opacity: showDifficultyPicker ? 1 : 0,
                            marginLeft: showDifficultyPicker ? 8 : 0
                        }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-center overflow-hidden shrink-0"
                    >
                        <ChevronDown className="w-4 h-4 text-text-muted -rotate-90 shrink-0" />
                    </motion.div>

                    {/* Text and Right Arrow (Visible only when Closed) */}
                    <motion.div
                        initial={false}
                        animate={{ opacity: showDifficultyPicker ? 0 : 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex items-center gap-3 sm:gap-4 ml-3 sm:ml-4 min-w-0"
                    >
                        <div className="flex-1 text-left min-w-0">
                            <p className="font-semibold text-text-primary text-sm whitespace-nowrap">Play vs AI</p>
                            <p className="text-text-muted text-xs whitespace-nowrap">Choose difficulty</p>
                        </div>
                        <ChevronDown className="w-4 h-4 shrink-0 text-text-muted rotate-90 ml-auto" />
                    </motion.div>
                </div>
            </motion.button>
        </div>
    );
};

export default PlayVsAIButton;
