import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { AuthContext } from '../../context/AuthContext';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const authContext = useContext(AuthContext);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Lưu token vào localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', username);
                
                // Update auth context
                if (authContext) {
                    authContext.setToken(data.token);
                    authContext.setUser(username);
                }

                // Redirect to dashboard
                navigate('/');
            } else {
                setError(data.error || 'Đăng nhập thất bại');
            }
        } catch (err) {
            setError('Lỗi kết nối. Vui lòng thử lại.');
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDemoLogin = () => {
        setUsername('admin');
        setPassword('password');
    };

    return (
        /* NỀN ĐỘNG (Mesh Gradient) với các đốm sáng mờ ảo */
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
            
            {/* Các hình tròn tạo hiệu ứng Glow */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none"></div>

            {/* CARD GLASSMORPHISM */}
            <Card className="w-full max-w-md shadow-2xl border-white/10 bg-white/95 backdrop-blur-xl relative z-10">
                <CardHeader className="text-center pb-6 pt-8">
                    <div className="mx-auto bg-gradient-to-tr from-blue-600 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30 transform rotate-3">
                        <span className="text-3xl transform -rotate-3">🏠</span>
                    </div>
                    <CardTitle className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-800 to-indigo-800">
                        Smart Home
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-2 font-medium tracking-wide uppercase">
                        Hệ thống điều khiển trung tâm
                    </p>
                </CardHeader>
                
                <CardContent className="px-8 pb-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <Alert variant="destructive" className="bg-red-50 text-red-600 border-red-200">
                                <AlertDescription className="font-medium">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
                                Tên người dùng
                            </label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Nhập admin..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                                required
                                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                                Mật khẩu
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                required
                                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-blue-500/25"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Đang kết nối...' : 'Đăng nhập hệ thống'}
                        </Button>

                        {/* THANH NGĂN CÁCH VÀ NÚT DEMO */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-slate-400 font-medium text-xs uppercase tracking-wider">
                                    Hoặc
                                </span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDemoLogin}
                            className="w-full h-11 border-dashed border-2 border-slate-300 text-slate-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-all font-medium"
                        >
                            ⚡ Điền nhanh tài khoản Demo
                        </Button>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}