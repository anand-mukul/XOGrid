import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Zap } from 'lucide-react';

const DuelAnimation = ({ show }) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md overflow-hidden"
                >
                    <div className="relative flex items-center justify-center w-full h-full">
                        {/* Dramatic Thunder background flashes */}
                        <motion.div 
                            animate={{ 
                                opacity: [0, 0.8, 0, 0.4, 0, 1, 0],
                                scale: [1, 1.1, 1, 1.05, 1, 1.2, 1]
                            }}
                            transition={{ 
                                duration: 1.5, 
                                times: [0, 0.1, 0.2, 0.3, 0.4, 0.8, 1],
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 0.5
                            }}
                            className="absolute inset-0 bg-accent-cyan/10 pointer-events-none"
                        />
                        <motion.div 
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ delay: 0.8, duration: 0.2, ease: "easeInOut" }}
                            className="absolute inset-0 bg-white"
                        />

                        {/* Thunder Icon in center */}
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 2, 1], opacity: [0, 1, 1] }}
                            transition={{ delay: 0.7, duration: 0.4, type: "spring" }}
                            className="absolute"
                        >
                            <Zap className="w-48 h-48 sm:w-64 sm:h-64 text-accent-cyan opacity-40 blur-xl" />
                            <Zap className="w-48 h-48 sm:w-64 sm:h-64 absolute inset-0 text-white drop-shadow-[0_0_15px_rgba(34,211,238,1)]" />
                        </motion.div>

                        {/* Title text */}
                        <motion.div
                            initial={{ y: 50, opacity: 0, scale: 0.8 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 1, duration: 0.5, type: 'spring' }}
                            className="absolute bottom-1/4 flex flex-col items-center"
                        >
                            <h2 className="text-4xl sm:text-6xl font-display font-black text-white tracking-widest uppercase italic drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">Live Duel</h2>
                            <p className="text-accent-cyan/80 font-bold mt-2 tracking-widest uppercase text-sm sm:text-base">Match Found</p>
                        </motion.div>

                        {/* Left Sword */}
                        <motion.div
                            initial={{ x: '-150%', y: '100%', rotate: -90, opacity: 0 }}
                            animate={{ x: '-20%', y: '10%', rotate: 45, opacity: 1 }}
                            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                            className="absolute z-10"
                        >
                            <Swords className="w-32 h-32 sm:w-48 sm:h-48 text-accent-rose drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]" />
                        </motion.div>

                        {/* Right Sword */}
                        <motion.div
                            initial={{ x: '150%', y: '-100%', rotate: 90, opacity: 0 }}
                            animate={{ x: '20%', y: '-10%', rotate: 45, opacity: 1 }}
                            transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                            className="absolute z-10"
                        >
                            <Swords className="w-32 h-32 sm:w-48 sm:h-48 text-accent-violet drop-shadow-[0_0_20px_rgba(139,92,246,0.6)] object-scale-down transform scale-x-[-1]" />
                        </motion.div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DuelAnimation;
