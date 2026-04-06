import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        const token = user?.token;

        if (token) {
            // Strip '/api' if VITE_API_URL includes it, since socket just needs the domain
            const socketUrl = import.meta.env.VITE_API_URL
                ? import.meta.env.VITE_API_URL.replace('/api', '')
                : 'http://localhost:5000';
            
            const newSocket = io(socketUrl, {
                auth: { token },
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000,
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            newSocket.on('connect_error', (err) => {
                console.warn('Socket connection error:', err.message);
            });

            return () => {
                newSocket.close();
                socketRef.current = null;
            };
        } else {
            // No token — disconnect any existing socket
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            setSocket(null);
        }
    }, [user?.token]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
