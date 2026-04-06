import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const SlideToGoogleAuth = ({ onLoginSuccess, onLoginError, isLoading }) => {
    const [isTriggered, setIsTriggered] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle' | 'success' | 'error'
    const containerRef = useRef(null);
    const x = useMotionValue(0);
    const controls = useAnimation();
    const [maxSlide, setMaxSlide] = useState(200);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateMaxSlide = () => {
            setMaxSlide(el.offsetWidth - 60);
        };
        updateMaxSlide();

        const observer = new ResizeObserver(updateMaxSlide);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isLoading && isTriggered && status === 'idle') {
            resetSlider('error');
        }
    }, [isLoading]);

    const resetSlider = useCallback((newStatus = 'idle') => {
        setStatus(newStatus);
        setIsTriggered(false);
        controls.start({ 
            x: 0, 
            transition: { type: 'spring', stiffness: 600, damping: 25, mass: 1 } 
        });
        
        if (newStatus !== 'idle') {
            setTimeout(() => setStatus('idle'), 2000);
        }
    }, [controls]);

    const loginWithGoogle = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            onLoginSuccess(tokenResponse);
        },
        onError: () => {
            onLoginError();
            resetSlider('error');
        },
        onNonOAuthError: () => {
            onLoginError();
            resetSlider('error');
        }
    });

    const handleDragEnd = (event, info) => {
        if (isLoading || isTriggered) return;
        
        if (info.offset.x > maxSlide * 0.7) { 
            setIsTriggered(true);
            setStatus('idle');
            controls.start({ x: maxSlide, transition: { type: 'spring', stiffness: 400, damping: 30 } });
            loginWithGoogle();
        } else {
            resetSlider('idle');
        }
    };
    
    const bgOpacity = useTransform(x, [0, maxSlide], [0, 1]);
    const trackHighlightWidth = useTransform(x, [0, maxSlide], [24, maxSlide + 48]);
    const textOpacity = useTransform(x, [0, maxSlide * 0.5], [1, 0]);

    return (
        <div className="relative w-full group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-cyan/20 to-accent-violet/20 rounded-full blur opacity-0 group-hover:opacity-50 transition duration-500" />
            <motion.div 
                ref={containerRef}
                className={`relative w-full h-14 rounded-full overflow-hidden flex items-center justify-center cursor-pointer border border-white/5 bg-[#0f131f] touch-none select-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] transition-colors ${status === 'error' ? 'border-accent-rose' : 'hover:border-white/10'}`}
                animate={status === 'error' ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
            >
                <motion.div 
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-accent-cyan/20 to-accent-violet/30 rounded-full z-0"
                    style={{ width: trackHighlightWidth, opacity: bgOpacity }}
                />

                {status === 'error' && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-accent-rose/20 rounded-full z-0 pointer-events-none" />
                )}

                <motion.div 
                    className="absolute inset-0 flex items-center justify-center font-semibold text-sm text-text-primary z-0 pointer-events-none drop-shadow-md"
                    style={{ opacity: status === 'error' ? 1 : textOpacity }}
                >
                    {status === 'error' ? <span className="text-accent-rose">Sign-in Failed</span> : isLoading ? 'Connecting...' : 'Slide to Continue with Google'}
                </motion.div>

                {!isLoading && !isTriggered && status === 'idle' && (
                    <div className="absolute right-4 flex items-center z-0 opacity-50">
                        <motion.div animate={{ x: [0, 5, 0], opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}>
                            <ChevronRight className="w-4 h-4 text-accent-cyan/70" />
                        </motion.div>
                        <motion.div animate={{ x: [0, 5, 0], opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}>
                            <ChevronRight className="w-4 h-4 text-accent-cyan/70" />
                        </motion.div>
                        <motion.div animate={{ x: [0, 5, 0], opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}>
                            <ChevronRight className="w-4 h-4 text-accent-cyan/70" />
                        </motion.div>
                    </div>
                )}

                <motion.div
                    className="absolute left-1 z-10 w-12 h-12 bg-surface-elevated/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/5"
                    drag={!isLoading && !isTriggered && status === 'idle' ? "x" : false}
                    dragConstraints={containerRef}
                    dragElastic={0.05}
                    dragMomentum={false}
                    style={{ x }}
                    animate={controls}
                    onDragEnd={handleDragEnd}
                    whileDrag={{ scale: 1.05, cursor: "grabbing" }}
                    whileHover={{ scale: 1.02 }}
                >
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm pointer-events-none">
                        {status === 'error' ? (
                            <X className="w-4 h-4 text-accent-rose stroke-[3]" />
                        ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default SlideToGoogleAuth;
