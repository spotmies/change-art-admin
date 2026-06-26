import { RouterProvider } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { router } from './router';
import { QueryProvider } from './providers/QueryProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SocketProvider } from './providers/SocketProvider';
import { ThemeProvider } from './providers/ThemeProvider';

/**
 * Root component. Wires global providers (theme, auth, query cache,
 * websocket) around the router. Order matters: Theme → Query → Auth → Socket
 * so the socket has both a session and a cache to invalidate against.
 */
export function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <SocketProvider>
            <RouterProvider router={router} />
            <Toaster
              position="top-center"
              gutter={10}
              toastOptions={{
                duration: 2500,
                style: {
                  background: 'var(--glass-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(20px)',
                  fontSize: '13px',
                },
              }}
            >
              {(t) => (
                <ToastBar toast={t}>
                  {({ icon, message }) => (
                    <>
                      {icon}
                      {message}
                      {t.type !== 'loading' && (
                        <button
                          type="button"
                          onClick={() => toast.dismiss(t.id)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            marginLeft: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.5,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = '0.5')}
                          aria-label="Dismiss toast"
                        >
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </ToastBar>
              )}
            </Toaster>
          </SocketProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
